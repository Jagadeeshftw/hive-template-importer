# Notes

Working notes on what was built, what was left out, and how it was checked.
Sections marked _(pending)_ are filled in as the work reaches them.

## Decisions

- **Reordering is move up / move down buttons, not drag and drop.** Arrows were
  chosen over DnD to protect time for import fidelity, which is what the brief
  weights most. They are also keyboard-reachable and carry `aria-label`s, which
  a drag surface would not be without extra work.
- **Two kinds of import issue, kept separate.** `unsupported` means our importer
  cannot represent something the export contains; `empty in source` means the
  export itself carries nothing there. Conflating them would hide which side the
  gap is on. An issue's location is written `row N · column`, so it points at a
  cell you can open in the spreadsheet.
- **The export is a spreadsheet, not an HTML document.** Spectora's "Export HTML
  Text" produces a workbook whose *comment cells* contain HTML, and ships it
  named `.xls` when the bytes are XLSX. Format is therefore decided by content
  sniffing, never by extension — the filename is treated as a hint and nothing
  more.
- **Comment HTML is sanitized against an allowlist, on import and on render.**
  Every removal is reported with its raw snippet and becomes a visible
  `import_issue`; nothing is dropped quietly or rewritten.
- **Current-generation Supabase API keys.** `sb_publishable_…` and `sb_secret_…`
  rather than the deprecated `anon` / `service_role` JWTs. See the README.
- **No landing page.** `/` redirects to the template list, or to sign-in.
- **No motion.** Transitions and animations are zeroed globally. Saved/unsaved
  state is a dot plus a count, never a toast that fades.

## Cut, and why

_(pending — recorded as scope decisions are made)_

## Supported input and known limits

_(pending — written from the Phase 1 findings on the real export)_

Known limits so far:

- **Mobile is for checking, not editing.** The brief puts mobile out of scope,
  so 390 is kept readable and no further. The editor assumes a desk window.
- **Upload ceiling is 10 MB**, `.xls` / `.xlsx` only. The extension check is a
  courtesy filter; it deliberately does not decide what the file *is*, because
  the Spectora export's extension lies. A true legacy BIFF `.xls`, or a
  plain-text file wearing a spreadsheet name, is rejected by the parser's
  content sniffing with a specific message.

## How it was verified

- `pnpm lint`, `pnpm typecheck` and `pnpm build` run clean.
- Auth was checked against the deployed app, not only locally: the password
  grant returns a session, a public sign-up attempt returns `signup_disabled`,
  and `/templates` redirects a signed-out visitor to `/login?next=%2Ftemplates`.
- Screenshots in `docs/screenshots/` are generated from a running app at 1440
  and 390, in light and dark, by `ai/scripts/screenshots.mjs`.
- The sanitizer has 22 tests, including hostile input: `<script>` elements,
  `onerror` handlers, `javascript:` and `data:` hrefs, case and whitespace
  obfuscation of schemes, protocol-relative targets, and a script nested inside
  `<svg>`. Determinism is asserted directly.
- Parser fixture tests, the copy-isolation test and the RLS cross-account test
  _(pending — they arrive with the schema and importer)_.

## Known issues

- **`sb_secret_` key returned 401 on REST and auth admin** (retested hours
  apart); using the legacy `service_role` JWT under the same env var name
  (`SUPABASE_SECRET_KEY`); server-only, never shipped to the client. The
  `sb_publishable_` key is unaffected and is what the browser uses. Verified by
  grepping the production build: the secret appears in no client bundle.

## Time spent

Roughly 3 hours of build time so far (first commit 15:47). A fuller breakdown
lands with the finished work.

## Credits

- [Next.js](https://nextjs.org) App Router, [Supabase](https://supabase.com),
  [Tailwind CSS](https://tailwindcss.com), [Vitest](https://vitest.dev),
  [Playwright](https://playwright.dev) for screenshots.
- [IBM Plex Sans and IBM Plex Mono](https://github.com/IBM/plex), OFL.
- No starter template beyond `create-next-app`.

## Hive vs Binsr

Full test report: [`docs/research/hive-vs-binsr-import-test.md`](docs/research/hive-vs-binsr-import-test.md)
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
is the gap this project treats as its hard case: a `number` field that loses
"Fahrenheit (F), Celsius (C)" has quietly stopped being a measurement.

### What that informed here

- **Preview before save, and a persisted import report** — taken from Binsr.
  Nothing is written until you have seen the parsed tree, the counts and the
  issues; afterwards the report stays with the template.
- **Every unmapped value is reported** — the gap in both. Units and answer types
  are preserved as structured data, and anything the importer cannot represent
  becomes a visible `import_issue` with its raw value, rather than vanishing.

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
