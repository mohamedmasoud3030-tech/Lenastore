import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import process from 'node:process';

const root = process.cwd();
const failures = [];

function walk(directory) {
  const absolute = join(root, directory);
  if (!existsSync(absolute)) return [];
  return readdirSync(absolute).flatMap((entry) => {
    const path = join(absolute, entry);
    if (statSync(path).isDirectory()) return walk(relative(root, path));
    return [path];
  });
}

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

function fail(message) {
  failures.push(message);
}

function requireText(haystack, needle, label) {
  if (!haystack.includes(needle)) fail(`${label}: missing ${needle}`);
}

const sourceFiles = walk('src').filter((path) => /\.(ts|tsx)$/.test(path));
const source = sourceFiles
  .map((path) => `\n/* ${relative(root, path)} */\n${readFileSync(path, 'utf8')}`)
  .join('\n');
const migrations = walk('supabase/migrations')
  .filter((path) => path.endsWith('.sql'))
  .map((path) => readFileSync(path, 'utf8'))
  .join('\n');
const sqlTests = walk('supabase/tests')
  .filter((path) => path.endsWith('.sql'))
  .map((path) => readFileSync(path, 'utf8'))
  .join('\n');

const forbiddenDirectWrites = [
  ['purchase_requests', /\.from\(['"]purchase_requests['"]\)[\s\S]{0,180}?\.insert\(/g],
  ['purchase_request_items', /\.from\(['"]purchase_request_items['"]\)[\s\S]{0,180}?\.insert\(/g],
  ['purchases', /\.from\(['"]purchases['"]\)[\s\S]{0,180}?\.insert\(/g],
  ['purchase_items', /\.from\(['"]purchase_items['"]\)[\s\S]{0,180}?\.insert\(/g],
  ['payments', /\.from\(['"]payments['"]\)[\s\S]{0,180}?\.insert\(/g],
  ['goods_receipts', /\.from\(['"]goods_receipts['"]\)[\s\S]{0,180}?\.insert\(/g],
  ['goods_receipt_items', /\.from\(['"]goods_receipt_items['"]\)[\s\S]{0,180}?\.insert\(/g],
  ['stock_issues', /\.from\(['"]stock_issues['"]\)[\s\S]{0,180}?\.insert\(/g],
  ['stock_issue_items', /\.from\(['"]stock_issue_items['"]\)[\s\S]{0,180}?\.insert\(/g],
];

for (const [table, pattern] of forbiddenDirectWrites) {
  if (pattern.test(source)) fail(`Atomic write bypass: frontend inserts directly into ${table}`);
}

const requiredFrontendRpcs = [
  'create_purchase_request_atomic',
  'create_purchase_atomic',
  'receive_goods',
  'register_payment',
  'issue_stock',
  'reverse_payment',
  'cancel_goods_receipt',
  'cancel_stock_issue',
  'create_purchase_return',
  'cancel_purchase_request',
  'cancel_purchase',
  'system_integrity_report',
  'export_project_snapshot',
  'report_client_error',
  'seed_demo_project_if_empty',
];
for (const rpc of requiredFrontendRpcs) {
  requireText(source, `'${rpc}'`, 'Frontend RPC contract');
  requireText(migrations, `function public.${rpc}(`, 'Database RPC contract');
}

const purchasesSource = read('src/components/Purchases.tsx');
if (purchasesSource.includes('purchase_balances(*)')) {
  requireText(
    migrations,
    'function public.purchase_balances(p public.purchases)',
    'PostgREST computed relationship for purchase_balances'
  );
}

const suppliersSource = read('src/components/Suppliers.tsx');
if (suppliersSource.includes('supplier_balances(*)')) {
  requireText(
    migrations,
    'function public.supplier_balances(s public.suppliers)',
    'PostgREST computed relationship for supplier_balances'
  );
}

const appSource = read('src/App.tsx');
for (const route of [
  'path="requests"',
  'path="materials"',
  'path="movements"',
  'path="purchases"',
  'path="suppliers"',
  'path="reports"',
  'path="audit"',
  'path="integrity"',
]) {
  requireText(appSource, route, 'Protected route contract');
}
requireText(appSource, '<RuntimeErrorReporter />', 'Runtime monitoring mount');

for (const testFile of [
  'supabase/tests/db.test.sql',
  'supabase/tests/procurement_atomicity.test.sql',
  'supabase/tests/payment_idempotency.test.sql',
  'supabase/tests/stock_issues.test.sql',
  'supabase/tests/reversals_and_returns.test.sql',
  'supabase/tests/production_readiness.test.sql',
]) {
  if (!existsSync(join(root, testFile))) fail(`Missing SQL regression test: ${testFile}`);
}

requireText(sqlTests, "'flow-payment-1'", 'Current payment idempotency test');
requireText(sqlTests, 'create_purchase_request_atomic(', 'Atomic request SQL coverage');
requireText(sqlTests, 'create_purchase_atomic(', 'Atomic purchase SQL coverage');
requireText(sqlTests, 'reverse_payment(', 'Payment reversal SQL coverage');
requireText(sqlTests, 'create_purchase_return(', 'Purchase return SQL coverage');
requireText(sqlTests, 'system_integrity_report(', 'Integrity SQL coverage');
requireText(sqlTests, 'export_project_snapshot(', 'Export SQL coverage');
requireText(sqlTests, 'seed_demo_project_if_empty(', 'Safe demo SQL coverage');
requireText(sqlTests, 'report_client_error(', 'Runtime error SQL coverage');

for (const path of sourceFiles) {
  const relativePath = relative(root, path);
  const text = readFileSync(path, 'utf8');
  if (/\|\|\s*['"](?:SAR|OMR)['"]|\?\?\s*['"](?:SAR|OMR)['"]/.test(text)) {
    fail(`Forbidden non-EGP currency fallback: ${relativePath}`);
  }
}

if (/register_payment\s*\([^)]*'partial'\s*\)/s.test(sqlTests)) {
  fail('Legacy seven-argument register_payment call detected in SQL tests');
}

if (failures.length) {
  console.error('\nContract verification failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`Contract verification passed: ${sourceFiles.length} source files, ${requiredFrontendRpcs.length} RPCs, protected routes, EGP currency and SQL flow coverage.`);
