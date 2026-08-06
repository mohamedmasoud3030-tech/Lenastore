-- Harden stock issue integrity, validation, concurrency and grants.
-- Apply after 202608060002_add_stock_issues_and_rpc.sql.

DO $$
BEGIN
  IF to_regclass('public.stock_issues') IS NULL
     OR to_regclass('public.stock_issue_items') IS NULL
     OR to_regprocedure('public.issue_stock(uuid,character varying,date,character varying,character varying,character varying,text,jsonb,character varying)') IS NULL THEN
    RAISE EXCEPTION 'stock issue migration 002 must be applied before migration 003';
  END IF;
END
$$;

UPDATE public.stock_issues si
SET created_by = p.user_id
FROM public.projects p
WHERE p.id = si.project_id
  AND si.created_by IS NULL;

ALTER TABLE public.stock_issues
  ALTER COLUMN created_by SET DEFAULT auth.uid(),
  ALTER COLUMN created_by SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.stock_issues'::regclass
      AND conname = 'stock_issues_issue_number_not_blank'
  ) THEN
    ALTER TABLE public.stock_issues
      ADD CONSTRAINT stock_issues_issue_number_not_blank
      CHECK (btrim(issue_number) <> '') NOT VALID;
    ALTER TABLE public.stock_issues
      VALIDATE CONSTRAINT stock_issues_issue_number_not_blank;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.stock_issues'::regclass
      AND conname = 'stock_issues_receiver_name_not_blank'
  ) THEN
    ALTER TABLE public.stock_issues
      ADD CONSTRAINT stock_issues_receiver_name_not_blank
      CHECK (btrim(receiver_name) <> '') NOT VALID;
    ALTER TABLE public.stock_issues
      VALIDATE CONSTRAINT stock_issues_receiver_name_not_blank;
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS stock_issue_items_issue_material_unique_idx
  ON public.stock_issue_items(stock_issue_id, material_id);

