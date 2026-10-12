# Confidence Lab: Confidence Bank build brief

This folder is the design handoff for two pieces of work:

- **Part A** covers small changes that are already approved for the existing app: the icon, the copy and the typography.
- **Part B** covers a new feature, the **Confidence Bank**: onboarding, memory capture, the daily Remember sequence and the Bank pillar.

Build Part A first, then Part B in the order given in section B10.

## Folder contents

| Path | What it is |
|---|---|
| `screens/png/` | A picture of every screen, at 2x scale (the screens are 390 × 844 points, phone size). |
| `screens/html/` | A standalone HTML version of every screen. Open these in a browser. The buttons link between screens, so the flow can be clicked through. **These are the visual reference.** |
| `source/` | The original mockup files, in a design tool format (`.dc.html`). Use them only for reference, because they do not render by themselves. `Pillar.dc.html` holds the pillar logic. |
| `icons/` | The Zeus icon: favicons, phone home screen icons and the plain mark (`zeus-mark.svg` uses `currentColor`). |

Match the standalone HTML for layout, spacing, colour and type, and build with the app's own framework and components. The memory text in the screens is sample content.

---

## Part A: Approved changes to the existing app

1. **Favicon:** use `icons/favicon.svg`, with `favicon.ico` as the fallback and `apple-touch-icon.png` for iPhone. In `<head>`:
   ```html
   <link rel="icon" href="/favicon.svg" type="image/svg+xml">
   <link rel="icon" href="/favicon.ico" sizes="any">
   <link rel="apple-touch-icon" href="/apple-touch-icon.png">
   ```
   If the app has a web manifest, use `icon-192.png` and `icon-512.png` for it.
2. **Sidebar header:** replace the "ZEUS" placeholder next to "CONFIDENCE LAB" with `zeus-mark.svg`, inline, at 40 × 40 with `color: var(--ink)`.
3. **Menu button:** replace the three-line menu icon with the inline Zeus mark at 30 × 30. Keep the 44 × 44 button, its border and `aria-label="Open menu"`. Give each inline copy of the SVG a unique mask id.
4. **Home subheading (Section I):** "Record your progress, one day at a time." Set it in EB Garamond italic, 20px, line height 1.5, `var(--ink2)`, with a maximum width of 32ch.
5. **Module card descriptions:**
   - II Prepare to Perform: "Rehearse for moments that matter with breathing and visualization."
   - III Manage Pressure: "Reset and ground yourself by focusing on action here and now." (plain text, no italics)
   - IV Learn from Setbacks: "Separate story from truth for growth and clear decision-making."

---

## Part B: Confidence Bank

**Principle:** Recall → Pause → Feel → Carry forward. Each memory is rebuilt, the evidence it holds is drawn out, and its feeling is reconnected. **All memories stay on the device.** No network calls and no AI services are used for this feature.

### B1. Data

```ts
type Memory = {
  id: string;
  title: string;          // short, past tense, starts with a verb, no "I": "Led the difficult client presentation"
  happened: string;       // 1 to 3 sentences, in the user's words, max 300 characters
  evidence: string[];     // chosen chips plus optional free text: ["Preparation", "Calm", "Leadership"]
  feelings: string[];     // chosen chips plus optional free text: ["Focused", "Capable", "Proud"]
  type?: "success" | "effort" | "progress";
  createdAt: string;      // ISO date
  updatedAt: string;
};

type BankState = {
  memories: Memory[];        // maximum 10
  lastDailyDate?: string;    // local calendar date (YYYY-MM-DD) when the daily sequence last ran
  rotation: string[];        // memory ids not yet shown in the current cycle
};
```

Store this with the app's existing on-device storage (localStorage or IndexedDB on the web, or the platform's equivalent). Wrap every read and write in error handling, and fall back to an empty bank if storage fails.

### B2. What happens when the app opens

| Condition | What the user sees |
|---|---|
| First open of the local day, 0 memories | Onboarding Intro (screen 01) |
| First open of the local day, 1 to 9 memories | Remember sequence (screens 09 to 12) |
| First open of the local day, 10 memories | Home. Put this behind a flag, `DAILY_RECALL_WHEN_FULL = false`, so it can be turned on later. |
| Any later open on the same day | Home |

Set `lastDailyDate` when the Intro or the Remember sequence is first shown that day.

**Rotation:** when `rotation` is empty, refill it with every memory id in shuffled order. Show the first id and remove it from the list. Each memory then appears once per cycle before any repeats. When a memory is deleted, remove its id from `rotation`.

### B3. Onboarding and capture (screens 01 to 08)

