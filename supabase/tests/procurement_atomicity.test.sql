-- Transactional regression test for atomic purchase requests and purchase orders.
-- Leaves no data behind.

begin;

insert into public.projects(id,user_id,name,start_date,currency) values
('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Atomic Test P1',current_date,'EGP'),
('22222222-2222-4222-8222-222222222222','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Atomic Test P2',current_date,'EGP');

insert into public.materials(id,project_id,name,unit,min_stock) values
('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111','Atomic Cement','Bag',0),
('44444444-4444-4444-8444-444444444444','22222222-2222-4222-8222-222222222222','Other Project Material','Bag',0);

insert into public.suppliers(id,project_id,name) values
('55555555-5555-4555-8555-555555555555','11111111-1111-4111-8111-111111111111','Atomic Supplier');

set local role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);

do $$
declare
  v_request_1 uuid;
  v_request_2 uuid;
  v_purchase_1 uuid;
  v_purchase_2 uuid;
  v_failed boolean;
begin
  v_request_1 := public.create_purchase_request_atomic(
    '11111111-1111-4111-8111-111111111111','PR-ATOMIC-1',current_date,
    'Atomic request','URGENT',current_date + 2,'notes',
    jsonb_build_array(jsonb_build_object('material_id','33333333-3333-4333-8333-333333333333','quantity',10)),
    'request-attempt-1'
  );

  v_request_2 := public.create_purchase_request_atomic(
    '11111111-1111-4111-8111-111111111111','PR-ATOMIC-1',current_date,
    'Atomic request','URGENT',current_date + 2,'notes',
    jsonb_build_array(jsonb_build_object('material_id','33333333-3333-4333-8333-333333333333','quantity',10)),
    'request-attempt-1'
  );

  if v_request_1 <> v_request_2 then raise exception 'request retry returned different id'; end if;
  if (select count(*) from public.purchase_requests where id=v_request_1) <> 1 then raise exception 'duplicate request'; end if;
  if (select count(*) from public.purchase_request_items where request_id=v_request_1) <> 1 then raise exception 'request items missing or duplicated'; end if;

  v_failed := false;
  begin
    perform public.create_purchase_request_atomic(
      '11111111-1111-4111-8111-111111111111','PR-CROSS',current_date,
      'Cross material','NORMAL',null,null,
      jsonb_build_array(jsonb_build_object('material_id','44444444-4444-4444-8444-444444444444','quantity',1)),
      'request-cross'
    );
  exception when others then v_failed := true;
  end;
  if not v_failed then raise exception 'cross-project request material accepted'; end if;

  v_purchase_1 := public.create_purchase_atomic(
    '11111111-1111-4111-8111-111111111111',v_request_1,'PO-ATOMIC-1',
    '55555555-5555-4555-8555-555555555555',current_date,'INV-ATOMIC',
    10,15,5,'purchase notes',
    jsonb_build_array(jsonb_build_object('material_id','33333333-3333-4333-8333-333333333333','quantity',10,'unit_price',25.555)),
    'purchase-attempt-1'
  );

  v_purchase_2 := public.create_purchase_atomic(
    '11111111-1111-4111-8111-111111111111',v_request_1,'PO-ATOMIC-1',
    '55555555-5555-4555-8555-555555555555',current_date,'INV-ATOMIC',
    10,15,5,'purchase notes',
    jsonb_build_array(jsonb_build_object('material_id','33333333-3333-4333-8333-333333333333','quantity',10,'unit_price',25.555)),
    'purchase-attempt-1'
  );

  if v_purchase_1 <> v_purchase_2 then raise exception 'purchase retry returned different id'; end if;
  if (select subtotal from public.purchases where id=v_purchase_1) <> 255.55 then raise exception 'subtotal calculation mismatch'; end if;
  if (select total from public.purchases where id=v_purchase_1) <> 265.55 then raise exception 'purchase total calculation mismatch'; end if;
  if (select status from public.purchase_requests where id=v_request_1) <> 'PURCHASED' then raise exception 'request not marked purchased'; end if;
  if (select count(*) from public.purchase_balances((select p from public.purchases p where p.id=v_purchase_1))) <> 1 then raise exception 'computed relationship failed'; end if;

  v_failed := false;
  begin
    perform public.create_purchase_atomic(
      '11111111-1111-4111-8111-111111111111',v_request_1,'PO-ATOMIC-2',
      '55555555-5555-4555-8555-555555555555',current_date,null,
      0,0,0,null,
      jsonb_build_array(jsonb_build_object('material_id','33333333-3333-4333-8333-333333333333','quantity',1,'unit_price',1)),
      'purchase-attempt-2'
    );
  exception when others then v_failed := true;
  end;
  if not v_failed then raise exception 'request converted twice'; end if;

  v_failed := false;
  begin
    insert into public.stock_movements(project_id,type,material_id,quantity,date,receiver_name,location_used,created_by)
    values('11111111-1111-4111-8111-111111111111','IN','44444444-4444-4444-8444-444444444444',1,current_date,'tester','site','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  exception when others then v_failed := true;
  end;
  if not v_failed then raise exception 'cross-project manual stock movement accepted'; end if;
end $$;

reset role;
select 'PASS' as result, 12 as assertions_passed, 0 as assertions_failed;
rollback;
