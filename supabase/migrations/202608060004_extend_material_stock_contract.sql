-- Extend the material_stock API contract without changing the existing column order.
-- New columns are appended so existing PostgREST clients remain compatible.

CREATE OR REPLACE VIEW public.material_stock
WITH (security_invoker = true)
AS
SELECT
  m.id AS material_id,
  m.project_id,
  m.name,
  m.min_stock,
  m.unit,
  coalesce(sum(CASE WHEN sm.type = 'IN' THEN sm.quantity ELSE 0 END), 0)::numeric(18,3) AS total_in,
  coalesce(sum(CASE WHEN sm.type = 'OUT' THEN sm.quantity ELSE 0 END), 0)::numeric(18,3) AS total_out,
  (
    coalesce(sum(CASE WHEN sm.type = 'IN' THEN sm.quantity ELSE 0 END), 0)
    - coalesce(sum(CASE WHEN sm.type = 'OUT' THEN sm.quantity ELSE 0 END), 0)
  )::numeric(18,3) AS current_stock,
  m.category,
  m.notes
FROM public.materials m
LEFT JOIN public.stock_movements sm ON sm.material_id = m.id
GROUP BY
  m.id,
  m.project_id,
  m.name,
  m.min_stock,
  m.unit,
  m.category,
  m.notes;

COMMENT ON VIEW public.material_stock IS
  'RLS-aware material balances with category and notes appended to the stable API contract.';

GRANT SELECT ON public.material_stock TO authenticated;
REVOKE ALL ON public.material_stock FROM anon;
