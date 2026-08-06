-- Make payment registration retry-safe while preserving the legacy RPC during rollout.

ALTER TABLE public.projects
  ALTER COLUMN currency SET DEFAULT 'EGP';

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS idempotency_key varchar(100);

UPDATE public.payments
SET idempotency_key = 'legacy-' || id::text
WHERE idempotency_key IS NULL OR btrim(idempotency_key) = '';

UPDATE public.payments pay
SET created_by = p.user_id
FROM public.projects p
WHERE p.id = pay.project_id
  AND pay.created_by IS NULL;

ALTER TABLE public.payments
  ALTER COLUMN idempotency_key SET NOT NULL,
  ALTER COLUMN created_by SET DEFAULT auth.uid(),
  ALTER COLUMN created_by SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS payments_project_idempotency_key_uidx
  ON public.payments(project_id, idempotency_key);

REVOKE ALL ON public.payments FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.payments FROM authenticated;
GRANT SELECT ON public.payments TO authenticated;

CREATE OR REPLACE FUNCTION public.register_payment(
  p_project_id uuid,
  p_purchase_id uuid,
  p_amount numeric,
  p_date date,
  p_method varchar,
  p_reference_number varchar,
  p_notes text,
  p_idempotency_key varchar
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_payment_id uuid;
  v_total numeric(18,2);
  v_paid numeric(18,2);
  v_amount numeric(18,2);
  v_existing public.payments%ROWTYPE;
  v_reference varchar(100);
  v_notes text;
  v_method varchar(20);
  v_key varchar(100);
BEGIN
  IF auth.uid() IS NULL OR NOT public.owns_project(p_project_id) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  IF p_amount IS NULL THEN
    RAISE EXCEPTION 'payment amount must be positive';
  END IF;

  v_amount := round(p_amount, 2)::numeric(18,2);
  IF v_amount <= 0 THEN
    RAISE EXCEPTION 'payment amount must be positive';
  END IF;

  IF p_date IS NULL THEN
    RAISE EXCEPTION 'payment date is required';
  END IF;

  v_method := upper(btrim(coalesce(p_method, '')));
  IF v_method NOT IN ('CASH', 'TRANSFER', 'CHEQUE', 'OTHER') THEN
    RAISE EXCEPTION 'invalid payment method';
  END IF;

  IF length(btrim(coalesce(p_idempotency_key, ''))) > 100 THEN
    RAISE EXCEPTION 'idempotency key is too long';
  END IF;

  v_key := btrim(coalesce(p_idempotency_key, ''));
  IF v_key = '' THEN
    RAISE EXCEPTION 'idempotency key required';
  END IF;

  IF length(btrim(coalesce(p_reference_number, ''))) > 100 THEN
    RAISE EXCEPTION 'payment reference is too long';
  END IF;

  v_reference := nullif(btrim(p_reference_number), '');
  v_notes := nullif(btrim(p_notes), '');

  SELECT *
  INTO v_existing
  FROM public.payments
  WHERE project_id = p_project_id
    AND idempotency_key = v_key;

  IF FOUND THEN
    IF v_existing.purchase_id IS DISTINCT FROM p_purchase_id
       OR v_existing.amount IS DISTINCT FROM v_amount
       OR v_existing.date IS DISTINCT FROM p_date
       OR v_existing.method IS DISTINCT FROM v_method
       OR v_existing.reference_number IS DISTINCT FROM v_reference
       OR v_existing.notes IS DISTINCT FROM v_notes THEN
      RAISE EXCEPTION 'idempotency key payload mismatch';
    END IF;
    RETURN v_existing.id;
  END IF;

  SELECT total
  INTO v_total
  FROM public.purchases
  WHERE id = p_purchase_id
    AND project_id = p_project_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'purchase not found or unauthorized';
  END IF;

  -- The purchase lock serializes concurrent payments. Recheck the key after waiting.
  SELECT *
  INTO v_existing
  FROM public.payments
  WHERE project_id = p_project_id
    AND idempotency_key = v_key;

  IF FOUND THEN
    IF v_existing.purchase_id IS DISTINCT FROM p_purchase_id
       OR v_existing.amount IS DISTINCT FROM v_amount
       OR v_existing.date IS DISTINCT FROM p_date
       OR v_existing.method IS DISTINCT FROM v_method
       OR v_existing.reference_number IS DISTINCT FROM v_reference
       OR v_existing.notes IS DISTINCT FROM v_notes THEN
      RAISE EXCEPTION 'idempotency key payload mismatch';
    END IF;
    RETURN v_existing.id;
  END IF;

  SELECT coalesce(sum(amount), 0)::numeric(18,2)
  INTO v_paid
  FROM public.payments
  WHERE purchase_id = p_purchase_id;

  IF v_paid + v_amount > v_total THEN
    RAISE EXCEPTION 'Payment amount exceeds remaining balance. Remaining: %', v_total - v_paid;
  END IF;

  INSERT INTO public.payments(
    project_id,
    purchase_id,
    amount,
    date,
    method,
    reference_number,
    notes,
    idempotency_key,
    created_by
  )
  VALUES (
    p_project_id,
    p_purchase_id,
    v_amount,
    p_date,
    v_method,
    v_reference,
    v_notes,
    v_key,
    auth.uid()
  )
  RETURNING id INTO v_payment_id;

  RETURN v_payment_id;
END;
$$;

REVOKE ALL ON FUNCTION public.register_payment(
  uuid, uuid, numeric, date, varchar, varchar, text, varchar
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_payment(
  uuid, uuid, numeric, date, varchar, varchar, text, varchar
) TO authenticated;

COMMENT ON FUNCTION public.register_payment(
  uuid, uuid, numeric, date, varchar, varchar, text, varchar
) IS 'Registers an atomic, project-scoped, idempotent supplier payment.';

-- Temporary compatibility overload for the currently deployed client.
CREATE OR REPLACE FUNCTION public.register_payment(
  p_project_id uuid,
  p_purchase_id uuid,
  p_amount numeric,
  p_date date,
  p_method varchar,
  p_reference_number varchar,
  p_notes text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN public.register_payment(
    p_project_id,
    p_purchase_id,
    p_amount,
    p_date,
    p_method,
    p_reference_number,
    p_notes,
    'legacy-' || gen_random_uuid()::text
  );
END;
$$;

REVOKE ALL ON FUNCTION public.register_payment(
  uuid, uuid, numeric, date, varchar, varchar, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_payment(
  uuid, uuid, numeric, date, varchar, varchar, text
) TO authenticated;

COMMENT ON FUNCTION public.register_payment(
  uuid, uuid, numeric, date, varchar, varchar, text
) IS 'Temporary compatibility overload. Remove after all clients send p_idempotency_key.';

COMMENT ON COLUMN public.payments.idempotency_key IS
  'Client-generated retry key unique within a project.';
