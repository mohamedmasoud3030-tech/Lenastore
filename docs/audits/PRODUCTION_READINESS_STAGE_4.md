# Production Readiness — Stage 4

Date: 2026-08-06

## Runtime controls

- Project-scoped client error reporting for uncaught browser errors and unhandled promise rejections.
- Direct integrity report covering stock, procurement totals, receipt state, payments, returns, project isolation and reversal lineage.
- Full project JSON export including operational records, audit events, attachment metadata and runtime errors.
- Safe demo seeding restricted to a completely empty project and implemented through the same atomic RPCs used by production flows.
- EGP is the only fallback currency in application source.

## Live database verification

The production Supabase project was verified using rolled-back transactions:

- 16 integrity checks returned zero current issues.
- Project export contained every expected data section.
- Safe demo setup created materials, a supplier, purchase request, purchase order, partial receipt, payment and stock issue.
- A second demo seed attempt on a non-empty project was rejected.
- Runtime error reporting was recorded and surfaced by the integrity report.
- Unauthorized project access was rejected.
- Final production-readiness test: 19 assertions passed, 0 failed, transaction rolled back.

## Automated merge gates

CI blocks:

- Direct frontend writes to atomic procurement, payment, receipt and issue tables.
- Missing frontend or database RPC contracts.
- Missing protected application routes.
- Missing computed relationships for embedded balance views.
- Missing SQL regression suites.
- Legacy seven-argument payment calls.
- SAR or OMR fallback currency values in TypeScript source.
- TypeScript, unit test or production build failures.

SQL regression files can run automatically against a configured test database through the `SUPABASE_DB_URL` repository secret. Live production verification is additionally executed transactionally before release migrations are considered complete.
