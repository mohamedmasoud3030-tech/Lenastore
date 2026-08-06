create or replace function public.register_payment(
  p_project_id uuid,
  p_purchase_id uuid,
  p_amount numeric,
  p_date date,
  p_method varchar,
  p_reference_number varchar,
  p_notes text,
  p_idempotency_key varchar
)
returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_payment_id uuid;
  v_total numeric(18,2);
  v_paid numeric(18,2);
  v_amount numeric(18,2);
  v_existing public.payments%rowtype;
  v_reference varchar(100);
  v_notes text;
  v_method varchar(20);
  v_key varchar(100);
  v_purchase_status varchar(20);
begin
  if auth.uid() is null or not public.owns_project(p_project_id) then raise exception 'unauthorized'; end if;
  if p_amount is null then raise exception 'payment amount must be positive'; end if;
  v_amount:=round(p_amount,2)::numeric(18,2);
  if v_amount<=0 then raise exception 'payment amount must be positive'; end if;
  if p_date is null then raise exception 'payment date is required'; end if;
  v_method:=upper(btrim(coalesce(p_method,'')));
  if v_method not in ('CASH','TRANSFER','CHEQUE','OTHER') then raise exception 'invalid payment method'; end if;
  v_key:=btrim(coalesce(p_idempotency_key,''));
  if v_key='' or length(v_key)>100 then raise exception 'invalid idempotency key'; end if;
  if length(btrim(coalesce(p_reference_number,'')))>100 then raise exception 'payment reference is too long'; end if;
  v_reference:=nullif(btrim(p_reference_number),'');
  v_notes:=nullif(btrim(p_notes),'');

  select * into v_existing from public.payments
  where project_id=p_project_id and idempotency_key=v_key;
  if found then
    if v_existing.purchase_id is distinct from p_purchase_id
       or v_existing.amount is distinct from v_amount
       or v_existing.date is distinct from p_date
       or v_existing.method is distinct from v_method
       or v_existing.reference_number is distinct from v_reference
       or v_existing.notes is distinct from v_notes then
      raise exception 'idempotency key payload mismatch';
    end if;
    return v_existing.id;
  end if;

  select status into v_purchase_status from public.purchases
  where id=p_purchase_id and project_id=p_project_id
  for update;
  if not found then raise exception 'purchase not found or unauthorized'; end if;
  if v_purchase_status<>'ACTIVE' then raise exception 'cancelled purchase cannot receive payments'; end if;

  select purchase_total into v_total from public.purchase_balances where purchase_id=p_purchase_id;
  select coalesce(sum(amount),0)::numeric(18,2) into v_paid
  from public.payments where purchase_id=p_purchase_id and status='POSTED';
  if v_paid+v_amount>v_total then raise exception 'Payment amount exceeds remaining balance. Remaining: %',v_total-v_paid; end if;

  insert into public.payments(project_id,purchase_id,amount,date,method,reference_number,notes,idempotency_key,created_by)
  values(p_project_id,p_purchase_id,v_amount,p_date,v_method,v_reference,v_notes,v_key,auth.uid())
  returning id into v_payment_id;
  return v_payment_id;
end;
$$;
revoke all on function public.register_payment(uuid,uuid,numeric,date,varchar,varchar,text,varchar) from public,anon;
grant execute on function public.register_payment(uuid,uuid,numeric,date,varchar,varchar,text,varchar) to authenticated;

create or replace function public.receive_goods(
  p_project_id uuid,
  p_purchase_id uuid,
  p_receipt_number varchar,
  p_receipt_date date,
  p_notes text,
  p_items jsonb,
  p_idempotency_key varchar
)
returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_receipt_id uuid;
  v_supplier_id uuid;
  v_item record;
  v_pi public.purchase_items%rowtype;
  v_receipt_item_id uuid;
  v_received_before numeric(18,3);
  v_count integer:=0;
