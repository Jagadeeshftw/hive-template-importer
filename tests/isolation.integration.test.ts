import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { beforeAll, describe, expect, it } from 'vitest';

/**
 * Integration tests against the real Supabase project: they prove the two
 * promises that cannot be checked in a unit test — that one reviewer cannot
 * read another's rows, and that editing a copy leaves the original alone.
 *
 * They need credentials, so they skip when the environment is not configured
 * (CI without secrets, a fresh clone). Run them with:
 *
 *   set -a && . ./.env.local && set +a && pnpm test
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const reviewers = [1, 2].map((n) => ({
  email: process.env[`SEED_REVIEWER_${n}_EMAIL`],
  password: process.env[`SEED_REVIEWER_${n}_PASSWORD`],
}));

const configured = Boolean(url && publishable && reviewers.every((r) => r.email && r.password));

async function signIn(email: string, password: string): Promise<SupabaseClient> {
  const client = createClient(url!, publishable!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`sign-in failed for ${email}: ${error.message}`);
  return client;
}

describe.skipIf(!configured)('row-level security between reviewers', () => {
  let one: SupabaseClient;
  let two: SupabaseClient;
  let oneTemplateId: string;
  let twoTemplateId: string;

  beforeAll(async () => {
    one = await signIn(reviewers[0].email!, reviewers[0].password!);
    two = await signIn(reviewers[1].email!, reviewers[1].password!);

    const { data: oneRows } = await one.from('templates').select('id').eq('is_sample', true);
    const { data: twoRows } = await two.from('templates').select('id').eq('is_sample', true);
    oneTemplateId = oneRows![0].id;
    twoTemplateId = twoRows![0].id;
    expect(oneTemplateId).not.toBe(twoTemplateId);
  });

  it('each reviewer sees only their own templates', async () => {
    const { data } = await one.from('templates').select('id, owner_id');
    expect(data!.length).toBeGreaterThan(0);
    expect(data!.some((t) => t.id === twoTemplateId)).toBe(false);
  });

  it('reviewer1 cannot read reviewer2 rows even by asking for them directly', async () => {
    const { data, error } = await one.from('templates').select('id').eq('id', twoTemplateId);
    // RLS filters rather than errors: the row is simply not there.
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('the block reaches child tables too', async () => {
    const { data: twoSections } = await two.from('sections').select('id').eq('template_id', twoTemplateId);
    expect(twoSections!.length).toBe(13);

    const { data: leaked } = await one.from('sections').select('id').eq('template_id', twoTemplateId);
    expect(leaked).toEqual([]);

    const sectionId = twoSections![0].id;
    const { data: leakedItems } = await one.from('items').select('id').eq('section_id', sectionId);
    expect(leakedItems).toEqual([]);
  });

  it('reviewer1 cannot write into reviewer2 template', async () => {
    const { data: twoSections } = await two.from('sections').select('id').eq('template_id', twoTemplateId);
    const { error } = await one
      .from('sections')
      .update({ name: 'HACKED' })
      .eq('id', twoSections![0].id)
      .select('id');

    // Either refused outright, or filtered to nothing. Never applied.
    const { data: after } = await two.from('sections').select('name').eq('id', twoSections![0].id);
    expect(after![0].name).not.toBe('HACKED');
    if (error) expect(error.code).toBeDefined();
  });

  it('reviewer1 cannot copy reviewer2 template', async () => {
    const { error } = await one.rpc('copy_template', {
      source_template_id: twoTemplateId,
      new_name: 'stolen',
    });
    expect(error).not.toBeNull();
  });
});

describe.skipIf(!configured)('copying a template', () => {
  let one: SupabaseClient;
  let sampleId: string;
  let copyId: string;

  beforeAll(async () => {
    one = await signIn(reviewers[0].email!, reviewers[0].password!);
    const { data } = await one.from('templates').select('id').eq('is_sample', true);
    sampleId = data![0].id;

    const { data: newId, error } = await one.rpc('copy_template', {
      source_template_id: sampleId,
      new_name: `Isolation test ${Date.now()}`,
    });
    if (error) throw new Error(`copy failed: ${error.message}`);
    copyId = newId as string;
  });

  const countsFor = async (client: SupabaseClient, templateId: string) => {
    const { data: sections } = await client.from('sections').select('id').eq('template_id', templateId);
    const sectionIds = sections!.map((s) => s.id);
    const { data: items } = await client.from('items').select('id').in('section_id', sectionIds);
    const itemIds = items!.map((i) => i.id);
    const { count: comments } = await client
      .from('comments')
      .select('*', { count: 'exact', head: true })
      .in('item_id', itemIds);
    return { sections: sections!.length, items: items!.length, comments: comments ?? 0 };
  };

  it('copies the whole tree', async () => {
    const original = await countsFor(one, sampleId);
    const copy = await countsFor(one, copyId);
    expect(copy).toEqual(original);
    expect(copy.comments).toBe(392);
  });

  it('records where it came from, and is not the sample', async () => {
    const { data } = await one
      .from('templates')
      .select('copied_from_id, is_sample')
      .eq('id', copyId)
      .single();
    expect(data!.copied_from_id).toBe(sampleId);
    expect(data!.is_sample).toBe(false);
  });

  it('editing the copy leaves the original untouched', async () => {
    const { data: originalSections } = await one
      .from('sections')
      .select('id, name, position')
      .eq('template_id', sampleId)
      .order('position');
    const { data: copySections } = await one
      .from('sections')
      .select('id, name, position')
      .eq('template_id', copyId)
      .order('position');

    const originalName = originalSections![0].name;
    expect(copySections![0].name).toBe(originalName);
    expect(copySections![0].id).not.toBe(originalSections![0].id);

    // Rename a section on the copy.
    const { error: renameError } = await one
      .from('sections')
      .update({ name: 'Renamed on the copy' })
      .eq('id', copySections![0].id);
    expect(renameError).toBeNull();

    // Edit a comment on the copy.
    const { data: copyItems } = await one
      .from('items')
      .select('id')
      .eq('section_id', copySections![0].id)
      .order('position');
    const { data: copyComments } = await one
      .from('comments')
      .select('id, text_html')
      .eq('item_id', copyItems![0].id)
      .order('position');

    const { error: editError } = await one
      .from('comments')
      .update({ text_html: '<p>Edited on the copy only.</p>' })
      .eq('id', copyComments![0].id);
    expect(editError).toBeNull();

    // The original must be exactly as it was.
    const { data: originalAfter } = await one
      .from('sections')
      .select('name')
      .eq('id', originalSections![0].id)
      .single();
    expect(originalAfter!.name).toBe(originalName);

    const { data: originalItems } = await one
      .from('items')
      .select('id')
      .eq('section_id', originalSections![0].id)
      .order('position');
    const { data: originalComments } = await one
      .from('comments')
      .select('text_html')
      .eq('item_id', originalItems![0].id)
      .order('position');
    expect(originalComments![0].text_html).not.toBe('<p>Edited on the copy only.</p>');
  });

  it('copies options too, in order', async () => {
    const { data: copySections } = await one.from('sections').select('id').eq('template_id', copyId);
    const { data: items } = await one
      .from('items')
      .select('id')
      .in('section_id', copySections!.map((s) => s.id));
    const { data: comments } = await one
      .from('comments')
      .select('id, name')
      .in('item_id', items!.map((i) => i.id))
      .eq('answer_type', 'number');

    const temperature = comments!.find((c) => c.name.trim() === 'Temperature');
    const { data: options } = await one
      .from('comment_options')
      .select('label, kind, position')
      .eq('comment_id', temperature!.id)
      .order('position');

    expect(options!.map((o) => o.label)).toEqual(['Fahrenheit (F)', 'Celsius (C)']);
    expect(options!.every((o) => o.kind === 'unit')).toBe(true);
  });

  it('cleans up after itself', async () => {
    const { error } = await one.from('templates').delete().eq('id', copyId);
    expect(error).toBeNull();
  });
});
