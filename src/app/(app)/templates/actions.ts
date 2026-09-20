'use server';

import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { parseSpectoraExport } from '@/lib/import/parse-spectora';
import { persistImport } from '@/lib/import/persist';
import { ImportError } from '@/lib/import/types';
import { sanitizeHtml } from '@/lib/sanitize-html';
import { SPECTORA_POLICY } from '@/lib/import/policy';

const SAMPLE_PATH = 'samples/spectora/internachi-residential-2026-09-20.xls';
const SAMPLE_FILENAME = 'InterNACHI Residential -2026-09-20.xls';

export type ActionState = { error: string | null; ok?: boolean };

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  return { supabase, user };
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

/**
 * Parses an upload and returns a preview. Nothing is written here.
 *
 * Save re-parses the same bytes rather than trusting a payload from the
 * browser. The parser is deterministic, so the preview and the saved result are
 * the same by construction — and nothing the client sends can change what lands
 * in the database.
 */
export async function saveImport(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase, user } = await requireUser();

  const file = formData.get('file');
  const name = String(formData.get('name') ?? '').trim();

  if (!(file instanceof File) || file.size === 0) {
    return { error: 'No file was received. Choose the export again.' };
  }
  if (!name) {
    return { error: 'Give the template a name before saving.' };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const sha256 = createHash('sha256').update(bytes).digest('hex');

  let templateId: string;
  try {
    const result = parseSpectoraExport(bytes, { filename: file.name });
    const persisted = await persistImport({
      supabase,
      ownerId: user.id,
      result,
      source: { filename: file.name, bytes, sha256 },
      templateName: name,
    });
    templateId = persisted.templateId;
  } catch (error) {
    if (error instanceof ImportError) return { error: error.message };
    return {
      error: `The import could not be saved: ${error instanceof Error ? error.message : 'unknown error'}`,
    };
  }

  revalidatePath('/templates');
  redirect(`/templates/${templateId}/report?saved=1`);
}

// ---------------------------------------------------------------------------
// Editing
// ---------------------------------------------------------------------------

export async function renameSection(sectionId: string, name: string): Promise<ActionState> {
  const { supabase } = await requireUser();
  const trimmed = name.trim();
  if (!trimmed) return { error: 'A section needs a name.' };

  const { error } = await supabase.from('sections').update({ name: trimmed }).eq('id', sectionId);
  if (error) return { error: error.message };

  revalidatePath('/templates', 'layout');
  return { error: null, ok: true };
}

export async function renameItem(itemId: string, name: string): Promise<ActionState> {
  const { supabase } = await requireUser();
  const trimmed = name.trim();
  if (!trimmed) return { error: 'An item needs a name.' };

  const { error } = await supabase.from('items').update({ name: trimmed }).eq('id', itemId);
  if (error) return { error: error.message };

  revalidatePath('/templates', 'layout');
  return { error: null, ok: true };
}

/** Comment HTML is sanitized on the way in, exactly as it is on import. */
export async function updateCommentText(
  commentId: string,
  html: string,
): Promise<ActionState> {
  const { supabase } = await requireUser();
  const { html: clean } = sanitizeHtml(html, SPECTORA_POLICY);

  const { error } = await supabase
    .from('comments')
    .update({ text_html: clean })
    .eq('id', commentId);
  if (error) return { error: error.message };

  revalidatePath('/templates', 'layout');
  return { error: null, ok: true };
}

export async function renameComment(commentId: string, name: string): Promise<ActionState> {
  const { supabase } = await requireUser();
  const trimmed = name.trim();
  if (!trimmed) return { error: 'A comment needs a name.' };

  const { error } = await supabase.from('comments').update({ name: trimmed }).eq('id', commentId);
  if (error) return { error: error.message };

  revalidatePath('/templates', 'layout');
  return { error: null, ok: true };
}

type Level = 'section' | 'item' | 'comment';

const TABLE: Record<Level, string> = {
  section: 'sections',
  item: 'items',
  comment: 'comments',
};

const PARENT: Record<Level, string> = {
  section: 'template_id',
  item: 'section_id',
  comment: 'item_id',
};

