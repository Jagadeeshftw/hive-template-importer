import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { parseSpectoraExport, templateNameFrom } from '@/lib/import/parse-spectora';
import { ImportError, type ImportResult, type ParsedComment } from '@/lib/import/types';

const FIXTURE = 'samples/spectora/internachi-residential-2026-09-20.xls';

let result: ImportResult;
let comments: ParsedComment[];

const findComment = (section: string, item: string, name: string) => {
  const s = result.sections.find((x) => x.name === section);
  const i = s?.items.find((x) => x.name === item);
  return i?.comments.find((x) => x.name.trim() === name);
};

beforeAll(() => {
  const bytes = new Uint8Array(readFileSync(FIXTURE));
  result = parseSpectoraExport(bytes, { filename: 'InterNACHI Residential -2026-09-20.xls' });
  comments = result.sections.flatMap((s) => s.items.flatMap((i) => i.comments));
});

describe('counts, verified independently in Phase 1', () => {
  it('finds 13 sections, 69 items and 392 comments', () => {
    expect(result.stats.sectionCount).toBe(13);
    expect(result.stats.itemCount).toBe(69);
    expect(result.stats.commentCount).toBe(392);
  });

  it('reads all 42 columns from one sheet', () => {
    expect(result.stats.columnCount).toBe(42);
    expect(result.stats.sheetName).toBe('Sheet1');
    expect(result.stats.rowCount).toBe(392);
  });

  it('splits comment types 78 info / 12 limit / 302 defect', () => {
    const byType = comments.reduce<Record<string, number>>((acc, c) => {
      acc[c.commentType] = (acc[c.commentType] ?? 0) + 1;
      return acc;
    }, {});
    expect(byType).toEqual({ info: 78, limit: 12, defect: 302 });
  });

  it('maps categories, and leaves them null on non-defect rows', () => {
    const byCategory = comments.reduce<Record<string, number>>((acc, c) => {
      const key = c.category ?? 'null';
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});
    // 281 med, 21 high, no low rows in this file, 90 blank.
    expect(byCategory).toEqual({ med: 281, high: 21, null: 90 });

    // Category is present on defects and absent elsewhere — semantics, not gaps.
    expect(comments.filter((c) => c.commentType === 'defect').every((c) => c.category)).toBe(true);
    expect(comments.filter((c) => c.commentType !== 'defect').every((c) => !c.category)).toBe(true);
  });
});

describe('hierarchy and order', () => {
  it('keeps sections in document order', () => {
    expect(result.sections.map((s) => s.name)).toEqual([
      'Inspection Details',
      'Exterior',
      'Roof',
      'Basement, Foundation, Crawlspace & Structure',
      'Heating',
      'Cooling',
      'Plumbing',
      'Electrical',
      'Fireplace',
      'Attic, Insulation & Ventilation',
      'Doors, Windows & Interior',
      'Built-in Appliances',
      'Garage',
    ]);
  });

  it('matches the per-section comment counts', () => {
    const counts = Object.fromEntries(
      result.sections.map((s) => [s.name, s.items.reduce((n, i) => n + i.comments.length, 0)]),
    );
    expect(counts).toEqual({
      'Inspection Details': 6,
      Exterior: 50,
      Roof: 35,
      'Basement, Foundation, Crawlspace & Structure': 33,
      Heating: 22,
      Cooling: 24,
      Plumbing: 43,
      Electrical: 40,
      Fireplace: 13,
      'Attic, Insulation & Ventilation': 20,
      'Doors, Windows & Interior': 54,
      'Built-in Appliances': 26,
      Garage: 26,
    });
  });

  it('treats "General" as a different item in each section', () => {
    const generals = result.sections.flatMap((s) => s.items.filter((i) => i.name === 'General'));
    expect(generals).toHaveLength(8);
    // Each is its own item with its own comments, not one merged item.
    expect(new Set(generals.map((g) => g.sourceRow)).size).toBe(8);
  });

  it('orders by row, not by the unreliable Order column', () => {
    // Roof > Coverings has duplicate source_order values (0,0,1,2,...).
    const coverings = result.sections
      .find((s) => s.name === 'Roof')
      ?.items.find((i) => i.name === 'Coverings');
    expect(coverings).toBeDefined();

    const orders = coverings!.comments.map((c) => c.sourceOrder);
    expect(orders.filter((o) => o === 0).length).toBeGreaterThan(1);

    // Positions are still dense and unique, and follow the spreadsheet rows.
    expect(coverings!.comments.map((c) => c.position)).toEqual(
      coverings!.comments.map((_, i) => i),
    );
    const rows = coverings!.comments.map((c) => c.sourceRow);
    expect([...rows].sort((a, b) => a - b)).toEqual(rows);
  });

  it('records a source row on every comment', () => {
    expect(comments.every((c) => Number.isInteger(c.sourceRow) && c.sourceRow >= 2)).toBe(true);
    expect(new Set(comments.map((c) => c.sourceRow)).size).toBe(392);
  });

  it('keeps both rows that share a comment name, without deduping', () => {
    const damper = result.sections
      .find((s) => s.name === 'Fireplace')
      ?.items.find((i) => i.name === 'Damper Doors')
      ?.comments.filter((c) => c.name === 'Damper Inoperable');
    expect(damper).toHaveLength(2);
    expect(damper![0].sourceRow).not.toBe(damper![1].sourceRow);
  });
});

