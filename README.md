# Template Importer

Imports a Spectora "HTML Text" template export into a structured schema, then lets
you review, edit and copy it. The import path is a deterministic parser — no LLM —
so every row in the database traces back to a node in the source file.

Live: https://hive-template-import.vercel.app

## Stack

- Next.js (App Router) + TypeScript
- Supabase (Postgres + Auth), deployed on Vercel
- Server-side HTML parsing with cheerio
- Vitest for parser fixtures

## Getting started

```bash
pnpm install
cp .env.example .env.local   # fill in your Supabase project values
pnpm dev
```

## Environment

`.env.example` lists every variable. Two notes:

- **API keys.** This uses Supabase's current-generation keys —
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (`sb_publishable_…`) and
  `SUPABASE_SECRET_KEY` (`sb_secret_…`). They replace the legacy `anon` and
  `service_role` JWTs, which Supabase now marks as deprecated. The publishable
  key is safe in the browser; row-level security is what protects the data. The
  secret key is server-only and bypasses RLS, so it never reaches the client.
- **Accounts.** Public sign-ups are disabled. Two reviewer accounts are created
  by the seed script through the admin API; **the credentials are in the
  submission email**, not in this repo.

## Screenshots

`docs/screenshots/` holds every screen at desktop 1440 and mobile 390, in light
and dark. Regenerate them against a running app with:

```bash
node ai/scripts/screenshots.mjs http://localhost:3000
```

## Layout

| Path                 | What lives there                                         |
| -------------------- | -------------------------------------------------------- |
| `src/`               | App Router routes, parser and Supabase clients            |
| `samples/spectora/`  | The committed Spectora export used as the import fixture  |
| `supabase/`          | `config.toml`, migrations and seed for the schema         |
| `tests/`             | Parser fixture tests and copy-isolation tests             |
| `ai/`                | Prompts, skills and scripts used to build this            |
| `docs/screenshots/`  | Desktop 1440 / mobile 390 screenshots, light and dark     |