begin
  if auth.uid() is null or not public.owns_project(p_project_id) then raise exception 'unauthorized'; end if;
  if p_idempotency_key is null or btrim(p_idempotency_key)='' then raise exception 'idempotency key required'; end if;
  select id into v_receipt_id from public.goods_receipts where project_id=p_project_id and idempotency_key=p_idempotency_key;
  if found then return v_receipt_id; end if;
  select supplier_id into v_supplier_id from public.purchases
  where id=p_purchase_id and project_id=p_project_id and status='ACTIVE'
  for update;
  if not found then raise exception 'active purchase not found or unauthorized'; end if;
  insert into public.goods_receipts(project_id,purchase_id,supplier_id,receipt_number,date,notes,idempotency_key,created_by)
  values(p_project_id,p_purchase_id,v_supplier_id,p_receipt_number,p_receipt_date,p_notes,p_idempotency_key,auth.uid())
  on conflict(project_id,idempotency_key) do nothing returning id into v_receipt_id;
  if v_receipt_id is null then select id into v_receipt_id from public.goods_receipts where project_id=p_project_id and idempotency_key=p_idempotency_key; return v_receipt_id; end if;
  for v_item in
    select (e->>'purchase_item_id')::uuid as purchase_item_id,sum((e->>'quantity')::numeric) as quantity
    from jsonb_array_elements(p_items)e group by (e->>'purchase_item_id')::uuid
  loop
    v_count:=v_count+1;
    if v_item.quantity<=0 then raise exception 'received quantity must be positive'; end if;
    select * into v_pi from public.purchase_items where id=v_item.purchase_item_id and purchase_id=p_purchase_id for update;
    if not found then raise exception 'purchase item not found for purchase'; end if;
    select coalesce(sum(gri.received_quantity),0) into v_received_before
    from public.goods_receipt_items gri join public.goods_receipts gr on gr.id=gri.goods_receipt_id
    where gri.purchase_item_id=v_pi.id and gr.status='COMPLETED';
    if v_received_before+v_item.quantity>v_pi.quantity then raise exception 'Cannot receive more than ordered for item %',v_pi.id; end if;
    insert into public.goods_receipt_items(goods_receipt_id,purchase_item_id,material_id,received_quantity)
    values(v_receipt_id,v_pi.id,v_pi.material_id,v_item.quantity) returning id into v_receipt_item_id;
    update public.purchase_items set received_quantity=v_received_before+v_item.quantity where id=v_pi.id;
    insert into public.stock_movements(project_id,type,material_id,quantity,date,reference_number,purchase_id,supplier_id,source_receipt_item_id,notes,created_by)
    values(p_project_id,'IN',v_pi.material_id,v_item.quantity,p_receipt_date,p_receipt_number,p_purchase_id,v_supplier_id,v_receipt_item_id,'استلام مواد',auth.uid());
  end loop;
  if v_count=0 then raise exception 'at least one receipt item is required'; end if;
  update public.purchases p set receipt_status=case
    when not exists(select 1 from public.purchase_items pi where pi.purchase_id=p.id and pi.received_quantity<pi.quantity) then 'FULL'
    when exists(select 1 from public.purchase_items pi where pi.purchase_id=p.id and pi.received_quantity>0) then 'PARTIAL'
    else 'UNRECEIVED' end
  where p.id=p_purchase_id;
  return v_receipt_id;
end;
$$;
revoke all on function public.receive_goods(uuid,uuid,varchar,date,text,jsonb,varchar) from public,anon;
grant execute on function public.receive_goods(uuid,uuid,varchar,date,text,jsonb,varchar) to authenticated;

create or replace function public.issue_stock(
  p_project_id uuid,
  p_issue_number varchar,
  p_issue_date date,
  p_receiver_name varchar,
  p_destination varchar,
  p_reference_number varchar,
  p_notes text,
  p_items jsonb,
  p_idempotency_key varchar
)
returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_issue_id uuid;
  v_item record;
  v_balance numeric(18,3);
  v_movement_id uuid;