describe('spot checks at the start, middle and end', () => {
  it('start — row 2, the first comment of the first section', () => {
    const first = result.sections[0].items[0].comments[0];
    expect(first.sourceRow).toBe(2);
    expect(result.sections[0].name).toBe('Inspection Details');
  });

  it('middle — Heating > Equipment > Heat Type keeps all 10 options in order', () => {
    const heatType = findComment('Heating', 'Equipment', 'Heat Type');
    expect(heatType).toBeDefined();
    expect(heatType!.answerType).toBe('checkbox');
    expect(heatType!.isQuestion).toBe(true);
    expect(heatType!.options.filter((o) => o.kind === 'choice').map((o) => o.label)).toEqual([
      'Heat Pump',
      'Forced Air',
      'Radiant Heat',
      'Electric Wall Heater',
      'Electric Baseboard',
      'Steam Boiler',
      'Space Heater',
      'Gas-Fired Heat',
      'Hydronic',
      'None',
    ]);
  });

  it('end — the last section still parses with its comments intact', () => {
    const last = result.sections.at(-1)!;
    expect(last.name).toBe('Garage');
    const lastComment = last.items.at(-1)!.comments.at(-1)!;
    expect(lastComment.sourceRow).toBe(393);
    expect(lastComment.name.length).toBeGreaterThan(0);
  });
});

describe('number fields keep their units — the hard case', () => {
  it('Temperature keeps number plus both unit options, in order', () => {
    const temperature = findComment('Inspection Details', 'General', 'Temperature');
    expect(temperature).toBeDefined();
    expect(temperature!.answerType).toBe('number');
    expect(temperature!.options.filter((o) => o.kind === 'unit').map((o) => o.label)).toEqual([
      'Fahrenheit (F)',
      'Celsius (C)',
    ]);
  });

  it('SEER Rating keeps its single unit', () => {
    const seer = findComment('Cooling', 'Cooling Equipment', 'SEER Rating');
    expect(seer!.answerType).toBe('number');
    expect(seer!.options.map((o) => o.label)).toEqual(['SEER']);
  });

  it('Capacity keeps "gallons"', () => {
    const capacity = findComment(
      'Plumbing',
      'Hot Water Systems, Controls, Flues & Vents',
      'Capacity',
    );
    expect(capacity!.answerType).toBe('number');
    expect(capacity!.options.map((o) => o.label)).toEqual(['gallons']);
  });

  it('R-value is a number with no units, which is allowed', () => {
    const rValue = findComment('Attic, Insulation & Ventilation', 'Attic Insulation', 'R-value');
    expect(rValue!.answerType).toBe('number');
    expect(rValue!.options).toEqual([]);
  });
});

describe('recommendation survives on every row type', () => {
  it('keeps "pro" on an info row', () => {
    const responsibility = findComment('Heating', 'General', "Homeowner's Responsibility");
    expect(responsibility).toBeDefined();
    expect(responsibility!.commentType).toBe('info');
    expect(responsibility!.recommendation).toBe('pro');
  });

  it('finds all four recommendations, three of them on info rows', () => {
    const withRec = comments.filter((c) => c.recommendation);
    expect(withRec).toHaveLength(4);
    expect(withRec.filter((c) => c.commentType === 'info')).toHaveLength(3);
    expect(withRec.map((c) => c.recommendation).sort()).toEqual([
      'monitor',
      'pro',
      'pro',
      'pro',
    ]);
  });
});

describe('text is kept verbatim', () => {
  it('keeps a typo exactly as the inspector wrote it', () => {
    const splitting = findComment('Exterior', 'Siding, Flashing & Trim', 'Splitting');
    expect(splitting).toBeDefined();
    expect(splitting!.textHtml).toContain('Siding shingles was splitting');
  });

  it('keeps trailing whitespace in a comment name', () => {
    const general = result.sections[0].items[0];
    const temperature = general.comments.find((c) => c.name.startsWith('Temperature'));
    expect(temperature!.name).toBe('Temperature ');
  });

  it('decodes entities in names exactly once, and not at all in comment HTML', () => {
    // The XML layer already decoded &amp;amp; to &amp;; one more pass gives &.
    expect(result.sections.map((s) => s.name)).toContain(
      'Basement, Foundation, Crawlspace & Structure',
    );
    expect(result.sections.every((s) => !s.name.includes('&amp;'))).toBe(true);

    // Comment HTML keeps its entity: decoding again would corrupt the markup.
    const withEntity = comments.filter((c) => c.textHtml.includes('&amp;'));
    expect(withEntity.length).toBeGreaterThan(0);
  });
});

