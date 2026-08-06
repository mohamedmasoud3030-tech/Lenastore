create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  actor_id uuid not null,
  event_type varchar(80) not null,
  entity_type varchar(80) not null,
  entity_id uuid,
  reason text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.audit_events enable row level security;
drop policy if exists audit_events_select on public.audit_events;
create policy audit_events_select on public.audit_events
for select to authenticated
using (public.owns_project(project_id));
revoke all on public.audit_events from anon, authenticated;
grant select on public.audit_events to authenticated;

create table if not exists public.stock_reversals (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  original_movement_id uuid not null references public.stock_movements(id),
  reversal_movement_id uuid not null references public.stock_movements(id),
  source_entity_type varchar(40) not null,
  source_entity_id uuid not null,
  reason text not null,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  unique(original_movement_id),
  unique(reversal_movement_id)
);

alter table public.stock_reversals enable row level security;
drop policy if exists stock_reversals_select on public.stock_reversals;
create policy stock_reversals_select on public.stock_reversals
for select to authenticated
using (public.owns_project(project_id));
revoke all on public.stock_reversals from anon, authenticated;
grant select on public.stock_reversals to authenticated;

alter table public.payments
  add column if not exists status varchar(20) not null default 'POSTED',
  add column if not exists reversed_at timestamptz,
  add column if not exists reversed_by uuid,
  add column if not exists reversal_reason text,
  add column if not exists reversal_idempotency_key varchar(100);

alter table public.payments drop constraint if exists payments_status_check;
alter table public.payments add constraint payments_status_check check (status in ('POSTED','REVERSED'));
create unique index if not exists payments_project_reversal_idempotency_uidx
  on public.payments(project_id, reversal_idempotency_key)
  where reversal_idempotency_key is not null;

alter table public.goods_receipts
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid,
  add column if not exists cancellation_reason text,
  add column if not exists cancellation_idempotency_key varchar(100);

create unique index if not exists goods_receipts_project_cancellation_idempotency_uidx
  on public.goods_receipts(project_id, cancellation_idempotency_key)
  where cancellation_idempotency_key is not null;

alter table public.stock_issues
  add column if not exists status varchar(20) not null default 'COMPLETED',
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid,
  add column if not exists cancellation_reason text,
  add column if not exists cancellation_idempotency_key varchar(100);

alter table public.stock_issues drop constraint if exists stock_issues_status_check;
alter table public.stock_issues add constraint stock_issues_status_check check (status in ('COMPLETED','CANCELLED'));
create unique index if not exists stock_issues_project_cancellation_idempotency_uidx
  on public.stock_issues(project_id, cancellation_idempotency_key)
  where cancellation_idempotency_key is not null;

alter table public.stock_issue_items
  add column if not exists stock_movement_id uuid references public.stock_movements(id);
create unique index if not exists stock_issue_items_stock_movement_uidx
  on public.stock_issue_items(stock_movement_id)
  where stock_movement_id is not null;

create or replace view public.purchase_balances
with (security_invoker = true)
as
select
  p.id as purchase_id,
  p.project_id,
  p.total as purchase_total,
  coalesce(sum(pay.amount) filter (where pay.status = 'POSTED'), 0)::numeric(18,2) as total_paid,
  (p.total - coalesce(sum(pay.amount) filter (where pay.status = 'POSTED'), 0))::numeric(18,2) as remaining_balance,
  case
    when coalesce(sum(pay.amount) filter (where pay.status = 'POSTED'), 0) = 0 then 'UNPAID'::text
    when coalesce(sum(pay.amount) filter (where pay.status = 'POSTED'), 0) >= p.total then 'PAID'::text
    else 'PARTIAL'::text
  end as payment_status
from public.purchases p
left join public.payments pay on pay.purchase_id = p.id
group by p.id, p.project_id, p.total;

create or replace view public.supplier_balances
with (security_invoker = true)
as
select
  s.id as supplier_id,
  s.project_id,
  s.name,
  coalesce(sum(pb.purchase_total), 0)::numeric(18,2) as total_purchases,
  coalesce(sum(pb.total_paid), 0)::numeric(18,2) as total_paid,
  coalesce(sum(pb.remaining_balance), 0)::numeric(18,2) as remaining_balance
from public.suppliers s
left join public.purchases p on p.supplier_id = s.id
left join public.purchase_balances pb on pb.purchase_id = p.id
group by s.id, s.project_id, s.name;

