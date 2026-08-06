-- Verifies that only the retry-safe payment RPC remains exposed.

DO $$
DECLARE
  v_new_function oid;
BEGIN
  IF to_regprocedure(
    'public.register_payment(uuid,uuid,numeric,date,character varying,character varying,text)'
  ) IS NOT NULL THEN
    RAISE EXCEPTION 'legacy register_payment overload still exists';
  END IF;

  v_new_function := to_regprocedure(
    'public.register_payment(uuid,uuid,numeric,date,character varying,character varying,text,character varying)'
  );

  IF v_new_function IS NULL THEN
    RAISE EXCEPTION 'idempotent register_payment overload is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE oid = v_new_function
      AND prosecdef
      AND proconfig @> ARRAY['search_path=public, pg_temp']::text[]
  ) THEN
    RAISE EXCEPTION 'idempotent register_payment hardening is invalid';
  END IF;

  IF has_function_privilege('anon', v_new_function, 'EXECUTE') THEN
    RAISE EXCEPTION 'anon must not execute register_payment';
  END IF;

  IF NOT has_function_privilege('authenticated', v_new_function, 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated must execute register_payment';
  END IF;

  IF (
    SELECT count(*)
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'register_payment'
  ) <> 1 THEN
    RAISE EXCEPTION 'exactly one register_payment overload must remain';
  END IF;
END
$$;

SELECT 'PASS: only the idempotent register_payment RPC remains exposed' AS result;
