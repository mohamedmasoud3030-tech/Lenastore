-- Supabase Schema for Construction Management App

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Projects
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    location VARCHAR(255),
    manager_name VARCHAR(255),
    phone VARCHAR(50),
    start_date DATE NOT NULL,
    owner_name VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Materials
CREATE TABLE materials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    unit VARCHAR(50) NOT NULL,
    min_stock NUMERIC(10, 2) DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Suppliers
CREATE TABLE suppliers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    company VARCHAR(255),
    phone VARCHAR(50),
    tax_id VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Purchase Requests
CREATE TABLE purchase_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    request_number VARCHAR(100) NOT NULL,
    date DATE NOT NULL,
    reason TEXT,
    priority VARCHAR(50) DEFAULT 'NORMAL', -- NORMAL, URGENT
    needed_date DATE,
    status VARCHAR(50) DEFAULT 'DRAFT', -- DRAFT, REQUESTED, PURCHASING, PURCHASED, CANCELLED
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Purchase Request Items
CREATE TABLE purchase_request_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id UUID NOT NULL REFERENCES purchase_requests(id) ON DELETE CASCADE,
    material_id UUID NOT NULL REFERENCES materials(id),
    quantity NUMERIC(10, 2) NOT NULL
);

-- 6. Purchases
CREATE TABLE purchases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    request_id UUID REFERENCES purchase_requests(id) ON DELETE SET NULL,
    purchase_number VARCHAR(100) NOT NULL,
    supplier_id UUID NOT NULL REFERENCES suppliers(id),
    date DATE NOT NULL,
    subtotal NUMERIC(12, 2) DEFAULT 0,
    discount NUMERIC(12, 2) DEFAULT 0,
    tax NUMERIC(12, 2) DEFAULT 0,
    transport_cost NUMERIC(12, 2) DEFAULT 0,
    total NUMERIC(12, 2) NOT NULL,
    receipt_status VARCHAR(50) DEFAULT 'UNRECEIVED', -- UNRECEIVED, PARTIAL, FULL
    invoice_number VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Purchase Items
CREATE TABLE purchase_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    purchase_id UUID NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
    material_id UUID NOT NULL REFERENCES materials(id),
    quantity NUMERIC(10, 2) NOT NULL,
    unit_price NUMERIC(12, 2) NOT NULL,
    total NUMERIC(12, 2) NOT NULL,
    received_quantity NUMERIC(10, 2) DEFAULT 0
);

-- 8. Goods Receipts
CREATE TABLE goods_receipts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    purchase_id UUID NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
    supplier_id UUID NOT NULL REFERENCES suppliers(id),
    receipt_number VARCHAR(100) NOT NULL,
    date DATE NOT NULL,
    status VARCHAR(50) DEFAULT 'COMPLETED',
    notes TEXT,
    idempotency_key VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(project_id, idempotency_key)
);

-- 9. Goods Receipt Items
CREATE TABLE goods_receipt_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    goods_receipt_id UUID NOT NULL REFERENCES goods_receipts(id) ON DELETE CASCADE,
    purchase_item_id UUID NOT NULL REFERENCES purchase_items(id),
    material_id UUID NOT NULL REFERENCES materials(id),
    received_quantity NUMERIC(10, 2) NOT NULL CHECK (received_quantity > 0)
);

-- 10. Stock Movements (Includes Goods Receipts as IN movements)
CREATE TABLE stock_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    type VARCHAR(10) NOT NULL CHECK (type IN ('IN', 'OUT')),
    material_id UUID NOT NULL REFERENCES materials(id),
    quantity NUMERIC(10, 2) NOT NULL,
    date DATE NOT NULL,
    reference_number VARCHAR(100),
    receiver_name VARCHAR(255),
    location_used VARCHAR(255),
    purchase_id UUID REFERENCES purchases(id) ON DELETE SET NULL,
    supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
    source_receipt_item_id UUID REFERENCES goods_receipt_items(id) UNIQUE, -- Idempotency
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 11. Payments
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    purchase_id UUID NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
    amount NUMERIC(12, 2) NOT NULL,
    date DATE NOT NULL,
    method VARCHAR(50), -- CASH, TRANSFER, CHEQUE
    reference_number VARCHAR(100),
    receiver_name VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 12. Attachments
