# Notes

What was built, what was cut, what it supports, and how it was checked.

## What I cut, and why

- **No table support.** The tag inventory of the real export found `<p>`, `<a>`,
  `<strong>` and one `<div>` — no tables anywhere. Supporting a construct the
  file does not contain would have been guesswork, so tables stay out of the
  allowlist. A pinned test records the trap for whoever adds them later: the
  HTML parser inserts an implicit `<tbody>`, so a table allowlist that omits it
  reports a phantom removal on every table.
- **No photo fetching.** The export has ten `Default Photo N` columns and ten
  caption columns. They are all empty in this template, but the design is to
  keep the URL and caption as a reference and never fetch or store the image:
  an importer that reaches out to a CDN at import time is slow, fragile, and
  quietly copies someone else's assets.
- **No multi-user collaboration.** One owner per template, enforced by RLS. No
  sharing, no presence, no merge. The brief is about fidelity of import, not
  concurrent editing, and anything less than real conflict handling would be
  worse than not having it.
- **No drag-and-drop reorder.** Move up / move down buttons instead. Arrows were
  chosen over DnD to protect time for import fidelity, which is what the brief
  weights most. They are also keyboard-reachable and carry `aria-label`s, which
  a drag surface would not be without meaningfully more work.
- **Mobile is check-only.** 390 is kept readable and no further; the brief puts
  mobile out of scope. The editor assumes a desk window with the tree and the
  comment side by side.

## Decisions worth stating

- **The format is decided by content, never by extension.** Spectora ships XLSX
  bytes under a `.xls` name, and calls the export "HTML Text" when the HTML is
  inside the spreadsheet's comment cells. Trusting the name would fail both ways
  round.
- **Save re-parses the file rather than trusting the preview payload.** The
  browser sends the bytes again; it never sends a parsed tree. Nothing the
  client says can change what lands in the database. The parser being
  deterministic is what makes the preview and the save agree by construction.
- **Order comes from row order.** The export has an `Order (w/i item)` column,
  but 38 of 69 items carry duplicate values in it — Roof › Coverings reads
  `0,0,1,2,3,4,5,6,7,8,9`. It is stored as `source_order` for the audit trail
  and never used for sorting.
- **Comment HTML is sanitized on import and again on render**, against an
  allowlist. Every removal is reported with its raw snippet and becomes a
  visible issue; nothing is dropped quietly or rewritten.
- **Checkbox rows are questions, not blank comments.** 72 rows have multiple
  choice options and no prose. Treating their empty text as a defect would have
  raised 71 false alarms.
- **Item identity is (section, item name).** `General` appears as an item in
  eight different sections.
- **No motion.** Transitions and animations are zeroed globally. Saved/unsaved
  is a dot and a count, never a toast that fades.

## Supported input, and known limits

**Supported.** A Spectora "Export to spreadsheet → Export HTML Text" workbook:
XLSX bytes, identified by their ZIP magic number regardless of whether the file
is named `.xls` or `.xlsx`. Columns are matched by header name, so a reshuffled
or extended export still imports. Up to 10 MB.

**Rejected, each with its own message rather than a generic failure:**

| Input | What the user is told |
| --- | --- |
| Legacy BIFF `.xls` | It is the old compound-document format; re-export from Spectora |
| An HTML document | "HTML Text" means HTML inside a spreadsheet, not an HTML page |
| A PDF | It is a PDF, not a spreadsheet |
| Junk bytes | It does not begin with a ZIP header, whatever its name says |
| A workbook missing a required column | The missing column is named |

**Limits:**

- **The unit concept is preserved, not flattened.** `answer_type = number` and
  its unit options are kept as structured data: Temperature keeps
  `Fahrenheit (F), Celsius (C)`, SEER keeps `SEER`, Capacity keeps `gallons`.
  R-value is a number with no units, which is allowed.
- **The `-1` (low) category is untested by any stock Spectora template.** This
  export has 281 rows at `0` and 21 at `1` and not a single `-1`. The low path
  is covered by a synthetic fixture rather than by the real file, and that
  substitution is deliberate and recorded here rather than hidden.
- **`sb_secret_` key returned 401 on REST and auth admin** (retested hours
  apart); using the legacy `service_role` JWT under the same env var name
  (`SUPABASE_SECRET_KEY`); server-only, never shipped to the client. The
  `sb_publishable_` key is unaffected and is what the browser uses. Verified by
  grepping the production build: the secret appears in no client bundle.
- `supabase config push` will overwrite hosted auth settings with whatever the
  local `config.toml` declares, including the CLI template's own defaults. Run
  `supabase config diff` and read it before pushing.

## Missing from the export vs not supported by the importer

These are different failures and the app keeps them apart, because the person
reading the report needs to know which side the gap is on.

**Missing from the export — 12 rows.** `empty_in_source`. Twelve non-question
rows have nothing in their `Comment Text` cell: rows 5, 192, 232, 236, 237, 245,
247, 251, 276, 342, 349 and 367. The export simply carries no text there. The
importer did not drop anything, and there is nothing to recover. The other 71
empty cells belong to checkbox questions and are not reported at all.

