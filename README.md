# Astra One

**Explore farther. Decide wisely. Bring everyone home.**  
An Arabic–English educational simulator for resource and crew decisions at a fictional lunar or Martian outpost.

> Astra One is an independent educational prototype created for the NASA Space Apps Challenge. It is not affiliated with or endorsed by NASA, and it is not an engineering model or a mission-planning tool.

## The experience

Every operating cycle asks the player to balance interconnected systems:

- Keep energy, oxygen, water, food, and crew readiness within safe bounds.
- Preview an action's modeled effect before committing.
- Choose research, maintenance, rest, or a higher-risk expedition.
- Build facilities while managing credits, cargo, power, and operating costs.
- Respond to events and compare outcomes using a replayable scenario seed.

The game includes five hands-on guided steps, six short science lessons with before-and-after questions, an interactive base schematic, downloadable PNG mission reports, achievements, and a personal on-device leaderboard. Missions can also be ended early; early endings are recorded separately from completed or evacuated missions.

## A short judging walkthrough

1. Choose the Moon or Mars, a scenario, crew size, difficulty, and a 10-cycle mission.
2. Name the base and start the mission. Watch the launch sequence.
3. Compare actions in the resource forecast, then inspect the base map and its systems layer.
4. Try one decision and discuss its trade-offs for supplies, science, and crew readiness.
5. Open Flight School or choose Guided tutorial to see the learning experience.

The forecast is explicitly hypothetical: it uses relative simulation units and excludes random events and expedition outcomes.

## Run locally

Requires Node.js 18 or later.

**Important:** Do not open `index.html` with VS Code Live Server (usually port `5500`). This app uses React and TypeScript, which need Vite to compile and serve; Live Server will show a blank page.

Open the project folder in VS Code, then run these commands in its terminal:

```powershell
npm install
npm run dev
```

Open the local URL printed by Vite (normally `http://localhost:5173/`), not `http://127.0.0.1:5500/`.

Run the simulation and persistence tests, then create a production build:

```powershell
npm test
npm run build
npm run preview
```

The production build is a static Vite app with an installable PWA and offline app shell. No NASA API key or network service is needed to play. The optional web fonts fall back to system fonts when offline.

## Languages and accessibility

- Arabic and English interfaces, with right-to-left and left-to-right layouts.
- Keyboard-accessible controls and base-map objects.
- Motion follows the operating system's `prefers-reduced-motion` setting.
- Responsive layouts for mobile, tablet, and desktop.
- Mission saves, preferences, achievements, and personal records stay in browser storage on the current device.

## Technology

React 18 · TypeScript · Zustand · Vite · Tailwind CSS · Web Audio API · vite-plugin-pwa

The project uses the Node.js test runner through `tsx`; the test command covers 32 simulation and persistence cases.

## Project map

```text
src/
├── components/  # Mission screens, interactive map, lessons, and controls
├── game/        # Simulation rules, facilities, scenarios, events, and lessons
├── i18n/        # Arabic and English interface copy
├── store/       # Mission, settings, and achievement state
├── hooks/       # Sound and interaction hooks
└── utils/       # Local persistence and mission-report export
```

## Learning and scientific context

In-app lessons link to selected NASA Science references on the Moon, Mars, and lunar water. Resource values, radiation exposure, event chances, and crew-readiness measures are simplified training indicators—not measured engineering quantities or validated operational risks.

See [PROJECT_GUIDE.md](./PROJECT_GUIDE.md) for gameplay and learning details.
