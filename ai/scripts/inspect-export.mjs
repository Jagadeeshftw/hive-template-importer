/**
 * Inventories a Spectora spreadsheet export: what it really is, what columns it
 * carries, how full each one is, and what HTML hides in the comment cells.
 *
 *   node ai/scripts/inspect-export.mjs samples/spectora/<file>
 *
 * This is the tool that produced the Phase 1 numbers. It is deliberately
 * independent of the importer, so its counts are a check on the parser rather
 * than an echo of it.
 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import XLSX from 'xlsx';

const path = process.argv[2];
if (!path) {
  console.error('usage: node ai/scripts/inspect-export.mjs <file>');
  process.exit(1);
}

const bytes = readFileSync(path);
const sha = createHash('sha256').update(bytes).digest('hex');

// --- What is this file, really? ------------------------------------------
const magic = bytes.subarray(0, 4);
const isZip = magic[0] === 0x50 && magic[1] === 0x4b && magic[2] === 0x03 && magic[3] === 0x04;
const isBiff = magic[0] === 0xd0 && magic[1] === 0xcf;

console.log(`file      ${path}`);
console.log(`size      ${bytes.length} bytes`);
console.log(`sha256    ${sha}`);
console.log(`magic     ${[...magic].map((b) => b.toString(16).padStart(2, '0')).join(' ')}`);
console.log(`format    ${isZip ? 'ZIP container (XLSX / OOXML)' : isBiff ? 'legacy BIFF (.xls) — NOT supported' : 'unknown'}`);
if (!isZip) process.exit(1);

const wb = XLSX.read(bytes, { type: 'buffer' });
const sheet = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' });
const [header, ...data] = rows;

console.log(`sheets    ${wb.SheetNames.join(', ')}`);
console.log(`rows      ${data.length} data rows + 1 header`);
console.log(`columns   ${header.length}`);

// --- Hierarchy ------------------------------------------------------------
const col = (name) => header.indexOf(name);
const SECTION = col('Section Name');
const ITEM = col('Item Name');
const TEXT = col('Comment Text');

const sections = [...new Set(data.map((r) => r[SECTION]))];
const items = [...new Set(data.map((r) => `${r[SECTION]}\u0000${r[ITEM]}`))];
console.log(`\nsections  ${sections.length}`);
console.log(`items     ${items.length}`);
console.log(`comments  ${data.length}`);

console.log('\n--- per section (document order) ---');
for (const s of sections) {
  const inSection = data.filter((r) => r[SECTION] === s);
  const itemCount = new Set(inSection.map((r) => r[ITEM])).size;
  console.log(`  ${String(itemCount).padStart(3)} items ${String(inSection.length).padStart(4)} comments  ${s}`);
}

// Sections must be one contiguous run each, or row order cannot carry order.
const runs = [];
for (const r of data) if (runs.at(-1) !== r[SECTION]) runs.push(r[SECTION]);
const contiguous = runs.length === sections.length;
console.log(`\nsection blocks contiguous: ${contiguous ? 'yes' : `NO — ${runs.length} runs for ${sections.length} sections`}`);

// --- Column fill ----------------------------------------------------------
console.log('\n--- column fill ---');
for (const [i, name] of header.entries()) {
  const values = data.map((r) => (r[i] ?? '').toString());
  const filled = values.filter((v) => v.trim() !== '');
  const distinct = [...new Set(filled)];
  const sample = distinct.length && distinct.length <= 6 ? ` ${JSON.stringify(distinct)}` : '';
  console.log(
    `  ${String(filled.length).padStart(3)}/${data.length} filled, ${String(distinct.length).padStart(3)} distinct  ${name}${sample}`,
  );
}

// --- HTML in comment cells ------------------------------------------------
const blob = data.map((r) => r[TEXT] ?? '').join('');
const withText = data.filter((r) => (r[TEXT] ?? '').trim() !== '').length;
const withTags = data.filter((r) => /<[a-zA-Z]/.test(r[TEXT] ?? '')).length;

const tags = new Map();
for (const m of blob.matchAll(/<\s*([a-zA-Z][a-zA-Z0-9]*)[^>]*>/g)) {
  const t = m[1].toLowerCase();
  tags.set(t, (tags.get(t) ?? 0) + 1);
}
const attrs = new Map();
for (const m of blob.matchAll(/<\s*([a-zA-Z][a-zA-Z0-9]*)([^>]*)>/g)) {
  for (const a of m[2].matchAll(/([a-zA-Z-]+)\s*=/g)) {
    const k = `${m[1].toLowerCase()}@${a[1].toLowerCase()}`;
    attrs.set(k, (attrs.get(k) ?? 0) + 1);
  }
}

console.log(`\n--- HTML in "Comment Text" ---`);
console.log(`  ${withText} rows have text, ${withTags} contain tags, ${data.length - withText} are empty`);
console.log('  tags (opening):');
for (const [t, c] of [...tags].sort((a, b) => b[1] - a[1])) console.log(`    <${t}> ${c}`);
console.log('  attributes:');
for (const [a, c] of [...attrs].sort((a, b) => b[1] - a[1])) console.log(`    ${a} ${c}`);

const entities = new Map();
for (const m of blob.matchAll(/&[a-zA-Z#0-9]+;/g)) entities.set(m[0], (entities.get(m[0]) ?? 0) + 1);
console.log(`  entities: ${JSON.stringify(Object.fromEntries(entities))}`);

const names = data.map((r) => `${r[SECTION]}|${r[ITEM]}`).join('');
const nameEntities = new Map();
for (const m of names.matchAll(/&[a-zA-Z#0-9]+;/g)) nameEntities.set(m[0], (nameEntities.get(m[0]) ?? 0) + 1);
console.log(`  entities still in section/item NAMES: ${JSON.stringify(Object.fromEntries(nameEntities))}`);
console.log('    (these need exactly one more decode; comment HTML must NOT be decoded again)');

// --- Distributions worth knowing -----------------------------------------
const tally = (name) => {
  const i = col(name);
  if (i < 0) return;
  const counts = new Map();
  for (const r of data) {
    const v = (r[i] ?? '').toString().trim() || '(blank)';
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  const shown = [...counts].sort((a, b) => b[1] - a[1]).slice(0, 12);
  console.log(`  ${name}: ${shown.map(([v, c]) => `${v}=${c}`).join('  ')}`);
};

console.log('\n--- distributions ---');
for (const name of [
  'Comment Type (info, limit, defect)',
  'Category (-1: Low, 0: Med, 1: High)',
  'Answer Type (boolean, checkbox, date, number, range, text)',
  'Recommendation (from list)',
  'Unit Type Options (numeric answers only, comma-separated)',
]) tally(name);

const min = col('Default Estimate Min');
const max = col('Default Estimate Max');
const estimates = new Set(data.map((r) => `${r[min]}-${r[max]}`));
console.log(`\n  estimate ranges: ${estimates.size} distinct ${JSON.stringify([...estimates].slice(0, 5))}`);
if (estimates.size === 1) {
  console.log(`  ^ every row shares one range — likely a Spectora default, not tuned values`);
}
