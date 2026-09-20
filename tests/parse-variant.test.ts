import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { parseSpectoraExport } from '@/lib/import/parse-spectora';
import type { ImportResult, ParsedComment } from '@/lib/import/types';

/**
 * A second, hand-made export. Different sections, different items, a different
 * column order, and an extra column — so passing here means the importer reads
 * the format, not the one file it was built against.
 *
 * Regenerate with: node ai/scripts/make-variant-fixture.mjs
 */
const VARIANT = 'tests/fixtures/hand-made-variant.xlsx';

let result: ImportResult;
let comments: ParsedComment[];
const byName = (name: string) => comments.find((c) => c.name === name)!;

beforeAll(() => {
  result = parseSpectoraExport(new Uint8Array(readFileSync(VARIANT)), {
    filename: 'Hand Made Variant-2026-09-20.xlsx',
  });
  comments = result.sections.flatMap((s) => s.items.flatMap((i) => i.comments));
});

describe('a different template imports on its own terms', () => {
  it('reads its own structure, not the InterNACHI one', () => {
    expect(result.sections.map((s) => s.name)).toEqual([
      'Structure',
      'Water',
      'Decks & Porches',
    ]);
    expect(result.stats.commentCount).toBe(8);
    expect(result.stats.itemCount).toBe(4);
  });

  it('matches columns by header name despite a different column order', () => {
    // "Item Name" comes before "Section Name" in this file.
    expect(byName('Hairline Cracking')).toBeDefined();
    expect(result.sections[0].items[0].name).toBe('Foundation');
  });

  it('cleans its own filename into a template name', () => {
    expect(result.templateName).toBe('Hand Made Variant');
  });
});

describe('the -1 category path, absent from the real export', () => {
  it('maps -1 to low', () => {
    expect(byName('Hairline Cracking').category).toBe('low');
  });

  it('maps all three categories in one file', () => {
    expect(byName('Hairline Cracking').category).toBe('low');
    expect(byName('Step Cracking').category).toBe('med');
    expect(byName('Displacement').category).toBe('high');
  });
});

describe('hostile HTML arriving through a real cell', () => {
  const hostile = () => byName('Hostile Markup');

  it('keeps the legitimate text', () => {
    expect(hostile().textHtml).toContain('Vapour barrier torn.');
  });

  it('removes the script, the handler and the javascript: link', () => {
    const html = hostile().textHtml;
    expect(html).not.toContain('<script');
    expect(html).not.toContain('evil.example.com');
    expect(html).not.toContain('onerror');
    expect(html).not.toContain('javascript:');
    // The dangerous link is unwrapped, not left as an inert anchor.
    expect(html).toContain('click');
    expect((html.match(/<a /g) ?? [])).toHaveLength(1);
  });

  it('keeps the safe link, with target and a forced rel', () => {
    const html = hostile().textHtml;
    expect(html).toContain('href="https://www.nachi.org/vapor-barriers"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it('reports every removal as an issue on that row, with the raw snippet', () => {
    const row = hostile().sourceRow;
    const issues = result.issues.filter((i) => i.sourceRow === row);
    expect(issues.length).toBeGreaterThanOrEqual(3);
    expect(issues.every((i) => i.kind === 'unsupported')).toBe(true);
    expect(issues.some((i) => i.rawSnippet?.includes('evil.example.com'))).toBe(true);
    expect(issues.some((i) => i.rawSnippet?.includes('onerror'))).toBe(true);
    expect(issues.some((i) => i.rawSnippet?.includes('javascript:'))).toBe(true);
  });
});

describe('options and entities in an unfamiliar file', () => {
  it('keeps unit options on a number field', () => {
    const flow = byName('Flow Rate');
    expect(flow.answerType).toBe('number');
    expect(flow.options.map((o) => o.label)).toEqual(['GPM', 'litres/min']);
  });

  it('keeps choice options in order', () => {
    expect(byName('Pump Type').options.map((o) => o.label)).toEqual([
      'Submersible',
      'Jet',
      'Hand',
      'Unknown',
    ]);
  });

  it('does not shred an option label that contains a comma', () => {
    // '1 1/2", 2", Unknown' must split into three, not five.
    expect(byName('Casing Size').options.map((o) => o.label)).toEqual([
      '1 1/2"',
      '2"',
      'Unknown',
    ]);
  });

  it('decodes an entity in a section name exactly once', () => {
    expect(result.sections.map((s) => s.name)).toContain('Decks & Porches');
  });

  it('leaves the entity alone inside comment HTML', () => {
    expect(byName('Loose Railing').textHtml).toContain('&amp;');
  });
});

describe('unknown and missing columns', () => {
  it('reports an unrecognised column instead of ignoring it', () => {
    const issue = result.issues.find((i) => i.sourceColumn === 'Inspector Mood');
    expect(issue).toBeDefined();
    expect(issue!.kind).toBe('unsupported');
    expect(issue!.message).toMatch(/Column not supported/);
    expect(issue!.sourceRow).toBe(1);
  });

  it('fails hard when a required column is missing, naming it', () => {
    const bytes = new Uint8Array(readFileSync('tests/fixtures/missing-columns.xlsx'));
    expect(() => parseSpectoraExport(bytes)).toThrowError(/Comment Text/);
    expect(() => parseSpectoraExport(bytes)).toThrowError(/missing/i);
  });
});

describe('estimates in a file where they differ', () => {
  it('raises no uniform-estimate notice when the values are genuinely tuned', () => {
    expect(result.issues.filter((i) => i.kind === 'notice')).toHaveLength(0);
  });

  it('imports the differing ranges faithfully', () => {
    expect(byName('Hairline Cracking').estimateMin).toBe(250);
    expect(byName('Displacement').estimateMax).toBe(25000);
  });
});