CREATE OR REPLACE FUNCTION public.issue_stock(
  p_project_id uuid,
  p_issue_number varchar,
  p_issue_date date,
  p_receiver_name varchar,
  p_destination varchar,
  p_reference_number varchar,
  p_notes text,
  p_items jsonb,
  p_idempotency_key varchar
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_issue_id uuid;
  v_item record;
  v_balance numeric(18,3);
BEGIN
  IF auth.uid() IS NULL OR NOT public.owns_project(p_project_id) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  IF p_issue_number IS NULL OR btrim(p_issue_number) = '' THEN
    RAISE EXCEPTION 'issue number is required';
  END IF;

  IF p_issue_date IS NULL THEN
    RAISE EXCEPTION 'issue date is required';
  END IF;

  IF p_receiver_name IS NULL OR btrim(p_receiver_name) = '' THEN
    RAISE EXCEPTION 'receiver name is required';
  END IF;

  IF p_idempotency_key IS NULL OR btrim(p_idempotency_key) = '' THEN
    RAISE EXCEPTION 'idempotency key required';
  END IF;

  IF p_items IS NULL
     OR jsonb_typeof(p_items) <> 'array'
     OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'at least one issue item is required';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_items) e
    WHERE jsonb_typeof(e) <> 'object'
       OR coalesce(e->>'material_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
       OR coalesce(e->>'quantity', '') !~ '^[[:space:]]*[0-9]+([.][0-9]+)?[[:space:]]*$'
  ) THEN
    RAISE EXCEPTION 'invalid issue item payload';
  END IF;

  SELECT id
  INTO v_issue_id
  FROM public.stock_issues
  WHERE project_id = p_project_id
    AND idempotency_key = p_idempotency_key;

  IF FOUND THEN
    RETURN v_issue_id;
  END IF;

  -- Validate and lock all materials in deterministic UUID order before writing.
  FOR v_item IN
    SELECT payload.material_id, sum(payload.quantity)::numeric(18,3) AS quantity
    FROM (
      SELECT
        (e->>'material_id')::uuid AS material_id,
        (e->>'quantity')::numeric AS quantity
      FROM jsonb_array_elements(p_items) e
    ) payload
    GROUP BY payload.material_id
    ORDER BY payload.material_id
  LOOP
    IF v_item.quantity <= 0 THEN
      RAISE EXCEPTION 'issued quantity must be positive';
    END IF;

    PERFORM pg_advisory_xact_lock(hashtextextended(v_item.material_id::text, 0));

    IF NOT EXISTS (
      SELECT 1
      FROM public.materials m
      WHERE m.id = v_item.material_id
        AND m.project_id = p_project_id
    ) THEN
      RAISE EXCEPTION 'material % does not belong to project', v_item.material_id;
    END IF;

    SELECT coalesce(
      sum(CASE WHEN sm.type = 'IN' THEN sm.quantity ELSE -sm.quantity END),
      0
    )::numeric(18,3)
    INTO v_balance
    FROM public.stock_movements sm
    WHERE sm.project_id = p_project_id
      AND sm.material_id = v_item.material_id;

    IF v_balance < v_item.quantity THEN
      RAISE EXCEPTION 'insufficient stock. available: %, requested: %', v_balance, v_item.quantity;
    END IF;
  END LOOP;

  INSERT INTO public.stock_issues (
    project_id,
    issue_number,
    date,
    receiver_name,
    destination,
    reference_number,
    notes,
    idempotency_key,
    created_by
  )
  VALUES (
    p_project_id,
    btrim(p_issue_number),
    p_issue_date,
    btrim(p_receiver_name),
    nullif(btrim(p_destination), ''),
    nullif(btrim(p_reference_number), ''),
    nullif(btrim(p_notes), ''),
    btrim(p_idempotency_key),
    auth.uid()
  )
  ON CONFLICT (project_id, idempotency_key) DO NOTHING
  RETURNING id INTO v_issue_id;

  IF v_issue_id IS NULL THEN
    SELECT id
    INTO v_issue_id
    FROM public.stock_issues
    WHERE project_id = p_project_id
      AND idempotency_key = p_idempotency_key;
    RETURN v_issue_id;
  END IF;

  FOR v_item IN
    SELECT payload.material_id, sum(payload.quantity)::numeric(18,3) AS quantity
    FROM (
      SELECT
        (e->>'material_id')::uuid AS material_id,
        (e->>'quantity')::numeric AS quantity
      FROM jsonb_array_elements(p_items) e
    ) payload
    GROUP BY payload.material_id
    ORDER BY payload.material_id
  LOOP
    INSERT INTO public.stock_issue_items(stock_issue_id, material_id, quantity)
    VALUES (v_issue_id, v_item.material_id, v_item.quantity);

    INSERT INTO public.stock_movements (
      project_id,
      type,
      material_id,
      quantity,
      date,
      reference_number,
      receiver_name,
      location_used,
      notes,
      created_by
    )
    VALUES (
      p_project_id,
      'OUT',
      v_item.material_id,
      v_item.quantity,
      p_issue_date,
      btrim(p_issue_number),
      btrim(p_receiver_name),
      nullif(btrim(p_destination), ''),
      nullif(btrim(p_notes), ''),
      auth.uid()
    );
  END LOOP;

  RETURN v_issue_id;
END;
$$;

REVOKE ALL ON FUNCTION public.issue_stock(
  uuid,
  varchar,
  date,
  varchar,
  varchar,
  varchar,
  text,
  jsonb,
  varchar
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.issue_stock(
  uuid,
  varchar,
  date,
  varchar,
  varchar,
  varchar,
  text,
  jsonb,
  varchar
) TO authenticated;

COMMENT ON FUNCTION public.issue_stock(
  uuid,
  varchar,
  date,
  varchar,
  varchar,
  varchar,
  text,
  jsonb,
  varchar
) IS 'Atomically creates an idempotent stock issue after deterministic locking and project ownership validation.';
