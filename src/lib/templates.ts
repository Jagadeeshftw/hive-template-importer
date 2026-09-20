/**
 * Template reads.
 *
 * The schema is not written yet — it waits on the Phase 1 report on the real
 * Spectora export — so this returns nothing and the list renders its empty
 * state. The shape below is the one the proposal's list screen needs; the
 * Supabase query replaces the body in Phase 2.
 */
export type TemplateSummary = {
  id: string;
  name: string;
  /** Set when this template came from "Make a copy". */
  copiedFromName: string | null;
  /** True for the seeded sample, which "Reset sample" is allowed to replace. */
  isSample: boolean;
  sourceFilename: string | null;
  sectionCount: number;
  itemCount: number;
  commentCount: number;
  issueCount: number;
  importedAt: string | null;
};

export async function listTemplates(): Promise<TemplateSummary[]> {
  return [];
}
