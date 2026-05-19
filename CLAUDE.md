# Personal Priority Overview — project notes

A local-first PWA for tracking recurring todos, cadence ("when did I last…")
items, and plain todos. Designed for a single user.

## Stack

- SvelteKit 2 + Svelte 5 (runes syntax) + TypeScript
- Tailwind CSS 4 (CSS-first config in `src/app.css`)
- Dexie (IndexedDB) for local data; Supabase planned for sync
- `@sveltejs/adapter-static` → GitHub Pages on `pwa.tomas.today`

## Conventions

- **Use Svelte 5 runes**: `$state`, `$derived`, `$props`, `$effect`. Do not use
  Svelte 4 reactive declarations (`$: x = ...`), `export let`, or stores from
  `svelte/store` unless there's a specific reason. Module-level reactive state
  lives in `*.svelte.ts` files.
- **Local-first**: writes go to Dexie immediately. Sync to Supabase is layered
  on top and never blocks the UI. UI reads from `taskStore` (in
  `src/lib/store.svelte.ts`) which is reloaded via `reloadTasks()` after
  mutations.
- **No SSR**: `+layout.ts` sets `ssr = false`. Adapter-static serves
  `index.html` as a SPA fallback.

## Data model

See `src/lib/types.ts`. Single `Task` shape with `kind: 'todo' | 'recurring' | 'cadence'`.
Completions are an append-only log keyed by `taskId` — the most recent one
drives all "is it done this period" / "when did I last do it" logic.

## Build / deploy

- `npm run build` runs the icon generation step then `vite build`.
- Pushes to `main` deploy via `.github/workflows/deploy.yml`.
- Supabase URL + publishable key are read from GitHub Actions secrets at
  build time as `PUBLIC_SUPABASE_URL` / `PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
  Both are safe to ship to the client (publishable key is RLS-protected).

## Sync

- Schema lives in `supabase/migrations/`. Supabase GitHub integration applies
  on push to `main`. `tasks` and `completions` tables, each row owned by a
  `user_id` referencing `auth.users`. RLS restricts every operation to the
  owner.
- Soft deletes via `deleted_at`. Client filters those out for display but
  keeps the rows around so sync can propagate the deletion.
- Push: each local mutation fires `pushTask` / `pushCompletion` to Supabase,
  best-effort. Failures fall through to the next full sync.
- Pull: `fullSync()` runs on sign-in and on `window.focus`. Uploads local
  rows then pulls all remote rows; merges by ID with last-write-wins on
  `updated_at`.
- Auth: GitHub OAuth via Supabase. Sign-in is optional — the app works
  offline-local without it.

## Not yet implemented

- Realtime subscriptions (currently pull-on-focus, no push from server)
- Task editing (only create / complete / delete right now)
- Push notifications (out of scope for v1)
- "Clear local data on sign-out" option
