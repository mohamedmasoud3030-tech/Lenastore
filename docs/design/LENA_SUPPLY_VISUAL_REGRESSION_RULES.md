# LENA SUPPLY Visual Regression Rules

These rules protect the approved operational interface from drifting between sessions.

## Required references

- `docs/design/LENA_SUPPLY_UI_CONTRACT.md`
- `src/config/brand.ts`
- shared components in `src/components/common/`

## Every visual pull request must prove

- no legacy brand string is visible;
- no marketing hero or feature panel was added;
- no body-level horizontal overflow exists;
- mobile primary actions remain visible and clickable;
- loading, error and empty states remain distinct;
- dark mode, when enabled, remains readable;
- print output remains light and RTL;
- the PWA manifest still resolves to one generated source.

## Required route matrix

Test at minimum:

- `/login`
- `/setup-project`
- `/`
- `/materials`
- `/movements`
- `/requests`
- `/requests/new`
- one request-details route
- `/purchases`
- `/purchases/new`
- one purchase-details route
- `/suppliers`
- `/reports`

## Required viewport matrix

- 320×568
- 375×812
- 414×896
- 768×1024
- 1024×768
- 1440×900

## Automated guards

A browser smoke test should fail when:

- `document.body.scrollWidth > window.innerWidth`;
- a primary button is outside the viewport;
- a dialog exceeds viewport bounds;
- a route renders a blank root;
- an uncaught runtime error occurs;
- a protected internal route fails after refresh;
- bottom navigation or a sticky action covers interactive content.

## Screenshot naming

Store evidence under:

`evidence/lena-supply-release/<viewport>/<route>.png`

Examples:

- `evidence/lena-supply-release/375/login.png`
- `evidence/lena-supply-release/375/materials.png`
- `evidence/lena-supply-release/1440/purchases.png`

## Forbidden changes

- adding a new one-off button system;
- adding a new one-off input style;
- replacing operational tables with decorative cards on desktop;
- placing critical information only in hover tooltips;
- shrinking essential text below readable mobile sizes;
- adding a second manifest;
- adding generated or estimated financial values;
- changing the brand name outside `src/config/brand.ts` without a formal product decision.

## Approval gate

A visual change is accepted only when lint, tests, production build, route smoke and the viewport matrix pass. A screenshot of one page is not sufficient evidence.
