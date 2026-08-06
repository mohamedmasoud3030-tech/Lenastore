alter table public.purchase_requests
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid,
  add column if not exists cancellation_reason text,
  add column if not exists cancellation_idempotency_key varchar(100);
create unique index if not exists purchase_requests_project_cancellation_idempotency_uidx
  on public.purchase_requests(project_id,cancellation_idempotency_key)
  where cancellation_idempotency_key is not null;

alter table public.purchases
  add column if not exists status varchar(20) not null default 'ACTIVE',
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid,
  add column if not exists cancellation_reason text,
  add column if not exists cancellation_idempotency_key varchar(100);
alter table public.purchases drop constraint if exists purchases_status_check;
alter table public.purchases add constraint purchases_status_check check (status in ('ACTIVE','CANCELLED'));
create unique index if not exists purchases_project_cancellation_idempotency_uidx
  on public.purchases(project_id,cancellation_idempotency_key)
  where cancellation_idempotency_key is not null;

create table public.purchase_returns (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  purchase_id uuid not null references public.purchases(id),
  supplier_id uuid not null references public.suppliers(id),
  return_number varchar(100) not null,
  date date not null,
  reason text not null,
  status varchar(20) not null default 'COMPLETED' check (status in ('COMPLETED','CANCELLED')),
  total numeric(18,2) not null check (total >= 0),
  idempotency_key varchar(100) not null,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  unique(project_id,return_number),
  unique(project_id,idempotency_key)
);

create table public.purchase_return_items (
  id uuid primary key default gen_random_uuid(),
  purchase_return_id uuid not null references public.purchase_returns(id) on delete cascade,
  purchase_item_id uuid not null references public.purchase_items(id),
  material_id uuid not null references public.materials(id),
  quantity numeric(18,3) not null check (quantity > 0),
  unit_price numeric(18,4) not null check (unit_price >= 0),
  total numeric(18,2) not null check (total >= 0),
  unique(purchase_return_id,purchase_item_id)
);

alter table public.purchase_returns enable row level security;
alter table public.purchase_return_items enable row level security;
create policy purchase_returns_select on public.purchase_returns
for select to authenticated using (public.owns_project(project_id));
create policy purchase_return_items_select on public.purchase_return_items
for select to authenticated using (
  exists(select 1 from public.purchase_returns r where r.id=purchase_return_id and public.owns_project(r.project_id))
);
revoke all on public.purchase_returns, public.purchase_return_items from anon, authenticated;
grant select on public.purchase_returns, public.purchase_return_items to authenticated;

create or replace view public.purchase_return_balances
with (security_invoker = true)
as
select
  p.id as purchase_id,
  p.project_id,
  coalesce(sum(pr.total) filter (where pr.status='COMPLETED'),0)::numeric(18,2) as total_returned
from public.purchases p
left join public.purchase_returns pr on pr.purchase_id=p.id
group by p.id,p.project_id;
revoke all on public.purchase_return_balances from anon;
grant select on public.purchase_return_balances to authenticated;

create or replace view public.purchase_balances
with (security_invoker = true)
as
select
  p.id as purchase_id,
  p.project_id,
  (case when p.status='CANCELLED' then 0 else p.total - coalesce(prb.total_returned,0) end)::numeric(18,2) as purchase_total,
  coalesce(sum(pay.amount) filter (where pay.status='POSTED'),0)::numeric(18,2) as total_paid,
  ((case when p.status='CANCELLED' then 0 else p.total - coalesce(prb.total_returned,0) end)
    - coalesce(sum(pay.amount) filter (where pay.status='POSTED'),0))::numeric(18,2) as remaining_balance,
  case
    when coalesce(sum(pay.amount) filter (where pay.status='POSTED'),0)=0 then 'UNPAID'::text
    when coalesce(sum(pay.amount) filter (where pay.status='POSTED'),0) >=
         (case when p.status='CANCELLED' then 0 else p.total - coalesce(prb.total_returned,0) end) then 'PAID'::text
    else 'PARTIAL'::text
  end as payment_status
