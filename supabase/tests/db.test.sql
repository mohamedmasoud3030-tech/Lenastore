-- End-to-end database flow assertions for the current Lenastore contract.
-- Transactional: leaves no test data.

begin;

insert into public.projects(id,user_id,name,start_date,currency) values
('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Flow Test P1',current_date,'EGP'),
('22222222-2222-4222-8222-222222222222','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Flow Test P2',current_date,'EGP');
insert into public.materials(id,project_id,name,unit,min_stock) values
('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111','Test Cement','Bag',10),
('44444444-4444-4444-8444-444444444444','22222222-2222-4222-8222-222222222222','Other Material','Bag',10);
insert into public.suppliers(id,project_id,name) values
('55555555-5555-4555-8555-555555555555','11111111-1111-4111-8111-111111111111','Test Supplier');
insert into storage.objects(id,bucket_id,name) values
('88888888-8888-4888-8888-888888888888','attachments','11111111-1111-4111-8111-111111111111/p1.pdf'),
('99999999-9999-4999-8999-999999999999','attachments','22222222-2222-4222-8222-222222222222/p2.pdf');

set local role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);

do $$
declare
  v_request uuid;
  v_purchase uuid;
  v_purchase_item uuid;
  v_receipt_1 uuid;
  v_receipt_2 uuid;
  v_payment uuid;
  v_issue uuid;
  v_failed boolean;
