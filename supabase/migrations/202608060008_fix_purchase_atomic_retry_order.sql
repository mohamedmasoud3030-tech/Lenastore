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