from public.purchases p
left join public.purchase_return_balances prb on prb.purchase_id=p.id
left join public.payments pay on pay.purchase_id=p.id
group by p.id,p.project_id,p.total,p.status,prb.total_returned;

create or replace view public.supplier_balances
with (security_invoker = true)
as
select
  s.id as supplier_id,
  s.project_id,
  s.name,
  coalesce(sum(pb.purchase_total),0)::numeric(18,2) as total_purchases,
  coalesce(sum(pb.total_paid),0)::numeric(18,2) as total_paid,
  coalesce(sum(pb.remaining_balance),0)::numeric(18,2) as remaining_balance
from public.suppliers s
left join public.purchases p on p.supplier_id=s.id
left join public.purchase_balances pb on pb.purchase_id=p.id
group by s.id,s.project_id,s.name;

create or replace function public.create_purchase_return(
  p_project_id uuid,
  p_purchase_id uuid,
  p_return_number varchar,
  p_return_date date,
  p_reason text,
  p_items jsonb,
  p_idempotency_key varchar
)
returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_return_id uuid;
  v_existing public.purchase_returns%rowtype;
  v_purchase public.purchases%rowtype;
  v_item record;
  v_pi public.purchase_items%rowtype;
  v_key varchar(100);
  v_number varchar(100);
  v_reason text;
  v_items jsonb;
  v_existing_items jsonb;
  v_new_total numeric(18,2):=0;
  v_existing_returns numeric(18,2):=0;
  v_paid numeric(18,2):=0;
  v_returned_qty numeric(18,3);
  v_stock numeric(18,3);
