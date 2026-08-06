# LENA SUPPLY UI Contract

Status: **Locked for the operational MVP**  
Product: **LENA SUPPLY — لينا للتوريدات**

This contract is the visual source of truth for all current and future screens. A page must reuse the shared patterns below instead of inventing a new visual language.

## Product character

LENA SUPPLY is a daily construction-materials operations tool. It is not a marketing site, a landing page, or a generic ERP template.

Required qualities:

- practical and information-dense without feeling crowded;
- Arabic-first and true RTL;
- mobile-first, then tablet and desktop;
- direct task execution with minimal introductory copy;
- clear separation between loading, error, empty and success states.

## Brand

- Master brand: `LENA`
- Product: `SUPPLY`
- Full name: `LENA SUPPLY`
- Arabic name: `لينا للتوريدات`
- Descriptor: `إدارة المواد والمشتريات والمخزون للمشروعات الإنشائية`
- Browser title: `LENA Supply | إدارة المواد والتوريدات`
- PWA short name: `LENA`

Brand strings must come from `src/config/brand.ts` where code reuse is possible.

## Palette

- Slate 950/900: navigation, primary actions, strong headings.
- Sky 700/600: active navigation, links and operational emphasis.
- Amber 500/400: warnings and highlighted supply actions.
- Emerald 700/600: completed and healthy states.
- Red 700/600: errors and destructive warnings.
- Slate 100/50: application background and neutral surfaces.

A status must never depend on color alone; every badge includes a readable label.

## Typography

- Font family: Cairo with system sans-serif fallback.
- Page title: 22–28 px, bold/black.
- Section title: 16–20 px, bold.
- Body: 14–16 px.
- Supporting text: 12–14 px; essential operational text must not use tiny text.
- Financial values use tabular numerals where supported.

## Spacing and sizing

- Mobile page padding: 16 px.
- Desktop page padding: 20–24 px.
- Section gap: 16–24 px.
- Input height: 44–48 px.
- Primary button height: 44–48 px.
- Minimum touch target: 44 × 44 px.
- Card radius: 12–16 px.
- Dialog radius: maximum 16 px.

## Page structure

Every operational page follows this order:

1. compact page header;
2. one-line description only when useful;
3. primary action;
4. search and filters;
5. KPIs only when they support a decision;
6. data table on desktop or operational cards on mobile.

Forbidden:

- hero sections;
- marketing feature lists;
- full-width promotional banners;
- oversized titles;
- decorative empty space;
- cards nested inside cards without a functional reason;
- re-styling the same primitive differently per page.

## Shared patterns

Use the existing shared components and extend them centrally:

- `PageContainer`
- `PageHeader`
- `FilterToolbar`
- `KpiCard`
- `StatusBadge`
- `LoadingSkeleton`
- `ErrorState`
- `EmptyState`
- `ConfirmDialog`
- `ToastProvider`

New pages must use these patterns before introducing another component.

## Lists and tables

Desktop:

- concise columns;
- stable alignment;
- clear status badges;
- grouped row actions;
- no unnecessary horizontal page scroll.

Mobile:

- cards or structured rows;
- document number/name first;
- status second;
- two or three critical values only;
- details and secondary actions remain accessible;
- never shrink a desktop table until it becomes unreadable.

## Forms and dialogs

- One column on mobile.
- Two columns on larger screens only for related fields.
- Validation appears next to the relevant field.
- Saving state disables repeated submission.
- Long mobile forms use a full-height sheet or full page.
- Dialog content scrolls inside the viewport.
- Primary action remains reachable when the mobile keyboard is open.
- Icon-only buttons require `aria-label`.

## System states

Loading: skeletons that preserve layout.  
Error: Arabic explanation and retry action.  
Empty: concise explanation and useful CTA.  
Success: short toast and immediate data refresh.

A failed query must never be displayed as an empty dataset.

## Dark mode

Dark mode may remain only while every active page, dialog, chart and state remains readable at WCAG AA contrast. Light mode is the default. Print output is always light.

## Responsive acceptance

Required viewports:

- 320×568
- 360×800
- 375×812
- 390×844
- 414×896
- 768×1024
- 820×1180
- 1024×768
- 1280×800
- 1440×900
- 1920×1080

Acceptance conditions:

- no body-level horizontal overflow;
- no clipped primary action;
- no navigation covering content;
- no dialog outside the viewport;
- safe-area padding for installed PWA mode;
- usable at 200% zoom;
- direct route refresh works.

## Change control

Any global visual change must:

1. update a shared component or token;
2. update this contract when the rule changes;
3. include before/after screenshots for 375×812 and 1440×900;
4. prove that existing routes remain consistent.

A page-specific redesign that bypasses the shared contract is not accepted.
