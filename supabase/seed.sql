-- supabase/seed.sql
-- Seed data for Construction MVP
-- Provides realistic Arabic data for testing.
-- Usage: SELECT seed_demo_data('YOUR-USER-UUID-HERE');

CREATE OR REPLACE FUNCTION seed_demo_data(p_user_id UUID) RETURNS VOID AS $$
DECLARE
  v_project_id UUID := uuid_generate_v4();
  v_mat1 UUID := uuid_generate_v4();
  v_mat2 UUID := uuid_generate_v4();
  v_mat3 UUID := uuid_generate_v4();
  v_mat4 UUID := uuid_generate_v4();
  v_sup1 UUID := uuid_generate_v4();
  v_sup2 UUID := uuid_generate_v4();
  v_req1 UUID := uuid_generate_v4();
  v_pur1 UUID := uuid_generate_v4();
  v_pur2 UUID := uuid_generate_v4();
BEGIN

-- Ensure user is valid (this relies on the user existing in auth.users ideally, but we will just use the passed ID)

-- 1. Project
INSERT INTO projects (id, user_id, name, location, manager_name, phone, start_date, owner_name)
VALUES (v_project_id, p_user_id, 'مشروع برج النور السكني', 'الرياض، حي الملقا', 'م. خالد عبدالله', '0501234567', CURRENT_DATE - INTERVAL '30 days', 'شركة الأفق للتطوير');

-- 2. Materials
INSERT INTO materials (id, project_id, name, category, unit, min_stock) VALUES 
(v_mat1, v_project_id, 'أسمنت بورتلاندي عادي', 'مواد أساسية', 'كيس 50كجم', 100),
(v_mat2, v_project_id, 'حديد تسليح سابك 14مم', 'معادن', 'طن', 10),
(v_mat3, v_project_id, 'رمل أبيض مغسول', 'مواد أساسية', 'رد', 5),
(v_mat4, v_project_id, 'طوب أحمر مفرغ 20x20', 'مواد بناء', 'ألف طوبة', 2);

-- 3. Suppliers
INSERT INTO suppliers (id, project_id, name, company, phone, tax_id) VALUES 
(v_sup1, v_project_id, 'مؤسسة البناء المتين', 'البناء المتين للتجارة', '0551112222', '300123456700003'),
(v_sup2, v_project_id, 'مصنع قمة الصلب', 'قمة الصلب', '0509998888', '300987654300003');

-- 4. Purchase Request
INSERT INTO purchase_requests (id, project_id, request_number, date, reason, priority, status)
VALUES (v_req1, v_project_id, 'PR-1001', CURRENT_DATE - INTERVAL '15 days', 'نقص في مواد الأساسات', 'URGENT', 'PURCHASED');

INSERT INTO purchase_request_items (request_id, material_id, quantity) VALUES
(v_req1, v_mat1, 500),
(v_req1, v_mat2, 20);

-- 5. Purchases
INSERT INTO purchases (id, project_id, request_id, purchase_number, supplier_id, date, total, receipt_status)
VALUES 
(v_pur1, v_project_id, v_req1, 'PO-2001', v_sup1, CURRENT_DATE - INTERVAL '14 days', 12500, 'FULL'),
(v_pur2, v_project_id, NULL, 'PO-2002', v_sup2, CURRENT_DATE - INTERVAL '5 days', 60000, 'PARTIAL');

-- Purchase 1 Items (Cement)
INSERT INTO purchase_items (id, purchase_id, material_id, quantity, unit_price, total, received_quantity)
VALUES 
(uuid_generate_v4(), v_pur1, v_mat1, 500, 25, 12500, 500);

-- Purchase 2 Items (Steel)
INSERT INTO purchase_items (id, purchase_id, material_id, quantity, unit_price, total, received_quantity)
VALUES 
(uuid_generate_v4(), v_pur2, v_mat2, 20, 3000, 60000, 10);

-- 6. Goods Receipts & Stock Movements (Using the RPC logic manually for seed to ensure integrity)
-- Receipt for PO-2001 (Full)
WITH new_receipt AS (
    INSERT INTO goods_receipts (project_id, purchase_id, supplier_id, receipt_number, date, status, notes)
    VALUES (v_project_id, v_pur1, v_sup1, 'GR-3001', CURRENT_DATE - INTERVAL '13 days', 'COMPLETED', 'استلام كامل للأسمنت')
    RETURNING id
),
new_receipt_item AS (
    INSERT INTO goods_receipt_items (goods_receipt_id, purchase_item_id, material_id, received_quantity)
    SELECT new_receipt.id, pi.id, pi.material_id, 500
    FROM new_receipt, purchase_items pi WHERE pi.purchase_id = v_pur1
    RETURNING id, material_id, received_quantity
)
INSERT INTO stock_movements (project_id, type, material_id, quantity, date, reference_number, purchase_id, supplier_id, notes, source_receipt_item_id)
SELECT v_project_id, 'IN', material_id, received_quantity, CURRENT_DATE - INTERVAL '13 days', 'GR-3001', v_pur1, v_sup1, 'استلام مبدئي', id
FROM new_receipt_item;

-- Receipt for PO-2002 (Partial)
WITH new_receipt AS (
    INSERT INTO goods_receipts (project_id, purchase_id, supplier_id, receipt_number, date, status, notes)
    VALUES (v_project_id, v_pur2, v_sup2, 'GR-3002', CURRENT_DATE - INTERVAL '4 days', 'COMPLETED', 'استلام دفعة أولى من الحديد')
    RETURNING id
),
new_receipt_item AS (
    INSERT INTO goods_receipt_items (goods_receipt_id, purchase_item_id, material_id, received_quantity)
    SELECT new_receipt.id, pi.id, pi.material_id, 10
    FROM new_receipt, purchase_items pi WHERE pi.purchase_id = v_pur2
    RETURNING id, material_id, received_quantity
)
INSERT INTO stock_movements (project_id, type, material_id, quantity, date, reference_number, purchase_id, supplier_id, notes, source_receipt_item_id)
SELECT v_project_id, 'IN', material_id, received_quantity, CURRENT_DATE - INTERVAL '4 days', 'GR-3002', v_pur2, v_sup2, 'استلام جزئي', id
FROM new_receipt_item;

-- Stock OUT movement (Usage)
INSERT INTO stock_movements (project_id, type, material_id, quantity, date, reference_number, receiver_name, location_used, notes)
VALUES 
(v_project_id, 'OUT', v_mat1, 150, CURRENT_DATE - INTERVAL '10 days', 'ISS-001', 'م. خالد', 'قواعد المبنى أ', 'صرف للصبة الأولى');

-- 7. Payments
-- Full payment for PO-2001
INSERT INTO payments (project_id, purchase_id, amount, date, method, reference_number, notes)
VALUES (v_project_id, v_pur1, 12500, CURRENT_DATE - INTERVAL '12 days', 'TRANSFER', 'TRX-998877', 'سداد كامل قيمة الأسمنت');

-- Partial payment for PO-2002
INSERT INTO payments (project_id, purchase_id, amount, date, method, reference_number, notes)
VALUES (v_project_id, v_pur2, 20000, CURRENT_DATE - INTERVAL '3 days', 'CHEQUE', 'CHQ-123456', 'دفعة مقدمة للحديد');

END;
$$ LANGUAGE plpgsql SECURITY INVOKER;
