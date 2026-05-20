# Architectural decisions and rationale

This is a personal app maintained mostly by Claude. "Contributing" means
the author and his AI iterate over time. This document captures the *why*
behind choices that aren't obvious from the code, so future work can
either follow the principle or knowingly break it.

For mechanics (conventions, file layout, dev workflow), see
[`CLAUDE.md`](./CLAUDE.md). This file is just the reasoning.

## Local-first

Primary use is phones on transit, planes, in low signal. Every tap must
be instant and never show a "network error" modal. Local-first satisfies
both: writes go to IndexedDB synchronously, the UI is reactive on local
state, and sync to Supabase is a best-effort background concern.

Trade-off accepted: cross-device sync is eventually consistent with
last-write-wins on `updated_at`. For a single user editing the same task
on two devices simultaneously, that's a non-issue.

## Sign-in is optional

Onboarding friction matters more than feature parity. A new user (or
the developer testing a feature) can use the app immediately, locally,
without seeing an auth screen. They opt into sync only when they want
cross-device data.

The sign-in CTA is a small "Local only · Sign in" pill in the header,
persistent on every page so it's discoverable without being loud.

## Outbox + Realtime over blind pull-on-focus

An earlier iteration only synced on `window.focus`. That left mutations
silently unpushed for arbitrary periods (open phone, do stuff, close
without focus firing on desktop). The outbox + drain pattern makes "did
this push?" answerable: if a row's in the outbox, it hasn't. Realtime
then propagates server-side changes to other devices without waiting on
focus.

`fullSync` on focus is kept as a safety net for missed Realtime events
and cold starts.

## No SSR

Single user, no SEO concerns, no need for first-paint optimisation
because the app shell is tiny. SSR adds complexity (request-time data
fetching, hydration mismatches, server runtime) for no benefit.
`@sveltejs/adapter-static` produces a single SPA fallback, deployable
to any static host.

## `import.meta.env.PUBLIC_*` instead of `$env/dynamic/public`

`$env/dynamic/public` reads from `globalThis.__sveltekit_*.env` at
runtime — a runtime object populated either by SSR or by `vite preview`
on startup. Neither happens on adapter-static + GitHub Pages, so the
object ships as `null` and any access throws or evaluates to undefined.

`import.meta.env.PUBLIC_*` is inlined at build time by Vite. Values
land in the JS bundle, work on any host, no runtime substitution needed.

Vite's default `envPrefix` covers `VITE_` only; `vite.config.ts` adds
`PUBLIC_` so `import.meta.env.PUBLIC_*` substitutes correctly.

## Explicit GRANTs in Supabase migrations

Supabase Studio's "create table" UI quietly grants CRUD to the `anon`
and `authenticated` roles. SQL migrations don't. Without the grant,
every signed-in request gets PostgreSQL error 42501 ("permission denied
for table"); RLS never even evaluates.

This was a silent prod bug — sync was failing in production for the
only user, who interpreted it as "the app doesn't really sync." Always
include explicit `GRANT` statements when a migration creates a table.

## Four-layer test pyramid

Each layer answers a different question:

1. **Unit**: "does this pure function behave correctly?" Fast, no I/O.
2. **Component**: "does this component render the right thing for this
   state?" Snapshot-style; mocked dependencies.
3. **E2E (no auth)**: "does the local-only app work end-to-end?" Real
   browser, no backend, fast and deterministic.
4. **Sync**: "does the live Supabase + Realtime path work?" Real
   browser, real backend, auth injected via `signInWithPassword` +
   `localStorage` seeding.

What is **not** testable in this setup:

- GitHub OAuth UX (we use password auth in sync tests).
- iOS Safari / Android Chrome quirks beyond what Chromium covers.
  Touch interactions, viewport quirks, PWA install prompts, home-screen
  icon rendering — manual on real devices only.
- Service worker / real PWA install behaviour.
- Real-world Realtime latency / connectivity churn (both Playwright
  contexts share one machine).
- Production Supabase migration application (the GitHub integration
  applies them; we don't test the integration itself).
- GitHub Pages deploy correctness — we build but don't verify the live
  URL.
- Visual / design quality (no screenshot diffing yet).

## Claude Code on the web — workflow constraints

The app is maintained largely by Claude. Anything that requires "run on
my machine" is friction. The remote container keeps the iteration loop
fast — Claude can pull the repo, run tests, push PRs, and stand up a
dev tunnel for review without the user needing to install anything.

Constraints worth knowing:

- **Network access** defaults to "Trusted" (allowlist of package
  registries, GitHub, cloud SDKs). For Cloudflare quick-tunnels, the
  environment must be set to "Full".
- **Secrets**: the platform stores environment variables in plain text
  and warns against credentials. Real secrets (test user creds,
  Supabase keys) live in GitHub Actions **repo-level** secrets;
  env-scoped secrets aren't visible to jobs without an `environment:`
  block. Claude cannot read either kind in-session — only CI can.
- **Container lifetime**: containers are ephemeral and reclaimed after
  inactivity. The dev tunnel URL dies with the session. `cloudflared`
  is installed on demand (see CLAUDE.md → Dev workflow). We tried a
  setup-script approach to pre-install it, but the script's working
  directory at setup-time isn't always the repo root, so on-demand
  install in the session is more reliable.
- **Branch deletes** are rejected by the git proxy — the proxy only
  permits pushes to the current working branch. Clean up old branches
  via the GitHub UI.

## Preview / review loop

Currently: Claude runs `npm run dev` in the cloud container, exposes it
via Cloudflare quick-tunnel, hands a URL to the user for phone +
desktop review. No GitHub Pages preview deploys, no separate Supabase
project for previews.

Considered and rejected: per-branch `gh-pages` deploys via subpaths.
Too much plumbing (base-path injection, Pages source migration, gh-pages
branch state management, preview cleanup workflow) for a single-user
app. Re-evaluate if multiple reviewers ever need to look at the same
branch simultaneously.
