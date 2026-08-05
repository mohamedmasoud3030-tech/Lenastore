-- Lenastore Construction MVP — authoritative Supabase schema
-- Applied and verified on project bsrshhgjtnrvsckeqsmg on 2026-08-06.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path=public,pg_temp
as $$
begin
  new.updated_at=now();
  return new;
end;
$$;

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  name varchar(255) not null,
  location varchar(255), manager_name varchar(255), phone varchar(50),
  start_date date not null, owner_name varchar(255),
  currency char(3) not null default 'SAR', is_active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.materials (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name varchar(255) not null, category varchar(100), unit varchar(50) not null,
  min_stock numeric(18,3) not null default 0 check(min_stock>=0), notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(project_id,name)
);

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name varchar(255) not null, company varchar(255), phone varchar(50), tax_id varchar(100), notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.purchase_requests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  request_number varchar(100) not null, date date not null, reason text,
  priority varchar(50) not null default 'NORMAL' check(priority in('NORMAL','URGENT')),
  needed_date date,
  status varchar(50) not null default 'DRAFT' check(status in('DRAFT','REQUESTED','PURCHASING','PURCHASED','CANCELLED')),
  notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(project_id,request_number)
);

create table public.purchase_request_items (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.purchase_requests(id) on delete cascade,
  material_id uuid not null references public.materials(id),
  quantity numeric(18,3) not null check(quantity>0),
  unique(request_id,material_id)
);

create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  request_id uuid references public.purchase_requests(id) on delete set null,
  purchase_number varchar(100) not null,
  supplier_id uuid not null references public.suppliers(id),
  date date not null,
  subtotal numeric(18,2) not null default 0 check(subtotal>=0),
  discount numeric(18,2) not null default 0 check(discount>=0),
  tax numeric(18,2) not null default 0 check(tax>=0),
  transport_cost numeric(18,2) not null default 0 check(transport_cost>=0),
  total numeric(18,2) not null check(total>=0),
  receipt_status varchar(50) not null default 'UNRECEIVED' check(receipt_status in('UNRECEIVED','PARTIAL','FULL')),
  invoice_number varchar(100), notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(project_id,purchase_number)
);

create table public.purchase_items (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.purchases(id) on delete cascade,
  material_id uuid not null references public.materials(id),
  quantity numeric(18,3) not null check(quantity>0),
  unit_price numeric(18,4) not null check(unit_price>=0),
  total numeric(18,2) not null check(total>=0),
  received_quantity numeric(18,3) not null default 0 check(received_quantity>=0 and received_quantity<=quantity),
  unique(purchase_id,material_id)
);

create table public.goods_receipts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  purchase_id uuid not null references public.purchases(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id),
  receipt_number varchar(100) not null, date date not null,
  status varchar(50) not null default 'COMPLETED' check(status in('COMPLETED','CANCELLED')),
  notes text, idempotency_key varchar(100) not null,
  created_by uuid default auth.uid(), created_at timestamptz not null default now(),
  unique(project_id,receipt_number), unique(project_id,idempotency_key)
);

create table public.goods_receipt_items (
  id uuid primary key default gen_random_uuid(),
  goods_receipt_id uuid not null references public.goods_receipts(id) on delete cascade,
  purchase_item_id uuid not null references public.purchase_items(id),
  material_id uuid not null references public.materials(id),
  received_quantity numeric(18,3) not null check(received_quantity>0),
  unique(goods_receipt_id,purchase_item_id)
);

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  type varchar(10) not null check(type in('IN','OUT')),
  material_id uuid not null references public.materials(id),
  quantity numeric(18,3) not null check(quantity>0), date date not null,
  reference_number varchar(100), receiver_name varchar(255), location_used varchar(255),
  purchase_id uuid references public.purchases(id) on delete set null,
  supplier_id uuid references public.suppliers(id) on delete set null,
  source_receipt_item_id uuid unique references public.goods_receipt_items(id),
  notes text, created_by uuid default auth.uid(), created_at timestamptz not null default now(),
  check((source_receipt_item_id is null and purchase_id is null) or (source_receipt_item_id is not null and purchase_id is not null and type='IN'))
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  purchase_id uuid not null references public.purchases(id) on delete cascade,
  amount numeric(18,2) not null check(amount>0), date date not null,
  method varchar(50) check(method in('CASH','TRANSFER','CHEQUE','OTHER')),
  reference_number varchar(100), receiver_name varchar(255), notes text,
  created_by uuid default auth.uid(), created_at timestamptz not null default now()
);

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  file_name varchar(255) not null,
  file_type varchar(100) not null check(file_type in('image/jpeg','image/png','application/pdf')),
  file_size integer not null check(file_size>0 and file_size<=5242880),
  file_path text not null unique,
  entity_type varchar(50) not null check(entity_type in('PROJECT','SUPPLIER','MATERIAL','PURCHASE_REQUEST','PURCHASE','PAYMENT','MOVEMENT')),
  entity_id uuid not null, notes text,
  created_by uuid default auth.uid(), created_at timestamptz not null default now()
);

