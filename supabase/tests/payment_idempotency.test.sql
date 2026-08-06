-- Verifies payment retry safety, balance protection and project isolation.

DO $$
DECLARE
  v_function oid;
BEGIN
  v_function := to_regprocedure(
    'public.register_payment(uuid,uuid,numeric,date,character varying,character varying,text,character varying)'
  );

  IF v_function IS NULL THEN
    RAISE EXCEPTION 'idempotent register_payment overload is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE oid = v_function
      AND prosecdef
      AND proconfig @> ARRAY['search_path=public, pg_temp']::text[]
  ) THEN
    RAISE EXCEPTION 'register_payment hardening is invalid';
  END IF;

  IF has_function_privilege('anon', v_function, 'EXECUTE') THEN
    RAISE EXCEPTION 'anon must not execute idempotent register_payment';
  END IF;

  IF NOT has_function_privilege('authenticated', v_function, 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated must execute idempotent register_payment';
  END IF;

  IF has_table_privilege('anon', 'public.payments', 'SELECT') THEN
    RAISE EXCEPTION 'anon must not read payments';
  END IF;

  IF has_table_privilege('authenticated', 'public.payments', 'INSERT')
     OR has_table_privilege('authenticated', 'public.payments', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.payments', 'DELETE') THEN
    RAISE EXCEPTION 'authenticated direct payment writes must be revoked';
  END IF;
END
$$;

BEGIN;

INSERT INTO public.projects(id, user_id, name, start_date)
VALUES
  ('71000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000011', 'Payment Test P1', current_date),
  ('72000000-0000-4000-8000-000000000002', '72000000-0000-4000-8000-000000000022', 'Payment Test P2', current_date);

DO $$
DECLARE
  v_currency text;
BEGIN
  SELECT btrim(currency::text)
  INTO v_currency
  FROM public.projects
  WHERE id = '71000000-0000-4000-8000-000000000001';

  IF v_currency IS DISTINCT FROM 'EGP' THEN
    RAISE EXCEPTION 'project default currency mismatch: %', v_currency;
  END IF;
END
$$;

INSERT INTO public.suppliers(id, project_id, name)
VALUES
  ('71000000-0000-4000-8000-000000000101', '71000000-0000-4000-8000-000000000001', 'Supplier P1'),
  ('72000000-0000-4000-8000-000000000202', '72000000-0000-4000-8000-000000000002', 'Supplier P2');

INSERT INTO public.purchases(
  id, project_id, purchase_number, supplier_id, date, subtotal, total
)
VALUES
  ('71000000-0000-4000-8000-000000001001', '71000000-0000-4000-8000-000000000001', 'PO-PAY-1', '71000000-0000-4000-8000-000000000101', current_date, 1000, 1000),
  ('72000000-0000-4000-8000-000000002002', '72000000-0000-4000-8000-000000000002', 'PO-PAY-2', '72000000-0000-4000-8000-000000000202', current_date, 100, 100);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '71000000-0000-4000-8000-000000000011', true);

DO $$
DECLARE
  v_first uuid;
  v_retry uuid;
  v_second uuid;
  v_count integer;
  v_total numeric(18,2);
  v_creator uuid;
  v_failed boolean;
BEGIN
  v_first := public.register_payment(
    '71000000-0000-4000-8000-000000000001',
    '71000000-0000-4000-8000-000000001001',
    250,
    current_date,
    'TRANSFER',
    'BANK-001',
    'First payment',
    'payment-attempt-001'
  );

  v_retry := public.register_payment(
    '71000000-0000-4000-8000-000000000001',
    '71000000-0000-4000-8000-000000001001',
    250,
    current_date,
    'transfer',
    ' BANK-001 ',
    ' First payment ',
    ' payment-attempt-001 '
  );

  IF v_retry <> v_first THEN
    RAISE EXCEPTION 'idempotent retry returned a different payment';
  END IF;

  SELECT count(*), sum(amount)
  INTO v_count, v_total
  FROM public.payments
  WHERE project_id = '71000000-0000-4000-8000-000000000001';

  SELECT created_by
  INTO v_creator
  FROM public.payments
  WHERE id = v_first;

  IF v_count <> 1 OR v_total <> 250 THEN
    RAISE EXCEPTION 'retry duplicated payment: count %, total %', v_count, v_total;
  END IF;

  IF v_creator IS DISTINCT FROM '71000000-0000-4000-8000-000000000011'::uuid THEN
    RAISE EXCEPTION 'payment creator was not preserved: %', v_creator;
  END IF;

  v_failed := false;
  BEGIN
    PERFORM public.register_payment(
      '71000000-0000-4000-8000-000000000001',
      '71000000-0000-4000-8000-000000001001',
      251,
      current_date,
      'TRANSFER',
      'BANK-001',
      'First payment',
      'payment-attempt-001'
    );
  EXCEPTION WHEN OTHERS THEN
    v_failed := true;
  END;
  IF NOT v_failed THEN
    RAISE EXCEPTION 'idempotency payload mismatch was accepted';
  END IF;

  v_second := public.register_payment(
    '71000000-0000-4000-8000-000000000001',
    '71000000-0000-4000-8000-000000001001',
    750,
    current_date,
    'CASH',
    null,
    null,
    'payment-attempt-002'
  );

  IF v_second = v_first THEN
    RAISE EXCEPTION 'distinct payment attempts returned one id';
  END IF;

  v_failed := false;
  BEGIN
    PERFORM public.register_payment(
      '71000000-0000-4000-8000-000000000001',
      '71000000-0000-4000-8000-000000001001',
      1,
      current_date,
      'CASH',
      null,
      null,
      'payment-attempt-overpay'
    );
  EXCEPTION WHEN OTHERS THEN
    v_failed := true;
  END;
  IF NOT v_failed THEN
    RAISE EXCEPTION 'overpayment was accepted';
  END IF;

  v_failed := false;
  BEGIN
    PERFORM public.register_payment(
      '72000000-0000-4000-8000-000000000002',
      '72000000-0000-4000-8000-000000002002',
      10,
      current_date,
      'CASH',
      null,
      null,
      'payment-attempt-cross-project'
    );
  EXCEPTION WHEN OTHERS THEN
    v_failed := true;
  END;
  IF NOT v_failed THEN
    RAISE EXCEPTION 'cross-project payment was accepted';
  END IF;

  SELECT count(*), sum(amount)
  INTO v_count, v_total
  FROM public.payments
  WHERE project_id = '71000000-0000-4000-8000-000000000001';

  IF v_count <> 2 OR v_total <> 1000 THEN
    RAISE EXCEPTION 'final payment state mismatch: count %, total %', v_count, v_total;
  END IF;
END
$$;

RESET ROLE;
ROLLBACK;

SELECT 'PASS: payment idempotency, balance protection, ownership and currency default are valid' AS result;
