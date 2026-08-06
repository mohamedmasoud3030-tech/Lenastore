# Supabase Migration Ledger

Product: LENA SUPPLY  
Production project ref: `bsrshhgjtnrvsckeqsmg`  
Repository base reviewed: `2fa47595d9244a43928b585763b3c804acf9499e`

> Live verification was not completed in this continuation because the Supabase connector became unavailable during execution. No claim below treats a Git file as proof that Production has been migrated.

| Migration | Expected objects | Git state | Live state | Required action |
|---|---|---:|---:|---|
| `202608060001_make_project_setup_idempotent.sql` | `public.upsert_existing_project_on_insert()` and `projects_idempotent_insert` trigger on `public.projects` | Present | Unverified in this run | Inspect function, trigger name, grants and retry behavior on project `bsrshhgjtnrvsckeqsmg` |
| `202608060002_add_stock_issues_and_rpc.sql` | `public.stock_issues`, `public.stock_issue_items`, RLS policies and `public.issue_stock(...)` | Present | Unverified in this run | Apply only if absent, then verify tables, policies, grants and function signature |
| `202608060003_harden_stock_issue_rpc.sql` | strict payload validation, deterministic material locking, unique issue-item material index, non-null `created_by`, hardened grants | Added on release branch | Not applied | Review and apply after migration 002, then run stock issue SQL assertions |

## Required live verification query

Run against `bsrshhgjtnrvsckeqsmg` before merge or release:

```sql
select
  to_regclass('public.stock_issues') is not null as stock_issues_exists,
  to_regclass('public.stock_issue_items') is not null as stock_issue_items_exists,
  to_regprocedure('public.issue_stock(uuid,character varying,date,character varying,character varying,character varying,text,jsonb,character varying)') is not null as issue_stock_exists,
  to_regprocedure('public.upsert_existing_project_on_insert()') is not null as onboarding_function_exists;

select t.tgname, t.tgenabled
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = 'projects'
  and not t.tgisinternal;

select
  n.nspname,
  p.proname,
  p.prosecdef,
  pg_get_function_identity_arguments(p.oid) as arguments,
  p.proconfig,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'upsert_existing_project_on_insert',
    'receive_goods',
    'register_payment',
    'issue_stock',
    'validate_stock_movement'
  )
order by p.proname;
```

## Release assertions

After applying migrations in order, run:

- `supabase/tests/release_assertions.sql`
- `supabase/tests/stock_issues.test.sql`

The stock issue assertions now cover:

- multiple materials;
- duplicate material aggregation;
- idempotent retry;
- empty and malformed payload rejection;
- cross-project material rejection;
- over-issue rejection;
- stock preservation after failed operations.

## Migration rules

- Never edit an already-applied migration to change Production behavior.
- Add a new timestamped correction migration.
- Never execute the whole `schema.sql` against Production as a shortcut.
- Apply DDL through the migration mechanism, not an ad-hoc client query.
- Record the live migration version and verification timestamp after application.
- Re-run Security and Performance Advisors after every applied DDL change.

## Current release blocker

`202608060003_harden_stock_issue_rpc.sql` is committed but not proven applied live. The release remains database-blocked until the live object query and SQL assertions pass on `bsrshhgjtnrvsckeqsmg`.
