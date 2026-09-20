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
  gap is on.
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
- **Upload ceiling is 10 MB**, `.html` / `.htm` only. The client-side check is a
  courtesy; the server re-checks, because anything arriving from a browser is
  untrusted.

## How it was verified

- `pnpm lint`, `pnpm typecheck` and `pnpm build` run clean.
- Auth was checked against the deployed app, not only locally: the password
  grant returns a session, a public sign-up attempt returns `signup_disabled`,
  and `/templates` redirects a signed-out visitor to `/login?next=%2Ftemplates`.
- Screenshots in `docs/screenshots/` are generated from a running app at 1440
  and 390, in light and dark, by `ai/scripts/screenshots.mjs`.
- Parser fixture tests, the copy-isolation test and the RLS cross-account test
  _(pending — they arrive with the schema and importer)_.

## Known issues

- **The `sb_secret_` key is rejected by the Supabase project's data plane**
  (401 on both the auth admin API and REST), while `sb_publishable_` works.
  Retested 30 minutes apart with the same result. The legacy `service_role` JWT
  works immediately. This affects the seed script only; nothing user-facing.

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

_(pending — to be filled from browser findings)_
