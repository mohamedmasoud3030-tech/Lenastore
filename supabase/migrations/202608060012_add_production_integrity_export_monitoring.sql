create table if not exists public.client_error_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  actor_id uuid not null,
  message text not null,
  stack text,
  path text,
  user_agent text,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.client_error_events enable row level security;
drop policy if exists client_error_events_select on public.client_error_events;
create policy client_error_events_select
on public.client_error_events
for select to authenticated
using (public.owns_project(project_id));
revoke all on public.client_error_events from anon, authenticated;
grant select on public.client_error_events to authenticated;

create or replace function public.report_client_error(
  p_project_id uuid,
  p_message text,
  p_stack text,
  p_path text,
  p_user_agent text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_message text;
begin
  if auth.uid() is null or not public.owns_project(p_project_id) then
    raise exception 'unauthorized';
  end if;

  v_message := nullif(btrim(left(coalesce(p_message, ''), 2000)), '');
  if v_message is null then
    raise exception 'error message is required';
  end if;

  insert into public.client_error_events(project_id, actor_id, message, stack, path, user_agent)
  values (
    p_project_id,
    auth.uid(),
    v_message,
    nullif(left(coalesce(p_stack, ''), 10000), ''),
    nullif(left(coalesce(p_path, ''), 1000), ''),
    nullif(left(coalesce(p_user_agent, ''), 1000), '')
  )
  returning id into v_id;

  return v_id;
end;
$$;
revoke all on function public.report_client_error(uuid,text,text,text,text) from public, anon;
grant execute on function public.report_client_error(uuid,text,text,text,text) to authenticated;

create or replace function public.system_integrity_report(p_project_id uuid)
returns table(
  check_name text,
  severity text,
  issue_count bigint,
  description text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or not public.owns_project(p_project_id) then
    raise exception 'unauthorized';
  end if;

  return query select 'negative_stock'::text, 'critical'::text, count(*)::bigint,
    'مواد رصيدها الحالي أقل من صفر'::text
  from public.material_stock ms where ms.project_id=p_project_id and ms.current_stock<0;

  return query select 'purchase_item_total_mismatch'::text, 'critical'::text, count(*)::bigint,
    'بنود شراء لا يساوي إجماليها الكمية × سعر الوحدة'::text
  from public.purchase_items pi join public.purchases p on p.id=pi.purchase_id
  where p.project_id=p_project_id and pi.total<>round(pi.quantity*pi.unit_price,2);

  return query select 'purchase_total_mismatch'::text, 'critical'::text, count(*)::bigint,
    'أوامر شراء لا يطابق إجماليها البنود والخصم والضريبة والنقل'::text
  from public.purchases p where p.project_id=p_project_id
    and p.total<>round(p.subtotal-p.discount+p.tax+p.transport_cost,2);

  return query select 'received_over_ordered'::text, 'critical'::text, count(*)::bigint,
    'بنود استلام تجاوزت الكمية المطلوبة'::text
  from public.purchase_items pi join public.purchases p on p.id=pi.purchase_id
  where p.project_id=p_project_id and pi.received_quantity>pi.quantity;

  return query select 'received_quantity_mismatch'::text, 'critical'::text, count(*)::bigint,
    'الكمية المستلمة في أمر الشراء لا تطابق سندات الاستلام الفعالة'::text
  from public.purchase_items pi
  join public.purchases p on p.id=pi.purchase_id
  left join lateral (
    select coalesce(sum(gri.received_quantity),0)::numeric(18,3) qty
    from public.goods_receipt_items gri
    join public.goods_receipts gr on gr.id=gri.goods_receipt_id
    where gri.purchase_item_id=pi.id and gr.status='COMPLETED'
  ) x on true
  where p.project_id=p_project_id and pi.received_quantity<>x.qty;

  return query select 'receipt_status_mismatch'::text, 'high'::text, count(*)::bigint,
    'حالة استلام أمر الشراء لا تطابق كميات البنود'::text
  from public.purchases p
  where p.project_id=p_project_id and p.status='ACTIVE'
    and p.receipt_status<>case
      when not exists(select 1 from public.purchase_items pi where pi.purchase_id=p.id and pi.received_quantity<pi.quantity) then 'FULL'
      when exists(select 1 from public.purchase_items pi where pi.purchase_id=p.id and pi.received_quantity>0) then 'PARTIAL'
      else 'UNRECEIVED'
    end;

  return query select 'payment_over_net_payable'::text, 'critical'::text, count(*)::bigint,
    'المدفوع الفعال أكبر من صافي المستحق بعد المرتجعات'::text
  from public.purchase_balances pb where pb.project_id=p_project_id and pb.total_paid>pb.purchase_total;

  return query select 'cross_project_purchase_supplier'::text, 'critical'::text, count(*)::bigint,
    'أمر شراء مرتبط بمورد من مشروع آخر'::text
  from public.purchases p join public.suppliers s on s.id=p.supplier_id
  where p.project_id=p_project_id and s.project_id<>p.project_id;

  return query select 'cross_project_purchase_material'::text, 'critical'::text, count(*)::bigint,
    'بند شراء مرتبط بمادة من مشروع آخر'::text
  from public.purchase_items pi join public.purchases p on p.id=pi.purchase_id
  join public.materials m on m.id=pi.material_id
  where p.project_id=p_project_id and m.project_id<>p.project_id;

  return query select 'cross_project_request_material'::text, 'critical'::text, count(*)::bigint,
    'بند طلب شراء مرتبط بمادة من مشروع آخر'::text
  from public.purchase_request_items pri join public.purchase_requests pr on pr.id=pri.request_id
  join public.materials m on m.id=pri.material_id
  where pr.project_id=p_project_id and m.project_id<>pr.project_id;

  return query select 'reversed_payment_incomplete'::text, 'high'::text, count(*)::bigint,
    'دفعات معكوسة ينقصها السبب أو المنفذ أو وقت العكس'::text
  from public.payments pay where pay.project_id=p_project_id and pay.status='REVERSED'
    and (pay.reversed_at is null or pay.reversed_by is null or nullif(btrim(pay.reversal_reason),'') is null);

  return query select 'cancelled_receipt_missing_reversal'::text, 'critical'::text, count(*)::bigint,
    'بنود استلام ملغاة لا تملك حركة عكس مرتبطة بالأصل'::text
  from public.goods_receipt_items gri
  join public.goods_receipts gr on gr.id=gri.goods_receipt_id
  left join public.stock_movements sm on sm.source_receipt_item_id=gri.id
  left join public.stock_reversals sr on sr.original_movement_id=sm.id and sr.source_entity_type='GOODS_RECEIPT'
  where gr.project_id=p_project_id and gr.status='CANCELLED' and sr.id is null;

  return query select 'cancelled_issue_missing_reversal'::text, 'critical'::text, count(*)::bigint,
    'بنود صرف ملغاة لا تملك حركة عكس مرتبطة بالأصل'::text
  from public.stock_issue_items sii
  join public.stock_issues si on si.id=sii.stock_issue_id
  left join public.stock_reversals sr on sr.original_movement_id=sii.stock_movement_id and sr.source_entity_type='STOCK_ISSUE'
  where si.project_id=p_project_id and si.status='CANCELLED' and sr.id is null;

  return query select 'return_quantity_over_received'::text, 'critical'::text, count(*)::bigint,
    'إجمالي المرتجع لمادة تجاوز الكمية المستلمة'::text
  from public.purchase_items pi join public.purchases p on p.id=pi.purchase_id
  left join lateral (
    select coalesce(sum(pri.quantity),0)::numeric(18,3) qty
    from public.purchase_return_items pri join public.purchase_returns pr on pr.id=pri.purchase_return_id
    where pri.purchase_item_id=pi.id and pr.status='COMPLETED'
  ) r on true
  where p.project_id=p_project_id and r.qty>pi.received_quantity;

  return query select 'orphan_purchase_items'::text, 'critical'::text, count(*)::bigint,
    'بنود شراء بدون أمر شراء صالح'::text
  from public.purchase_items pi left join public.purchases p on p.id=pi.purchase_id
  where p.id is null;

  return query select 'unresolved_client_errors'::text, 'warning'::text, count(*)::bigint,
    'أخطاء واجهة غير معلّمة كمحلولة'::text
  from public.client_error_events ce where ce.project_id=p_project_id and ce.resolved=false;
end;
$$;
revoke all on function public.system_integrity_report(uuid) from public, anon;
grant execute on function public.system_integrity_report(uuid) to authenticated;

create or replace function public.export_project_snapshot(p_project_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_snapshot jsonb;
begin
  if auth.uid() is null or not public.owns_project(p_project_id) then raise exception 'unauthorized'; end if;
  select jsonb_build_object(
    'exported_at', now(), 'schema_version', '2026-08-06',
    'project', (select to_jsonb(p) from public.projects p where p.id=p_project_id),
    'materials', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at) from public.materials x where x.project_id=p_project_id),'[]'::jsonb),
    'suppliers', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at) from public.suppliers x where x.project_id=p_project_id),'[]'::jsonb),
    'purchase_requests', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at) from public.purchase_requests x where x.project_id=p_project_id),'[]'::jsonb),
    'purchase_request_items', coalesce((select jsonb_agg(to_jsonb(x)) from public.purchase_request_items x join public.purchase_requests r on r.id=x.request_id where r.project_id=p_project_id),'[]'::jsonb),
    'purchases', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at) from public.purchases x where x.project_id=p_project_id),'[]'::jsonb),
    'purchase_items', coalesce((select jsonb_agg(to_jsonb(x)) from public.purchase_items x join public.purchases p on p.id=x.purchase_id where p.project_id=p_project_id),'[]'::jsonb),
    'goods_receipts', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at) from public.goods_receipts x where x.project_id=p_project_id),'[]'::jsonb),
    'goods_receipt_items', coalesce((select jsonb_agg(to_jsonb(x)) from public.goods_receipt_items x join public.goods_receipts g on g.id=x.goods_receipt_id where g.project_id=p_project_id),'[]'::jsonb),
    'payments', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at) from public.payments x where x.project_id=p_project_id),'[]'::jsonb),
    'stock_issues', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at) from public.stock_issues x where x.project_id=p_project_id),'[]'::jsonb),
    'stock_issue_items', coalesce((select jsonb_agg(to_jsonb(x)) from public.stock_issue_items x join public.stock_issues s on s.id=x.stock_issue_id where s.project_id=p_project_id),'[]'::jsonb),
    'stock_movements', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at) from public.stock_movements x where x.project_id=p_project_id),'[]'::jsonb),
    'purchase_returns', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at) from public.purchase_returns x where x.project_id=p_project_id),'[]'::jsonb),
    'purchase_return_items', coalesce((select jsonb_agg(to_jsonb(x)) from public.purchase_return_items x join public.purchase_returns r on r.id=x.purchase_return_id where r.project_id=p_project_id),'[]'::jsonb),
    'audit_events', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at) from public.audit_events x where x.project_id=p_project_id),'[]'::jsonb),
    'client_error_events', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at) from public.client_error_events x where x.project_id=p_project_id),'[]'::jsonb),
    'attachments_metadata', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at) from public.attachments x where x.project_id=p_project_id),'[]'::jsonb)
  ) into v_snapshot;
  return v_snapshot;
