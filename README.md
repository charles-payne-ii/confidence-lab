# Performance Lab

Performance Lab is a free, private browser app for short mental performance exercises. It helps you notice evidence of competence, prepare for a challenge, and learn from experience without scores, streaks, or pressure.

Version 0.1 includes:

- Daily practice for effort, success, progress, and a next action
- An optional, factual setback reflection
- Quick and expanded pre-performance routines with an optional breathing timer
- Event reviews linked to preparations
- A reusable Confidence Bank and weekly reviews
- Full history editing and deletion
- Versioned JSON backup export and validated, confirmed import
- Seven-day tracking by distinct local calendar day

## Local development

Requirements: Node.js 20.19+ or 22.12+ and npm.

```bash
npm ci
npm run dev
```

Open the local URL printed by Vite. Useful checks:

```bash
npm test
npm run build
npm run preview
```

The production build is written to `dist/`. The Vite base path is `/confidence-lab/`, matching this repository’s GitHub Pages project URL.

## GitHub Pages deployment

The workflow in `.github/workflows/deploy-pages.yml` builds and deploys the app whenever a commit reaches `main`, and it can also be run manually.

For the first deployment:

1. Push the completed changes to the repository’s `main` branch.
2. On GitHub, open **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to **GitHub Actions**.
4. Open the **Actions** tab and wait for **Deploy Performance Lab to Pages** to finish. You can run it manually with **Run workflow** if needed.
5. Open `https://charles-payne-ii.github.io/confidence-lab/`.

Navigation uses URL hashes, so direct links such as `https://charles-payne-ii.github.io/confidence-lab/#/history` and browser refreshes work without server-side rewrite rules.

## Privacy and storage

Entries are stored only in the current browser using `localStorage`. The app has no accounts, synchronization, analytics, AI coaching, notifications, payments, or community features. It makes no application network requests and never transmits entry content.

Data does not sync between devices or browser profiles. Clearing browser or site data can remove it. Private-browsing sessions and browsers with storage disabled may not retain changes. The app reports read and write failures rather than claiming a save succeeded.

## Backups

Use **History → Backups → Export JSON** regularly and keep the downloaded file somewhere safe. Import validates the complete versioned structure before offering to replace local data. You must confirm replacement. An invalid or unreadable import leaves existing data unchanged.

If the app encounters corrupt saved data, it preserves the original value and blocks accidental replacement. You can download the unreadable value for recovery or explicitly start fresh.

The current data format is version 1. Storage and validation live in `src/storage.ts`; UI components consume the typed model from `src/model.ts`. This boundary is intended to make a future account or synchronization adapter possible without rewriting the exercises.

## Limitations

- There is no device-to-device sync, login, encryption layer, or cloud recovery.
- The app is a personal reflection tool, not clinical care or a substitute for professional support.
- Dates use the browser’s local calendar and change with the device time zone.
- Version 0.1 imports only complete version 1 Performance Lab backups.

## Content inspiration

The exercise wording is original. The app is informed by broader performance psychology and by themes explored in Nate Zinsser’s *The Confident Mind*. It does not reproduce book passages, imply endorsement, or promise clinical benefits.