create or replace function public.reverse_payment(
  p_project_id uuid,
  p_payment_id uuid,
  p_reason text,
  p_idempotency_key varchar
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_payment public.payments%rowtype;
  v_reason text;
  v_key varchar(100);
begin
  if auth.uid() is null or not public.owns_project(p_project_id) then
    raise exception 'unauthorized';
  end if;
  v_reason := nullif(btrim(p_reason), '');
  if v_reason is null then raise exception 'reversal reason is required'; end if;
  v_key := btrim(coalesce(p_idempotency_key, ''));
  if v_key = '' or length(v_key) > 100 then raise exception 'invalid idempotency key'; end if;

  select * into v_payment
  from public.payments
  where id = p_payment_id and project_id = p_project_id
  for update;
  if not found then raise exception 'payment not found or unauthorized'; end if;

  if v_payment.status = 'REVERSED' then
    if v_payment.reversal_idempotency_key is distinct from v_key
       or v_payment.reversal_reason is distinct from v_reason then
      raise exception 'payment already reversed with different payload';
    end if;
    return v_payment.id;
  end if;

  update public.payments
  set status = 'REVERSED', reversed_at = now(), reversed_by = auth.uid(),
      reversal_reason = v_reason, reversal_idempotency_key = v_key
  where id = v_payment.id;

  insert into public.audit_events(project_id, actor_id, event_type, entity_type, entity_id, reason, payload)
  values (p_project_id, auth.uid(), 'PAYMENT_REVERSED', 'PAYMENT', v_payment.id, v_reason,
          jsonb_build_object('purchase_id', v_payment.purchase_id, 'amount', v_payment.amount, 'date', v_payment.date, 'method', v_payment.method));
  return v_payment.id;
end;
$$;
revoke all on function public.reverse_payment(uuid,uuid,text,varchar) from public, anon;
grant execute on function public.reverse_payment(uuid,uuid,text,varchar) to authenticated;

create or replace function public.cancel_goods_receipt(
  p_project_id uuid,
  p_receipt_id uuid,
  p_reversal_date date,
  p_reason text,
  p_idempotency_key varchar
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_receipt public.goods_receipts%rowtype;
  v_item record;
  v_original_movement public.stock_movements%rowtype;
  v_reversal_movement_id uuid;
  v_balance numeric(18,3);
  v_reason text;
  v_key varchar(100);
begin
  if auth.uid() is null or not public.owns_project(p_project_id) then raise exception 'unauthorized'; end if;
  if p_reversal_date is null then raise exception 'reversal date is required'; end if;
  v_reason := nullif(btrim(p_reason), '');
  if v_reason is null then raise exception 'cancellation reason is required'; end if;
  v_key := btrim(coalesce(p_idempotency_key, ''));
  if v_key = '' or length(v_key) > 100 then raise exception 'invalid idempotency key'; end if;

  select * into v_receipt
  from public.goods_receipts
  where id = p_receipt_id and project_id = p_project_id
  for update;
  if not found then raise exception 'goods receipt not found or unauthorized'; end if;

  if v_receipt.status = 'CANCELLED' then
    if v_receipt.cancellation_idempotency_key is distinct from v_key
       or v_receipt.cancellation_reason is distinct from v_reason then
      raise exception 'goods receipt already cancelled with different payload';
    end if;
    return v_receipt.id;
  end if;

  perform 1 from public.purchases p where p.id = v_receipt.purchase_id and p.project_id = p_project_id for update;

  for v_item in
    select gri.*, pi.received_quantity as purchase_received_quantity
    from public.goods_receipt_items gri
    join public.purchase_items pi on pi.id = gri.purchase_item_id
    where gri.goods_receipt_id = v_receipt.id
    order by gri.material_id
  loop
    perform pg_advisory_xact_lock(hashtextextended(v_item.material_id::text, 0));
    select coalesce(sum(case when sm.type='IN' then sm.quantity else -sm.quantity end),0)::numeric(18,3)
    into v_balance from public.stock_movements sm
    where sm.project_id = p_project_id and sm.material_id = v_item.material_id;
    if v_balance < v_item.received_quantity then
      raise exception 'cannot cancel receipt because material % has already been consumed. available: %, required: %', v_item.material_id, v_balance, v_item.received_quantity;
    end if;

    select * into v_original_movement
    from public.stock_movements sm
    where sm.source_receipt_item_id = v_item.id and sm.project_id = p_project_id and sm.type = 'IN'
    for update;
    if not found then raise exception 'original receipt stock movement not found'; end if;

    insert into public.stock_movements(project_id,type,material_id,quantity,date,reference_number,receiver_name,location_used,notes,created_by)
    values (p_project_id,'OUT',v_item.material_id,v_item.received_quantity,p_reversal_date,
            'REV-' || v_receipt.receipt_number,'إلغاء استلام',null,v_reason,auth.uid())
    returning id into v_reversal_movement_id;

    insert into public.stock_reversals(project_id,original_movement_id,reversal_movement_id,source_entity_type,source_entity_id,reason,created_by)
    values (p_project_id,v_original_movement.id,v_reversal_movement_id,'GOODS_RECEIPT',v_receipt.id,v_reason,auth.uid());

    update public.purchase_items
    set received_quantity = greatest(0, received_quantity - v_item.received_quantity)
    where id = v_item.purchase_item_id;
  end loop;

  update public.goods_receipts
  set status='CANCELLED', cancelled_at=now(), cancelled_by=auth.uid(),
      cancellation_reason=v_reason, cancellation_idempotency_key=v_key
  where id=v_receipt.id;

  update public.purchases p
  set receipt_status = case
    when not exists(select 1 from public.purchase_items pi where pi.purchase_id=p.id and pi.received_quantity < pi.quantity) then 'FULL'
    when exists(select 1 from public.purchase_items pi where pi.purchase_id=p.id and pi.received_quantity > 0) then 'PARTIAL'
    else 'UNRECEIVED'
  end
  where p.id=v_receipt.purchase_id;

  insert into public.audit_events(project_id,actor_id,event_type,entity_type,entity_id,reason,payload)
  values (p_project_id,auth.uid(),'GOODS_RECEIPT_CANCELLED','GOODS_RECEIPT',v_receipt.id,v_reason,
          jsonb_build_object('purchase_id',v_receipt.purchase_id,'receipt_number',v_receipt.receipt_number,'reversal_date',p_reversal_date));
  return v_receipt.id;
end;
$$;
revoke all on function public.cancel_goods_receipt(uuid,uuid,date,text,varchar) from public, anon;
grant execute on function public.cancel_goods_receipt(uuid,uuid,date,text,varchar) to authenticated;

create or replace function public.cancel_stock_issue(
  p_project_id uuid,
  p_issue_id uuid,
  p_reversal_date date,
  p_reason text,
  p_idempotency_key varchar
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_issue public.stock_issues%rowtype;
  v_item record;
  v_original_movement public.stock_movements%rowtype;
  v_reversal_movement_id uuid;
  v_reason text;
  v_key varchar(100);
begin
  if auth.uid() is null or not public.owns_project(p_project_id) then raise exception 'unauthorized'; end if;
  if p_reversal_date is null then raise exception 'reversal date is required'; end if;
  v_reason := nullif(btrim(p_reason), '');
  if v_reason is null then raise exception 'cancellation reason is required'; end if;
  v_key := btrim(coalesce(p_idempotency_key, ''));
  if v_key = '' or length(v_key) > 100 then raise exception 'invalid idempotency key'; end if;

  select * into v_issue from public.stock_issues
  where id=p_issue_id and project_id=p_project_id for update;
  if not found then raise exception 'stock issue not found or unauthorized'; end if;

  if v_issue.status='CANCELLED' then
    if v_issue.cancellation_idempotency_key is distinct from v_key
       or v_issue.cancellation_reason is distinct from v_reason then
      raise exception 'stock issue already cancelled with different payload';
    end if;
    return v_issue.id;
  end if;

  for v_item in select sii.* from public.stock_issue_items sii where sii.stock_issue_id=v_issue.id order by sii.material_id
  loop
    perform pg_advisory_xact_lock(hashtextextended(v_item.material_id::text,0));
    if v_item.stock_movement_id is not null then
      select * into v_original_movement from public.stock_movements where id=v_item.stock_movement_id for update;
    else
      select * into v_original_movement
      from public.stock_movements sm
      where sm.project_id=p_project_id and sm.material_id=v_item.material_id and sm.type='OUT' and sm.reference_number=v_issue.issue_number
      order by sm.created_at desc limit 1 for update;
    end if;
    if not found then raise exception 'original issue stock movement not found'; end if;

    insert into public.stock_movements(project_id,type,material_id,quantity,date,reference_number,receiver_name,location_used,notes,created_by)
    values (p_project_id,'IN',v_item.material_id,v_item.quantity,p_reversal_date,
            'REV-' || v_issue.issue_number,'إلغاء صرف',v_issue.destination,v_reason,auth.uid())
    returning id into v_reversal_movement_id;

    insert into public.stock_reversals(project_id,original_movement_id,reversal_movement_id,source_entity_type,source_entity_id,reason,created_by)
    values (p_project_id,v_original_movement.id,v_reversal_movement_id,'STOCK_ISSUE',v_issue.id,v_reason,auth.uid());
  end loop;

  update public.stock_issues
  set status='CANCELLED', cancelled_at=now(), cancelled_by=auth.uid(),
      cancellation_reason=v_reason, cancellation_idempotency_key=v_key
  where id=v_issue.id;

  insert into public.audit_events(project_id,actor_id,event_type,entity_type,entity_id,reason,payload)
  values (p_project_id,auth.uid(),'STOCK_ISSUE_CANCELLED','STOCK_ISSUE',v_issue.id,v_reason,
          jsonb_build_object('issue_number',v_issue.issue_number,'reversal_date',p_reversal_date));
  return v_issue.id;
end;
$$;
revoke all on function public.cancel_stock_issue(uuid,uuid,date,text,varchar) from public, anon;
grant execute on function public.cancel_stock_issue(uuid,uuid,date,text,varchar) to authenticated;

notify pgrst, 'reload schema';
