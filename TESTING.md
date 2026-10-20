# Testing Guide — Astra One

## Current verification

The project uses Node's built-in test runner through `tsx`. Test counts change
as coverage evolves; use the current `npm test` output as the source of truth.
At the October 2026 judging-audit pass, all 129 configured tests passed and the
production TypeScript/Vite build passed.

The repository does not currently define a watch-mode or coverage command.

## Commands

Run the configured test suite:

```bash
npm test
```

Run one test file:

```bash
npx tsx --test src/game/model.test.ts
```

Type-check and create a production build:

```bash
npm run build
```

## Automated coverage

The configured suite covers:

- Mission model calculations, resource forecasts and bounds, activities,
  environmental telemetry, events, objectives, operations, transit and mission
  outcomes.
- Flight-transfer calculations and destination-specific mission profiles.
- Save/load validation, legacy resource migration, mission setup persistence,
  and restoration of crew selection, individual condition telemetry, and bounded resources.
- Role-filtered mission panels, programmatic action authorization, deterministic
  autonomous crew routines, and specialist-efficiency effects.
- Academy progress normalization and certification requirements.
- Achievements, settings, site layout and leaderboard behavior.

The tests use deterministic seeds for repeatable simulation and event cases.

## Browser QA checklist

Use this checklist when manually smoke-testing UI changes:

- Intro transition leads to the clean mode-selection dashboard.
- Training opens the Flight Academy; all five lessons require a 100% knowledge
  check before their targeted practical trial, and the final perfect trial
  unlocks the educational award and free simulation sandbox.
- Quiz passes, completed lessons, trial outcomes and the award survive refresh
  in local storage; the optional final knowledge exam remains available.
- Simulation setup starts with destination selection; Moon/Mars changes update
  the orbital readout without changing its frame size.
- LED timeline nodes directly switch the active setup step; refresh restores the
  active start/setup view without vertical page scrolling.
- Future LED steps remain disabled; completed choices auto-advance, and each
  intermediate step's Next Step action is disabled until that step validates.
- The final profile step exposes the Initialize Mission Launch action.
- Starting, pausing, saving, reloading and resuming a mission preserve the
  expected mission state.
- Events, transit decisions, daily actions, operations and mission completion
  remain operable.
- Check Arabic/RTL and English/LTR, reduced-motion behavior, and compact through
  wide viewports for clipping, overlap and document-level overflow.

The latest browser smoke pass exercised every LED setup step, confirmed that
changing a selected objective does not navigate away, checked Moon/Mars
switching without a canvas-frame size change, and verified active-step
restoration after refresh. The sequential wizard was also checked: future LEDs
cannot be activated, valid choices advance one step at a time, and the final
profile step exposes the launch action. Every setup panel and the orbital
preview fit without internal vertical scrolling at 320×600, 320×800, 390×600,
1280×700 and 1280×800; the document height matched the viewport in each case.
The Academy was not completed through all five knowledge checks and practical
trials in that pass, and a full mission was not manually played end-to-end.
Those flows are covered in part by the unit tests, but the repository does not
yet have automated browser E2E coverage for them.

## QA follow-up

Add browser automation for the complete Academy and mission journeys when an
E2E runner and isolated test storage are introduced. Keep browser tests isolated
from a user's persisted save and Academy progress.
