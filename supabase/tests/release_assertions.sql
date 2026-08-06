-- LENA SUPPLY release schema assertions.
-- Safe to run against the live project after all timestamped migrations.

DO $$
DECLARE
  v_issue_function oid;
  v_created_by_not_null boolean;
  v_stock_issues_rls boolean;
  v_stock_issue_items_rls boolean;
BEGIN
  IF to_regclass('public.projects') IS NULL
     OR to_regclass('public.materials') IS NULL
     OR to_regclass('public.stock_movements') IS NULL
     OR to_regclass('public.stock_issues') IS NULL
     OR to_regclass('public.stock_issue_items') IS NULL THEN
    RAISE EXCEPTION 'required release tables are missing';
  END IF;

  IF to_regprocedure('public.upsert_existing_project_on_insert()') IS NULL THEN
    RAISE EXCEPTION 'idempotent project setup function is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'projects'
      AND t.tgname = 'projects_idempotent_insert'
      AND NOT t.tgisinternal
      AND t.tgenabled <> 'D'
  ) THEN
    RAISE EXCEPTION 'projects_idempotent_insert trigger is missing or disabled';
  END IF;

  v_issue_function := to_regprocedure(
    'public.issue_stock(uuid,character varying,date,character varying,character varying,character varying,text,jsonb,character varying)'
  );
  IF v_issue_function IS NULL THEN
    RAISE EXCEPTION 'issue_stock function is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE oid = v_issue_function
      AND prosecdef
      AND proconfig @> ARRAY['search_path=public, pg_temp']::text[]
  ) THEN
    RAISE EXCEPTION 'issue_stock is not hardened with SECURITY DEFINER and a fixed search_path';
  END IF;

  IF has_function_privilege('anon', v_issue_function, 'EXECUTE') THEN
    RAISE EXCEPTION 'anon must not execute issue_stock';
  END IF;

  IF NOT has_function_privilege('authenticated', v_issue_function, 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated must execute issue_stock';
  END IF;

  SELECT attnotnull
  INTO v_created_by_not_null
  FROM pg_attribute
  WHERE attrelid = 'public.stock_issues'::regclass
    AND attname = 'created_by'
    AND NOT attisdropped;

  IF NOT coalesce(v_created_by_not_null, false) THEN
    RAISE EXCEPTION 'stock_issues.created_by must be NOT NULL';
  END IF;

  SELECT relrowsecurity INTO v_stock_issues_rls
  FROM pg_class WHERE oid = 'public.stock_issues'::regclass;
  SELECT relrowsecurity INTO v_stock_issue_items_rls
  FROM pg_class WHERE oid = 'public.stock_issue_items'::regclass;

  IF NOT coalesce(v_stock_issues_rls, false)
     OR NOT coalesce(v_stock_issue_items_rls, false) THEN
    RAISE EXCEPTION 'RLS must be enabled on stock issue tables';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'stock_issue_items'
      AND indexname = 'stock_issue_items_issue_material_unique_idx'
  ) THEN
    RAISE EXCEPTION 'unique issue/material index is missing';
  END IF;
END
$$;

SELECT 'PASS: live release objects, trigger, RLS and RPC grants are valid' AS result;