create index materials_project_idx on public.materials(project_id);
create index suppliers_project_idx on public.suppliers(project_id);
create index purchase_requests_project_idx on public.purchase_requests(project_id);
create index purchases_project_idx on public.purchases(project_id);
create index purchases_request_idx on public.purchases(request_id);
create index purchases_supplier_idx on public.purchases(supplier_id);
create index purchase_items_purchase_idx on public.purchase_items(purchase_id);
create index purchase_items_material_idx on public.purchase_items(material_id);
create index purchase_request_items_material_idx on public.purchase_request_items(material_id);
create index goods_receipts_purchase_idx on public.goods_receipts(purchase_id);
create index goods_receipts_supplier_idx on public.goods_receipts(supplier_id);
create index goods_receipt_items_material_idx on public.goods_receipt_items(material_id);
create index goods_receipt_items_purchase_item_idx on public.goods_receipt_items(purchase_item_id);
create index stock_movements_project_material_idx on public.stock_movements(project_id,material_id,date);
create index stock_movements_material_idx on public.stock_movements(material_id);
create index stock_movements_purchase_idx on public.stock_movements(purchase_id);
create index stock_movements_supplier_idx on public.stock_movements(supplier_id);
create index payments_purchase_idx on public.payments(purchase_id);
create index payments_project_idx on public.payments(project_id);
create index attachments_entity_idx on public.attachments(project_id,entity_type,entity_id);

create trigger projects_updated_at before update on public.projects for each row execute function public.set_updated_at();
create trigger materials_updated_at before update on public.materials for each row execute function public.set_updated_at();
create trigger suppliers_updated_at before update on public.suppliers for each row execute function public.set_updated_at();
create trigger purchase_requests_updated_at before update on public.purchase_requests for each row execute function public.set_updated_at();
create trigger purchases_updated_at before update on public.purchases for each row execute function public.set_updated_at();

create or replace function public.owns_project(p_project_id uuid)
returns boolean language sql stable security invoker set search_path=public,pg_temp
as $$select exists(select 1 from public.projects p where p.id=p_project_id and p.user_id=(select auth.uid()));$$;
revoke all on function public.owns_project(uuid) from public,anon;
grant execute on function public.owns_project(uuid) to authenticated;

create or replace view public.material_stock with(security_invoker=true) as
select m.id material_id,m.project_id,m.name,m.min_stock,m.unit,
coalesce(sum(case when sm.type='IN' then sm.quantity else 0 end),0)::numeric(18,3) total_in,
coalesce(sum(case when sm.type='OUT' then sm.quantity else 0 end),0)::numeric(18,3) total_out,
(coalesce(sum(case when sm.type='IN' then sm.quantity else 0 end),0)-coalesce(sum(case when sm.type='OUT' then sm.quantity else 0 end),0))::numeric(18,3) current_stock
from public.materials m left join public.stock_movements sm on sm.material_id=m.id
group by m.id,m.project_id,m.name,m.min_stock,m.unit;

create or replace view public.purchase_balances with(security_invoker=true) as
select p.id purchase_id,p.project_id,p.total purchase_total,
coalesce(sum(pay.amount),0)::numeric(18,2) total_paid,
(p.total-coalesce(sum(pay.amount),0))::numeric(18,2) remaining_balance,
case when coalesce(sum(pay.amount),0)=0 then 'UNPAID' when coalesce(sum(pay.amount),0)>=p.total then 'PAID' else 'PARTIAL' end payment_status
from public.purchases p left join public.payments pay on pay.purchase_id=p.id
group by p.id,p.project_id,p.total;

