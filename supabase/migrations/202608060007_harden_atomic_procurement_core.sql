alter table public.purchase_requests
  add column if not exists idempotency_key varchar(100),
  add column if not exists created_by uuid;

update public.purchase_requests pr
set idempotency_key = coalesce(pr.idempotency_key, 'legacy-' || pr.id::text),
    created_by = coalesce(pr.created_by, p.user_id)
from public.projects p
where p.id = pr.project_id
  and (pr.idempotency_key is null or pr.created_by is null);

alter table public.purchase_requests
  alter column idempotency_key set not null,
  alter column created_by set not null,
  alter column created_by set default auth.uid();

create unique index if not exists purchase_requests_project_idempotency_key_uidx
  on public.purchase_requests(project_id, idempotency_key);

alter table public.purchases
  add column if not exists idempotency_key varchar(100),
  add column if not exists created_by uuid;

update public.purchases po
set idempotency_key = coalesce(po.idempotency_key, 'legacy-' || po.id::text),
    created_by = coalesce(po.created_by, p.user_id)
from public.projects p
where p.id = po.project_id
  and (po.idempotency_key is null or po.created_by is null);

alter table public.purchases
  alter column idempotency_key set not null,
  alter column created_by set not null,
  alter column created_by set default auth.uid();

create unique index if not exists purchases_project_idempotency_key_uidx
  on public.purchases(project_id, idempotency_key);

create unique index if not exists purchases_request_once_uidx
  on public.purchases(request_id)
  where request_id is not null;

create or replace function public.purchase_balances(p public.purchases)
returns setof public.purchase_balances
rows 1
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select pb.*
  from public.purchase_balances pb
  where pb.purchase_id = p.id;
$$;

revoke all on function public.purchase_balances(public.purchases) from public, anon;
grant execute on function public.purchase_balances(public.purchases) to authenticated;

create or replace function public.supplier_balances(s public.suppliers)
returns setof public.supplier_balances
rows 1
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select sb.*
  from public.supplier_balances sb
  where sb.supplier_id = s.id;
$$;

revoke all on function public.supplier_balances(public.suppliers) from public, anon;
grant execute on function public.supplier_balances(public.suppliers) to authenticated;

drop policy if exists stock_movements_insert_manual on public.stock_movements;
create policy stock_movements_insert_manual
on public.stock_movements
for insert
to authenticated
with check (
  public.owns_project(project_id)
  and source_receipt_item_id is null
  and purchase_id is null
  and exists (
    select 1
    from public.materials m
    where m.id = stock_movements.material_id
      and m.project_id = stock_movements.project_id
  )
);

drop policy if exists pri_insert on public.purchase_request_items;
create policy pri_insert
on public.purchase_request_items
for insert
to authenticated
with check (
  exists (
    select 1
    from public.purchase_requests r
    join public.materials m
      on m.id = purchase_request_items.material_id
     and m.project_id = r.project_id
    where r.id = purchase_request_items.request_id
      and public.owns_project(r.project_id)
  )
);

drop policy if exists purchase_items_insert on public.purchase_items;
create policy purchase_items_insert
on public.purchase_items
for insert
to authenticated
with check (
  exists (
    select 1
    from public.purchases p
    join public.materials m
      on m.id = purchase_items.material_id
     and m.project_id = p.project_id
    where p.id = purchase_items.purchase_id
      and public.owns_project(p.project_id)
  )
);

drop policy if exists purchases_insert on public.purchases;
create policy purchases_insert
on public.purchases
for insert
to authenticated
with check (
  public.owns_project(project_id)
  and exists (
    select 1
    from public.suppliers s
    where s.id = purchases.supplier_id
      and s.project_id = purchases.project_id
  )
  and (
    request_id is null
    or exists (
      select 1
      from public.purchase_requests r
      where r.id = purchases.request_id
        and r.project_id = purchases.project_id
        and r.status not in ('CANCELLED', 'PURCHASED')
    )
  )
);