end;
$$;
revoke all on function public.export_project_snapshot(uuid) from public, anon;
grant execute on function public.export_project_snapshot(uuid) to authenticated;

create or replace function public.seed_demo_project_if_empty(p_project_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid:=auth.uid();
  v_material_1 uuid:=gen_random_uuid();
  v_material_2 uuid:=gen_random_uuid();
  v_supplier uuid:=gen_random_uuid();
  v_request uuid;
  v_purchase uuid;
  v_purchase_item uuid;
begin
  if v_user is null or not public.owns_project(p_project_id) then raise exception 'unauthorized'; end if;
  if exists(select 1 from public.materials where project_id=p_project_id)
     or exists(select 1 from public.suppliers where project_id=p_project_id)
     or exists(select 1 from public.purchase_requests where project_id=p_project_id)
     or exists(select 1 from public.purchases where project_id=p_project_id)
     or exists(select 1 from public.stock_movements where project_id=p_project_id) then
    raise exception 'demo data can only be seeded into a completely empty project';
  end if;

  update public.projects set currency='EGP' where id=p_project_id;
  insert into public.materials(id,project_id,name,category,unit,min_stock,notes) values
  (v_material_1,p_project_id,'أسمنت بورتلاندي','مواد أساسية','كيس',20,'بيانات ديمو'),
  (v_material_2,p_project_id,'حديد تسليح 14 مم','معادن','طن',2,'بيانات ديمو');
  insert into public.suppliers(id,project_id,name,company,phone,tax_id,notes)
  values(v_supplier,p_project_id,'مورد الديمو','شركة التوريدات التجريبية','01000000000','DEMO-001','بيانات ديمو');

  v_request:=public.create_purchase_request_atomic(
    p_project_id,'PR-DEMO-001',current_date-7,'احتياج ديمو للموقع','NORMAL',current_date+3,'بيانات ديمو',
    jsonb_build_array(
      jsonb_build_object('material_id',v_material_1,'quantity',100),
      jsonb_build_object('material_id',v_material_2,'quantity',5)
    ),'demo-request-001'
  );
  v_purchase:=public.create_purchase_atomic(
    p_project_id,v_request,'PO-DEMO-001',v_supplier,current_date-6,'INV-DEMO-001',100,500,150,'أمر شراء تجريبي',
    jsonb_build_array(
      jsonb_build_object('material_id',v_material_1,'quantity',100,'unit_price',80),
      jsonb_build_object('material_id',v_material_2,'quantity',5,'unit_price',40000)
    ),'demo-purchase-001'
  );
  select id into v_purchase_item from public.purchase_items where purchase_id=v_purchase and material_id=v_material_1;
  perform public.receive_goods(
    p_project_id,v_purchase,'GR-DEMO-001',current_date-5,'استلام ديمو جزئي',
    jsonb_build_array(jsonb_build_object('purchase_item_id',v_purchase_item,'quantity',60)),'demo-receipt-001'
  );
  perform public.register_payment(
    p_project_id,v_purchase,50000,current_date-4,'TRANSFER','TRX-DEMO-001','دفعة ديمو','demo-payment-001'
  );
  perform public.issue_stock(
    p_project_id,'ISS-DEMO-001',current_date-3,'مهندس الموقع','منطقة الأساسات',null,'صرف ديمو',
    jsonb_build_array(jsonb_build_object('material_id',v_material_1,'quantity',10)),'demo-issue-001'
  );
  insert into public.audit_events(project_id,actor_id,event_type,entity_type,entity_id,reason,payload)
  values(p_project_id,v_user,'DEMO_DATA_SEEDED','PROJECT',p_project_id,'إنشاء بيانات ديمو آمنة',jsonb_build_object('purchase_id',v_purchase));
  return p_project_id;
end;
$$;
revoke all on function public.seed_demo_project_if_empty(uuid) from public, anon;
grant execute on function public.seed_demo_project_if_empty(uuid) to authenticated;

create or replace function public.seed_demo_data(p_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare v_project uuid:=gen_random_uuid();
begin
  if auth.uid() is null or p_user_id is distinct from auth.uid() then raise exception 'unauthorized'; end if;
  if not exists(select 1 from auth.users where id=p_user_id) then raise exception 'demo user does not exist'; end if;
  if exists(select 1 from public.projects where user_id=p_user_id) then raise exception 'user already has a project'; end if;
  insert into public.projects(id,user_id,name,location,manager_name,phone,start_date,owner_name,currency)
  values(v_project,p_user_id,'مشروع ديمو لينا سبلاي','القاهرة - مصر','مدير المشروع','01000000000',current_date,'شركة الديمو','EGP');
  perform public.seed_demo_project_if_empty(v_project);
  return v_project;
end;
$$;
revoke all on function public.seed_demo_data(uuid) from public, anon;
grant execute on function public.seed_demo_data(uuid) to authenticated;

notify pgrst, 'reload schema';
