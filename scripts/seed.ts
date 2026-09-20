/**
 * Seeds the database: two reviewer accounts, each with its own imported copy of
 * the committed Spectora export.
 *
 *   pnpm seed
 *
 * The sample is produced by running the real importer on
 * samples/spectora/internachi-residential-2026-09-20.xls — not from a SQL dump —
 * so seeding exercises the parser every time and the app opens on real content.
 *
 * Safe to re-run: it replaces each reviewer's sample and leaves anything they
 * imported or copied alone.
 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { parseSpectoraExport } from '../src/lib/import/parse-spectora';
import { persistImport } from '../src/lib/import/persist';

const SAMPLE_PATH = 'samples/spectora/internachi-residential-2026-09-20.xls';
const SAMPLE_FILENAME = 'InterNACHI Residential -2026-09-20.xls';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}. See .env.example.`);
  return value;
}

async function ensureUser(
  admin: SupabaseClient,
  email: string,
  password: string,
): Promise<string> {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (!error) return data.user.id;

  if (!/already been registered|already exists/i.test(error.message)) throw error;

  // Already there: find the id and reset the password to the one in the env,
  // so a re-run always leaves known-good credentials.
  const { data: list, error: listError } = await admin.auth.admin.listUsers({ perPage: 200 });
  if (listError) throw listError;

  const existing = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (!existing) throw new Error(`${email} reported as existing but was not found`);

  const { error: updateError } = await admin.auth.admin.updateUserById(existing.id, { password });
  if (updateError) throw updateError;

  return existing.id;
}

/** Removes only this owner's sample. Imported and copied templates are left. */
async function clearSample(admin: SupabaseClient, ownerId: string): Promise<void> {
  const { error } = await admin
    .from('templates')
    .delete()
    .eq('owner_id', ownerId)
    .eq('is_sample', true);
  if (error) throw error;
}

async function main() {
  const url = required('NEXT_PUBLIC_SUPABASE_URL');
  const secret = required('SUPABASE_SECRET_KEY');
  const admin = createClient(url, secret, { auth: { persistSession: false } });

  const bytes = new Uint8Array(readFileSync(SAMPLE_PATH));
  const sha256 = createHash('sha256').update(bytes).digest('hex');

  console.log(`sample  ${SAMPLE_PATH}`);
  console.log(`sha256  ${sha256}`);

  const reviewers = [1, 2].map((n) => ({
    email: required(`SEED_REVIEWER_${n}_EMAIL`),
    password: required(`SEED_REVIEWER_${n}_PASSWORD`),
  }));

  for (const reviewer of reviewers) {
    const ownerId = await ensureUser(admin, reviewer.email, reviewer.password);
    await clearSample(admin, ownerId);

    // The real importer, run fresh for each account.
    const result = parseSpectoraExport(bytes, { filename: SAMPLE_FILENAME });

    const { templateId, importRunId } = await persistImport({
      supabase: admin,
      ownerId,
      result,
      source: { filename: SAMPLE_FILENAME, bytes, sha256 },
      templateName: result.templateName,
      isSample: true,
    });

    console.log(
      `\n${reviewer.email}` +
        `\n  user        ${ownerId}` +
        `\n  template    ${templateId} "${result.templateName}"` +
        `\n  import run  ${importRunId}` +
        `\n  parsed      ${result.stats.sectionCount} sections, ` +
        `${result.stats.itemCount} items, ${result.stats.commentCount} comments ` +
        `in ${result.stats.durationMs} ms` +
        `\n  issues      ${result.issues.length}`,
    );
  }

  console.log('\nSeed complete.');
}

main().catch((error) => {
  console.error(`\nSeed failed: ${error.message ?? error}`);
  process.exit(1);
});
