import XLSX from 'xlsx';
import { sanitizeHtml, type SanitizePolicy } from '@/lib/sanitize-html';
import { SPECTORA_POLICY } from './policy';
import { assertSpectoraWorkbook, assertWorksheetPresent } from './sniff';
import {
  ImportError,
  type CommentCategory,
  type CommentType,
  type ImportIssue,
  type ImportResult,
  type ParsedComment,
  type ParsedItem,
  type ParsedOption,
  type ParsedSection,
} from './types';

export const PARSER_VERSION = 'spectora-xlsx v1';

/**
 * Columns are found by header name, never by position: a Spectora export with
 * an extra column inserted must still import. A required column that is absent
 * is a hard error naming it; an unrecognised column becomes an issue.
 */
const REQUIRED = {
  section: 'Section Name',
  item: 'Item Name',
  commentName: 'Comment Name',
  commentText: 'Comment Text',
  commentType: 'Comment Type (info, limit, defect)',
} as const;

const OPTIONAL = {
  category: 'Category (-1: Low, 0: Med, 1: High)',
  choices: 'Multiple Choice Options (comma-separated)',
  units: 'Unit Type Options (numeric answers only, comma-separated)',
  recommendation: 'Recommendation (from list)',
  order: 'Order (w/i item)',
  answerType: 'Answer Type (boolean, checkbox, date, number, range, text)',
  defaultValue: 'Default Value',
  defaultValue2: 'Default Value 2 (for "range" types)',
  defaultUnit: 'Default Unit Type (for "number" and "range" types)',
  defaultLocation: 'Default Location',
  estimateMin: 'Default Estimate Min',
  estimateMax: 'Default Estimate Max',
  locked: 'Locked',
  simpleFormat: 'Simple Format',
  disablePhotos: 'Disable Photos',
  uses: 'Uses',
  lastModified: 'Last Modified',
} as const;

/** Photo columns are numbered; matched by shape rather than listed ten times. */
const PHOTO_COLUMN = /^Default Photo \d+( Caption)?$/;

export type ParseOptions = {
  /** Defaults to the Spectora allowlist. */
  policy?: SanitizePolicy;
  /** Used to default the template name; the user can edit it before saving. */
  filename?: string;
};

export function parseSpectoraExport(
  bytes: Uint8Array,
  options: ParseOptions = {},
): ImportResult {
  const startedAt = Date.now();
  const policy = options.policy ?? SPECTORA_POLICY;

  assertSpectoraWorkbook(bytes);

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(bytes, { type: 'array' });
  } catch (cause) {
    throw new ImportError(
      'unreadable_workbook',
      `The workbook could not be opened: ${cause instanceof Error ? cause.message : 'unknown error'}`,
    );
  }

  assertWorksheetPresent(workbook.SheetNames);

  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  // raw:false keeps every cell as the string the export wrote, so trailing
  // spaces and line endings survive. defval:'' keeps rows rectangular.
  const grid = XLSX.utils.sheet_to_json<string[]>(sheet, {
    header: 1,
    raw: false,
    defval: '',
  });

  if (grid.length < 2) {
    throw new ImportError(
      'no_rows',
      'The worksheet has no data rows — only a header, or nothing at all.',
    );
  }

  const header = grid[0].map((h) => (h ?? '').toString());
  const rows = grid.slice(1);
  const issues: ImportIssue[] = [];

  const index = buildColumnIndex(header, issues);
  const cell = (row: string[], key: string): string => {
    const i = index.get(key);
    return i === undefined ? '' : ((row[i] ?? '') as string).toString();
  };

  // ---- walk the rows -----------------------------------------------------
  const sections: ParsedSection[] = [];
  let currentSection: ParsedSection | undefined;
  let currentItem: ParsedItem | undefined;

  rows.forEach((row, i) => {
    // Spreadsheet row number: +1 for the header, +1 because rows are 1-based.
    const sourceRow = i + 2;

    const sectionName = decodeOnce(cell(row, REQUIRED.section));
    const itemName = decodeOnce(cell(row, REQUIRED.item));

    if (!sectionName && !itemName && !cell(row, REQUIRED.commentName)) {
      return; // Entirely blank row: nothing to import, nothing to report.
    }

    if (!currentSection || currentSection.name !== sectionName) {
      currentSection = {
        name: sectionName,
        position: sections.length,
        sourceRow,
        items: [],
      };
      sections.push(currentSection);
      currentItem = undefined;
    }

    // Item identity is (section, name): "General" repeats across 8 sections.
    if (!currentItem || currentItem.name !== itemName) {
      currentItem = {
        name: itemName,
        position: currentSection.items.length,
        sourceRow,
        comments: [],
      };
      currentSection.items.push(currentItem);
    }

    const path = `${sectionName} > ${itemName}`;
    const comment = parseComment({
      row,
      cell,
      sourceRow,
      position: currentItem.comments.length,
      path,
      policy,
      issues,
    });

    currentItem.comments.push(comment);
  });

  const comments = sections.flatMap((s) => s.items.flatMap((i) => i.comments));

  // ---- template-level notices -------------------------------------------
  reportUniformEstimates(comments, issues);

  return {
    templateName: templateNameFrom(options.filename, sheetName),
    sections,
    issues,
    stats: {
      sheetName,
      rowCount: rows.length,
      columnCount: header.length,
      sectionCount: sections.length,
      itemCount: sections.reduce((n, s) => n + s.items.length, 0),
      commentCount: comments.length,
      durationMs: Date.now() - startedAt,
    },
  };
}

