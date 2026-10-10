# Astra One

**Explore farther. Decide wisely. Bring everyone home.**  
An Arabic–English educational simulator for resource and crew decisions at a fictional lunar or Martian outpost.

> Astra One is an independent educational prototype created for the NASA Space Apps Challenge. It is not affiliated with or endorsed by NASA, and it is not an engineering model or a mission-planning tool.

## The experience

Each fictional mission day uses a 06:00–22:00 activity window followed by crew sleep:

- Keep energy, oxygen, water, food, and crew readiness within safe bounds.
- Schedule multiple timed activities; research, maintenance, rest, and expeditions use different amounts of the day.
- Apply daily life-support consumption, crew recovery, and mission events when the crew sleeps at 22:00.
- Build facilities while managing credits, cargo, power, and operating costs.
- Respond to events and compare outcomes using a replayable scenario seed.

The game includes five hands-on guided steps, six short science lessons with before-and-after questions, an interactive base schematic, downloadable PNG mission reports, achievements, and a personal on-device leaderboard. Both mission modes include outbound and return spacecraft legs with resource trade-offs; the commander makes the final flight and emergency decisions after reviewing crew advice. Mission activities and facility operations open a dedicated **Operation result** tab with before-and-after resource readings. Missions can also be ended early; early endings are recorded separately from completed or evacuated missions.

The first screen offers two distinct paths. **Education** starts a short, low-difficulty Moon mission through the same outbound, base-operations, and return stages; open the astronaut tutor from its map icon, and use Flight School for separate lessons. **Mission Simulation** lets players configure destination, scenario, crew size, full or specialist control, specialty, duration, difficulty, objective, and a replayable seed. Its map assistant is a robot whose name and appearance are saved locally. The simulation uses a cockpit-window transit scene with moving space elements and a side decision console. In specialist mode, the onboard assistant supports other roles and asks approval before a critical end-of-day support plan.

## A short judging walkthrough

1. Select **Education** for a guided 10-cycle Moon mission, or **Mission Simulation** to set up a custom run.
2. In simulation setup, select destination, scenario, crew, control mode and specialty, duration, difficulty, objective, and seed; name the base and launch.
3. Review the outbound spacecraft decision in the cockpit console, then manage the base. The return leg uses the same role-based decision flow.
4. Schedule activities that fit before 22:00; end the shift early if needed, then sleep to apply daily resource changes and events. In Education, open the astronaut tutor from the map; in Simulation, open and customize the robot assistant there.
5. Compare actions in the resource forecast, consult crew roles, and make choices during events and at the base.
6. After the base phase, make a return-flight decision and review the mission debrief.

The forecast is explicitly hypothetical: it uses relative simulation units and excludes events and expedition outcomes. The mission seed makes outcomes reproducible; it does not make this an engineering or operational model. Evacuation debriefs identify the depleted resource and explain prevention steps.

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

The production build is a static Vite app with an installable PWA and offline app shell. No API key or network service is needed to play or use the local tutor. For the optional Gemini tutor, create a key in [Google AI Studio](https://aistudio.google.com/apikey), copy `.env.example` to `.env`, and replace the `ASTRONAUT_API_KEY` placeholder. Keep `.env` private and never add the key to frontend code or commit it. In the project folder, open two terminals: run `npm run api` in one and `npm run dev` in the other. In the game, open the map assistant and use **Check connection**; the assistant dialog also shows setup steps and connection status. The API server reads the URL, key, and model only from its environment, so restart it after changing `.env`. The example model may need to be changed to one available to your account. Free-tier limits and terms can change, and Google may process submitted chat and mission context under its terms. In production, route `/api/astronaut` and `/api/astronaut/health` to this server. Without a configured key or server, the context-aware local tutor still works. Chat can make recommendations, but it never executes gameplay choices on the learner’s behalf.

The “mission simulation” is still an educational prototype—not a real-mission simulator, validated risk model, or operational guidance. Crew roles are a team-learning exercise on the same device, not online multiplayer; solo learners can role-play each perspective.

## Languages and accessibility

- Arabic and English interfaces, with right-to-left and left-to-right layouts.
- Keyboard-accessible controls and base-map objects.
- Motion follows the operating system's `prefers-reduced-motion` setting.
- Responsive layouts for mobile, tablet, and desktop.
- Mission saves, preferences, achievements, and personal records stay in browser storage on the current device.

## Technology

React 18 · TypeScript · Zustand · Vite · Tailwind CSS · Web Audio API · vite-plugin-pwa

The project uses the Node.js test runner through `tsx`; the test command covers simulation and persistence cases.

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
