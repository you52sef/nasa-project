# Astra One

**Explore farther. Decide wisely. Bring everyone home.**

An Arabic–English educational simulator for resource and crew decisions at a fictional lunar or Martian outpost.

> Astra One is an independent educational prototype created for the NASA Space Apps Challenge. It is not affiliated with or endorsed by NASA, and it is not an engineering model or a mission-planning tool.

## The experience

Choose **Education** to enter the lesson-based Learning Hub and its guided Moon mission, or **Decision Simulation** to configure a mission. Each destination-specific mission profile displays its assumed minimum crew, equipment checklist, and daily surface activities, and selecting a profile configures a compatible crew roster. These checklists are educational planning guidance, not NASA-certified operational requirements; linked NASA references provide scientific context. Five cumulative lessons combine theory cards, guided interface actions, and mini-simulations. Course progress, attempts, topic mastery, and weak points persist locally. The simulation includes Arabic and English interfaces, crew roles, seeded scenarios and events, construction phases, field operations, ECLSS, greenhouse and ISRU mechanics, radiation tracking, animated telemetry, sound effects, and an autosaved campaign.

Mission purpose choices are destination-specific: lunar surface sample and radiation science or lunar base infrastructure; Mars opposition regolith, ice and astrobiology exploration or conjunction greenhouse, Sabatier and self-sustainability work. The profile asks for an astronaut name and a crew duty, then shows that crewmember's daily duty completion from the activity actually performed that mission day. English is the first-visit language; an explicitly saved language preference is retained.

The surface map places the habitat and crew facilities near the base center, separates power generation at the perimeter, and keeps the landing pad beyond its modeled 100 m habitat setback. The crew panel (full control) and role-specific Comm-Link (specialist control) let players send requests to assigned crewmembers. On-device rules assess specialty, fatigue, resources, workload, and active emergencies; accepted and declined requests appear in the daily debrief.

All simulation decisions, crew support recommendations, events, and telemetry use deterministic or seeded on-device rules. The project has no third-party AI integration, external AI API, or server-side chat feature. Crew titles such as “AI/Robotics Engineer” describe a requested mission role, not an AI system.

The model uses familiar units, but the rates and life-support loops are simplified educational assumptions—not validated engineering or NASA specifications. Supply rates are 0.84 kg oxygen, 3.8 L water, 2.39 kg packaged food, and 1.0 kg CO₂ per crew member per day. Water recycling varies by difficulty (98% Easy, 94% Normal, 90% Hard). Environmental references include Moon gravity 0.165 g, Mars gravity 0.38 g, Mars pressure 0.6% of Earth, 3–22 minute Mars communication delay, and an approximately 14-day lunar night.

## Gameplay

Each modeled mission day uses a 06:00–22:00 activity window. A crewmember must complete daily exercise and at least one work activity before sleep; only one rest block can be scheduled per day. The separate routine totals 24 hours, including two work shifts and eight hours of sleep. Mars adds 39 minutes to personal time for a 24 h 39 min sol.

Base power and facility costs use a 0.025-hour (90-second) energy equivalent per modeled day, a deliberate game-only cycle/reserve scaling layer that keeps long campaigns playable without changing the listed nameplate reference values. It is not a 24-hour engineering load calculation. The survival-load reference is 27 kW and the battery reference is 200 kWh (about 7.4 real hours at that load). Solar is modeled at 15 kW on the Moon and 7 kW on Mars; lunar-night solar output is zero, and Mars dust storms reduce output by 80–95% for 3–5 days.

Other modeled hazards and mechanics include a six-game-hour oxygen emergency reserve, daily health loss during food or water shortage, cumulative radiation warnings, pressure leaks, emergency levels, and regolith dust mitigation using a suitport and electrostatic dust shield. These are educational game rules, not medical or operational predictions.

Construction phases gate progression from initial landing and habitat infrastructure to command, operations, and expansion. The map uses stable facility zones, logical network origins, a protected-ridge marker, and a 100-unit landing-pad setback from habitats. Four optional surface-operation flows run within the active survival campaign.

NASA reference pages for [Moon facts](https://science.nasa.gov/moon/facts/) and [Mars facts](https://science.nasa.gov/mars/facts/) provide natural-environment context. Resource rates, radiation exposure, facility performance, power budgets, and probabilities remain simplified game assumptions.

## Development

Requirements: Node.js 18+ and npm.

```powershell
npm install
npm run dev
npm test
npm run build
npm run preview
```

The production build is a static Vite app with an installable PWA and offline app shell. No API keys or external service are required for gameplay.

## Languages, accessibility, and persistence

- Arabic and English interfaces with right-to-left and left-to-right layouts; English is the default for first-time visitors.
- Responsive layouts and keyboard-accessible controls.
- Motion follows `prefers-reduced-motion`.
- Mission state, Academy progress, preferences, achievements, and personal records stay in browser storage on the current device.

## Technology and project map

React 18 · TypeScript · Zustand · Vite · Tailwind CSS · Web Audio API · vite-plugin-pwa

```text
src/
├── components/  # Mission screens, interactive map, lessons, and controls
├── game/        # Simulation rules, facilities, scenarios, events, and lessons
├── i18n/        # Arabic and English interface copy
├── store/       # Mission, settings, and achievement state
├── hooks/       # Sound and interaction hooks
└── utils/       # Local persistence and mission-report export
```

See [PROJECT_GUIDE.md](./PROJECT_GUIDE.md) for gameplay details and limitations.
