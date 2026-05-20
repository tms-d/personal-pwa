# Personal Priority Overview — project notes

A local-first PWA for tracking recurring todos, cadence ("when did I last…")
items, and plain todos. Designed for a single user. Live at
<https://pwa.tomas.today>.

For the *why* behind the architecture, see [`CONTRIBUTING.md`](./CONTRIBUTING.md).

## Stack

- SvelteKit 2 + Svelte 5 (runes syntax) + TypeScript
- Tailwind CSS 4 (CSS-first config in `src/app.css`)
- Dexie (IndexedDB) for local data
- Supabase for sync (Postgres + auth + Realtime; optional, opt-in via
  GitHub OAuth)
- `@sveltejs/adapter-static` → GitHub Pages

## Conventions

- **Svelte 5 runes**: `$state`, `$derived`, `$props`, `$effect`. Do not
  use Svelte 4 `$: x = ...`, `export let`, or `svelte/store` unless there's
  a specific reason. Module-level reactive state lives in `*.svelte.ts`
  files.
- **Local-first**: writes go to Dexie immediately. Sync to Supabase layers
  on top and never blocks the UI. UI reads from `taskStore` in
  `src/lib/store.svelte.ts`, reloaded via `reloadTasks()` after mutations.
- **No SSR**: `+layout.ts` sets `ssr = false`. Adapter-static serves
  `index.html` as a SPA fallback.
- **Branches**: work on `claude/<topic>` branches, never directly on
  `main`. The remote git proxy only allows pushes to the current working
  branch and rejects branch deletes — clean those up via the GitHub UI.

## Data model

See `src/lib/types.ts`. Single `Task` shape with
`kind: 'todo' | 'recurring' | 'cadence'`. Completions are an append-only
log keyed by `taskId` — the most recent one drives all "is it done this
period" / "when did I last do it" logic. Soft deletes via `deletedAt` so
sync can propagate deletions.

## Build / deploy

- `npm run build` runs icon generation then `vite build`.
- Pushes to `main` deploy via `.github/workflows/deploy.yml`.
- Supabase URL + publishable key are read at build time via
  `import.meta.env.PUBLIC_SUPABASE_URL` and
  `PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Values are inlined into the bundle.
  Both are safe to ship — RLS protects the data.
- `vite.config.ts` sets `envPrefix: ['VITE_', 'PUBLIC_']` so Vite
  actually inlines `import.meta.env.PUBLIC_*` (its default only covers
  `VITE_`).

## Sync

- Schema in `supabase/migrations/`. Supabase GitHub integration applies
  migrations on push to `main`.
- `tasks` and `completions` tables, each row owned by a `user_id`. RLS
  restricts every operation to the owner.
- Tables created via SQL migrations need an **explicit GRANT** to the
  `authenticated` role (Supabase Studio adds this automatically for
  UI-created tables, not migration-created ones). See
  `supabase/migrations/20260520130000_grant_table_permissions.sql`.
  Without it, every signed-in request fails with PostgreSQL 42501 and
  sync silently breaks.
- **Push**: every mutation calls `enqueuePush(table, rowId)` which writes
  to a local Dexie `outbox` table. `drainOutbox()` reads rows from
  Dexie, upserts to Supabase, removes outbox entries on success.
  Triggers: every mutation, `online` event, `window.focus`, sign-in.
  Concurrent drains coalesce on the in-flight promise.
- **Pull**: Supabase Realtime subscription per-table, filtered by
  `user_id`. Applies remote changes via LWW on `updated_at` (strict for
  Realtime echoes, non-strict for `fullSync`). `fullSync()` on focus is
  the safety net for missed events and cold start.
- **Auth**: GitHub OAuth via Supabase. Optional. Sign-in CTA is the
  "Local only · Sign in" pill in the header. Sign-out clears local Dexie
  (always, with a confirm dialog) so a different account doesn't merge
  with the previous user's data.

## Testing

Four layers under `tests/`:

- **Unit** (Vitest + fake-indexeddb): pure logic in `tasks.ts` and
  `sync-helpers.ts`, Dexie-backed mutations, outbox machinery with a
  mocked Supabase client.
- **Component** (Vitest + Testing Library): per-state rendering of UI
  components.
- **E2E** (Playwright, no auth): create / edit / complete / archive /
  navigation flows against `vite preview`.
- **Sync** (Playwright, signed in): uses `signInWithPassword` to fetch a
  session, seeds it into the page's `localStorage` before navigation,
  then exercises pull / push / two-context realtime / sign-out clearing.

CI: `.github/workflows/test.yml` runs all four on PRs. The sync job
needs `TEST_USER_EMAIL` + `TEST_USER_PASSWORD` as **repo-level** GitHub
Actions secrets (env-scoped secrets aren't visible to jobs without an
`environment:` block). E2E build uses placeholder Supabase env (no real
backend calls in those tests).

Locally: `npm test` (unit + component), `npm run test:e2e`,
`npm run test:sync`.

## Dev workflow

- `npm run dev` — local dev, local-only by default (no Supabase env →
  `getSupabase()` returns null, app falls back to Dexie-only mode).
- When the user asks for a hosted preview of in-progress work (so they
  can open it on their phone or share a URL), expose the dev server via
  a Cloudflare quick-tunnel. `cloudflared` is not pre-installed in the
  container — install it on demand:

  ```sh
  if ! command -v cloudflared >/dev/null; then
    curl -fsSL -o /usr/local/bin/cloudflared \
      https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64
    chmod +x /usr/local/bin/cloudflared
  fi

  DEV_TUNNEL=1 npm run dev &                            # binds 0.0.0.0, accepts any Host header
  cloudflared tunnel --url http://localhost:5173 &      # prints a https://*.trycloudflare.com URL
  ```

  The Claude Code on the web environment must be set to **Full** network
  access — Trusted blocks `trycloudflare.com`. If the install or the
  tunnel hangs / 403s, that's the cause; ask the user to flip the
  Network access setting on the environment.

## Gotchas worth knowing

- **`$env/dynamic/public` does NOT work on adapter-static SPAs.** Use
  `import.meta.env.PUBLIC_*`. The dynamic module relies on an SSR pass
  to populate the runtime env object; there's no SSR here. Symptom of
  getting this wrong: `getSupabase()` returns null in prod, sign-in
  pill never renders, and the app silently runs local-only.
- **Add explicit GRANTs in any migration that creates a table.** See
  the sync section above.
- **Secrets are CI-only.** Claude Code on the web's env-var storage is
  plain text and the docs warn against credentials. `TEST_USER_*` live
  in GitHub Actions repo secrets; Claude cannot read them in-session.
  Sync tests therefore run only in CI.
- **Container deliberately has no Supabase env**, so `npm run dev` is
  always local-only and safe — never mutates real data.
- **Supabase errors are PostgrestError plain objects**, not `Error`
  instances. Use a discriminated check (`'message' in e`) when
  stringifying, otherwise you get `"[object Object]"`.

## Not yet implemented

- Push notifications (out of scope for v1)
- Tags UI (model has `tags`, no UI — issue #8)
- Trash / restore view (issue #9)
- Manual ordering / pin (issue #10)
- JSON export/import (issue #14)
- Design foundations + thorough redesign (issues #15, #16)

See the [Issues page](https://github.com/tms-d/personal-pwa/issues) for
the current backlog.