- **01 Intro:** "Build your Confidence Bank." The Zeus mark glows slowly (see B8), above an empty pillar showing "0 of 10 memories" and "Three set your foundation." The primary button **Add my first memory** starts the capture flow. The text link **Start my day** goes to Home, so onboarding can be skipped.
- **The capture flow** has four steps, one question per screen. Each screen shows "MEMORY n · STEP x OF 4" and a row of four dots, with a back arrow at the top left.
  - **02 Name the moment:** a title field with the placeholder "Led the difficult client presentation" and the hint "A short title in the past tense, without 'I'." Below it are optional single-select type chips: Success, Effort, Progress.
  - **03 What happened?** A text area, 300 characters at most, with a character counter. Hint: "Be specific: the situation, what you did, the result."
  - **04 What does this show about you?** Multi-select chips (Courage, Preparation, Persistence, Skill, Judgment, Leadership, Calm) plus an "In your own words" text field.
  - **05 Return to that moment. What did you feel?** Multi-select chips (Proud, Calm, Strong, Relieved, Energized, Capable, Focused) plus an "In your own words" text field. The button reads **Review memory**.
  - **Validation:** Continue stays disabled until a title is entered (step 02), the text area is filled in (step 03), and at least one chip is chosen or free text entered (steps 04 and 05).
- **06 Confirm:** a card showing the title, type label, the What happened text, Evidence and Feeling. The primary button **Add to Bank** saves the memory. **Edit** returns to step 02 with the fields filled in.
- **After saving**, show the pillar with the new tier glowing:
  - **n = 1 or 2 (screen 07):** "n of 10 memories" and "{3 − n} more sets your foundation." ("One more…" or "Two more…"). The primary button is **Add another**, with a **Finish later** text link that goes to Home.
  - **n = 3 (screen 08):** "FOUNDATION SET · 3 OF 10" and "Your Confidence Bank is ready. Five to seven memories make it stronger." The buttons are **Start my day** (primary) and **Add another**.
  - **n = 4 to 10:** use the screen 07 layout with the milestone text from B6. The buttons are **Add another** (hidden at 10) and **Done**, which goes to Home.
- The capture flow can also be started from **Fill the bank**, **Add a memory** on Home, and the Bank list. Hide these entry points when the bank has 10 memories.

### B4. The daily Remember sequence (screens 09 to 12)

These screens use the dark theme (B7). The user moves forward by tapping, and there are no timers. Four thin bars at the top show the current stage.

1. **09 Recall:**
   - Eyebrow: **"REMEMBER WHEN YOU…"**
   - Headline: `{title}`, with **its first letter lowercased**, for example "led the difficult client presentation".
   - Below a double rule: `"{happened}"` in large Cormorant Garamond italic, inside curly quotation marks.
   - The title fades in, then the quote fades in about 0.9 seconds later.
   - Bottom: **Tap to continue**.
2. **10 Pause:** the gold Zeus mark at 96px breathes (see B8), with a thin gold ring that grows and fades with it. Text: "Take one slow breath." and "Picture where you were and what you did." Bottom: **Tap when ready**.
3. **11 Feel:** "YOU FELT", then each item in `feelings` on its own line in 58px gold Cormorant Garamond. The words fade in one after another, about 1.2 seconds apart. Below a double rule, in italic: "Let it come back. That's still you." Bottom: **Tap to continue**.
4. **12 Bank:** "CONFIDENCE BANK", the pillar in its dark version at full size, "n of 10 memories" and the milestone label. The buttons are **Start my day** (gold, primary), which goes to Home, and **Fill the bank** (outlined), which starts the capture flow.

**Text rule:** every line on these screens is either fixed text or the user's stored words. Never generate, paraphrase or invent actions, outcomes or feelings.

### B5. Home and the Bank list (screens 13 and 14)

- **13 Home:** the existing hero ("Build Confidence", the italic subheading and "Begin entry"), followed by a **Confidence Bank** band between thin rules. The band shows the pillar (it can be tapped to open the Bank list), "CONFIDENCE BANK", "n of 10 memories" in Cormorant Garamond at 26px, the milestone line, and **Add a memory ›** while n < 10. The module list follows below.
- **14 Bank list:** a back arrow, then a header with the pillar, "Confidence Bank", "n of 10 memories" and the milestone label. Below that, a list of memories, each with its title, type label, "Showed {evidence}", **View and edit**, and **Delete** (ask for confirmation before deleting). The **Add a memory** button sits at the bottom while n < 10.

### B6. Milestone text

| n | Label (pillar screens) | Line on Home |
|---|---|---|
| 0 | — | "Three set your foundation." |
| 1 or 2 | — | "{3 − n} more sets your foundation." |
| 3 to 6 | Foundation set | "Foundation set. {7 − n} more for a strong bank." |
| 7 to 9 | Strong bank | "Strong bank. {10 − n} more to complete it." |
| 10 | Complete | "Your Confidence Bank is complete." |