create or replace view public.supplier_balances with(security_invoker=true) as
select s.id supplier_id,s.project_id,s.name,
coalesce(sum(pb.purchase_total),0)::numeric(18,2) total_purchases,
coalesce(sum(pb.total_paid),0)::numeric(18,2) total_paid,
coalesce(sum(pb.remaining_balance),0)::numeric(18,2) remaining_balance
from public.suppliers s left join public.purchases p on p.supplier_id=s.id
left join public.purchase_balances pb on pb.purchase_id=p.id
group by s.id,s.project_id,s.name;

alter table public.projects enable row level security;
alter table public.materials enable row level security;
alter table public.suppliers enable row level security;
alter table public.purchase_requests enable row level security;
alter table public.purchase_request_items enable row level security;
alter table public.purchases enable row level security;
alter table public.purchase_items enable row level security;
alter table public.goods_receipts enable row level security;
alter table public.goods_receipt_items enable row level security;
alter table public.stock_movements enable row level security;
alter table public.payments enable row level security;
alter table public.attachments enable row level security;

create policy projects_select on public.projects for select to authenticated using(user_id=(select auth.uid()));
create policy projects_insert on public.projects for insert to authenticated with check(user_id=(select auth.uid()));
create policy projects_update on public.projects for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy materials_select on public.materials for select to authenticated using(public.owns_project(project_id));
create policy materials_insert on public.materials for insert to authenticated with check(public.owns_project(project_id));
create policy materials_update on public.materials for update to authenticated using(public.owns_project(project_id)) with check(public.owns_project(project_id));
create policy materials_delete on public.materials for delete to authenticated using(public.owns_project(project_id));
create policy suppliers_select on public.suppliers for select to authenticated using(public.owns_project(project_id));
create policy suppliers_insert on public.suppliers for insert to authenticated with check(public.owns_project(project_id));
create policy suppliers_update on public.suppliers for update to authenticated using(public.owns_project(project_id)) with check(public.owns_project(project_id));
create policy suppliers_delete on public.suppliers for delete to authenticated using(public.owns_project(project_id));
create policy pr_select on public.purchase_requests for select to authenticated using(public.owns_project(project_id));
create policy pr_insert on public.purchase_requests for insert to authenticated with check(public.owns_project(project_id));
create policy pr_update on public.purchase_requests for update to authenticated using(public.owns_project(project_id)) with check(public.owns_project(project_id));
create policy pri_select on public.purchase_request_items for select to authenticated using(exists(select 1 from public.purchase_requests r where r.id=request_id and public.owns_project(r.project_id)));
create policy pri_insert on public.purchase_request_items for insert to authenticated with check(exists(select 1 from public.purchase_requests r where r.id=request_id and public.owns_project(r.project_id)));
create policy pri_update on public.purchase_request_items for update to authenticated using(exists(select 1 from public.purchase_requests r where r.id=request_id and public.owns_project(r.project_id))) with check(exists(select 1 from public.purchase_requests r where r.id=request_id and public.owns_project(r.project_id)));
create policy pri_delete on public.purchase_request_items for delete to authenticated using(exists(select 1 from public.purchase_requests r where r.id=request_id and public.owns_project(r.project_id)));
create policy purchases_select on public.purchases for select to authenticated using(public.owns_project(project_id));
create policy purchases_insert on public.purchases for insert to authenticated with check(public.owns_project(project_id));
create policy purchase_items_select on public.purchase_items for select to authenticated using(exists(select 1 from public.purchases p where p.id=purchase_id and public.owns_project(p.project_id)));
create policy purchase_items_insert on public.purchase_items for insert to authenticated with check(exists(select 1 from public.purchases p where p.id=purchase_id and public.owns_project(p.project_id)));
create policy goods_receipts_select on public.goods_receipts for select to authenticated using(public.owns_project(project_id));
create policy goods_receipt_items_select on public.goods_receipt_items for select to authenticated using(exists(select 1 from public.goods_receipts gr where gr.id=goods_receipt_id and public.owns_project(gr.project_id)));
create policy stock_movements_select on public.stock_movements for select to authenticated using(public.owns_project(project_id));
create policy stock_movements_insert_manual on public.stock_movements for insert to authenticated with check(public.owns_project(project_id) and source_receipt_item_id is null and purchase_id is null and exists(select 1 from public.materials m where m.id=material_id and m.project_id=project_id));
create policy payments_select on public.payments for select to authenticated using(public.owns_project(project_id));
create policy attachments_select on public.attachments for select to authenticated using(public.owns_project(project_id));
create policy attachments_insert on public.attachments for insert to authenticated with check(public.owns_project(project_id) and split_part(file_path,'/',1)=project_id::text);
create policy attachments_update on public.attachments for update to authenticated using(public.owns_project(project_id)) with check(public.owns_project(project_id) and split_part(file_path,'/',1)=project_id::text);
create policy attachments_delete on public.attachments for delete to authenticated using(public.owns_project(project_id));

