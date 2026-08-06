-- Transactional regression coverage for reversals, returns and document cancellation.
-- Leaves no residual data.

begin;

insert into public.projects(id,user_id,name,start_date,currency) values
('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Corrections Test',current_date,'EGP');
insert into public.materials(id,project_id,name,unit,min_stock) values
('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111','Test Cement','Bag',0);
insert into public.suppliers(id,project_id,name) values
('55555555-5555-4555-8555-555555555555','11111111-1111-4111-8111-111111111111','Test Supplier');

set local role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);

do $$
declare
  v_request uuid;
  v_request_cancel uuid;
  v_purchase uuid;
  v_purchase_cancel uuid;
  v_purchase_item uuid;
  v_receipt uuid;
  v_payment uuid;
  v_issue uuid;
  v_return uuid;
  v_failed boolean;
begin
  v_request_cancel:=public.create_purchase_request_atomic(
    '11111111-1111-4111-8111-111111111111','PR-CANCEL',current_date,'Cancel me','NORMAL',null,null,
    jsonb_build_array(jsonb_build_object('material_id','33333333-3333-4333-8333-333333333333','quantity',1)),
    'request-cancel-create'
  );
  perform public.cancel_purchase_request(
    '11111111-1111-4111-8111-111111111111',v_request_cancel,'No longer needed','request-cancel-1'
  );
  if (select status from public.purchase_requests where id=v_request_cancel)<>'CANCELLED' then raise exception 'request not cancelled'; end if;
  if public.cancel_purchase_request(
    '11111111-1111-4111-8111-111111111111',v_request_cancel,'No longer needed','request-cancel-1'
  )<>v_request_cancel then raise exception 'request cancellation retry mismatch'; end if;

  v_purchase_cancel:=public.create_purchase_atomic(
    '11111111-1111-4111-8111-111111111111',null,'PO-CANCEL',
    '55555555-5555-4555-8555-555555555555',current_date,null,0,0,0,null,
    jsonb_build_array(jsonb_build_object('material_id','33333333-3333-4333-8333-333333333333','quantity',1,'unit_price',10)),
    'purchase-cancel-create'
  );
  perform public.cancel_purchase(
    '11111111-1111-4111-8111-111111111111',v_purchase_cancel,'Entered by mistake','purchase-cancel-1'
  );
  if (select status from public.purchases where id=v_purchase_cancel)<>'CANCELLED' then raise exception 'purchase not cancelled'; end if;

  v_failed:=false;
  begin
    perform public.register_payment(
      '11111111-1111-4111-8111-111111111111',v_purchase_cancel,1,current_date,'CASH',null,null,'cancelled-purchase-payment'
    );
  exception when others then v_failed:=true;
  end;
  if not v_failed then raise exception 'cancelled purchase accepted payment'; end if;

  v_request:=public.create_purchase_request_atomic(
    '11111111-1111-4111-8111-111111111111','PR-CORRECTION',current_date,'Correction flow','NORMAL',null,null,
    jsonb_build_array(jsonb_build_object('material_id','33333333-3333-4333-8333-333333333333','quantity',10)),
    'request-correction-create'
  );
  v_purchase:=public.create_purchase_atomic(
    '11111111-1111-4111-8111-111111111111',v_request,'PO-CORRECTION',
    '55555555-5555-4555-8555-555555555555',current_date,null,0,0,0,null,
    jsonb_build_array(jsonb_build_object('material_id','33333333-3333-4333-8333-333333333333','quantity',10,'unit_price',10)),
    'purchase-correction-create'
  );
  select id into v_purchase_item from public.purchase_items where purchase_id=v_purchase;

  v_receipt:=public.receive_goods(
    '11111111-1111-4111-8111-111111111111',v_purchase,'GR-CORRECTION',current_date,'Received',
    jsonb_build_array(jsonb_build_object('purchase_item_id',v_purchase_item,'quantity',10)),
    'receipt-correction-create'
  );
  v_payment:=public.register_payment(
    '11111111-1111-4111-8111-111111111111',v_purchase,100,current_date,'CASH','PAY-100','Paid','payment-correction-create'
  );
  v_issue:=public.issue_stock(
    '11111111-1111-4111-8111-111111111111','ISS-CORRECTION',current_date,'Engineer','Zone A',null,'Issued',
    jsonb_build_array(jsonb_build_object('material_id','33333333-3333-4333-8333-333333333333','quantity',4)),
    'issue-correction-create'
  );

  v_failed:=false;
  begin
    perform public.cancel_goods_receipt(
      '11111111-1111-4111-8111-111111111111',v_receipt,current_date,'Wrong receipt','receipt-cancel-1'
    );
  exception when others then v_failed:=true;
  end;
  if not v_failed then raise exception 'receipt cancellation allowed after stock consumption'; end if;

  perform public.reverse_payment(
    '11111111-1111-4111-8111-111111111111',v_payment,'Duplicate payment','payment-reverse-1'
  );
  if (select total_paid from public.purchase_balances where purchase_id=v_purchase)<>0 then raise exception 'reversed payment still counted'; end if;
  if public.reverse_payment(
    '11111111-1111-4111-8111-111111111111',v_payment,'Duplicate payment','payment-reverse-1'
  )<>v_payment then raise exception 'payment reversal retry mismatch'; end if;

  perform public.cancel_stock_issue(
    '11111111-1111-4111-8111-111111111111',v_issue,current_date,'Issue entered by mistake','issue-cancel-1'
  );
  if (select current_stock from public.material_stock where material_id='33333333-3333-4333-8333-333333333333')<>10 then raise exception 'issue reversal stock mismatch'; end if;

  v_return:=public.create_purchase_return(
    '11111111-1111-4111-8111-111111111111',v_purchase,'RET-1',current_date,'Damaged',
    jsonb_build_array(jsonb_build_object('purchase_item_id',v_purchase_item,'quantity',4)),
    'return-1'
  );
  if (select purchase_total from public.purchase_balances where purchase_id=v_purchase)<>60 then raise exception 'return net payable mismatch'; end if;
  if (select current_stock from public.material_stock where material_id='33333333-3333-4333-8333-333333333333')<>6 then raise exception 'return stock mismatch'; end if;
  if public.create_purchase_return(
    '11111111-1111-4111-8111-111111111111',v_purchase,'RET-1',current_date,'Damaged',
    jsonb_build_array(jsonb_build_object('purchase_item_id',v_purchase_item,'quantity',4)),
    'return-1'
  )<>v_return then raise exception 'return retry mismatch'; end if;

  v_failed:=false;
  begin
    perform public.cancel_goods_receipt(
      '11111111-1111-4111-8111-111111111111',v_receipt,current_date,'Wrong receipt','receipt-cancel-1'
    );
  exception when others then v_failed:=true;
  end;
  if not v_failed then raise exception 'receipt cancellation allowed while returned stock remains accounted'; end if;

  if (select count(*) from public.audit_events where project_id='11111111-1111-4111-8111-111111111111')<4 then raise exception 'audit events missing'; end if;
  if (select count(*) from public.stock_reversals where project_id='11111111-1111-4111-8111-111111111111')<1 then raise exception 'stock reversal lineage missing'; end if;
end $$;

reset role;
select 'PASS' as result, 17 as assertions_passed, 0 as assertions_failed;
rollback;