create or replace function public.create_purchase_request_atomic(
  p_project_id uuid,
  p_request_number varchar,
  p_request_date date,
  p_reason text,
  p_priority varchar,
  p_needed_date date,
  p_notes text,
  p_items jsonb,
  p_idempotency_key varchar
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_request_id uuid;
  v_existing public.purchase_requests%rowtype;
  v_key varchar(100);
  v_number varchar(100);
  v_priority varchar(50);
  v_reason text;
  v_notes text;
  v_items jsonb;
  v_existing_items jsonb;
begin
  if auth.uid() is null or not public.owns_project(p_project_id) then
    raise exception 'unauthorized';
  end if;

  v_key := btrim(coalesce(p_idempotency_key, ''));
  if v_key = '' or length(v_key) > 100 then
    raise exception 'invalid idempotency key';
  end if;

  v_number := btrim(coalesce(p_request_number, ''));
  if v_number = '' or length(v_number) > 100 then
    raise exception 'invalid request number';
  end if;

  if p_request_date is null then
    raise exception 'request date is required';
  end if;

  v_reason := nullif(btrim(p_reason), '');
  if v_reason is null then
    raise exception 'request reason is required';
  end if;

  v_priority := upper(btrim(coalesce(p_priority, 'NORMAL')));
  if v_priority not in ('NORMAL', 'URGENT') then
    raise exception 'invalid request priority';
  end if;

  v_notes := nullif(btrim(p_notes), '');

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'at least one request item is required';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_items) e
    where jsonb_typeof(e) <> 'object'
       or coalesce(e->>'material_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
       or coalesce(e->>'quantity', '') !~ '^[[:space:]]*[0-9]+([.][0-9]+)?[[:space:]]*$'
       or (e->>'quantity')::numeric <= 0
  ) then
    raise exception 'invalid request item payload';
  end if;

  select jsonb_agg(
           jsonb_build_object('material_id', q.material_id, 'quantity', q.quantity)
           order by q.material_id
         )
  into v_items
  from (
    select (e->>'material_id')::uuid as material_id,
           sum((e->>'quantity')::numeric)::numeric(18,3) as quantity
    from jsonb_array_elements(p_items) e
    group by (e->>'material_id')::uuid
  ) q;

  if exists (
    select 1
    from jsonb_array_elements(v_items) e
    left join public.materials m
      on m.id = (e->>'material_id')::uuid
     and m.project_id = p_project_id
    where m.id is null
  ) then
    raise exception 'request contains a material outside the project';
  end if;

  select *
  into v_existing
  from public.purchase_requests
  where project_id = p_project_id
    and idempotency_key = v_key;

  if found then
    select jsonb_agg(
             jsonb_build_object('material_id', i.material_id, 'quantity', i.quantity)
             order by i.material_id
           )
    into v_existing_items
    from public.purchase_request_items i
    where i.request_id = v_existing.id;

    if v_existing.request_number is distinct from v_number
       or v_existing.date is distinct from p_request_date
       or v_existing.reason is distinct from v_reason
       or v_existing.priority is distinct from v_priority
       or v_existing.needed_date is distinct from p_needed_date
       or v_existing.notes is distinct from v_notes
       or v_existing_items is distinct from v_items then
      raise exception 'idempotency key payload mismatch';
    end if;
    return v_existing.id;
  end if;

  insert into public.purchase_requests(
    project_id, request_number, date, reason, priority, needed_date,
    status, notes, idempotency_key, created_by
  ) values (
    p_project_id, v_number, p_request_date, v_reason, v_priority, p_needed_date,
    'REQUESTED', v_notes, v_key, auth.uid()
  )
  on conflict (project_id, idempotency_key) do nothing
  returning id into v_request_id;

  if v_request_id is null then
    select id into v_request_id
    from public.purchase_requests
    where project_id = p_project_id and idempotency_key = v_key;
    return v_request_id;
  end if;

  insert into public.purchase_request_items(request_id, material_id, quantity)
  select v_request_id,
         (e->>'material_id')::uuid,
         (e->>'quantity')::numeric(18,3)
  from jsonb_array_elements(v_items) e;

  return v_request_id;
