# Supabase Migration Ledger

Product: LENA SUPPLY  
Production project ref: `bsrshhgjtnrvsckeqsmg`  
Verified: `2026-08-06`  
Release branch: `release/lena-supply-hardening-continuation-20260806`

This ledger records the live production state verified through the Supabase management connection. Repository files alone are not treated as proof of application.

| Repository migration | Live migration version | Live state | Verification |
|---|---:|---:|---|
| `202608060001_make_project_setup_idempotent.sql` | `20260805231003` (`make_project_setup_idempotent`) | Applied | Function `public.upsert_existing_project_on_insert()` exists and trigger `projects_idempotent_insert` is enabled |
| `202608060002_add_stock_issues_and_rpc.sql` | `20260806102907` (`add_stock_issues_and_rpc`) | Applied | Stock issue tables, RLS, indexes and initial RPC were created |
| `202608060003_harden_stock_issue_rpc.sql` | `20260806102938` (`harden_stock_issue_rpc`) | Applied | Strict validation, deterministic locks, non-null creator, unique issue/material index and hardened grants are active |

## Live release assertions

The following checks passed against project `bsrshhgjtnrvsckeqsmg`:

- required release tables and functions exist;
- `projects_idempotent_insert` exists and is enabled;
- RLS is enabled on both stock issue tables;
- `stock_issues.created_by` is `NOT NULL`;
- `issue_stock(...)` is `SECURITY DEFINER` with `search_path=public, pg_temp`;
- `anon` cannot execute `issue_stock(...)`;
- `authenticated` can execute `issue_stock(...)`;
- the unique issue/material index exists.

Result:

```text
PASS: live release objects, trigger, RLS and RPC grants are valid
```

## Stock issue transactional assertions

The test ran inside a transaction and ended with `ROLLBACK`, so production demo data was not changed. It verified:

- multiple materials in one issue;
- duplicate material aggregation;
- idempotent retry returning the same issue;
- empty payload rejection;
- cross-project material rejection;
- over-issue rejection;
- unchanged stock after failed operations.

Result:

```text
PASS: stock issue atomicity, aggregation, idempotency, isolation and balance protection
```

## Advisor review

Security Advisor reports the three authenticated operational RPCs (`receive_goods`, `register_payment`, `issue_stock`) because they intentionally use `SECURITY DEFINER`. Each function verifies `auth.uid()`, checks project ownership and fixes its `search_path`; `anon` execution is revoked. These warnings are therefore reviewed and accepted for the RPC architecture.

The remaining account-level warning is leaked-password protection being disabled. It must be enabled in Supabase Auth settings before public account registration is promoted beyond the controlled MVP.

Performance Advisor reports only informational unused-index notices. The database is new and low-volume, so release-critical indexes are retained until real query statistics exist.

## Migration rules

- Never edit an already-applied migration to change production behavior.
- Add a new timestamped correction migration.
- Never execute the whole `schema.sql` against production as a shortcut.
- Apply DDL through the migration mechanism, not an ad-hoc client query.
- Record the live migration version and verification date after application.
- Re-run Security and Performance Advisors after every DDL change.

## Current database gate

The database migration and SQL assertion gate is complete. Remaining merge gates are repository CI and deployment verification.
