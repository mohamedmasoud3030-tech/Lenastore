-- Remove the temporary seven-argument payment overload after the idempotent client is live.

DO $$
BEGIN
  IF to_regprocedure(
    'public.register_payment(uuid,uuid,numeric,date,character varying,character varying,text,character varying)'
  ) IS NULL THEN
    RAISE EXCEPTION 'idempotent register_payment overload must exist before cleanup';
  END IF;
END
$$;

DROP FUNCTION IF EXISTS public.register_payment(
  uuid,
  uuid,
  numeric,
  date,
  varchar,
  varchar,
  text
);