// ---------------------------------------------------------------------------

function buildColumnIndex(
  header: readonly string[],
  issues: ImportIssue[],
): Map<string, number> {
  const index = new Map<string, number>();
  header.forEach((name, i) => {
    if (name && !index.has(name)) index.set(name, i);
  });

  const missing = Object.values(REQUIRED).filter((name) => !index.has(name));
  if (missing.length > 0) {
    throw new ImportError(
      'missing_columns',
      `This spreadsheet is missing ${missing.length === 1 ? 'a required column' : 'required columns'}: ` +
        `${missing.map((m) => `"${m}"`).join(', ')}. It does not look like a Spectora template export.`,
    );
  }

  const known = new Set<string>([
    ...Object.values(REQUIRED),
    ...Object.values(OPTIONAL),
  ]);

  header.forEach((name, i) => {
    if (!name.trim()) return;
    if (known.has(name) || PHOTO_COLUMN.test(name)) return;
    issues.push({
      kind: 'unsupported',
      sourceRow: 1,
      sourceColumn: name,
      locationPath: null,
      message: `Column not supported: "${name}". Its values were not imported.`,
      rawSnippet: `column ${columnLetter(i)} · "${name}"`,
    });
  });

  return index;
}

type ParseCommentArgs = {
  row: string[];
  cell: (row: string[], key: string) => string;
  sourceRow: number;
  position: number;
  path: string;
  policy: SanitizePolicy;
  issues: ImportIssue[];
};

function parseComment({
  row,
  cell,
  sourceRow,
  position,
  path,
  policy,
  issues,
}: ParseCommentArgs): ParsedComment {
  // Names are kept verbatim — trailing spaces included — after exactly one
  // entity decode. Spectora double-escapes, so "&amp;" here means "&".
  const name = decodeOnce(cell(row, REQUIRED.commentName));
  const rawText = cell(row, REQUIRED.commentText);

  const answerType = cell(row, OPTIONAL.answerType).trim() || 'boolean';
  const choices = splitOptions(cell(row, OPTIONAL.choices));
  const units = splitOptions(cell(row, OPTIONAL.units));
  const isQuestion = answerType === 'checkbox' || choices.length > 0;

  // Comment text is HTML. It is sanitized, never entity-decoded again: its
  // "&amp;" is already correct inside HTML.
  let textHtml = '';
  if (rawText.trim()) {
    const { html, removals } = sanitizeHtml(rawText, policy);
    textHtml = html;
    for (const removal of removals) {
      issues.push({
        kind: 'unsupported',
        sourceRow,
        sourceColumn: REQUIRED.commentText,
        locationPath: `${path} > ${name}`,
        message: removal.reason,
        rawSnippet: removal.snippet,
      });
    }
  } else if (!isQuestion) {
    // A checkbox row with options legitimately has no prose; anything else
    // with no text is a genuine gap in the export.
    issues.push({
      kind: 'empty_in_source',
      sourceRow,
      sourceColumn: REQUIRED.commentText,
      locationPath: `${path} > ${name}`,
      message: 'The export carries no comment text in this cell.',
      rawSnippet: null,
    });
  }

  const options: ParsedOption[] = [
    ...choices.map((label, i) => ({ kind: 'choice' as const, label, position: i })),
    ...units.map((label, i) => ({ kind: 'unit' as const, label, position: i })),
  ];

  return {
    name,
    textHtml,
    position,
    commentType: parseCommentType(cell(row, REQUIRED.commentType), sourceRow, path, issues),
    category: parseCategory(cell(row, OPTIONAL.category)),
    answerType,
    isQuestion,
    recommendation: nullIfBlank(cell(row, OPTIONAL.recommendation)),
    defaultValue: nullIfBlank(cell(row, OPTIONAL.defaultValue)),
    estimateMin: parseNumber(cell(row, OPTIONAL.estimateMin)),
    estimateMax: parseNumber(cell(row, OPTIONAL.estimateMax)),
    sourceRow,
    sourceOrder: parseNumber(cell(row, OPTIONAL.order)),
    options,
  };
}