describe('issues, and the difference between them', () => {
  it('flags empty comment text only on rows that are not questions', () => {
    const empties = result.issues.filter((i) => i.kind === 'empty_in_source');
    // 83 rows have no text, but 71 are checkbox questions where that is correct.
    expect(empties).toHaveLength(12);
    expect(empties.every((i) => i.sourceRow !== null)).toBe(true);
  });

  it('does not flag a checkbox question for having no prose', () => {
    const heatType = findComment('Heating', 'Equipment', 'Heat Type')!;
    const flagged = result.issues.some(
      (i) => i.sourceRow === heatType.sourceRow && i.kind === 'empty_in_source',
    );
    expect(flagged).toBe(false);
  });

  it('reports the YouTube embed div as unsupported, at its row', () => {
    const div = result.issues.find(
      (i) => i.sourceRow === 311 && i.kind === 'unsupported' && /div/.test(i.message),
    );
    expect(div).toBeDefined();
    expect(div!.rawSnippet).toContain('youtube-embed-wrapper');
  });

  it('raises one template-level notice about the uniform estimate range', () => {
    const notices = result.issues.filter((i) => i.kind === 'notice');
    expect(notices).toHaveLength(1);
    expect(notices[0].sourceRow).toBeNull();
    expect(notices[0].message).toContain('392');
    expect(notices[0].message).toMatch(/\$10.*\$1000/);
    expect(notices[0].message).toMatch(/Spectora default/i);
  });

  it('keeps every estimate faithfully despite the notice', () => {
    expect(comments.every((c) => c.estimateMin === 10 && c.estimateMax === 1000)).toBe(true);
  });

  it('emits no issue for target="_blank", which is allowed', () => {
    expect(result.issues.some((i) => /target/i.test(i.message))).toBe(false);
  });

  it('forces rel on the links it keeps', () => {
    const withLinks = comments.filter((c) => c.textHtml.includes('<a '));
    expect(withLinks.length).toBeGreaterThan(0);
    expect(withLinks.every((c) => c.textHtml.includes('rel="noopener noreferrer"'))).toBe(true);
  });
});

describe('template name', () => {
  it('cleans the filename rather than using it raw', () => {
    expect(result.templateName).toBe('InterNACHI Residential');
  });

  it('handles other shapes without inventing a name', () => {
    expect(templateNameFrom('Four Point-2026-01-02.xlsx', 'Sheet1')).toBe('Four Point');
    expect(templateNameFrom('plain.xlsx', 'Sheet1')).toBe('plain');
    expect(templateNameFrom(undefined, 'Sheet1')).toBe('Sheet1');
    expect(templateNameFrom('2026-01-02.xlsx', 'Sheet1')).toBe('Sheet1');
  });
});

describe('determinism', () => {
  it('produces identical output for identical bytes', () => {
    const bytes = new Uint8Array(readFileSync(FIXTURE));
    const a = parseSpectoraExport(bytes, { filename: 'x.xls' });
    const b = parseSpectoraExport(bytes, { filename: 'x.xls' });
    expect(b.sections).toEqual(a.sections);
    expect(b.issues).toEqual(a.issues);
  });
});

describe('failure cases are honest', () => {
  it('rejects a legacy BIFF .xls by name', () => {
    const biff = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0]);
    expect(() => parseSpectoraExport(biff)).toThrowError(/legacy Excel file/i);
    try {
      parseSpectoraExport(biff);
    } catch (e) {
      expect((e as ImportError).code).toBe('legacy_xls');
    }
  });

  it('rejects an HTML document, and explains the "HTML Text" trap', () => {
    const html = new TextEncoder().encode('<!doctype html><html><body>hi</body></html>');
    expect(() => parseSpectoraExport(html)).toThrowError(/spreadsheet whose comment cells/i);
  });

  it('rejects an empty file', () => {
    expect(() => parseSpectoraExport(new Uint8Array())).toThrowError(/empty/i);
  });

  it('rejects arbitrary bytes that are not a workbook', () => {
    const junk = new TextEncoder().encode('Section Name,Item Name\nRoof,Coverings\n');
    expect(() => parseSpectoraExport(junk)).toThrowError(/not an XLSX workbook/i);
  });

  it('rejects a PDF specifically', () => {
    const pdf = new TextEncoder().encode('%PDF-1.7\n...');
    expect(() => parseSpectoraExport(pdf)).toThrowError(/PDF/);
  });
});