CREATE TABLE attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(100) NOT NULL,
    file_size INTEGER NOT NULL,
    file_path TEXT NOT NULL,
    entity_type VARCHAR(50) NOT NULL, -- PROJECT, SUPPLIER, MATERIAL, PURCHASE_REQUEST, PURCHASE, PAYMENT, MOVEMENT
    entity_id UUID NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Views for Calculations

-- Stock View
CREATE OR REPLACE VIEW material_stock WITH (security_invoker = true) AS
SELECT 
    m.id AS material_id,
    m.project_id,
    m.name,
    m.min_stock,
    m.unit,
    COALESCE(SUM(CASE WHEN sm.type = 'IN' THEN sm.quantity ELSE 0 END), 0) AS total_in,
    COALESCE(SUM(CASE WHEN sm.type = 'OUT' THEN sm.quantity ELSE 0 END), 0) AS total_out,
    COALESCE(SUM(CASE WHEN sm.type = 'IN' THEN sm.quantity ELSE 0 END), 0) - COALESCE(SUM(CASE WHEN sm.type = 'OUT' THEN sm.quantity ELSE 0 END), 0) AS current_stock
FROM 
    materials m
LEFT JOIN 
    stock_movements sm ON m.id = sm.material_id
GROUP BY 
    m.id, m.project_id, m.name, m.min_stock, m.unit;

-- Purchase Balances View
CREATE OR REPLACE VIEW purchase_balances WITH (security_invoker = true) AS
SELECT 
    p.id AS purchase_id,
    p.project_id,
    p.total AS purchase_total,
    COALESCE(SUM(pay.amount), 0) AS total_paid,
    p.total - COALESCE(SUM(pay.amount), 0) AS remaining_balance,
    CASE 
        WHEN COALESCE(SUM(pay.amount), 0) = 0 THEN 'UNPAID'
        WHEN COALESCE(SUM(pay.amount), 0) >= p.total THEN 'PAID'
        ELSE 'PARTIAL'
    END AS payment_status
FROM 
    purchases p
LEFT JOIN 
    payments pay ON p.id = pay.purchase_id
GROUP BY 
    p.id, p.project_id, p.total;

-- Supplier Balances View
CREATE OR REPLACE VIEW supplier_balances WITH (security_invoker = true) AS
SELECT
    s.id AS supplier_id,
    s.project_id,
    s.name,
    COALESCE(SUM(p.total), 0) AS total_purchases,
    COALESCE(SUM(pb.total_paid), 0) AS total_paid,
    COALESCE(SUM(p.total), 0) - COALESCE(SUM(pb.total_paid), 0) AS remaining_balance
FROM
    suppliers s
LEFT JOIN
    purchases p ON s.id = p.supplier_id
LEFT JOIN
    purchase_balances pb ON p.id = pb.purchase_id
GROUP BY
    s.id, s.project_id, s.name;

-- RLS setup
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_request_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE goods_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE goods_receipt_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;

-- Projects
CREATE POLICY "Projects viewable by owner" ON projects FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Projects insertable by owner" ON projects FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Projects updatable by owner" ON projects FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Projects deletable by owner" ON projects FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Materials
CREATE POLICY "Materials viewable by owner" ON materials FOR SELECT TO authenticated USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));
CREATE POLICY "Materials insertable by owner" ON materials FOR INSERT TO authenticated WITH CHECK (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));
CREATE POLICY "Materials updatable by owner" ON materials FOR UPDATE TO authenticated USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid())) WITH CHECK (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));
CREATE POLICY "Materials deletable by owner" ON materials FOR DELETE TO authenticated USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

-- Suppliers
CREATE POLICY "Suppliers viewable by owner" ON suppliers FOR SELECT TO authenticated USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));
CREATE POLICY "Suppliers insertable by owner" ON suppliers FOR INSERT TO authenticated WITH CHECK (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));
CREATE POLICY "Suppliers updatable by owner" ON suppliers FOR UPDATE TO authenticated USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid())) WITH CHECK (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));
CREATE POLICY "Suppliers deletable by owner" ON suppliers FOR DELETE TO authenticated USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

