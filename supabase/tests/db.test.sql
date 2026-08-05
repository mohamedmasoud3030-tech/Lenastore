-- Lenastore database release assertions.
-- Run after schema.sql. The script is transactional and leaves no test data.

begin;

insert into public.projects(id,user_id,name,start_date) values
('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Test P1',current_date),
('22222222-2222-4222-8222-222222222222','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Test P2',current_date);
insert into public.materials(id,project_id,name,unit,min_stock) values
('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111','Test Cement','Bag',10),
('44444444-4444-4444-8444-444444444444','22222222-2222-4222-8222-222222222222','Other Material','Bag',10);
insert into public.suppliers(id,project_id,name) values
('55555555-5555-4555-8555-555555555555','11111111-1111-4111-8111-111111111111','Test Supplier');
insert into public.purchases(id,project_id,purchase_number,supplier_id,date,subtotal,total) values
('66666666-6666-4666-8666-666666666666','11111111-1111-4111-8111-111111111111','PO-TEST','55555555-5555-4555-8555-555555555555',current_date,1000,1000);
insert into public.purchase_items(id,purchase_id,material_id,quantity,unit_price,total) values
('77777777-7777-4777-8777-777777777777','66666666-6666-4666-8666-666666666666','33333333-3333-4333-8333-333333333333',100,10,1000);
insert into storage.objects(id,bucket_id,name) values
('88888888-8888-4888-8888-888888888888','attachments','11111111-1111-4111-8111-111111111111/p1.pdf'),
('99999999-9999-4999-8999-999999999999','attachments','22222222-2222-4222-8222-222222222222/p2.pdf');

set local role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);

do $$
declare
  v_r1 uuid;
  v_r2 uuid;
  v_failed boolean;
begin
  if (select count(*) from public.stock_movements where project_id='11111111-1111-4111-8111-111111111111')<>0 then raise exception 'purchase changed stock'; end if;

  v_r1:=public.receive_goods(
    '11111111-1111-4111-8111-111111111111',
    '66666666-6666-4666-8666-666666666666',
    'GR-TEST-1',current_date,'partial',
    jsonb_build_array(jsonb_build_object('purchase_item_id','77777777-7777-4777-8777-777777777777','quantity',40)),
    'idem-test-1'
  );
  if (select current_stock from public.material_stock where material_id='33333333-3333-4333-8333-333333333333')<>40 then raise exception 'partial stock mismatch'; end if;
  if (select receipt_status from public.purchases where id='66666666-6666-4666-8666-666666666666')<>'PARTIAL' then raise exception 'partial status mismatch'; end if;

  v_r2:=public.receive_goods(
    '11111111-1111-4111-8111-111111111111',
    '66666666-6666-4666-8666-666666666666',
    'GR-TEST-1',current_date,'retry',
    jsonb_build_array(jsonb_build_object('purchase_item_id','77777777-7777-4777-8777-777777777777','quantity',40)),
    'idem-test-1'
  );
  if v_r1<>v_r2 then raise exception 'idempotency id mismatch'; end if;
  if (select count(*) from public.goods_receipts where purchase_id='66666666-6666-4666-8666-666666666666')<>1 then raise exception 'duplicate receipt'; end if;
  if (select count(*) from public.stock_movements where purchase_id='66666666-6666-4666-8666-666666666666')<>1 then raise exception 'duplicate movement'; end if;

  v_failed:=false;
  begin
    perform public.receive_goods(
      '11111111-1111-4111-8111-111111111111',
      '66666666-6666-4666-8666-666666666666',
      'GR-OVER',current_date,'over',
      jsonb_build_array(jsonb_build_object('purchase_item_id','77777777-7777-4777-8777-777777777777','quantity',61)),
      'idem-over'
    );
  exception when others then v_failed:=true;
  end;
  if not v_failed then raise exception 'over receipt allowed'; end if;

  perform public.receive_goods(
    '11111111-1111-4111-8111-111111111111',
    '66666666-6666-4666-8666-666666666666',
    'GR-TEST-2',current_date,'final',
    jsonb_build_array(jsonb_build_object('purchase_item_id','77777777-7777-4777-8777-777777777777','quantity',60)),
    'idem-test-2'
  );
  if (select current_stock from public.material_stock where material_id='33333333-3333-4333-8333-333333333333')<>100 then raise exception 'full stock mismatch'; end if;
  if (select receipt_status from public.purchases where id='66666666-6666-4666-8666-666666666666')<>'FULL' then raise exception 'full status mismatch'; end if;

  v_failed:=false;
  begin
    insert into public.stock_movements(project_id,type,material_id,quantity,date,receiver_name,location_used)
    values('11111111-1111-4111-8111-111111111111','OUT','33333333-3333-4333-8333-333333333333',101,current_date,'tester','site');
  exception when others then v_failed:=true;
  end;
  if not v_failed then raise exception 'over issue allowed'; end if;

  perform public.register_payment('11111111-1111-4111-8111-111111111111','66666666-6666-4666-8666-666666666666',600,current_date,'CASH','PAY-1','partial');
  v_failed:=false;
  begin
    perform public.register_payment('11111111-1111-4111-8111-111111111111','66666666-6666-4666-8666-666666666666',401,current_date,'CASH','PAY-2','over');
  exception when others then v_failed:=true;
  end;
  if not v_failed then raise exception 'overpayment allowed'; end if;
  if (select total_paid from public.purchase_balances where purchase_id='66666666-6666-4666-8666-666666666666')<>600 then raise exception 'payment balance mismatch'; end if;

  if (select count(*) from public.projects where id='22222222-2222-4222-8222-222222222222')<>0 then raise exception 'RLS project leak'; end if;
  if (select count(*) from public.material_stock where project_id='22222222-2222-4222-8222-222222222222')<>0 then raise exception 'view leak'; end if;
  if (select count(*) from storage.objects where bucket_id='attachments')<>1 then raise exception 'storage leak'; end if;

  v_failed:=false;
  begin
    insert into public.materials(project_id,name,unit) values('22222222-2222-4222-8222-222222222222','Cross','Bag');
  exception when others then v_failed:=true;
  end;
  if not v_failed then raise exception 'cross-project insert allowed'; end if;
end $$;

reset role;
select 'PASS' as result,13 as assertions_passed,0 as assertions_failed;
rollback;
