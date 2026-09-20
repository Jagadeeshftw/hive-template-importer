import type { SupabaseClient } from '@supabase/supabase-js';
import { PARSER_VERSION } from './parse-spectora';
import type { ImportResult } from './types';

export type PersistArgs = {
  supabase: SupabaseClient;
  ownerId: string;
  result: ImportResult;
  /** The bytes as uploaded, kept with the run so the report stays checkable. */
  source: { filename: string; bytes: Uint8Array; sha256: string };
  /** Name the user confirmed on the preview screen. */
  templateName: string;
  isSample?: boolean;
};

export type PersistResult = { templateId: string; importRunId: string };

/**
 * Writes a parsed import to the database.
 *
 * Inserts are batched per level rather than per row, so a 392-comment template
 * is a handful of round trips. Ordering is explicit: a section's items are
 * inserted together, and each comment carries the position the parser gave it.
 */
export async function persistImport({
  supabase,
  ownerId,
  result,
  source,
  templateName,
  isSample = false,
}: PersistArgs): Promise<PersistResult> {
  const { data: template, error: templateError } = await supabase
    .from('templates')
    .insert({ owner_id: ownerId, name: templateName, is_sample: isSample })
    .select('id')
    .single();

  if (templateError) throw templateError;
  const templateId = template.id as string;

  // ---- sections ----------------------------------------------------------
  const { data: sectionRows, error: sectionError } = await supabase
    .from('sections')
    .insert(
      result.sections.map((s) => ({
        template_id: templateId,
        name: s.name,
        position: s.position,
        source_row: s.sourceRow,
      })),
    )
    .select('id, position');

  if (sectionError) throw sectionError;
  const sectionIdByPosition = new Map<number, string>(
    sectionRows.map((r) => [r.position as number, r.id as string]),
  );

  // ---- items -------------------------------------------------------------
  const itemPayload = result.sections.flatMap((s) =>
    s.items.map((i) => ({
      section_id: sectionIdByPosition.get(s.position)!,
      name: i.name,
      position: i.position,
      source_row: i.sourceRow,
    })),
  );

  const { data: itemRows, error: itemError } = await supabase
    .from('items')
    .insert(itemPayload)
    .select('id, section_id, position');

  if (itemError) throw itemError;
  const itemIdByKey = new Map<string, string>(
    itemRows.map((r) => [`${r.section_id}:${r.position}`, r.id as string]),
  );

  // ---- comments ----------------------------------------------------------
  const commentPayload = result.sections.flatMap((s) =>
    s.items.flatMap((i) => {
      const itemId = itemIdByKey.get(`${sectionIdByPosition.get(s.position)}:${i.position}`)!;
      return i.comments.map((c) => ({
        item_id: itemId,
        name: c.name,
        text_html: c.textHtml,
        position: c.position,
        comment_type: c.commentType,
        category: c.category,
        answer_type: c.answerType,
        is_question: c.isQuestion,
        recommendation: c.recommendation,
        default_value: c.defaultValue,
        estimate_min: c.estimateMin,
        estimate_max: c.estimateMax,
        source_row: c.sourceRow,
        source_order: c.sourceOrder,
      }));
    }),
  );

  const { data: commentRows, error: commentError } = await supabase
    .from('comments')
    .insert(commentPayload)
    .select('id, item_id, position');

  if (commentError) throw commentError;
  const commentIdByKey = new Map<string, string>(
    commentRows.map((r) => [`${r.item_id}:${r.position}`, r.id as string]),
  );

  // ---- options -----------------------------------------------------------
  const optionPayload = result.sections.flatMap((s) =>
    s.items.flatMap((i) => {
      const itemId = itemIdByKey.get(`${sectionIdByPosition.get(s.position)}:${i.position}`)!;
      return i.comments.flatMap((c) => {
        const commentId = commentIdByKey.get(`${itemId}:${c.position}`)!;
        return c.options.map((o) => ({
          comment_id: commentId,
          kind: o.kind,
          label: o.label,
          position: o.position,
        }));
      });
    }),
  );

  if (optionPayload.length > 0) {
    const { error: optionError } = await supabase.from('comment_options').insert(optionPayload);
    if (optionError) throw optionError;
  }

  // ---- run and issues ----------------------------------------------------
  const { data: run, error: runError } = await supabase
    .from('import_runs')
    .insert({
      template_id: templateId,
      owner_id: ownerId,
      filename: source.filename,
      byte_size: source.bytes.byteLength,
      sha256: source.sha256,
      sheet_name: result.stats.sheetName,
      row_count: result.stats.rowCount,
      column_count: result.stats.columnCount,
      parser_version: PARSER_VERSION,
      duration_ms: result.stats.durationMs,
      raw_source: toHex(source.bytes),
    })
    .select('id')
    .single();

  if (runError) throw runError;
  const importRunId = run.id as string;

  if (result.issues.length > 0) {
    const { error: issueError } = await supabase.from('import_issues').insert(
      result.issues.map((i) => ({
        import_run_id: importRunId,
        kind: i.kind,
        source_row: i.sourceRow,
        source_column: i.sourceColumn,
        location_path: i.locationPath,
        message: i.message,
        raw_snippet: i.rawSnippet,
      })),
    );
    if (issueError) throw issueError;
  }

  return { templateId, importRunId };
}

/** Postgres bytea literal, which is how PostgREST accepts binary. */
function toHex(bytes: Uint8Array): string {
  let out = '\\x';
  for (const byte of bytes) out += byte.toString(16).padStart(2, '0');
  return out;
}