-- Purchase Requests
CREATE POLICY "Purchase Requests viewable by owner" ON purchase_requests FOR SELECT TO authenticated USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));
CREATE POLICY "Purchase Requests insertable by owner" ON purchase_requests FOR INSERT TO authenticated WITH CHECK (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));
CREATE POLICY "Purchase Requests updatable by owner" ON purchase_requests FOR UPDATE TO authenticated USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid())) WITH CHECK (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));
CREATE POLICY "Purchase Requests deletable by owner" ON purchase_requests FOR DELETE TO authenticated USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

-- Purchase Request Items
CREATE POLICY "Purchase Request Items viewable by owner" ON purchase_request_items FOR SELECT TO authenticated USING (request_id IN (SELECT id FROM purchase_requests WHERE project_id IN (SELECT id FROM projects WHERE user_id = auth.uid())));
CREATE POLICY "Purchase Request Items insertable by owner" ON purchase_request_items FOR INSERT TO authenticated WITH CHECK (request_id IN (SELECT id FROM purchase_requests WHERE project_id IN (SELECT id FROM projects WHERE user_id = auth.uid())));
CREATE POLICY "Purchase Request Items updatable by owner" ON purchase_request_items FOR UPDATE TO authenticated USING (request_id IN (SELECT id FROM purchase_requests WHERE project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()))) WITH CHECK (request_id IN (SELECT id FROM purchase_requests WHERE project_id IN (SELECT id FROM projects WHERE user_id = auth.uid())));
CREATE POLICY "Purchase Request Items deletable by owner" ON purchase_request_items FOR DELETE TO authenticated USING (request_id IN (SELECT id FROM purchase_requests WHERE project_id IN (SELECT id FROM projects WHERE user_id = auth.uid())));

-- Purchases
CREATE POLICY "Purchases viewable by owner" ON purchases FOR SELECT TO authenticated USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));
CREATE POLICY "Purchases insertable by owner" ON purchases FOR INSERT TO authenticated WITH CHECK (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));
CREATE POLICY "Purchases updatable by owner" ON purchases FOR UPDATE TO authenticated USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid())) WITH CHECK (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));
CREATE POLICY "Purchases deletable by owner" ON purchases FOR DELETE TO authenticated USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

-- Purchase Items
CREATE POLICY "Purchase Items viewable by owner" ON purchase_items FOR SELECT TO authenticated USING (purchase_id IN (SELECT id FROM purchases WHERE project_id IN (SELECT id FROM projects WHERE user_id = auth.uid())));
CREATE POLICY "Purchase Items insertable by owner" ON purchase_items FOR INSERT TO authenticated WITH CHECK (purchase_id IN (SELECT id FROM purchases WHERE project_id IN (SELECT id FROM projects WHERE user_id = auth.uid())));
CREATE POLICY "Purchase Items updatable by owner" ON purchase_items FOR UPDATE TO authenticated USING (purchase_id IN (SELECT id FROM purchases WHERE project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()))) WITH CHECK (purchase_id IN (SELECT id FROM purchases WHERE project_id IN (SELECT id FROM projects WHERE user_id = auth.uid())));
CREATE POLICY "Purchase Items deletable by owner" ON purchase_items FOR DELETE TO authenticated USING (purchase_id IN (SELECT id FROM purchases WHERE project_id IN (SELECT id FROM projects WHERE user_id = auth.uid())));

-- Goods Receipts
CREATE POLICY "Goods Receipts viewable by owner" ON goods_receipts FOR SELECT TO authenticated USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));
CREATE POLICY "Goods Receipts insertable by owner" ON goods_receipts FOR INSERT TO authenticated WITH CHECK (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));
CREATE POLICY "Goods Receipts updatable by owner" ON goods_receipts FOR UPDATE TO authenticated USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid())) WITH CHECK (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));
CREATE POLICY "Goods Receipts deletable by owner" ON goods_receipts FOR DELETE TO authenticated USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

-- Goods Receipt Items
CREATE POLICY "Goods Receipt Items viewable by owner" ON goods_receipt_items FOR SELECT TO authenticated USING (goods_receipt_id IN (SELECT id FROM goods_receipts WHERE project_id IN (SELECT id FROM projects WHERE user_id = auth.uid())));
CREATE POLICY "Goods Receipt Items insertable by owner" ON goods_receipt_items FOR INSERT TO authenticated WITH CHECK (goods_receipt_id IN (SELECT id FROM goods_receipts WHERE project_id IN (SELECT id FROM projects WHERE user_id = auth.uid())));
CREATE POLICY "Goods Receipt Items updatable by owner" ON goods_receipt_items FOR UPDATE TO authenticated USING (goods_receipt_id IN (SELECT id FROM goods_receipts WHERE project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()))) WITH CHECK (goods_receipt_id IN (SELECT id FROM goods_receipts WHERE project_id IN (SELECT id FROM projects WHERE user_id = auth.uid())));
CREATE POLICY "Goods Receipt Items deletable by owner" ON goods_receipt_items FOR DELETE TO authenticated USING (goods_receipt_id IN (SELECT id FROM goods_receipts WHERE project_id IN (SELECT id FROM projects WHERE user_id = auth.uid())));