function parseCommentType(
  raw: string,
  sourceRow: number,
  path: string,
  issues: ImportIssue[],
): CommentType {
  const value = raw.trim().toLowerCase();
  if (value === 'info' || value === 'limit' || value === 'defect') return value;

  issues.push({
    kind: 'unsupported',
    sourceRow,
    sourceColumn: REQUIRED.commentType,
    locationPath: path,
    message: `Unrecognised comment type "${raw}". Imported as "info".`,
    rawSnippet: raw,
  });
  return 'info';
}

/** -1 / 0 / 1 in the export. Blank on info and limit rows, which is semantics. */
function parseCategory(raw: string): CommentCategory | null {
  switch (raw.trim()) {
    case '-1':
      return 'low';
    case '0':
      return 'med';
    case '1':
      return 'high';
    default:
      return null;
  }
}

/**
 * Comma-separated, and the separator is ", " in this export. Option labels can
 * themselves contain commas-with-no-space (`1 1/2", 2", Unknown`), so splitting
 * on a bare comma would shred them.
 */
function splitOptions(raw: string): string[] {
  const value = raw.trim();
  if (!value) return [];
  return value
    .split(/,\s+/)
    .map((part) => decodeOnce(part.trim()))
    .filter((part) => part.length > 0);
}

/**
 * Decodes HTML entities exactly once.
 *
 * The XML layer already decoded `&amp;amp;` to `&amp;`, so names arrive still
 * carrying an entity and need one more pass to become `&`. Comment HTML must
 * never go through this — its entities are already correct.
 */
function decodeOnce(value: string): string {
  return value.replace(/&(amp|lt|gt|quot|#39|apos|nbsp);/g, (_, name: string) => {
    switch (name) {
      case 'amp':
        return '&';
      case 'lt':
        return '<';
      case 'gt':
        return '>';
      case 'quot':
        return '"';
      case '#39':
      case 'apos':
        return "'";
      case 'nbsp':
        return ' ';
      default:
        return `&${name};`;
    }
  });
}

function reportUniformEstimates(
  comments: readonly ParsedComment[],
  issues: ImportIssue[],
): void {
  if (comments.length < 2) return;

  const ranges = new Set(
    comments.map((c) => `${c.estimateMin ?? ''}-${c.estimateMax ?? ''}`),
  );
  if (ranges.size !== 1) return;

  const [only] = [...ranges];
  if (only === '-') return; // Every row blank: nothing to say.

  const { estimateMin, estimateMax } = comments[0];
  issues.push({
    kind: 'notice',
    sourceRow: null,
    sourceColumn: `${OPTIONAL.estimateMin} / ${OPTIONAL.estimateMax}`,
    locationPath: null,
    message:
      `All ${comments.length} rows share the same estimate range ` +
      `$${estimateMin}–$${estimateMax}. That is likely a Spectora default rather ` +
      `than tuned values. Imported as-is; worth checking before relying on it.`,
    rawSnippet: `${estimateMin}–${estimateMax}`,
  });
}

/** "InterNACHI Residential -2026-09-20.xls" -> "InterNACHI Residential". */
export function templateNameFrom(filename: string | undefined, fallback: string): string {
  if (!filename) return fallback;

  const withoutExtension = filename.replace(/\.[^.]+$/, '');
  const withoutDate = withoutExtension.replace(/\s*-?\s*\d{4}-\d{2}-\d{2}\s*$/, '');
  const cleaned = withoutDate.replace(/[-_]+$/, '').trim();

  return cleaned || fallback;
}

function nullIfBlank(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function parseNumber(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function columnLetter(index: number): string {
  let n = index;
  let out = '';
  do {
    out = String.fromCharCode(65 + (n % 26)) + out;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return out;
}
