-- Verifies the live material_stock view contract and data projection.

DO $$
DECLARE
  v_positions text[];
BEGIN
  SELECT array_agg(column_name ORDER BY ordinal_position)
  INTO v_positions
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'material_stock';

  IF v_positions IS DISTINCT FROM ARRAY[
    'material_id',
    'project_id',
    'name',
    'min_stock',
    'unit',
    'total_in',
    'total_out',
    'current_stock',
    'category',
    'notes'
  ]::text[] THEN
    RAISE EXCEPTION 'material_stock column contract mismatch: %', v_positions;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'material_stock'
      AND c.reloptions @> ARRAY['security_invoker=true']::text[]
  ) THEN
    RAISE EXCEPTION 'material_stock must remain security_invoker';
  END IF;

  IF has_table_privilege('anon', 'public.material_stock', 'SELECT') THEN
    RAISE EXCEPTION 'anon must not select material_stock';
  END IF;

  IF NOT has_table_privilege('authenticated', 'public.material_stock', 'SELECT') THEN
    RAISE EXCEPTION 'authenticated must select material_stock';
  END IF;
END
$$;

BEGIN;

INSERT INTO public.projects(id, user_id, name, start_date, currency)
VALUES (
  '8d8f28c1-59f1-4b6e-9ce6-67f080d2ab01',
  '8d8f28c1-59f1-4b6e-9ce6-67f080d2ab02',
  'Material contract test',
  current_date,
  'EGP'
);

INSERT INTO public.materials(
  id, project_id, name, category, unit, min_stock, notes
)
VALUES (
  '8d8f28c1-59f1-4b6e-9ce6-67f080d2ab03',
  '8d8f28c1-59f1-4b6e-9ce6-67f080d2ab01',
  'Contract material',
  'تشطيبات',
  'كيس',
  5,
  'ملاحظة محفوظة'
);

INSERT INTO public.stock_movements(
  project_id, type, material_id, quantity, date, reference_number
)
VALUES
  ('8d8f28c1-59f1-4b6e-9ce6-67f080d2ab01', 'IN', '8d8f28c1-59f1-4b6e-9ce6-67f080d2ab03', 12, current_date, 'TEST-IN'),
  ('8d8f28c1-59f1-4b6e-9ce6-67f080d2ab01', 'OUT', '8d8f28c1-59f1-4b6e-9ce6-67f080d2ab03', 2, current_date, 'TEST-OUT');

DO $$
DECLARE
  v_row public.material_stock%ROWTYPE;
BEGIN
  SELECT *
  INTO v_row
  FROM public.material_stock
  WHERE material_id = '8d8f28c1-59f1-4b6e-9ce6-67f080d2ab03';

  IF v_row.category IS DISTINCT FROM 'تشطيبات' THEN
    RAISE EXCEPTION 'category projection failed: %', v_row.category;
  END IF;

  IF v_row.notes IS DISTINCT FROM 'ملاحظة محفوظة' THEN
    RAISE EXCEPTION 'notes projection failed: %', v_row.notes;
  END IF;

  IF v_row.total_in <> 12 OR v_row.total_out <> 2 OR v_row.current_stock <> 10 THEN
    RAISE EXCEPTION 'stock totals mismatch: in %, out %, current %',
      v_row.total_in, v_row.total_out, v_row.current_stock;
  END IF;
END
$$;

ROLLBACK;

SELECT 'PASS: material_stock contract, grants and data projection are valid' AS result;
