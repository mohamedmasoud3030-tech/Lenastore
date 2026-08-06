-- Lenastore stock issues assertion test.
-- Run after schema.sql and 202608060002_add_stock_issues_and_rpc.sql.

begin;

insert into public.projects(id,user_id,name,start_date) values
('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Test P1',current_date);

insert into public.materials(id,project_id,name,unit,min_stock) values
('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111','Test Cement','Bag',10);

-- Initial stock entry
insert into public.stock_movements(project_id,type,material_id,quantity,date,reference_number)
values('11111111-1111-4111-8111-111111111111','IN','33333333-3333-4333-8333-333333333333',50,current_date,'INIT-100');

set local role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);

do $$
declare
  v_iss1 uuid;
  v_iss2 uuid;
  v_failed boolean;
  v_stock numeric(18,3);
begin
  -- Check current stock is 50
  select current_stock into v_stock from public.material_stock where material_id='33333333-3333-4333-8333-333333333333';
  if v_stock <> 50 then raise exception 'initial stock mismatch: expected 50, got %', v_stock; end if;

  -- 1. Issue stock of 20 units
  v_iss1 := public.issue_stock(
    '11111111-1111-4111-8111-111111111111',
    'IS-001',
    current_date,
    'Ahmad Receiver',
    'Building A - Ground Floor',
    'REF-001',
    'Routine concrete work',
    jsonb_build_array(jsonb_build_object('material_id','33333333-3333-4333-8333-333333333333','quantity',20)),
    'idem-issue-001'
  );

  -- Check remaining stock is 30
  select current_stock into v_stock from public.material_stock where material_id='33333333-3333-4333-8333-333333333333';
  if v_stock <> 30 then raise exception 'stock after issue mismatch: expected 30, got %', v_stock; end if;

  -- 2. Retry with same idempotency key
  v_iss2 := public.issue_stock(
    '11111111-1111-4111-8111-111111111111',
    'IS-001',
    current_date,
    'Ahmad Receiver',
    'Building A - Ground Floor',
    'REF-001',
    'Routine concrete work',
    jsonb_build_array(jsonb_build_object('material_id','33333333-3333-4333-8333-333333333333','quantity',20)),
    'idem-issue-001'
  );

  if v_iss1 <> v_iss2 then raise exception 'issue idempotency mismatch'; end if;

  select current_stock into v_stock from public.material_stock where material_id='33333333-3333-4333-8333-333333333333';
  if v_stock <> 30 then raise exception 'stock after retry changed: expected 30, got %', v_stock; end if;

  -- 3. Over-issue check (try to issue 35 when only 30 available)
  v_failed := false;
  begin
    perform public.issue_stock(
      '11111111-1111-4111-8111-111111111111',
      'IS-002',
      current_date,
      'Ahmad Receiver',
      'Site B',
      null,
      'Over issue request',
      jsonb_build_array(jsonb_build_object('material_id','33333333-3333-4333-8333-333333333333','quantity',35)),
      'idem-issue-over'
    );
  exception when others then v_failed := true;
  end;

  if not v_failed then raise exception 'over-issue was incorrectly allowed'; end if;

end $$;

reset role;
select 'PASS' as result;
rollback;