Write numbers as words in this text: "One more", "Three more".

### B7. Design tokens

| Token | Light | Dark (Remember screens) |
|---|---|---|
| Background | `#f4f3f6` | `#1e1428` |
| Card or paper | `#fbfafc` | — |
| Ink (main text) | `#1c1a22` | `#f1ebf3` |
| Secondary text | `#4a4752` | `#d3c9db` |
| Muted text | `#686473` | `#ad9fbb` |
| Line | `#dcd9e2` | — |
| Strong line, empty tier border | `#c6c2cf` | `#574565` |
| Accent (eyebrows, links) | `#8a6a3b` | `#c9a862` |
| Selected chip background | `#efe7d9` with an `#8a6a3b` border | Gold fill `#c9a862` |
| Filled pillar tier | `#c9a862` with an `#8a6a3b` border | `#c9a862` |
| Primary button | `#1c1a22` background, `#f4f3f6` text | `#c9a862` background, `#1e1428` text |
| Danger (Delete) | `#9b382f` | — |

**Typography** (Google Fonts):

- **Cinzel 500/600:** eyebrows, labels and button text. Use capitals, 11 to 13px, with letter spacing between 0.18em and 0.3em.
- **Cormorant Garamond 500, plus italic:** headlines (34 to 42px), the Recall quote and the feeling words.
- **EB Garamond 400, plus italic:** body text, hints, chips and form fields.

**Shape:** square corners everywhere (radius 0). Primary buttons are 54px tall, chips 42px tall, and every touch target at least 44px. Use a 24 to 28px side margin. Section dividers are a `3px double` rule.

### B8. The pillar component and motion

**Pillar:** a vertical art deco column, about 120px wide.

- **Top (capital):** three stacked bars, each narrower than the one above: 84 × 7, 72 × 4 and 64 × 3 px.
- **Middle:** **10 tiers**, 54px wide, stacked with a 3px gap. Each tier's height is a prop: about 8 to 10px in compact uses, 20 to 22px on the full-size screens.
- **Bottom (base):** the same three bars, mirrored.
- **Colours:** the bars are ink on light backgrounds and gold on dark. Tiers fill **from the bottom**. A filled tier is gold, and an empty tier is transparent with a 1px border.
- **Props:** `count` (0 to 10), `tierHeight`, `onDark`, `highlightNewest`.
- **Accessibility:** `role="img"` with the label "n of 10 memories in your Confidence Bank".

**Motion:** a single 10-second loop (about 4 seconds in, 6 seconds out), with ease-in-out timing, repeating forever, with no counter or timer.

- **Zeus mark glow:** opacity from 0.5 to 1, with a gold drop shadow that grows from 0 to 16px.
- **Pause screen:** the mark also scales from 0.9 to 1.06, and the ring scales from 0.8 to 1.08 with opacity from 0 to 0.5.
- **Newest tier:** the tier just added gets a gold glow, `box-shadow 0 → 14px`, on the same loop.
- **Fade-ins:** opacity 0 to 1, moving up 8 to 10px, over 1.2 to 1.4 seconds.
- **Reduced motion:** when `prefers-reduced-motion` is set, turn off the loops and fades.

### B9. Accessibility

- Chips are real `<button>` elements, with `aria-pressed` for multi-select and `role="radio"`/`aria-checked` for single-select.
- Fields have visible labels.
- The back arrow has `aria-label="Back"`.
- Decorative images have `alt=""`.
- Text contrast is at least 4.5:1. The tokens above meet this.

### B10. Build order and acceptance checks

1. Storage and data model (B1), including rotation and the daily-date logic (B2).
2. The Pillar component (B8), checked at every count from 0 to 10, on light and dark backgrounds.
3. Capture flow and Confirm (03 to 06), with validation and editing.
4. Onboarding Intro and the after-save screens (01, 07, 08), with milestone text.
5. The Remember sequence (09 to 12), with the text rule (B4) and the lowercase title.
6. The Home band and the Bank list (13, 14), including delete with confirmation.
7. Motion and reduced-motion handling.

**Checks:**

- **First launch:** the Intro appears, and skipping it lands on Home.
- **Second launch on the same day:** Home opens directly.
- **Next day, with 1 to 9 memories:** the Remember sequence runs. Every memory appears once before any repeats.
- **With 10 memories:** the app opens to Home, and every Add entry point is hidden.
- **Deleting a memory:** the count, milestone text and rotation all update.
- **No outgoing network requests** at any point in this feature.

---

### For Codex: add this line to `AGENTS.md`

```
Design specs for the Confidence Bank feature are in design/confidence-bank/. Follow CONFIDENCE_BANK_BRIEF.md and match screens/html/ visually.
```
