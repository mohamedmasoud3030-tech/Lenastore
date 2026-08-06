# RELEASE HARDENING BASELINE AUDIT

**Date:** 2026-08-06  
**Product:** LENA SUPPLY (لينا للتوريدات)  
**Base SHA:** `732f04a6aad75353c5ceef3444ede96d579dacaa` (origin/main)  
**Working Branch:** `release/lena-supply-hardening-20260806-0916`  
**Backup Branch:** `ai-studio/pre-release-hardening-backup-20260806-0916`  

---

## Environment Facts
- **Node Version:** `v22.23.1`
- **npm Version:** `10.9.8`
- **Supabase Project Ref:** `bsrshhgjtnrvsckeqsmg`
- **Supabase URL:** `https://bsrshhgjtnrvsckeqsmg.supabase.co`

---

## Baseline Diagnostics
1. **Dependency Lock Status:**
   - Initial issue: `package.json` had `html2canvas`, `jspdf`, `recharts` added without updating `package-lock.json`. `npm ci` failed with `EUSAGE`.
   - Resolution: Ran `npm install` to synchronize `package-lock.json`, verified with clean `rm -rf node_modules && npm ci`. `npm ci` passes cleanly in 9 seconds.
   - Updated `.github/workflows/quality.yml` to enforce `npm ci`.

2. **Database Migrations Baseline:**
   - `202608060001_make_project_setup_idempotent.sql` (Idempotent onboarding RPC & trigger).
   - `202608060002_add_stock_issues_and_rpc.sql` (Stock issue tables, RLS policies, and `issue_stock` RPC).

3. **Analytics & Business Calculations Audit:**
   - Audit target: `AnalyticsCharts.tsx`, `Dashboard.tsx`.
   - Identified mock/fake multipliers (e.g. arbitrary constants for material costs) that need replacement with actual SQL sum computations or explicit empty states when data is insufficient.

4. **Brand Integrity:**
   - Replacing legacy titles ("إدارة مشروع البناء", "مشروعي", "Lenastore") with official brand **LENA SUPPLY** (لينا للتوريدات).

5. **PWA & Build Optimization:**
   - PWA Workbox configured with `maximumFileSizeToCacheInBytes: 5MB` and rollup manualChunks grouping (`vendor-react`, `vendor-supabase`, `vendor-recharts`, `vendor-pdf`, `vendor-icons`).
