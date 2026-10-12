# Confidence Lab

A free personal mental performance app built with React, TypeScript, and Vite. Record effort, success, progress, and next actions; prepare for challenges; and learn from experience. There are no scores, streaks, analytics, AI coaching, payments, or notifications.

## What works

- Daily practice with partial saves, seven local calendar days of activity, and full history editing/deletion.
- Quick or expanded preparation with optional breathing/rehearsal timers and linked event reviews.
- Pressure and setback exercises, weekly reflection, and action checkboxes.
- A Confidence Bank with up to ten specific memories. Four capture steps collect the title, what happened, evidence, and feelings, followed by review before saving.
- Daily Recall → Pause → Feel → Bank, using your exact words and a shuffled rotation. With no memories, the first open of the day offers Intro; with one to nine, Recall; with ten, Home. Later opens that day go to Home. **Data & privacy** has a setting to keep recall at ten.
- A shared pillar that fills from the bottom, foundation/strong/complete milestones, light/dark themes, self-hosted italic fonts, and reduced-motion support.
- Validated JSON export/import and optional private cloud accounts. Local storage works without a configured cloud service.

The app starts empty. Earlier version 1 bank examples remain under **Data & privacy → Earlier bank examples** and are still selectable before challenges. They are not converted into full memories automatically: the app never invents missing feelings or evidence.

## Start user testing

Follow [the testing and cloud setup guide](docs/USER_TESTING.md). The site is at:

https://charles-payne-ii.github.io/confidence-lab/

This project's public Supabase configuration is included in `.env.production`. Run the SQL setup and configure authentication redirects before deployment. After deployment, sign in through **Data & privacy**, choose **Start cloud storage**, and wait for **Saved to your cloud account**. Verify restoration in another browser before relying on it for longer testing. Browser storage alone can disappear when site data is cleared.

## Local development

Use Node.js 22.12+ and npm:

```bash
npm ci
npm run dev
```

For cloud development, copy `.env.example` to `.env.local` and set your project's public URL and publishable (or legacy anon) key. Never put a `service_role` or secret key in the browser configuration. `.env.local` is ignored by Git.

```bash
npm run check
npm run preview
```

`check` runs unit tests, the real SQL migration in embedded PostgreSQL (PGlite), TypeScript, and the production build. PGlite is a development dependency, not shipped to browsers. Browser checks in `scripts/` additionally exercise the app with Python Playwright and Chromium; see [verification notes](docs/VERIFICATION.md).

## GitHub Pages deployment

1. Complete the Supabase steps in [USER_TESTING.md](docs/USER_TESTING.md), including running `supabase/setup.sql`.
2. The public URL/key for this project are already included. To use another project, set both repository **Settings → Secrets and variables → Actions → Variables**: `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
3. Review and merge the feature pull request into `main`.
4. Keep **Settings → Pages → Source: GitHub Actions**. Do not configure the suggested Jekyll/HTML templates or select a branch/root folder.
5. Open **Actions → Deploy Performance Lab to Pages** and wait for a successful run. To rebuild after changing variables, choose **Run workflow → main → Run workflow**.
6. Open the site URL above and reload.

Vite uses `/confidence-lab/` for asset URLs. Hash navigation works on refresh and direct links such as `#/history`; no server rewrite is needed. The manifest and Zeus icons are bundled locally. There is no service worker/offline cache.

## Privacy and cloud storage

Without sign-in, entries stay in the browser and no entries are sent externally. With sign-in and an explicit connection, the configured Supabase service receives your email for authentication and your entries for storage. No analytics or other third-party requests are used; fonts are self-hosted. The source is public; private entries are not committed to GitHub or hosted by GitHub Pages.

`supabase/setup.sql` enables row-level security: an authenticated user can read and write only their own `user_data` row. The public browser key is safe to publish because authorization uses the signed-in user's token and database policies. Never expose administrative keys. HTTPS protects transport. This app does not implement end-to-end encryption; the project owner/service can access database data.

`.env.production` contains the project's public URL and publishable key, with the owner's authorization. These are not authentication secrets. GitHub repository variables can override them as a pair; `.env.local` can override them locally. A build with either missing disables cloud configuration rather than crashing.

Cloud writes use an atomic expected revision. Offline edits remain in the browser, and a failed save is visible. Reconnection compares the last acknowledged cloud copy, local changes, and remote changes. If both changed, the user must choose a copy; the app does not silently merge or overwrite. Copies can be exported before replacement. Returning online or focusing the app rechecks the service. Imports, edits, and deletions also sync when connected.

Sign-out keeps local entries on the device. Before using a shared device, confirm the cloud save, sign out, then delete local entries. Switching accounts requires an explicit choice if the browser contains different data. An in-flight request is pinned to its original account's token.

Cloud storage survives browser clearing while the account/project remains available, but no system guarantees permanent retention. Maintain the project, review the provider's plan/backup policies, and export JSON regularly to a separate safe location. Free projects may pause after inactivity; restore them in the Supabase dashboard if necessary.

## Backups and data boundaries

**Data & privacy → Download .json** exports the complete versioned dataset. Import validates every record and bank field before offering replacement; confirmation is required. Invalid or unreadable files leave existing entries unchanged. A valid replacement syncs to a connected account. If browser data is corrupt, the original raw value is preserved, accidental writes are blocked, and a recovery download is offered.

The version 1 format accepts original Performance Lab/Confidence Lab backups. The Confidence Bank is an optional extension; it includes stable IDs, ISO timestamps, local dates, the rotation queue, and recall settings. No example entries are seeded.

- `src/model.ts`: typed records.
- `src/storage.ts`: browser persistence and complete import validation.
- `src/bank.ts`: memory CRUD, rotation, milestones, and daily rules.
- `src/cloud.ts`: independent sync/reconciliation engine.
- `src/supabase.ts`: authenticated backend adapter.
- `src/useCloud.ts`: React/auth wiring.

Entry storage uses `performance-lab:data`; theme uses `confidence-lab.theme`. `confidence-lab:cloud-journal` stores the last acknowledged account copy to distinguish offline edits from cloud conflicts. Supabase separately stores the sign-in session. JSON backups contain entries/settings, never session tokens.

## Design and content

The original handoff is in `design/confidence-bank/`: brief, 15 PNG screens, standalone HTML, source mockups, and icon assets. It is a visual reference; its standalone screens do not implement persistence. The user's later cloud-storage requirement supersedes the brief's on-device-only rule. Production code uses React and locally hosted fonts, not the mockup framework or Google Fonts requests.

Cinzel, Cormorant Garamond, and EB Garamond use their original families, including genuine italic font files. SIL Open Font License notices are in `public/fonts/`.

Exercise wording is original, informed by broader performance psychology and themes explored in Nate Zinsser's *The Confident Mind*. No book passages, endorsement, or clinical benefit are implied. Dates follow the device's local calendar/time zone. This is a personal practice tool, not clinical care.
