# Verification

## Automated checks

`npm run check` runs 47 tests and the TypeScript/production build. Tests cover complete validation, corrupt storage protection, failed writes, concurrent browser tabs, local calendar tracking, memory CRUD/capacity, daily routing, shuffled rotation, preparation snapshots, cloud reconciliation, offline edits, account switching, and stale revisions.

`src/database.test.ts` executes the actual `supabase/setup.sql` in PostgreSQL through PGlite. It checks authenticated insert/update, atomic revision conflicts, anonymous denial, and isolation between two account IDs. It simulates Supabase's JWT-backed `auth.uid()` function. It does not provision a hosted Supabase service.

## Browser checks

Optional prerequisites: Python with Playwright, and Chromium at `/usr/bin/chromium` (the cloud workspace provides both). From the repository root, start a production preview in one terminal:

```bash
VITE_SUPABASE_URL='' VITE_SUPABASE_PUBLISHABLE_KEY='' npm run build
npm run preview -- --host 0.0.0.0 --port 4188 --strictPort
```

In another terminal:

```bash
python scripts/check-bank.py
```

The bank check exercises first-day Intro/skip, four-step validation, three-memory foundation, memory editing/deletion/reload, four-stage Recall, same-day suppression, daily practice and preparation integration, backup export/cancel/restore, invalid imports preserving data, capacity, full-bank recall setting, 320/390/1440 px layouts, light/dark themes, real italic fonts, reduced motion, and no external requests in local mode. Screenshots go to `/tmp/confidence-bank-checks`.

For cloud UI checks, build a separate fixture deployment (these are fake public settings, not live credentials):

```bash
VITE_SUPABASE_URL=https://confidence-test.supabase.co VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_browser_test_fixture npm run build -- --outDir /tmp/confidence-cloud-dist
npm run preview -- --outDir /tmp/confidence-cloud-dist --host 0.0.0.0 --port 4189 --strictPort
```

Then run:

```bash
python scripts/check-cloud.py
```

Every request to that fixture host is intercepted by Playwright. This checks explicit email sign-in requests containing no entries, first-upload confirmation, autosave, fresh-browser restoration, failed-write retention/retry, concurrent-conflict resolution, and sign-out. Screenshots go to `/tmp/confidence-cloud-checks`. It does **not** test live email delivery, the hosted project's policies, or live authentication.

For final live verification, follow USER_TESTING.md: configure your project, deploy, sign in, save a real entry, wait for cloud confirmation, and restore it in another browser. That check requires your project and account access.