**Not supported by the importer — 1 construct.** `unsupported`. Row 311 carries
a YouTube embed wrapper:
`<div class="youtube-embed-wrapper" style="position:relative;padding-bottom:56.25%…">`.
Our schema has no way to represent an embed, so the `div` is unwrapped, its text
is kept, and the raw markup is recorded on the issue so nothing is lost.

One further entry is neither: a template-level **notice** that all 392 rows share
the estimate range $10–$1000. The values are imported faithfully; the notice
exists because a single range across every row is much more likely to be a
Spectora default than four years of tuning, and silently trusting it would be as
wrong as silently dropping it.

## How I checked my work

- **95 tests.** Parser fixtures against the committed export, the sanitizer, the
  upload checks, and live integration tests.
- **Counts verified independently.** `ai/scripts/inspect-export.mjs` reads the
  workbook without touching the importer, so its numbers check the parser rather
  than echo it. It is what produced the Phase 1 figures.
- **A hand-made variant export** with different sections, a **reshuffled column
  order**, an **unknown column**, the `-1` category the real file lacks, hostile
  HTML in a real cell, and an option label (`1 1/2", 2", Unknown`) that a naive
  comma split would shred into five. Passing it means the importer reads the
  format, not the one file it was built against.
- **Five failure cases**, each asserting its own message: legacy BIFF, an HTML
  document, a PDF, junk bytes, and a missing required column.
- **Live RLS tests** against the real project: reviewer1 cannot read, write or
  copy reviewer2's rows, and the block reaches child tables — a section id
  belonging to the other account returns nothing rather than erroring.
- **Copy independence, tested end to end**: copying the sample reproduces
  13/69/392, records its origin, is never the sample, and renaming a section and
  editing a comment on the copy leaves the original untouched.
- **Hostile HTML**: `<script>` elements, `onerror` handlers, `javascript:` and
  `data:` hrefs, case and whitespace obfuscation (`java&#9;script:`),
  protocol-relative targets, and a script nested inside `<svg>`.
- **Screenshots** at 1440 and 390, light and dark, taken against the deployed
  app rather than a local build.

Two bugs the tests caught, both fixed: a slugged filename defaulted the template
name to `internachi-residential`, and the editor page grew to 36,000 px because
the 392-row tree stretched the page instead of scrolling inside its panel.

## Time spent

Roughly 6 hours end to end. About a third of that went on Phase 1 — reading the
file properly before writing any parser — which is also what caught the three
places where the received description of the export did not match its bytes.

## Credits

- [Next.js](https://nextjs.org) App Router, [Supabase](https://supabase.com),
  [Tailwind CSS](https://tailwindcss.com), [SheetJS](https://sheetjs.com) for
  the workbook, [cheerio](https://cheerio.js.org) for the comment HTML,
  [Vitest](https://vitest.dev), [Playwright](https://playwright.dev).
- [IBM Plex Sans and IBM Plex Mono](https://github.com/IBM/plex), OFL.
- No starter template beyond `create-next-app`.
- **AI tooling:** Claude Code wrote most of this repo under direction. The
  prompts and scripts are committed under `ai/` — the investigation prompt, the
  independent export inspector, the fixture builder, and the screenshot runner.
  No LLM runs in the import path: the parser is deterministic, and that is the
  point.

## Hive vs Binsr

Full test report:
[`docs/research/hive-vs-binsr-import-test.md`](docs/research/hive-vs-binsr-import-test.md)
(manual browser test, 20 Sept 2026, Hive trial org "Hive FDE Assignment").

**Both are structurally exact.** Each landed 13 sections / 69 items / 392
comments from the same export. On the thing that matters most — does the
customer's four years of tuning survive — neither loses structure.

**Binsr proves it; Hive doesn't.** Binsr shows a pre-import strategy screen,
reports provenance counts, and leaves a receipt you can go back to. Hive gets
the same rows into the database and then asks you to take its word for it. Same
outcome, very different amount of trust required.

**Hive maps more Spectora columns** — estimates and the recommendation service
both survive, where Binsr drops them.

**Both drop units**, and Hive silently flattens `number` answers to Text. That
is the gap this project treats as its hard case: a `number` field that has lost
"Fahrenheit (F), Celsius (C)" has quietly stopped being a measurement.

### What that informed here

- **Preview before save, and a persisted import report** — taken from Binsr.
  Nothing is written until you have seen the parsed tree, the counts and the
  issues; afterwards the report stays with the template.
- **Every unmapped value is reported** — the gap in both. Units and answer types
  are preserved as structured data, and anything the importer cannot represent
  becomes a visible issue with its raw value, rather than vanishing.

### Where Phase 1 corrected the report

The research file is committed as written. Three of its claims did not survive
checking against the file, and the corrections belong here rather than as edits
to the report:

- **Cell storage is `t="str"` with `<v>` elements, not `t="inlineStr"`.** The
  "no `sharedStrings.xml`" premise was right; the conclusion drawn from it was
  not. Verified: 2,919 `t="str"` cells, zero `<is>` elements.
- **Category has 90 blank rows**, not only 281×`0` and 21×`1`. The blanks are
  structural — category is present on all 302 `defect` rows and absent on all
  78 `info` and 12 `limit` rows.
- **42 columns, not 31.**
