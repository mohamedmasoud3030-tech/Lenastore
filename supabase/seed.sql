-- Secure demo seed for Lenastore.
-- Apply schema.sql first, then run:
-- select public.seed_demo_data('AUTH_USER_UUID'::uuid);

create or replace function public.seed_demo_data(p_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path=public,auth,pg_temp
as $$
declare
  v_project uuid:=gen_random_uuid();
  v_m1 uuid:=gen_random_uuid(); v_m2 uuid:=gen_random_uuid(); v_m3 uuid:=gen_random_uuid(); v_m4 uuid:=gen_random_uuid(); v_m5 uuid:=gen_random_uuid();
  v_m6 uuid:=gen_random_uuid(); v_m7 uuid:=gen_random_uuid(); v_m8 uuid:=gen_random_uuid(); v_m9 uuid:=gen_random_uuid(); v_m10 uuid:=gen_random_uuid();
  v_s1 uuid:=gen_random_uuid(); v_s2 uuid:=gen_random_uuid(); v_s3 uuid:=gen_random_uuid(); v_s4 uuid:=gen_random_uuid(); v_s5 uuid:=gen_random_uuid();
  v_r1 uuid:=gen_random_uuid(); v_p1 uuid:=gen_random_uuid(); v_p2 uuid:=gen_random_uuid();
  v_pi1 uuid:=gen_random_uuid(); v_pi2 uuid:=gen_random_uuid(); v_gr1 uuid:=gen_random_uuid(); v_gri1 uuid:=gen_random_uuid();
begin
  if not exists(select 1 from auth.users where id=p_user_id) then raise exception 'demo user does not exist'; end if;
  if exists(select 1 from public.projects where user_id=p_user_id) then raise exception 'user already has a project'; end if;

  insert into public.projects(id,user_id,name,location,manager_name,phone,start_date,owner_name,currency)
  values(v_project,p_user_id,'مشروع برج النور السكني','مسقط - سلطنة عُمان','م. محمد مسعود','90000000',current_date-30,'شركة الأفق للتطوير','OMR');

  insert into public.materials(id,project_id,name,category,unit,min_stock) values
  (v_m1,v_project,'أسمنت بورتلاندي','مواد أساسية','كيس',100),
  (v_m2,v_project,'حديد تسليح 14 مم','معادن','طن',10),
  (v_m3,v_project,'رمل مغسول','مواد أساسية','م³',20),
  (v_m4,v_project,'طابوق إسمنتي','مباني','قطعة',1000),
  (v_m5,v_project,'كابلات كهرباء 4 مم','كهرباء','لفة',10),
  (v_m6,v_project,'مواسير PPR 25 مم','سباكة','متر',100),
  (v_m7,v_project,'حصى 20 مم','مواد أساسية','م³',15),
  (v_m8,v_project,'خشب شدات','نجارة','لوح',50),
  (v_m9,v_project,'بلاط بورسلان','تشطيبات','م²',200),
  (v_m10,v_project,'دهان داخلي أبيض','تشطيبات','جالون',20);

  insert into public.suppliers(id,project_id,name,company,phone,tax_id) values
  (v_s1,v_project,'مؤسسة البناء المتين','البناء المتين للتجارة','91111111','OM100001'),
  (v_s2,v_project,'مصنع قمة الصلب','قمة الصلب','92222222','OM100002'),
  (v_s3,v_project,'شركة الرمال الذهبية','الرمال الذهبية','93333333','OM100003'),
  (v_s4,v_project,'الكهرباء الحديثة','الكهرباء الحديثة','94444444','OM100004'),
  (v_s5,v_project,'بيت السباكة','بيت السباكة','95555555','OM100005');

  insert into public.purchase_requests(id,project_id,request_number,date,reason,priority,status,needed_date)
  values(v_r1,v_project,'PR-1001',current_date-15,'مواد مرحلة الأساسات','URGENT','PURCHASED',current_date-10);
  insert into public.purchase_request_items(request_id,material_id,quantity) values(v_r1,v_m1,500),(v_r1,v_m2,20);

  insert into public.purchases(id,project_id,request_id,purchase_number,supplier_id,date,subtotal,total,receipt_status,invoice_number)
  values
  (v_p1,v_project,v_r1,'PO-2001',v_s1,current_date-14,12500,12500,'FULL','INV-5001'),
  (v_p2,v_project,null,'PO-2002',v_s2,current_date-5,60000,60000,'PARTIAL','INV-5002');

  insert into public.purchase_items(id,purchase_id,material_id,quantity,unit_price,total,received_quantity) values
  (v_pi1,v_p1,v_m1,500,25,12500,500),
  (v_pi2,v_p2,v_m2,20,3000,60000,10);

  insert into public.goods_receipts(id,project_id,purchase_id,supplier_id,receipt_number,date,status,notes,idempotency_key,created_by)
  values(v_gr1,v_project,v_p1,v_s1,'GR-3001',current_date-13,'COMPLETED','استلام كامل للأسمنت','seed-gr-3001',p_user_id);
  insert into public.goods_receipt_items(id,goods_receipt_id,purchase_item_id,material_id,received_quantity)
  values(v_gri1,v_gr1,v_pi1,v_m1,500);
  insert into public.stock_movements(project_id,type,material_id,quantity,date,reference_number,purchase_id,supplier_id,source_receipt_item_id,notes,created_by)
  values(v_project,'IN',v_m1,500,current_date-13,'GR-3001',v_p1,v_s1,v_gri1,'استلام كامل',p_user_id);

  with gr as (
    insert into public.goods_receipts(project_id,purchase_id,supplier_id,receipt_number,date,status,notes,idempotency_key,created_by)
    values(v_project,v_p2,v_s2,'GR-3002',current_date-4,'COMPLETED','استلام جزئي للحديد','seed-gr-3002',p_user_id) returning id
  ), gri as (
    insert into public.goods_receipt_items(goods_receipt_id,purchase_item_id,material_id,received_quantity)
    select id,v_pi2,v_m2,10 from gr returning id
  )
  insert into public.stock_movements(project_id,type,material_id,quantity,date,reference_number,purchase_id,supplier_id,source_receipt_item_id,notes,created_by)
  select v_project,'IN',v_m2,10,current_date-4,'GR-3002',v_p2,v_s2,id,'استلام جزئي',p_user_id from gri;

  insert into public.stock_movements(project_id,type,material_id,quantity,date,reference_number,receiver_name,location_used,notes,created_by) values
  (v_project,'OUT',v_m1,150,current_date-10,'ISS-001','م. خالد','قواعد المبنى','صرف للصبة الأولى',p_user_id),
  (v_project,'IN',v_m3,18,current_date-8,'MAN-001','أمين المخزن',null,'رصيد تجريبي',p_user_id),
  (v_project,'IN',v_m4,800,current_date-7,'MAN-002','أمين المخزن',null,'رصيد أقل من الحد',p_user_id),
  (v_project,'IN',v_m5,8,current_date-6,'MAN-003','أمين المخزن',null,'رصيد منخفض',p_user_id),
  (v_project,'OUT',v_m5,8,current_date-2,'ISS-002','فني الكهرباء','الدور الأول','نفاد المخزون',p_user_id);

  insert into public.payments(project_id,purchase_id,amount,date,method,reference_number,notes,created_by) values
  (v_project,v_p1,12500,current_date-12,'TRANSFER','TRX-998877','سداد كامل',p_user_id),
  (v_project,v_p2,20000,current_date-3,'CHEQUE','CHQ-123456','دفعة جزئية',p_user_id);

  return v_project;
end;
$$;

revoke all on function public.seed_demo_data(uuid) from public,anon,authenticated;