begin
  v_request:=public.create_purchase_request_atomic(
    '11111111-1111-4111-8111-111111111111','PR-FLOW-1',current_date,'Site requirement','NORMAL',current_date+3,null,
    jsonb_build_array(jsonb_build_object('material_id','33333333-3333-4333-8333-333333333333','quantity',100)),
    'flow-request-1'
  );
  v_purchase:=public.create_purchase_atomic(
    '11111111-1111-4111-8111-111111111111',v_request,'PO-FLOW-1','55555555-5555-4555-8555-555555555555',current_date,'INV-FLOW-1',
    50,100,25,'Flow purchase',
    jsonb_build_array(jsonb_build_object('material_id','33333333-3333-4333-8333-333333333333','quantity',100,'unit_price',10)),
    'flow-purchase-1'
  );
  select id into v_purchase_item from public.purchase_items where purchase_id=v_purchase;

  if (select subtotal from public.purchases where id=v_purchase)<>1000 then raise exception 'server subtotal mismatch'; end if;
  if (select total from public.purchases where id=v_purchase)<>1075 then raise exception 'server total mismatch'; end if;
  if (select count(*) from public.stock_movements where project_id='11111111-1111-4111-8111-111111111111')<>0 then raise exception 'purchase changed stock'; end if;

  v_receipt_1:=public.receive_goods(
    '11111111-1111-4111-8111-111111111111',v_purchase,'GR-FLOW-1',current_date,'partial',
    jsonb_build_array(jsonb_build_object('purchase_item_id',v_purchase_item,'quantity',40)),
    'flow-receipt-1'
  );
  if (select current_stock from public.material_stock where material_id='33333333-3333-4333-8333-333333333333')<>40 then raise exception 'partial stock mismatch'; end if;
  if (select receipt_status from public.purchases where id=v_purchase)<>'PARTIAL' then raise exception 'partial receipt status mismatch'; end if;

  v_receipt_2:=public.receive_goods(
    '11111111-1111-4111-8111-111111111111',v_purchase,'GR-FLOW-1',current_date,'retry',
    jsonb_build_array(jsonb_build_object('purchase_item_id',v_purchase_item,'quantity',40)),
    'flow-receipt-1'
  );
  if v_receipt_1<>v_receipt_2 then raise exception 'receipt retry id mismatch'; end if;
  if (select count(*) from public.goods_receipts where purchase_id=v_purchase)<>1 then raise exception 'duplicate receipt'; end if;

  v_failed:=false;
  begin
    perform public.receive_goods(
      '11111111-1111-4111-8111-111111111111',v_purchase,'GR-OVER',current_date,'over',
      jsonb_build_array(jsonb_build_object('purchase_item_id',v_purchase_item,'quantity',61)),
      'flow-receipt-over'
    );
  exception when others then v_failed:=true;
  end;
  if not v_failed then raise exception 'over receipt allowed'; end if;

  perform public.receive_goods(
    '11111111-1111-4111-8111-111111111111',v_purchase,'GR-FLOW-2',current_date,'final',
    jsonb_build_array(jsonb_build_object('purchase_item_id',v_purchase_item,'quantity',60)),
    'flow-receipt-2'
  );
  if (select current_stock from public.material_stock where material_id='33333333-3333-4333-8333-333333333333')<>100 then raise exception 'full stock mismatch'; end if;
  if (select receipt_status from public.purchases where id=v_purchase)<>'FULL' then raise exception 'full receipt status mismatch'; end if;

  v_issue:=public.issue_stock(
    '11111111-1111-4111-8111-111111111111','ISS-FLOW-1',current_date,'Engineer','Zone A',null,'Flow issue',
    jsonb_build_array(jsonb_build_object('material_id','33333333-3333-4333-8333-333333333333','quantity',30)),
    'flow-issue-1'
  );
  if (select current_stock from public.material_stock where material_id='33333333-3333-4333-8333-333333333333')<>70 then raise exception 'issue stock mismatch'; end if;
  if public.issue_stock(
    '11111111-1111-4111-8111-111111111111','ISS-FLOW-1',current_date,'Engineer','Zone A',null,'Flow issue',
    jsonb_build_array(jsonb_build_object('material_id','33333333-3333-4333-8333-333333333333','quantity',30)),
    'flow-issue-1'
  )<>v_issue then raise exception 'issue retry mismatch'; end if;

  v_failed:=false;
  begin
    perform public.issue_stock(
      '11111111-1111-4111-8111-111111111111','ISS-OVER',current_date,'Engineer','Zone B',null,null,
      jsonb_build_array(jsonb_build_object('material_id','33333333-3333-4333-8333-333333333333','quantity',71)),
      'flow-issue-over'
    );
  exception when others then v_failed:=true;
  end;
  if not v_failed then raise exception 'over issue allowed'; end if;

  v_payment:=public.register_payment(
    '11111111-1111-4111-8111-111111111111',v_purchase,600,current_date,'CASH','PAY-FLOW-1','partial','flow-payment-1'
  );
  if public.register_payment(
    '11111111-1111-4111-8111-111111111111',v_purchase,600,current_date,'CASH','PAY-FLOW-1','partial','flow-payment-1'
  )<>v_payment then raise exception 'payment retry mismatch'; end if;

  v_failed:=false;
  begin
    perform public.register_payment(
      '11111111-1111-4111-8111-111111111111',v_purchase,476,current_date,'CASH','PAY-FLOW-2','over','flow-payment-over'
    );
  exception when others then v_failed:=true;
  end;
  if not v_failed then raise exception 'overpayment allowed'; end if;
  if (select total_paid from public.purchase_balances where purchase_id=v_purchase)<>600 then raise exception 'payment balance mismatch'; end if;

  if (select count(*) from public.projects where id='22222222-2222-4222-8222-222222222222')<>0 then raise exception 'RLS project leak'; end if;
  if (select count(*) from public.material_stock where project_id='22222222-2222-4222-8222-222222222222')<>0 then raise exception 'view leak'; end if;
  if (select count(*) from storage.objects where bucket_id='attachments')<>1 then raise exception 'storage leak'; end if;

  v_failed:=false;
  begin
    insert into public.materials(project_id,name,unit)
    values('22222222-2222-4222-8222-222222222222','Cross project material','Bag');
  exception when others then v_failed:=true;
  end;
  if not v_failed then raise exception 'cross-project insert allowed'; end if;
end $$;

reset role;
select 'PASS' as result,22 as assertions_passed,0 as assertions_failed;
rollback;