begin
  if auth.uid() is null or not public.owns_project(p_project_id) then raise exception 'unauthorized'; end if;
  v_key:=btrim(coalesce(p_idempotency_key,''));
  if v_key='' or length(v_key)>100 then raise exception 'invalid idempotency key'; end if;
  v_number:=btrim(coalesce(p_return_number,''));
  if v_number='' or length(v_number)>100 then raise exception 'invalid return number'; end if;
  if p_return_date is null then raise exception 'return date is required'; end if;
  v_reason:=nullif(btrim(p_reason),'');
  if v_reason is null then raise exception 'return reason is required'; end if;
  if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then raise exception 'at least one return item is required'; end if;
  if exists(
    select 1 from jsonb_array_elements(p_items) e
    where jsonb_typeof(e)<>'object'
       or coalesce(e->>'purchase_item_id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
       or coalesce(e->>'quantity','') !~ '^[[:space:]]*[0-9]+([.][0-9]+)?[[:space:]]*$'
       or (e->>'quantity')::numeric<=0
  ) then raise exception 'invalid return item payload'; end if;
  if (select count(*)<>count(distinct e->>'purchase_item_id') from jsonb_array_elements(p_items)e) then
    raise exception 'duplicate purchase items are not allowed';
  end if;

  select * into v_purchase from public.purchases
  where id=p_purchase_id and project_id=p_project_id
  for update;
  if not found then raise exception 'purchase not found or unauthorized'; end if;
  if v_purchase.status<>'ACTIVE' then raise exception 'cancelled purchase cannot be returned'; end if;

  select jsonb_agg(jsonb_build_object('purchase_item_id',q.purchase_item_id,'quantity',q.quantity) order by q.purchase_item_id)
  into v_items
  from (
    select (e->>'purchase_item_id')::uuid purchase_item_id,(e->>'quantity')::numeric(18,3) quantity
    from jsonb_array_elements(p_items)e
  )q;

  select * into v_existing from public.purchase_returns
  where project_id=p_project_id and idempotency_key=v_key;
  if found then
    select jsonb_agg(jsonb_build_object('purchase_item_id',pri.purchase_item_id,'quantity',pri.quantity) order by pri.purchase_item_id)
    into v_existing_items from public.purchase_return_items pri where pri.purchase_return_id=v_existing.id;
    if v_existing.purchase_id is distinct from p_purchase_id
       or v_existing.return_number is distinct from v_number
       or v_existing.date is distinct from p_return_date
       or v_existing.reason is distinct from v_reason
       or v_existing_items is distinct from v_items then
      raise exception 'idempotency key payload mismatch';
    end if;
    return v_existing.id;
  end if;

  for v_item in select (e->>'purchase_item_id')::uuid purchase_item_id,(e->>'quantity')::numeric(18,3) quantity from jsonb_array_elements(v_items)e order by 1
  loop
    select * into v_pi from public.purchase_items where id=v_item.purchase_item_id and purchase_id=p_purchase_id for update;
    if not found then raise exception 'purchase item not found for purchase'; end if;
    perform pg_advisory_xact_lock(hashtextextended(v_pi.material_id::text,0));

    select coalesce(sum(pri.quantity),0)::numeric(18,3) into v_returned_qty
    from public.purchase_return_items pri join public.purchase_returns pr on pr.id=pri.purchase_return_id
    where pri.purchase_item_id=v_pi.id and pr.status='COMPLETED';
    if v_returned_qty+v_item.quantity>v_pi.received_quantity then
      raise exception 'return quantity exceeds received quantity for item %',v_pi.id;
    end if;

    select coalesce(sum(case when sm.type='IN' then sm.quantity else -sm.quantity end),0)::numeric(18,3)
    into v_stock from public.stock_movements sm
    where sm.project_id=p_project_id and sm.material_id=v_pi.material_id;
    if v_stock<v_item.quantity then raise exception 'insufficient stock for return. available: %, requested: %',v_stock,v_item.quantity; end if;

    v_new_total:=v_new_total+round(v_item.quantity*v_pi.unit_price,2);
  end loop;

  select coalesce(sum(total),0)::numeric(18,2) into v_existing_returns
  from public.purchase_returns where purchase_id=p_purchase_id and status='COMPLETED';
  select coalesce(sum(amount),0)::numeric(18,2) into v_paid
  from public.payments where purchase_id=p_purchase_id and status='POSTED';
  if v_paid>v_purchase.total-v_existing_returns-v_new_total then
    raise exception 'reverse or refund payments before this return. paid: %, resulting payable: %',v_paid,v_purchase.total-v_existing_returns-v_new_total;
  end if;

  insert into public.purchase_returns(project_id,purchase_id,supplier_id,return_number,date,reason,total,idempotency_key,created_by)
  values(p_project_id,p_purchase_id,v_purchase.supplier_id,v_number,p_return_date,v_reason,v_new_total,v_key,auth.uid())
  returning id into v_return_id;

  for v_item in select (e->>'purchase_item_id')::uuid purchase_item_id,(e->>'quantity')::numeric(18,3) quantity from jsonb_array_elements(v_items)e order by 1
  loop
    select * into v_pi from public.purchase_items where id=v_item.purchase_item_id and purchase_id=p_purchase_id;
    insert into public.purchase_return_items(purchase_return_id,purchase_item_id,material_id,quantity,unit_price,total)
    values(v_return_id,v_pi.id,v_pi.material_id,v_item.quantity,v_pi.unit_price,round(v_item.quantity*v_pi.unit_price,2));
    insert into public.stock_movements(project_id,type,material_id,quantity,date,reference_number,receiver_name,location_used,notes,created_by)
    values(p_project_id,'OUT',v_pi.material_id,v_item.quantity,p_return_date,v_number,'مرتجع للمورد',null,v_reason,auth.uid());
  end loop;

  insert into public.audit_events(project_id,actor_id,event_type,entity_type,entity_id,reason,payload)
  values(p_project_id,auth.uid(),'PURCHASE_RETURN_CREATED','PURCHASE_RETURN',v_return_id,v_reason,
         jsonb_build_object('purchase_id',p_purchase_id,'return_number',v_number,'total',v_new_total));
  return v_return_id;
end;
$$;
revoke all on function public.create_purchase_return(uuid,uuid,varchar,date,text,jsonb,varchar) from public,anon;
grant execute on function public.create_purchase_return(uuid,uuid,varchar,date,text,jsonb,varchar) to authenticated;

create or replace function public.cancel_purchase_request(
  p_project_id uuid,p_request_id uuid,p_reason text,p_idempotency_key varchar
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_request public.purchase_requests%rowtype; v_reason text; v_key varchar(100);
begin
  if auth.uid() is null or not public.owns_project(p_project_id) then raise exception 'unauthorized'; end if;
  v_reason:=nullif(btrim(p_reason),''); if v_reason is null then raise exception 'cancellation reason is required'; end if;
  v_key:=btrim(coalesce(p_idempotency_key,'')); if v_key='' or length(v_key)>100 then raise exception 'invalid idempotency key'; end if;
  select * into v_request from public.purchase_requests where id=p_request_id and project_id=p_project_id for update;
  if not found then raise exception 'purchase request not found or unauthorized'; end if;
  if v_request.status='CANCELLED' then
    if v_request.cancellation_idempotency_key is distinct from v_key or v_request.cancellation_reason is distinct from v_reason then raise exception 'request already cancelled with different payload'; end if;
    return v_request.id;
  end if;
  if v_request.status='PURCHASED' or exists(select 1 from public.purchases p where p.request_id=v_request.id) then raise exception 'converted request cannot be cancelled'; end if;
  update public.purchase_requests set status='CANCELLED',cancelled_at=now(),cancelled_by=auth.uid(),cancellation_reason=v_reason,cancellation_idempotency_key=v_key where id=v_request.id;
  insert into public.audit_events(project_id,actor_id,event_type,entity_type,entity_id,reason)
  values(p_project_id,auth.uid(),'PURCHASE_REQUEST_CANCELLED','PURCHASE_REQUEST',v_request.id,v_reason);
  return v_request.id;
end; $$;
revoke all on function public.cancel_purchase_request(uuid,uuid,text,varchar) from public,anon;
grant execute on function public.cancel_purchase_request(uuid,uuid,text,varchar) to authenticated;

create or replace function public.cancel_purchase(
  p_project_id uuid,p_purchase_id uuid,p_reason text,p_idempotency_key varchar
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_purchase public.purchases%rowtype; v_reason text; v_key varchar(100);
begin
  if auth.uid() is null or not public.owns_project(p_project_id) then raise exception 'unauthorized'; end if;
  v_reason:=nullif(btrim(p_reason),''); if v_reason is null then raise exception 'cancellation reason is required'; end if;
  v_key:=btrim(coalesce(p_idempotency_key,'')); if v_key='' or length(v_key)>100 then raise exception 'invalid idempotency key'; end if;
  select * into v_purchase from public.purchases where id=p_purchase_id and project_id=p_project_id for update;
  if not found then raise exception 'purchase not found or unauthorized'; end if;
  if v_purchase.status='CANCELLED' then
    if v_purchase.cancellation_idempotency_key is distinct from v_key or v_purchase.cancellation_reason is distinct from v_reason then raise exception 'purchase already cancelled with different payload'; end if;
    return v_purchase.id;
  end if;
  if exists(select 1 from public.payments where purchase_id=v_purchase.id and status='POSTED') then raise exception 'purchase with active payments cannot be cancelled'; end if;
  if exists(select 1 from public.goods_receipts where purchase_id=v_purchase.id and status='COMPLETED') then raise exception 'purchase with completed receipts cannot be cancelled'; end if;
  if exists(select 1 from public.purchase_returns where purchase_id=v_purchase.id and status='COMPLETED') then raise exception 'purchase with returns cannot be cancelled'; end if;
  update public.purchases set status='CANCELLED',cancelled_at=now(),cancelled_by=auth.uid(),cancellation_reason=v_reason,cancellation_idempotency_key=v_key where id=v_purchase.id;
  insert into public.audit_events(project_id,actor_id,event_type,entity_type,entity_id,reason)
  values(p_project_id,auth.uid(),'PURCHASE_CANCELLED','PURCHASE',v_purchase.id,v_reason);
  return v_purchase.id;
end; $$;
revoke all on function public.cancel_purchase(uuid,uuid,text,varchar) from public,anon;
grant execute on function public.cancel_purchase(uuid,uuid,text,varchar) to authenticated;

notify pgrst,'reload schema';
