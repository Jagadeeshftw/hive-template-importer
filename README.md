# Template Importer

Imports a Spectora "HTML Text" template export into a structured schema, then lets
you review, edit and copy it. The import path is a deterministic parser — no LLM —
so every row in the database traces back to a node in the source file.

Status: scaffold. See `NOTES.md` for scope decisions once the build starts.

## Stack

- Next.js (App Router) + TypeScript
- Supabase (Postgres + Auth)
- Server-side HTML parsing with cheerio
- Vitest for parser fixtures
- Deployed on Vercel

## Getting started

```bash
pnpm install
cp .env.example .env.local   # fill in your Supabase project values
pnpm dev
```

## Layout

| Path                 | What lives there                                         |
| -------------------- | -------------------------------------------------------- |
| `src/`               | App Router routes, parser and Supabase clients            |
| `samples/spectora/`  | The committed Spectora export used as the import fixture  |
| `supabase/`          | Migrations and seed for the Postgres schema               |
| `tests/`             | Parser fixture tests and copy-isolation tests             |
| `ai/`                | Prompts, skills and scripts used to build this            |
| `docs/screenshots/`  | Desktop 1440 / mobile 390 screenshots, light and dark     |