end;
$$;

revoke all on function public.create_purchase_request_atomic(uuid,varchar,date,text,varchar,date,text,jsonb,varchar) from public, anon;
grant execute on function public.create_purchase_request_atomic(uuid,varchar,date,text,varchar,date,text,jsonb,varchar) to authenticated;

create or replace function public.create_purchase_atomic(
  p_project_id uuid,
  p_request_id uuid,
  p_purchase_number varchar,
  p_supplier_id uuid,
  p_purchase_date date,
  p_invoice_number varchar,
  p_discount numeric,
  p_tax numeric,
  p_transport_cost numeric,
  p_notes text,
  p_items jsonb,
  p_idempotency_key varchar
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_purchase_id uuid;
  v_existing public.purchases%rowtype;
  v_key varchar(100);
  v_number varchar(100);
  v_invoice varchar(100);
  v_notes text;
  v_discount numeric(18,2);
  v_tax numeric(18,2);
  v_transport numeric(18,2);
  v_subtotal numeric(18,2);
  v_total numeric(18,2);
  v_items jsonb;
  v_existing_items jsonb;
  v_request_status varchar(50);
begin
  if auth.uid() is null or not public.owns_project(p_project_id) then
    raise exception 'unauthorized';
  end if;

  v_key := btrim(coalesce(p_idempotency_key, ''));
  if v_key = '' or length(v_key) > 100 then
    raise exception 'invalid idempotency key';
  end if;

  v_number := btrim(coalesce(p_purchase_number, ''));
  if v_number = '' or length(v_number) > 100 then
    raise exception 'invalid purchase number';
  end if;

  if p_purchase_date is null then
    raise exception 'purchase date is required';
  end if;

  if not exists (
    select 1 from public.suppliers s
    where s.id = p_supplier_id and s.project_id = p_project_id
  ) then
    raise exception 'supplier does not belong to project';
  end if;

  if p_request_id is not null then
    select status into v_request_status
    from public.purchase_requests
    where id = p_request_id and project_id = p_project_id
    for update;

    if not found then
      raise exception 'purchase request not found or unauthorized';
    end if;
    if v_request_status in ('CANCELLED', 'PURCHASED') then
      raise exception 'purchase request cannot be converted in its current status';
    end if;
  end if;

  v_invoice := nullif(btrim(p_invoice_number), '');
  if length(coalesce(v_invoice, '')) > 100 then
    raise exception 'invoice number is too long';
  end if;
  v_notes := nullif(btrim(p_notes), '');

  v_discount := round(coalesce(p_discount, 0), 2)::numeric(18,2);
  v_tax := round(coalesce(p_tax, 0), 2)::numeric(18,2);
  v_transport := round(coalesce(p_transport_cost, 0), 2)::numeric(18,2);
  if v_discount < 0 or v_tax < 0 or v_transport < 0 then
    raise exception 'financial adjustments cannot be negative';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'at least one purchase item is required';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_items) e
    where jsonb_typeof(e) <> 'object'
       or coalesce(e->>'material_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
       or coalesce(e->>'quantity', '') !~ '^[[:space:]]*[0-9]+([.][0-9]+)?[[:space:]]*$'
       or coalesce(e->>'unit_price', '') !~ '^[[:space:]]*[0-9]+([.][0-9]+)?[[:space:]]*$'
       or (e->>'quantity')::numeric <= 0
       or (e->>'unit_price')::numeric < 0
  ) then
    raise exception 'invalid purchase item payload';
  end if;

  if (
    select count(*) <> count(distinct e->>'material_id')
    from jsonb_array_elements(p_items) e
  ) then
    raise exception 'duplicate materials are not allowed in one purchase';
  end if;

  select jsonb_agg(
           jsonb_build_object(
             'material_id', q.material_id,
             'quantity', q.quantity,
             'unit_price', q.unit_price,
             'total', q.total
           ) order by q.material_id
         ),
         coalesce(sum(q.total), 0)::numeric(18,2)
  into v_items, v_subtotal
  from (
    select (e->>'material_id')::uuid as material_id,
           (e->>'quantity')::numeric(18,3) as quantity,
           round((e->>'unit_price')::numeric, 4)::numeric(18,4) as unit_price,
           round((e->>'quantity')::numeric * (e->>'unit_price')::numeric, 2)::numeric(18,2) as total
    from jsonb_array_elements(p_items) e
  ) q;

  if exists (
    select 1
    from jsonb_array_elements(v_items) e
    left join public.materials m
      on m.id = (e->>'material_id')::uuid
     and m.project_id = p_project_id
    where m.id is null
  ) then
    raise exception 'purchase contains a material outside the project';
  end if;

  v_total := round(v_subtotal - v_discount + v_tax + v_transport, 2)::numeric(18,2);
  if v_total < 0 then
    raise exception 'purchase total cannot be negative';
  end if;

  select *
  into v_existing
  from public.purchases
  where project_id = p_project_id
    and idempotency_key = v_key;

  if found then
    select jsonb_agg(
             jsonb_build_object(
               'material_id', i.material_id,
               'quantity', i.quantity,
               'unit_price', i.unit_price,
               'total', i.total
             ) order by i.material_id
           )
    into v_existing_items
    from public.purchase_items i
    where i.purchase_id = v_existing.id;

    if v_existing.request_id is distinct from p_request_id
       or v_existing.purchase_number is distinct from v_number
       or v_existing.supplier_id is distinct from p_supplier_id
       or v_existing.date is distinct from p_purchase_date
       or v_existing.invoice_number is distinct from v_invoice
       or v_existing.discount is distinct from v_discount
       or v_existing.tax is distinct from v_tax
       or v_existing.transport_cost is distinct from v_transport
       or v_existing.notes is distinct from v_notes
       or v_existing_items is distinct from v_items then
      raise exception 'idempotency key payload mismatch';
    end if;
    return v_existing.id;
  end if;

  insert into public.purchases(
    project_id, request_id, purchase_number, supplier_id, date,
    subtotal, discount, tax, transport_cost, total, receipt_status,
    invoice_number, notes, idempotency_key, created_by
  ) values (
    p_project_id, p_request_id, v_number, p_supplier_id, p_purchase_date,
    v_subtotal, v_discount, v_tax, v_transport, v_total, 'UNRECEIVED',
    v_invoice, v_notes, v_key, auth.uid()
  )
  on conflict (project_id, idempotency_key) do nothing
  returning id into v_purchase_id;

  if v_purchase_id is null then
    select id into v_purchase_id
    from public.purchases
    where project_id = p_project_id and idempotency_key = v_key;
    return v_purchase_id;
  end if;

  insert into public.purchase_items(
    purchase_id, material_id, quantity, unit_price, total, received_quantity
  )
  select v_purchase_id,
         (e->>'material_id')::uuid,
         (e->>'quantity')::numeric(18,3),
         (e->>'unit_price')::numeric(18,4),
         (e->>'total')::numeric(18,2),
         0
  from jsonb_array_elements(v_items) e;

  if p_request_id is not null then
    update public.purchase_requests
    set status = 'PURCHASED'
    where id = p_request_id and project_id = p_project_id;
  end if;

  return v_purchase_id;
end;
$$;

revoke all on function public.create_purchase_atomic(uuid,uuid,varchar,uuid,date,varchar,numeric,numeric,numeric,text,jsonb,varchar) from public, anon;
grant execute on function public.create_purchase_atomic(uuid,uuid,varchar,uuid,date,varchar,numeric,numeric,numeric,text,jsonb,varchar) to authenticated;

notify pgrst, 'reload schema';