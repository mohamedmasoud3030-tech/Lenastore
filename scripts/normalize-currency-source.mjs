import { readFileSync, writeFileSync } from 'node:fs';

const files = [
  'src/components/Suppliers.tsx',
  'src/components/Purchases.tsx',
  'src/components/Reports.tsx',
  'src/components/common/PrintDocumentModal.tsx',
  'src/lib/formatters.ts',
];

let changed = 0;
for (const file of files) {
  const source = readFileSync(file, 'utf8');
  const normalized = source
    .replace(/(\|\||\?\?)\s*'SAR'/g, "$1 'EGP'")
    .replace(/(\|\||\?\?)\s*"SAR"/g, '$1 "EGP"')
    .replace(/(\|\||\?\?)\s*'OMR'/g, "$1 'EGP'")
    .replace(/(\|\||\?\?)\s*"OMR"/g, '$1 "EGP"');

  if (normalized !== source) {
    writeFileSync(file, normalized);
    changed += 1;
    console.log(`Normalized ${file}`);
  }
}

if (changed === 0) {
  console.log('No currency fallbacks needed normalization.');
} else {
  console.log(`Normalized ${changed} source files.`);
}
