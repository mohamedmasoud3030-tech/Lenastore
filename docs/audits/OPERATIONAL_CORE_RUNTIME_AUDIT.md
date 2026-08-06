# Operational Core Runtime Audit

**Date:** 2026-08-06  
**Application:** Lenastore Construction PWA  
**Target Repository:** https://github.com/mohamedmasoud3030-tech/Lenastore  
**Supabase Ref:** `bsrshhgjtnrvsckeqsmg`

---

## Route Runtime Audit Table

| Route | Data Source / Views | Current Failure / Flaw | Root Cause | Planned Fix | Test Verification |
|-------|-------------------|----------------------|------------|-------------|-------------------|
| `/` (Dashboard) | `material_stock`, `purchases`, `payments` | Potential loading hang or empty cards on silent error | Swallowing error inside try/catch with `console.error` | Unified error handling, skeleton loading, project currency formatting | Unit test & UI render check |
| `/materials` | `material_stock`, `materials` | Search filters client side only, zero stock logic check, alert on duplicate | Uses default browser `alert()`, missing detail drawer, duplicate material name crash | Toast notifications, modal error, detail drawer with movement history, currency & unit accuracy | Material CRUD & low stock test |
| `/movements` | `stock_movements`, `material_stock` | Non-atomic stock issue, single-item direct insert into `stock_movements`, missing voucher metadata (stock_issues) | No stock issue voucher entity (`stock_issues`/`stock_issue_items`), no atomic RPC for stock issues | New DB migration for `stock_issues` & `stock_issue_items`, RPC `issue_stock` with lock & idempotency | SQL test & UI issue voucher test |
| `/requests` | `purchase_requests` | No pagination/filtering, missing status badges | Generic error handling, plain table without search/filter | Refactored list view with search, filter by status, unified UI components | PR list rendering & filter test |
| `/requests/new` | `materials`, `purchase_requests`, `purchase_request_items` | Non-atomic insert (parent then items), silent fail if item insert fails | 2 separate DB queries without transaction, raw error dialogs | Atomic RPC / transaction error boundary, validation for quantity > 0, toast feedback | Create PR integration test |
| `/requests/:id` | `purchase_requests`, `purchase_request_items`, `attachments` | Missing converted purchase status link, raw status strings | Basic layout without status stepper or supplier pre-selection | Add conversion state check, status badge, attachments integration | Request conversion test |
| `/purchases` | `purchases`, `suppliers`, `payments`, `purchase_balances` | Hardcoded SAR currency, client-side payment sum, missing search/filter | Hardcoded 'SAR' in `formatCurrency`, ignoring `purchase_balances` view | Use `project.currency`, query `purchase_balances` view, add search and filters | Currency & purchase balance test |
| `/purchases/new` | `suppliers`, `materials`, `purchases`, `purchase_items` | Non-atomic insert, random ID generation, potential partial failure | Client-side loops without atomic transaction | Atomic save or robust error rollback, auto-generated sequence number, currency formatter | Create purchase test |
| `/purchases/:id` | `purchases`, `purchase_items`, `payments`, `goods_receipts` | Non-idempotent receipt key (`Date.now()`), hardcoded SAR currency, missing receipt history | `Date.now()` recalculated every call, missing goods receipt history list | Persistent idempotency key, currency formatter, Goods Receipt history timeline | Goods receipt & payment test |
| `/suppliers` | `suppliers`, `supplier_balances` | Missing financial summary (purchases count, balance, total paid), no supplier detail drawer/statement | Only selecting from `suppliers` table without joining `supplier_balances` | Select from `supplier_balances`, add detail drawer with statement & printable ledger | Supplier statement test |
| `/reports` | `material_stock`, `payments`, `supplier_balances`, `stock_movements` | **`LOW_STOCK` report broken** (overwritten by `fetchStockReport` hardcoding `STOCK` type), CSV export without escaping or UTF-8 BOM | `fetchStockReport` sets `type: 'STOCK'` regardless of button clicked | Dedicated report handlers, proper CSV UTF-8 BOM + quote escaping, clean A4 print styles | Report generation & CSV test |

---

## Shared Architecture Improvements

1. **Unified Formatting**: Currency formatting powered by `project.currency` supporting SAR, EGP, OMR, AED, USD.
2. **Standard Component Layer**: `PageHeader`, `KpiCard`, `DataTable`, `LoadingSkeleton`, `EmptyState`, `ErrorState`, `StatusBadge`, `ConfirmDialog`, `Toast`.
3. **Atomic Stock Issue Engine**: `stock_issues` & `stock_issue_items` schema with `issue_stock` SECURITY DEFINER RPC.
4. **Idempotent Goods Receipt**: `receive_goods` RPC usage with sticky idempotency keys.
5. **Idempotent Payment Registration**: `register_payment` RPC usage with balance validation.