begin
  if auth.uid() is null or not public.owns_project(p_project_id) then raise exception 'unauthorized'; end if;
  if p_issue_number is null or btrim(p_issue_number)='' then raise exception 'issue number is required'; end if;
  if p_issue_date is null then raise exception 'issue date is required'; end if;
  if p_receiver_name is null or btrim(p_receiver_name)='' then raise exception 'receiver name is required'; end if;
  if p_idempotency_key is null or btrim(p_idempotency_key)='' then raise exception 'idempotency key required'; end if;
  if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then raise exception 'at least one issue item is required'; end if;
  if exists(select 1 from jsonb_array_elements(p_items)e
            where jsonb_typeof(e)<>'object'
               or coalesce(e->>'material_id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
               or coalesce(e->>'quantity','') !~ '^[[:space:]]*[0-9]+([.][0-9]+)?[[:space:]]*$') then
    raise exception 'invalid issue item payload';
  end if;
  select id into v_issue_id from public.stock_issues where project_id=p_project_id and idempotency_key=p_idempotency_key;
  if found then return v_issue_id; end if;
  for v_item in
    select (e->>'material_id')::uuid material_id,sum((e->>'quantity')::numeric)::numeric(18,3) quantity
    from jsonb_array_elements(p_items)e group by (e->>'material_id')::uuid order by 1
  loop
    if v_item.quantity<=0 then raise exception 'issued quantity must be positive'; end if;
    perform pg_advisory_xact_lock(hashtextextended(v_item.material_id::text,0));
    if not exists(select 1 from public.materials m where m.id=v_item.material_id and m.project_id=p_project_id) then raise exception 'material % does not belong to project',v_item.material_id; end if;
    select coalesce(sum(case when sm.type='IN' then sm.quantity else -sm.quantity end),0)::numeric(18,3)
    into v_balance from public.stock_movements sm where sm.project_id=p_project_id and sm.material_id=v_item.material_id;
    if v_balance<v_item.quantity then raise exception 'insufficient stock. available: %, requested: %',v_balance,v_item.quantity; end if;
  end loop;
  insert into public.stock_issues(project_id,issue_number,date,receiver_name,destination,reference_number,notes,idempotency_key,created_by,status)
  values(p_project_id,btrim(p_issue_number),p_issue_date,btrim(p_receiver_name),nullif(btrim(p_destination),''),nullif(btrim(p_reference_number),''),nullif(btrim(p_notes),''),btrim(p_idempotency_key),auth.uid(),'COMPLETED')
  on conflict(project_id,idempotency_key) do nothing returning id into v_issue_id;
  if v_issue_id is null then select id into v_issue_id from public.stock_issues where project_id=p_project_id and idempotency_key=p_idempotency_key; return v_issue_id; end if;
  for v_item in
    select (e->>'material_id')::uuid material_id,sum((e->>'quantity')::numeric)::numeric(18,3) quantity
    from jsonb_array_elements(p_items)e group by (e->>'material_id')::uuid order by 1
  loop
    insert into public.stock_movements(project_id,type,material_id,quantity,date,reference_number,receiver_name,location_used,notes,created_by)
    values(p_project_id,'OUT',v_item.material_id,v_item.quantity,p_issue_date,btrim(p_issue_number),btrim(p_receiver_name),nullif(btrim(p_destination),''),nullif(btrim(p_notes),''),auth.uid())
    returning id into v_movement_id;
    insert into public.stock_issue_items(stock_issue_id,material_id,quantity,stock_movement_id)
    values(v_issue_id,v_item.material_id,v_item.quantity,v_movement_id);
  end loop;
  return v_issue_id;
end;
$$;
revoke all on function public.issue_stock(uuid,varchar,date,varchar,varchar,varchar,text,jsonb,varchar) from public,anon;
grant execute on function public.issue_stock(uuid,varchar,date,varchar,varchar,varchar,text,jsonb,varchar) to authenticated;

notify pgrst,'reload schema';