-- Stock Movements
CREATE POLICY "Stock Movements viewable by owner" ON stock_movements FOR SELECT TO authenticated USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));
CREATE POLICY "Stock Movements insertable by owner" ON stock_movements FOR INSERT TO authenticated WITH CHECK (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));
CREATE POLICY "Stock Movements updatable by owner" ON stock_movements FOR UPDATE TO authenticated USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid())) WITH CHECK (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));
CREATE POLICY "Stock Movements deletable by owner" ON stock_movements FOR DELETE TO authenticated USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

-- Payments
CREATE POLICY "Payments viewable by owner" ON payments FOR SELECT TO authenticated USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));
CREATE POLICY "Payments insertable by owner" ON payments FOR INSERT TO authenticated WITH CHECK (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));
CREATE POLICY "Payments updatable by owner" ON payments FOR UPDATE TO authenticated USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid())) WITH CHECK (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));
CREATE POLICY "Payments deletable by owner" ON payments FOR DELETE TO authenticated USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

-- Attachments
CREATE POLICY "Attachments viewable by owner" ON attachments FOR SELECT TO authenticated USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));
CREATE POLICY "Attachments insertable by owner" ON attachments FOR INSERT TO authenticated WITH CHECK (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));
CREATE POLICY "Attachments updatable by owner" ON attachments FOR UPDATE TO authenticated USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid())) WITH CHECK (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));
CREATE POLICY "Attachments deletable by owner" ON attachments FOR DELETE TO authenticated USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

-- RPC for Atomic Receipt
CREATE OR REPLACE FUNCTION receive_goods(
    p_project_id UUID,
    p_purchase_id UUID,
    p_receipt_number VARCHAR,
    p_receipt_date DATE,
    p_notes TEXT,
    p_items JSONB, -- [{ "purchase_item_id": "uuid", "quantity": 10 }]
    p_idempotency_key VARCHAR DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_receipt_id UUID;
    v_item JSONB;
    v_purchase_item RECORD;
    v_receipt_item_id UUID;
    v_all_full BOOLEAN := TRUE;
    v_some_received BOOLEAN := FALSE;
BEGIN
    IF p_idempotency_key IS NOT NULL THEN
        SELECT id INTO v_receipt_id FROM goods_receipts WHERE project_id = p_project_id AND idempotency_key = p_idempotency_key;
        IF FOUND THEN
            RETURN v_receipt_id;
        END IF;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM purchases WHERE id = p_purchase_id AND project_id = p_project_id) THEN
        RAISE EXCEPTION 'Purchase not found or unauthorized';
    END IF;

    PERFORM 1 FROM purchases WHERE id = p_purchase_id FOR UPDATE;

    INSERT INTO goods_receipts (project_id, purchase_id, supplier_id, receipt_number, date, notes, idempotency_key)
    SELECT p_project_id, p_purchase_id, supplier_id, p_receipt_number, p_receipt_date, p_notes, p_idempotency_key
    FROM purchases WHERE id = p_purchase_id
    RETURNING id INTO v_receipt_id;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        SELECT * INTO v_purchase_item FROM purchase_items WHERE id = (v_item->>'purchase_item_id')::UUID FOR UPDATE;
        
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Purchase item not found';
        END IF;

        IF (v_item->>'quantity')::NUMERIC <= 0 THEN
            CONTINUE;
        END IF;

        IF v_purchase_item.received_quantity + (v_item->>'quantity')::NUMERIC > v_purchase_item.quantity THEN
            RAISE EXCEPTION 'Cannot receive more than ordered for item %', v_purchase_item.id;
        END IF;

        INSERT INTO goods_receipt_items (goods_receipt_id, purchase_item_id, material_id, received_quantity)
        VALUES (v_receipt_id, v_purchase_item.id, v_purchase_item.material_id, (v_item->>'quantity')::NUMERIC)
        RETURNING id INTO v_receipt_item_id;

        UPDATE purchase_items 
        SET received_quantity = received_quantity + (v_item->>'quantity')::NUMERIC
        WHERE id = v_purchase_item.id;

        INSERT INTO stock_movements (project_id, type, material_id, quantity, date, reference_number, purchase_id, supplier_id, notes, source_receipt_item_id)
        VALUES (p_project_id, 'IN', v_purchase_item.material_id, (v_item->>'quantity')::NUMERIC, p_receipt_date, p_receipt_number, p_purchase_id, 
                (SELECT supplier_id FROM purchases WHERE id = p_purchase_id), 'استلام مواد', v_receipt_item_id);
    END LOOP;

    FOR v_purchase_item IN SELECT * FROM purchase_items WHERE purchase_id = p_purchase_id
    LOOP
        IF v_purchase_item.received_quantity > 0 THEN
            v_some_received := TRUE;
        END IF;
        IF v_purchase_item.received_quantity < v_purchase_item.quantity THEN
            v_all_full := FALSE;
        END IF;
    END LOOP;

    IF v_all_full THEN
        UPDATE purchases SET receipt_status = 'FULL' WHERE id = p_purchase_id;
    ELSIF v_some_received THEN
        UPDATE purchases SET receipt_status = 'PARTIAL' WHERE id = p_purchase_id;
    ELSE
        UPDATE purchases SET receipt_status = 'UNRECEIVED' WHERE id = p_purchase_id;
    END IF;

    RETURN v_receipt_id;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