grant usage on schema public to authenticated;
grant select,insert,update on public.projects to authenticated;
grant select,insert,update,delete on public.materials,public.suppliers,public.purchase_request_items,public.attachments to authenticated;
grant select,insert,update on public.purchase_requests to authenticated;
grant select,insert on public.purchases,public.purchase_items,public.stock_movements to authenticated;
grant select on public.goods_receipts,public.goods_receipt_items,public.payments to authenticated;
grant select on public.material_stock,public.purchase_balances,public.supplier_balances to authenticated;

create or replace function public.receive_goods(p_project_id uuid,p_purchase_id uuid,p_receipt_number varchar,p_receipt_date date,p_notes text,p_items jsonb,p_idempotency_key varchar)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_receipt_id uuid; v_supplier_id uuid; v_item record; v_pi public.purchase_items%rowtype; v_receipt_item_id uuid; v_received_before numeric(18,3); v_count int:=0;
begin
 if auth.uid() is null or not public.owns_project(p_project_id) then raise exception 'unauthorized'; end if;
 if p_idempotency_key is null or btrim(p_idempotency_key)='' then raise exception 'idempotency key required'; end if;
 select id into v_receipt_id from public.goods_receipts where project_id=p_project_id and idempotency_key=p_idempotency_key;
 if found then return v_receipt_id; end if;
 select supplier_id into v_supplier_id from public.purchases where id=p_purchase_id and project_id=p_project_id for update;
 if not found then raise exception 'purchase not found or unauthorized'; end if;
 insert into public.goods_receipts(project_id,purchase_id,supplier_id,receipt_number,date,notes,idempotency_key,created_by)
 values(p_project_id,p_purchase_id,v_supplier_id,p_receipt_number,p_receipt_date,p_notes,p_idempotency_key,auth.uid())
 on conflict(project_id,idempotency_key) do nothing returning id into v_receipt_id;
 if v_receipt_id is null then select id into v_receipt_id from public.goods_receipts where project_id=p_project_id and idempotency_key=p_idempotency_key; return v_receipt_id; end if;
 for v_item in select (e->>'purchase_item_id')::uuid purchase_item_id,sum((e->>'quantity')::numeric) quantity from jsonb_array_elements(p_items)e group by (e->>'purchase_item_id')::uuid loop
  v_count:=v_count+1; if v_item.quantity<=0 then raise exception 'received quantity must be positive'; end if;
  select * into v_pi from public.purchase_items where id=v_item.purchase_item_id and purchase_id=p_purchase_id for update;
  if not found then raise exception 'purchase item not found for purchase'; end if;
  select coalesce(sum(gri.received_quantity),0) into v_received_before from public.goods_receipt_items gri join public.goods_receipts gr on gr.id=gri.goods_receipt_id where gri.purchase_item_id=v_pi.id and gr.status='COMPLETED';
  if v_received_before+v_item.quantity>v_pi.quantity then raise exception 'Cannot receive more than ordered for item %',v_pi.id; end if;
  insert into public.goods_receipt_items(goods_receipt_id,purchase_item_id,material_id,received_quantity) values(v_receipt_id,v_pi.id,v_pi.material_id,v_item.quantity) returning id into v_receipt_item_id;
  update public.purchase_items set received_quantity=v_received_before+v_item.quantity where id=v_pi.id;
  insert into public.stock_movements(project_id,type,material_id,quantity,date,reference_number,purchase_id,supplier_id,source_receipt_item_id,notes,created_by) values(p_project_id,'IN',v_pi.material_id,v_item.quantity,p_receipt_date,p_receipt_number,p_purchase_id,v_supplier_id,v_receipt_item_id,'استلام مواد',auth.uid());
 end loop;
 if v_count=0 then raise exception 'at least one receipt item is required'; end if;
 update public.purchases p set receipt_status=case when not exists(select 1 from public.purchase_items pi where pi.purchase_id=p.id and pi.received_quantity<pi.quantity) then 'FULL' when exists(select 1 from public.purchase_items pi where pi.purchase_id=p.id and pi.received_quantity>0) then 'PARTIAL' else 'UNRECEIVED' end where p.id=p_purchase_id;
 return v_receipt_id;
