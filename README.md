# Astra One

**Explore farther. Decide wisely. Bring everyone home.**  
An Arabic–English educational simulator for resource and crew decisions at a fictional lunar or Martian outpost.

> Astra One is an independent educational prototype created for the NASA Space Apps Challenge. It is not affiliated with or endorsed by NASA, and it is not an engineering model or a mission-planning tool.

## The experience

Each modeled mission day runs from 06:00 to 22:00. Players schedule research, exploration, maintenance, rest, and facility work by duration, then send the whole crew to sleep at 20:00 or later to apply daily resource changes and advance. Resource stores use labeled units (kWh, kg, and L) with continuous daily balances. The educational assumptions include 4 kWh of habitat power per crew member per modeled day, 0.84 kg of oxygen and 0.62 kg of food per person per day, and modeled water recovery when a recycler is installed. Solar scenario values are mean daily outputs at 1 AU, scaled by inverse-square distance at Mars and an idealized 29.53-day lunar illumination cycle. Outbound and return legs show ideal Hohmann transfer estimates, including transfer time, departure delta-v estimate, and phase angle; the flight animation remains deliberately accelerated.

The game includes five hands-on guided steps, six short science lessons with before-and-after questions, an interactive base schematic, downloadable PNG mission reports, achievements, and a personal on-device leaderboard. Outbound and return legs now run through an animated spacecraft cabin with a selectable flight profile and 1×/2×/4× time control, followed by a docking sequence. The simulated sun and map lighting move through dawn, day, dusk, and night; crew sleep has its own transition. Surprise events animate on the map and event screen. Missions can also be ended early; early endings are recorded separately from completed or evacuated missions. A crew council presents commander, power engineer, biologist, and water officer perspectives, then offers a resource-based recommendation for the player to consider.

The first screen begins with only two paths. **Education** starts with a guided 10-day, easy Moon mission and an astronaut tutor. **Decision Simulation** then opens destination, scenario, crew size, duration, difficulty, objective, role/control, and replayable seed settings. Both modes use the same resource and event model. Players can choose full crew control or a specialist role; in specialist mode, the player’s activities and facility work are role-limited while the assistant coordinates a supporting crew activity each day. Quantities use familiar physical units, but the rates and life-support loops are simplified educational planning assumptions—not a validated engineering or mission simulation.

## A short judging walkthrough

1. First choose **Education** for the guided beginner mission or **Decision Simulation** to configure a mission.
2. In either mode, expand **How to play** and the event guide before launch to review mission phases and emergency responses.
3. Choose full control or a role-specific play style, review the outbound flight choice, and plan activities within the 06:00–22:00 shift.
4. At 20:00 or later, send every crewmember to sleep; daily supplies resolve and the next day begins. The resource forecast uses the activities actually scheduled today, includes rest and specialist crew support, and lets you test one extra hypothetical action without committing it.
5. During an emergency, compare the cause, requirements, costs, and effects of each response before choosing. Near mission completion, make the return-flight decision.
6. Select the assistant station on the base map to open the astronaut tutor or customizable robot. It provides proactive local advice and rotating education facts; an optional server-side API can enable chat.
7. Review the debrief's failure diagnosis and recorded action/event pattern. Replay with the same seed to compare decisions.

The resource forecast excludes events and expedition outcomes; it otherwise uses the same daily resource resolution as the mission, including a single charge for each activity and the modeled ongoing water-leak loss. Hypothetical actions that exceed the remaining shift or violate the selected specialist role are excluded from the forecast. Event choices show their immediate, capacity-adjusted resource changes in the same units as the inventory; legacy event and leak amounts are converted to those units once. Orbital estimates use an Earth-centered two-body transfer from low Earth orbit for the Moon and circular heliocentric Hohmann transfers for Mars. They do not include launch dates/windows, inclination, perturbations, finite burns, corrections, lunar gravity, or landing. Transfer durations do not advance campaign days or consume supplies; the in-game travel animation and mission calendar are compressed. Lunar illumination is a smooth idealization. The mission seed makes gameplay outcomes reproducible; none of these educational estimates are validated engineering or operational models. Evacuation debriefs identify the depleted resource and explain prevention steps.

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

The production build is a static Vite app with an installable PWA and offline app shell. No API key or network service is needed to play or use the local tutor. The AI assistant screen is chat-only. Without a configured API it replies with local, context-aware guidance.

### Enable the public AI chat on Vercel

The Vercel functions in `api/` make the chat available to every visitor of the deployed game; visitors do not need their own provider key. The provider key stays in Vercel's server-side environment and is never sent to the browser.

1. Create a provider key in [Google AI Studio](https://aistudio.google.com/apikey). Provider free-tier quotas and terms vary and can change; Google may process submitted messages and mission context.
2. Push this repository to GitHub, sign in to [Vercel](https://vercel.com/), choose **Add New → Project**, and import the repository. Keep the project root at the repository root; Vercel detects the Vite app and the `api/` serverless functions.
3. In **Project → Settings → Environment Variables**, add these variables for **Production** (and Preview too if you want AI chat on preview deployments):

   | Name | Value |
   | --- | --- |
   | `ASTRONAUT_API_URL` | `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions` |
   | `ASTRONAUT_API_KEY` | The key created in Google AI Studio |
   | `ASTRONAUT_MODEL` | A model available to that key, for example `gemini-3.8-flash` |

4. Save the variables and deploy (or redeploy after adding them). The app and chat API use the same Vercel domain; no CORS setting or browser-side API key is needed.
5. Verify `https://<your-project>.vercel.app/api/astronaut/health` returns `{"enabled":true,"missing":[]}`. Then open the game, select the assistant station on the map, and send a message.

The public chat endpoint is intentionally unauthenticated for game visitors, but limits each observed IP to 12 requests per minute, limits request size to 24 KB, and accepts at most 10 messages of up to 1,000 characters each. The in-memory rate limit is best-effort per serverless instance, not a global quota: Vercel can run multiple instances. For stronger public abuse protection, connect a shared rate-limit store (such as Upstash Redis/Vercel KV) and set provider-side spend/quota limits before sharing widely. Provider, Vercel function, and model free-tier quotas still apply; this is not an unlimited AI service.

For local Gemini chat, copy `.env.example` to `.env`, add the same server-only values, then run `npm run api` and `npm run dev` in two terminals. Restart the API after changing `.env`. Never add `.env` or the provider key to frontend code or commit it. Chat can recommend actions, but it never executes gameplay choices on the learner’s behalf.

The “mission simulation” is still an educational prototype—not a real-mission simulator, validated risk model, or operational guidance. The cockpit, flight-time controls, and docking sequence are illustrative gameplay, not vehicle dynamics. Crew roles are a team-learning exercise on the same device, not online multiplayer; solo learners can play a more distinct specialist role while the rest of the crew coordinates supporting work.

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
api/             # Vercel serverless AI chat and health-check endpoints
```

## Learning and scientific context

In-app lessons link to selected NASA Science references on the Moon, Mars, and lunar water. Resource values, radiation exposure, event chances, and crew-readiness measures are simplified training indicators—not measured engineering quantities or validated operational risks.

See [PROJECT_GUIDE.md](./PROJECT_GUIDE.md) for gameplay and learning details.
