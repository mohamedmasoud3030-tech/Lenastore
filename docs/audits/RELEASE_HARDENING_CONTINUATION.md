# Release Hardening Continuation

Date: 2026-08-06  
Base commit: `2fa47595d9244a43928b585763b3c804acf9499e`  
Branch: `release/lena-supply-hardening-continuation-20260806`

## Continued from the previous usage-limited run

The previous run stopped after synchronizing dependencies, changing the public brand metadata and writing a baseline report. This continuation addresses the remaining high-risk findings without treating incomplete work as released.

## Completed in this branch

### Data integrity

- Removed the `current_stock × 10` estimated-cost fallback from analytics.
- Financial charts now use recorded purchases, purchase items and payments only.
- Cost analysis shows an explicit insufficient-data state instead of invented values.
- Movement insights use movement counts rather than combining quantities with incompatible units.
- Every analytics Supabase response is checked for an error before data is rendered.
- Query failures render an Arabic retry state and never masquerade as an empty dataset.

### Stock issue migration

- Added `202608060003_harden_stock_issue_rpc.sql`.
- Added strict issue-number, date, receiver, idempotency and JSON payload validation.
- Added deterministic material locking by UUID order.
- Preserved atomic and idempotent behavior.
- Added a unique issue/material index.
- Backfilled and enforced non-null `created_by`.
- Explicitly revoked execution from PUBLIC and anon.
- Expanded SQL assertions for aggregation, retry, malformed input, cross-project access and over-issue protection.

### Brand and practical UX

- `BrandMark` now displays `LENA SUPPLY` and `لينا للتوريدات` from the central brand config.
- Replaced the marketing split-screen login with a compact operational login.
- Replaced the promotional project-setup layout with a focused form.
- Set the setup default currency to EGP while preserving user-selectable EGP/SAR/OMR/AED/USD.
- Improved Arabic-safe currency and date formatting.

### PWA

- Removed the duplicate static `public/manifest.json`.
- Kept VitePWA as the single manifest source.
- Added theme, application and description metadata to `index.html`.
- Preserved NetworkOnly handling for Supabase requests.

### Design governance

- Added `docs/design/LENA_SUPPLY_UI_CONTRACT.md`.
- Added `docs/design/LENA_SUPPLY_VISUAL_REGRESSION_RULES.md`.
- Added an explicit Supabase migration ledger.

## Still blocked before release

The Supabase connector became unavailable during this continuation. Therefore the branch does **not** claim that migrations 002 or 003 are applied to Production.

Before merge/release:

1. Verify migration history on `bsrshhgjtnrvsckeqsmg`.
2. Apply missing migrations in order.
3. Run `supabase/tests/release_assertions.sql`.
4. Run `supabase/tests/stock_issues.test.sql`.
5. Run Security and Performance Advisors.
6. Confirm the production Vercel project identity and deployment SHA.

## Quality gate

A Pull Request is required so GitHub Actions can run from a clean Node 22 environment using:

```bash
npm ci
npm run lint
npm test
npm run build
```

The branch must not be merged while any check is failing or while the live migration status remains unverified.
