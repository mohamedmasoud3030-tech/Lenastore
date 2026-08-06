-- LENA SUPPLY stock issue release assertions.
-- Run after schema.sql and migrations 001, 002 and 003.

begin;

insert into public.projects(id,user_id,name,start_date,currency) values
('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Test P1',current_date,'EGP'),
('22222222-2222-4222-8222-222222222222','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Test P2',current_date,'EGP');

insert into public.materials(id,project_id,name,unit,min_stock) values
('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111','Test Cement','Bag',10),
('44444444-4444-4444-8444-444444444444','11111111-1111-4111-8111-111111111111','Test Steel','Ton',1),
('55555555-5555-4555-8555-555555555555','22222222-2222-4222-8222-222222222222','Foreign Material','Piece',0);

insert into public.stock_movements(project_id,type,material_id,quantity,date,reference_number) values
('11111111-1111-4111-8111-111111111111','IN','33333333-3333-4333-8333-333333333333',50,current_date,'INIT-A'),
('11111111-1111-4111-8111-111111111111','IN','44444444-4444-4444-8444-444444444444',30,current_date,'INIT-B'),
('22222222-2222-4222-8222-222222222222','IN','55555555-5555-4555-8555-555555555555',100,current_date,'INIT-C');

set local role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);

do $$
declare
  v_issue_1 uuid;
  v_issue_retry uuid;
  v_failed boolean;
  v_stock_a numeric(18,3);
  v_stock_b numeric(18,3);
  v_count integer;
begin
  select current_stock into v_stock_a
  from public.material_stock
  where material_id='33333333-3333-4333-8333-333333333333';

  if v_stock_a <> 50 then
    raise exception 'initial stock A mismatch: expected 50, got %', v_stock_a;
  end if;

  -- Duplicate material entries must be aggregated into one issue item.
  v_issue_1 := public.issue_stock(
    '11111111-1111-4111-8111-111111111111',
    'IS-001',
    current_date,
    'Ahmad Receiver',
    'Building A',
    'REF-001',
    'Release test',
    jsonb_build_array(
      jsonb_build_object('material_id','33333333-3333-4333-8333-333333333333','quantity',10),
      jsonb_build_object('material_id','33333333-3333-4333-8333-333333333333','quantity',5),
      jsonb_build_object('material_id','44444444-4444-4444-8444-444444444444','quantity',10)
    ),
    'idem-issue-001'
  );

  select current_stock into v_stock_a
  from public.material_stock
  where material_id='33333333-3333-4333-8333-333333333333';

  select current_stock into v_stock_b
  from public.material_stock
  where material_id='44444444-4444-4444-8444-444444444444';

  if v_stock_a <> 35 then
    raise exception 'stock A mismatch after issue: expected 35, got %', v_stock_a;
  end if;

  if v_stock_b <> 20 then
    raise exception 'stock B mismatch after issue: expected 20, got %', v_stock_b;
  end if;

  select count(*) into v_count
  from public.stock_issue_items
  where stock_issue_id=v_issue_1;

  if v_count <> 2 then
    raise exception 'duplicate materials were not aggregated: expected 2 rows, got %', v_count;
  end if;

  -- Same key must return the same issue without another movement.
  v_issue_retry := public.issue_stock(
    '11111111-1111-4111-8111-111111111111',
    'IGNORED-BY-IDEMPOTENCY',
    current_date,
    'Another Receiver',
    null,
    null,
    null,
    jsonb_build_array(
      jsonb_build_object('material_id','33333333-3333-4333-8333-333333333333','quantity',1)
    ),
    'idem-issue-001'
  );

  if v_issue_1 <> v_issue_retry then
    raise exception 'idempotency returned a different issue';
  end if;

  select count(*) into v_count
  from public.stock_movements
  where project_id='11111111-1111-4111-8111-111111111111'
    and reference_number='IS-001'
    and type='OUT';

  if v_count <> 2 then
    raise exception 'idempotent retry created duplicate movements: expected 2, got %', v_count;
  end if;

  -- Empty item list must fail.
  v_failed := false;
  begin
    perform public.issue_stock(
      '11111111-1111-4111-8111-111111111111','IS-EMPTY',current_date,'Receiver',null,null,null,'[]'::jsonb,'idem-empty'
    );
  exception when others then
    v_failed := true;
  end;
  if not v_failed then raise exception 'empty item list was incorrectly allowed'; end if;

  -- Invalid payload must fail before writing a header.
  v_failed := false;
  begin
    perform public.issue_stock(
      '11111111-1111-4111-8111-111111111111','IS-BAD',current_date,'Receiver',null,null,null,
      jsonb_build_array(jsonb_build_object('material_id','not-a-uuid','quantity',1)),
      'idem-bad'
    );
  exception when others then
    v_failed := true;
  end;
  if not v_failed then raise exception 'invalid item payload was incorrectly allowed'; end if;

  -- A material from another project must be rejected.
  v_failed := false;
  begin
    perform public.issue_stock(
      '11111111-1111-4111-8111-111111111111','IS-CROSS',current_date,'Receiver',null,null,null,
      jsonb_build_array(jsonb_build_object('material_id','55555555-5555-4555-8555-555555555555','quantity',1)),
      'idem-cross'
    );
  exception when others then
    v_failed := true;
  end;
  if not v_failed then raise exception 'cross-project material was incorrectly allowed'; end if;

  -- Over-issue must fail and preserve the balance.
  v_failed := false;
  begin
    perform public.issue_stock(
      '11111111-1111-4111-8111-111111111111','IS-OVER',current_date,'Receiver',null,null,null,
      jsonb_build_array(jsonb_build_object('material_id','33333333-3333-4333-8333-333333333333','quantity',36)),
      'idem-over'
    );
  exception when others then
    v_failed := true;
  end;
  if not v_failed then raise exception 'over-issue was incorrectly allowed'; end if;

  select current_stock into v_stock_a
  from public.material_stock
  where material_id='33333333-3333-4333-8333-333333333333';

  if v_stock_a <> 35 then
    raise exception 'failed issue changed stock: expected 35, got %', v_stock_a;
  end if;
end
$$;

reset role;
select 'PASS: stock issue validation, aggregation, idempotency, isolation and balance protection' as result;
rollback;
