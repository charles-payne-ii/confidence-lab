# Confidence Lab

Confidence Lab (originally Performance Lab) is a free, private browser app for short mental performance exercises. It helps you notice evidence of competence, prepare for a challenge, and learn from experience without scores, streaks, or pressure.

The updated interface follows the supplied Confidence Lab design: local serif fonts, purple and gold colours, light/dark themes, a collapsible sidebar, and one question at a time.

Features include:

- Build Confidence for effort, success, progress, and a next action
- Manage Pressure with an optional breathing pause, attention reset, and next action
- Learn from Setbacks with factual reflection, interpretation, an optional other view, and a controllable action
- Quick and expanded pre-performance routines with an optional breathing timer
- Event reviews linked to preparations
- A reusable Confidence Bank and weekly reviews
- Full history editing and deletion
- Versioned JSON backup export and validated, confirmed import
- Seven-day tracking by distinct local calendar day
- Partial entries with Save, Back, and Skip controls
- Weekly action checkboxes and persistent theme preferences

The app starts empty. There is no seeded example data. Confidence Bank additions from a practice are selected explicitly. Clear test entries through **Data & privacy → Delete all**, after confirming.

The supplied Zeus mark appears in the sidebar and menu button, with ink colouring in light mode and gold in dark mode. SVG, ICO, and PNG favicons, an Apple touch icon, and 192/512 px home-screen icons are bundled locally. The manifest launches the app at the repository subpath; it does not add offline caching or synchronization.

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

Entries are stored only in the current browser using `localStorage`. The app has no accounts, synchronization, analytics, AI coaching, notifications, payments, or community features. It loads only static site files, including bundled fonts, and never transmits entry content.

Data does not sync between devices or browser profiles. Clearing browser or site data can remove it. Private-browsing sessions and browsers with storage disabled may not retain changes. The app reports read and write failures rather than claiming a save succeeded.

## Backups

Use **Data & privacy → Download .json** regularly and keep the downloaded file somewhere safe. Import validates the complete versioned structure before offering to replace local data. You must confirm replacement. An invalid or unreadable import leaves existing data unchanged.

If the app encounters corrupt saved data, it preserves the original value and blocks accidental replacement. You can download the unreadable value for recovery or explicitly start fresh.

The current data format is version 1 and the entry storage key is `performance-lab:data`. Pressure/setback sessions, action checkboxes, and optional routine metadata extend that format; original version 1 backups remain valid. The theme uses `confidence-lab.theme`. Storage and validation live in `src/storage.ts`; exercise definitions and record creation live in `src/exercises.ts`; UI components consume the typed model from `src/model.ts`. This boundary is intended to make a future account or synchronization adapter possible without rewriting the exercises.

Failed writes retain new entries in the current tab and show an explicit warning with a backup action. They do not report a successful persistent save. If saved data cannot be read, the app leaves it untouched until storage is usable again.

## Limitations

- There is no device-to-device sync, login, encryption layer, or cloud recovery.
- The app is a personal reflection tool, not clinical care or a substitute for professional support.
- Dates use the browser’s local calendar and change with the device time zone.
- Imports accept complete version 1 Confidence Lab / original Performance Lab backups.

## Content inspiration

The exercise wording is original. The app is informed by broader performance psychology and by themes explored in Nate Zinsser’s *The Confident Mind*. It does not reproduce book passages, imply endorsement, or promise clinical benefits.

## Fonts and verification

Cinzel, Cormorant Garamond, and EB Garamond are bundled from the supplied design and served locally. Their SIL Open Font License notices are in `public/fonts/`. The app does not load Google Fonts or a CDN runtime.

`npm run check` runs storage and exercise tests followed by the TypeScript and production build checks. Browser checks exercise all four routines, partial saves, explicit bank additions, linked reviews, editing/deletion, weekly action persistence, validated backup replacement and cancellation, failed writes, corrupt saved data, responsive layouts, theme persistence, hash navigation, and refresh at the `/confidence-lab/` subpath.