-- RPC for Atomic Payment
CREATE OR REPLACE FUNCTION register_payment(
    p_project_id UUID,
    p_purchase_id UUID,
    p_amount NUMERIC,
    p_date DATE,
    p_method VARCHAR,
    p_reference_number VARCHAR,
    p_notes TEXT
) RETURNS UUID AS $$
DECLARE
    v_payment_id UUID;
    v_purchase_total NUMERIC;
    v_total_paid NUMERIC;
BEGIN
    SELECT total INTO v_purchase_total FROM purchases WHERE id = p_purchase_id AND project_id = p_project_id FOR UPDATE;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Purchase not found or unauthorized';
    END IF;

    SELECT COALESCE(SUM(amount), 0) INTO v_total_paid FROM payments WHERE purchase_id = p_purchase_id;

    IF v_total_paid + p_amount > v_purchase_total THEN
        RAISE EXCEPTION 'Payment amount exceeds remaining balance. Remaining: %', (v_purchase_total - v_total_paid);
    END IF;

    INSERT INTO payments (project_id, purchase_id, amount, date, method, reference_number, notes)
    VALUES (p_project_id, p_purchase_id, p_amount, p_date, p_method, p_reference_number, p_notes)
    RETURNING id INTO v_payment_id;

    RETURN v_payment_id;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

-- Storage bucket setup
INSERT INTO storage.buckets (id, name, public) 
VALUES ('attachments', 'attachments', false) 
ON CONFLICT (id) DO UPDATE SET public = false;

CREATE POLICY "Allow authenticated uploads" ON storage.objects FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'attachments' AND 
    EXISTS (SELECT 1 FROM projects WHERE id::text = (string_to_array(name, '/'))[1] AND user_id = auth.uid())
);

CREATE POLICY "Allow authenticated view" ON storage.objects FOR SELECT TO authenticated USING (
    bucket_id = 'attachments' AND 
    EXISTS (SELECT 1 FROM projects WHERE id::text = (string_to_array(name, '/'))[1] AND user_id = auth.uid())
);

CREATE POLICY "Allow authenticated update" ON storage.objects FOR UPDATE TO authenticated USING (
    bucket_id = 'attachments' AND 
    EXISTS (SELECT 1 FROM projects WHERE id::text = (string_to_array(name, '/'))[1] AND user_id = auth.uid())
);

CREATE POLICY "Allow authenticated delete" ON storage.objects FOR DELETE TO authenticated USING (
    bucket_id = 'attachments' AND 
    EXISTS (SELECT 1 FROM projects WHERE id::text = (string_to_array(name, '/'))[1] AND user_id = auth.uid())
);
