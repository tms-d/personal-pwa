# Personal Priority Overview

A local-first PWA for tracking recurring todos, cadence ("when did I last…")
items, and plain todos. Single-user, by design. Live at
<https://snail.tomas.today>.

## Stack

SvelteKit 2 + Svelte 5 runes, TypeScript, Tailwind 4. Dexie (IndexedDB)
locally; Supabase for cross-device sync via GitHub OAuth (optional).
Deployed as a static SPA on GitHub Pages.

## Run locally

```sh
npm install
npm run dev
```

Without Supabase env vars the dev server runs in local-only mode — every
mutation goes to IndexedDB, no auth, no network calls. That's the
deliberate safe default for UI work. Provide `PUBLIC_SUPABASE_URL` and
`PUBLIC_SUPABASE_PUBLISHABLE_KEY` via `.env` or your shell to enable sync.

```sh
npm test            # unit + component (Vitest)
npm run test:e2e    # Playwright local-only flows
npm run test:sync   # Playwright sync flows; needs TEST_USER_* env vars
```

## Further reading

- [`CLAUDE.md`](./CLAUDE.md) — project conventions, data model, dev
  workflow. The starting context for any Claude session.
- [`CONTRIBUTING.md`](./CONTRIBUTING.md) — architectural decisions and the
  "why" behind specific choices.
- [`src/lib/types.ts`](./src/lib/types.ts) — the data model in one file.
- [`tests/`](./tests/) — four-layer test pyramid.