end;$$;
revoke all on function public.receive_goods(uuid,uuid,varchar,date,text,jsonb,varchar) from public,anon;
grant execute on function public.receive_goods(uuid,uuid,varchar,date,text,jsonb,varchar) to authenticated;

create or replace function public.register_payment(p_project_id uuid,p_purchase_id uuid,p_amount numeric,p_date date,p_method varchar,p_reference_number varchar,p_notes text)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_payment_id uuid; v_total numeric(18,2); v_paid numeric(18,2);
begin
 if auth.uid() is null or not public.owns_project(p_project_id) then raise exception 'unauthorized'; end if;
 if p_amount is null or p_amount<=0 then raise exception 'payment amount must be positive'; end if;
 select total into v_total from public.purchases where id=p_purchase_id and project_id=p_project_id for update;
 if not found then raise exception 'purchase not found or unauthorized'; end if;
 select coalesce(sum(amount),0) into v_paid from public.payments where purchase_id=p_purchase_id;
 if v_paid+p_amount>v_total then raise exception 'Payment amount exceeds remaining balance. Remaining: %',v_total-v_paid; end if;
 insert into public.payments(project_id,purchase_id,amount,date,method,reference_number,notes,created_by) values(p_project_id,p_purchase_id,p_amount,p_date,p_method,p_reference_number,p_notes,auth.uid()) returning id into v_payment_id;
 return v_payment_id;
end;$$;
revoke all on function public.register_payment(uuid,uuid,numeric,date,varchar,varchar,text) from public,anon;
grant execute on function public.register_payment(uuid,uuid,numeric,date,varchar,varchar,text) to authenticated;

create or replace function public.validate_stock_movement()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v_balance numeric(18,3);
begin
 if not exists(select 1 from public.materials m where m.id=new.material_id and m.project_id=new.project_id) then raise exception 'material does not belong to project'; end if;
 if new.supplier_id is not null and not exists(select 1 from public.suppliers s where s.id=new.supplier_id and s.project_id=new.project_id) then raise exception 'supplier does not belong to project'; end if;
 if new.purchase_id is not null and not exists(select 1 from public.purchases p where p.id=new.purchase_id and p.project_id=new.project_id) then raise exception 'purchase does not belong to project'; end if;
 if new.type='OUT' then
  perform pg_advisory_xact_lock(hashtextextended(new.material_id::text,0));
  select coalesce(sum(case when sm.type='IN' then sm.quantity else -sm.quantity end),0) into v_balance from public.stock_movements sm where sm.project_id=new.project_id and sm.material_id=new.material_id;
  if v_balance<new.quantity then raise exception 'insufficient stock. available: %, requested: %',v_balance,new.quantity; end if;
 end if;
 return new;
end;$$;
revoke all on function public.validate_stock_movement() from public,anon,authenticated;
create trigger stock_movements_validate_before_insert before insert on public.stock_movements for each row execute function public.validate_stock_movement();

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('attachments','attachments',false,5242880,array['image/jpeg','image/png','application/pdf'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy attachments_storage_select on storage.objects for select to authenticated using(bucket_id='attachments' and public.owns_project(split_part(name,'/',1)::uuid));
create policy attachments_storage_insert on storage.objects for insert to authenticated with check(bucket_id='attachments' and name~'^[0-9a-fA-F-]{36}/[^/]+$' and public.owns_project(split_part(name,'/',1)::uuid));
create policy attachments_storage_update on storage.objects for update to authenticated using(bucket_id='attachments' and public.owns_project(split_part(name,'/',1)::uuid)) with check(bucket_id='attachments' and name~'^[0-9a-fA-F-]{36}/[^/]+$' and public.owns_project(split_part(name,'/',1)::uuid));
create policy attachments_storage_delete on storage.objects for delete to authenticated using(bucket_id='attachments' and public.owns_project(split_part(name,'/',1)::uuid));

do $$begin
 if to_regprocedure('public.rls_auto_enable()') is not null then execute 'revoke execute on function public.rls_auto_enable() from public,anon,authenticated'; end if;
end$$;
