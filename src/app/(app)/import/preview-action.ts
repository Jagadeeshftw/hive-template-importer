'use server';

import { createHash } from 'node:crypto';
import { parseSpectoraExport } from '@/lib/import/parse-spectora';
import { ImportError, type ImportIssue } from '@/lib/import/types';

export type PreviewRow = {
  sourceRow: number;
  section: string;
  item: string;
  commentName: string;
  commentType: 'info' | 'limit' | 'defect';
  answerType: string;
  isQuestion: boolean;
  textHtml: string;
  optionCount: number;
};

export type PreviewTreeComment = {
  name: string;
  textHtml: string;
  commentType: 'info' | 'limit' | 'defect';
  category: 'low' | 'med' | 'high' | null;
  answerType: string;
  isQuestion: boolean;
  options: { kind: 'choice' | 'unit'; label: string }[];
  sourceRow: number;
};

export type PreviewTreeItem = { name: string; comments: PreviewTreeComment[] };
export type PreviewTreeSection = {
  name: string;
  items: PreviewTreeItem[];
  commentCount: number;
  issueCount: number;
};

export type ImportPreview = {
  ok: true;
  filename: string;
  byteSize: number;
  sha256: string;
  suggestedName: string;
  stats: {
    sheetName: string;
    rowCount: number;
    columnCount: number;
    sectionCount: number;
    itemCount: number;
    commentCount: number;
    durationMs: number;
  };
  rows: PreviewRow[];
  sections: PreviewTreeSection[];
  issues: ImportIssue[];
};

export type PreviewFailure = { ok: false; error: string };
export type PreviewState = ImportPreview | PreviewFailure | null;

/**
 * Parses an upload and returns what would be written. Nothing is saved.
 *
 * Save re-parses the same bytes server-side rather than trusting this payload,
 * so the browser cannot alter what lands in the database. The parser is
 * deterministic, so the two runs agree by construction.
 */
export async function previewImport(
  _prev: PreviewState,
  formData: FormData,
): Promise<PreviewState> {
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: 'No file was received. Choose the export again.' };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());

  try {
    const result = parseSpectoraExport(bytes, { filename: file.name });

    const issuesByRow = new Map<number, number>();
    for (const issue of result.issues) {
      if (issue.sourceRow === null) continue;
      issuesByRow.set(issue.sourceRow, (issuesByRow.get(issue.sourceRow) ?? 0) + 1);
    }

    const rows: PreviewRow[] = result.sections.flatMap((s) =>
      s.items.flatMap((i) =>
        i.comments.map((c) => ({
          sourceRow: c.sourceRow,
          section: s.name,
          item: i.name,
          commentName: c.name,
          commentType: c.commentType,
          answerType: c.answerType,
          isQuestion: c.isQuestion,
          textHtml: c.textHtml,
          optionCount: c.options.length,
        })),
      ),
    );

    const sections: PreviewTreeSection[] = result.sections.map((s) => {
      const rowNumbers = s.items.flatMap((i) => i.comments.map((c) => c.sourceRow));
      const lo = Math.min(...rowNumbers);
      const hi = Math.max(...rowNumbers);
      let issueCount = 0;
      for (const [row, n] of issuesByRow) if (row >= lo && row <= hi) issueCount += n;

      return {
        name: s.name,
        commentCount: s.items.reduce((n, i) => n + i.comments.length, 0),
        issueCount,
        items: s.items.map((i) => ({
          name: i.name,
          comments: i.comments.map((c) => ({
            name: c.name,
            textHtml: c.textHtml,
            commentType: c.commentType,
            category: c.category,
            answerType: c.answerType,
            isQuestion: c.isQuestion,
            options: c.options.map((o) => ({ kind: o.kind, label: o.label })),
            sourceRow: c.sourceRow,
          })),
        })),
      };
    });

    return {
      ok: true,
      filename: file.name,
      byteSize: bytes.byteLength,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      suggestedName: result.templateName,
      stats: result.stats,
      rows,
      sections,
      issues: result.issues,
    };
  } catch (error) {
    if (error instanceof ImportError) return { ok: false, error: error.message };
    return {
      ok: false,
      error: `The file could not be read: ${error instanceof Error ? error.message : 'unknown error'}`,
    };
  }
}