/**
 * Moves a row one place up or down among its siblings.
 *
 * Positions are swapped through a temporary negative value, because
 * (parent, position) is unique and a direct swap would collide mid-flight.
 */
export async function move(
  level: Level,
  id: string,
  direction: 'up' | 'down',
): Promise<ActionState> {
  const { supabase } = await requireUser();
  const table = TABLE[level];
  const parentKey = PARENT[level];

  // The select list is built from `level`, so the typed query builder cannot
  // narrow it; the shape is asserted here instead.
  const { data, error: rowError } = await supabase.from(table).select('*').eq('id', id).single();

  if (rowError || !data) return { error: rowError?.message ?? 'Row not found.' };

  const row = data as unknown as Record<string, unknown> & { id: string; position: number };
  const parentId = row[parentKey];
  const target = direction === 'up' ? row.position - 1 : row.position + 1;
  if (target < 0) return { error: null, ok: true };

  const { data: neighbourRow } = await supabase
    .from(table)
    .select('*')
    .eq(parentKey, parentId as string)
    .eq('position', target)
    .maybeSingle();

  if (!neighbourRow) return { error: null, ok: true }; // Already at the end.
  const neighbour = neighbourRow as unknown as { id: string; position: number };

  const { error: parkError } = await supabase
    .from(table)
    .update({ position: -1 })
    .eq('id', row.id);
  if (parkError) return { error: parkError.message };

  await supabase.from(table).update({ position: row.position }).eq('id', neighbour.id);
  await supabase.from(table).update({ position: target }).eq('id', row.id);

  revalidatePath('/templates', 'layout');
  return { error: null, ok: true };
}

export async function renameTemplate(templateId: string, name: string): Promise<ActionState> {
  const { supabase } = await requireUser();
  const trimmed = name.trim();
  if (!trimmed) return { error: 'A template needs a name.' };

  const { error } = await supabase.from('templates').update({ name: trimmed }).eq('id', templateId);
  if (error) return { error: error.message };

  revalidatePath('/templates', 'layout');
  return { error: null, ok: true };
}

// ---------------------------------------------------------------------------
// Copy
// ---------------------------------------------------------------------------

export async function copyTemplate(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase } = await requireUser();

  const sourceId = String(formData.get('templateId') ?? '');
  const name = String(formData.get('name') ?? '').trim();
  if (!sourceId) return { error: 'No template was selected.' };

  const { data, error } = await supabase.rpc('copy_template', {
    source_template_id: sourceId,
    new_name: name || null,
  });

  if (error) return { error: `The copy failed, so nothing was written: ${error.message}` };

  revalidatePath('/templates');
  redirect(`/templates/${data as string}?copied=1`);
}

// ---------------------------------------------------------------------------
// Reset sample
// ---------------------------------------------------------------------------

/**
 * Re-runs the importer on the committed export and replaces only this account's
 * sample. Templates the user imported or copied are never touched.
 */
export async function resetSample(
  _prev: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  const { supabase, user } = await requireUser();

  let templateId: string;
  try {
    const bytes = new Uint8Array(await readFile(SAMPLE_PATH));
    const sha256 = createHash('sha256').update(bytes).digest('hex');

    const { error: deleteError } = await supabase
      .from('templates')
      .delete()
      .eq('owner_id', user.id)
      .eq('is_sample', true);
    if (deleteError) return { error: deleteError.message };

    const result = parseSpectoraExport(bytes, { filename: SAMPLE_FILENAME });
    const persisted = await persistImport({
      supabase,
      ownerId: user.id,
      result,
      source: { filename: SAMPLE_FILENAME, bytes, sha256 },
      templateName: result.templateName,
      isSample: true,
    });
    templateId = persisted.templateId;
  } catch (error) {
    return {
      error: `The sample could not be reset: ${error instanceof Error ? error.message : 'unknown error'}`,
    };
  }

  revalidatePath('/templates');
  redirect(`/templates/${templateId}/report?reset=1`);
}

export async function deleteTemplate(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase } = await requireUser();
  const id = String(formData.get('templateId') ?? '');

  const { error } = await supabase.from('templates').delete().eq('id', id);
  if (error) return { error: error.message };

  revalidatePath('/templates');
  redirect('/templates');
}
