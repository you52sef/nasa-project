# 📖 Astra One — Project Guide

## 🎯 What is Astra One?

Astra One is an **interactive educational game** built for the NASA Space Apps Challenge. It teaches students about the complex trade-offs involved in running a lunar or Martian outpost by making them:

1. **Build facilities** (solar panels, oxygen generators, hydroponic farms)
2. **Manage resources** (energy, oxygen, water, food)
3. **Make tough decisions** (maintenance vs. research? rest vs. exploration?)
4. **Respond to emergencies** (dust storms, equipment failures, radiation events)
5. **Keep the crew alive** for a mission duration of their choice

The game uses **Arabic and English**, supports **offline play**, has **sound effects**, and tracks **achievements and leaderboards**.

---

## 💡 Why This Project?

**The Challenge**: Most STEM education oversimplifies engineering trade-offs. Real missions involve complex interdependencies that aren't fun if presented abstractly.

**Our Solution**: Make those trade-offs **tangible and fun** by putting players in control of a working base where:
- Facility and crew demand compete for limited energy, water, oxygen, and food
- Rest improves modeled crew health and readiness but also uses supplies
- Choosing maintenance over research conserves resources but earns no research science
- Seeded events and the player's recorded actions shape each run

This makes kids **experience** engineering in their guts, not just understand it in their heads.

---

## 🎮 Two Parts: Learn and Simulate

The first screen begins with two paths and reveals setup only after one is selected. **Education** opens the cumulative Learning Hub and a guided 10-day Moon mission at easy difficulty. **Decision Simulation** opens the configurable setup for destination, scenario, crew size, duration, difficulty, objective, role/control, and a reproducible seed. The simulation objectives do not include the guided tutorial, which belongs to Education. Additional scenarios cover solar activity, habitat pressure, and greenhouse faults. Both paths use deterministic, on-device rules; the project has no third-party AI integration or external AI API.

Players can choose full crew control or a specialist role. Specialist mode limits the player's activities and facility work to that role; every specialist has role-appropriate actions, and deterministic crew-support rules select a complementary activity rather than automatically duplicating the player's scheduled task.

After choosing a path, the event guide lists every event's cause and response options. The in-mission crew council shows four perspectives—commander, power engineer, biologist, and water officer—and a deterministic recommendation based on current resource and readiness thresholds. The player discusses those trade-offs and makes the final choice. This is a team-learning exercise on one device, not online multiplayer or simulated voting. Flight screens additionally show idealized Earth–Moon and Earth–Mars orbital transfer estimates, clearly separated from the accelerated travel animation.

## 🎮 How to Play

### Start Screen
1. Choose **Education** for the preset learning mission or **Decision Simulation** for custom setup. Use **Back to mission mode selection** any time before launch to switch paths.
2. Review **How to play** and expand the event list to see each event and available response.
3. In simulation, choose **destination, scenario, crew, duration, difficulty, objective, control style, and seed**.
4. Enter a base name and start the mission.

### Gameplay
- A modeled day runs from 06:00 to 22:00. Schedule activities by duration: research (4 h), exploration (6 h), maintenance (3 h), exercise (2.5 h), and one rest block (2 h). Reserve time for daily exercise and at least one work activity (research, exploration, or maintenance); waiting for bedtime and sleeping are unavailable until both are scheduled. Building a facility takes 2 h; changing its operating state takes 1 h.
- The crew can go to sleep at 20:00 or later after completing the daily exercise and work requirements. Sleeping resolves daily resource use and readiness, then advances to the next day. Mission state auto-saves after gameplay decisions; Academy course progress is stored separately in browser storage.
- Inspect the resource bar and forecast, consult the four role perspectives, and plan activities within the remaining time.
- After mission setup, the launch scene leads to a spacecraft cabin. Choose a flight profile and simulation speed (1×, 2×, or 4×); the approach and docking animation completes before surface operations begin. The route panel shows ideal Hohmann/two-body transfer time, departure velocity change, and phase angle. Those are theoretical estimates, not flight plans; campaign days and supplies do not advance over the transfer duration.
- The map follows the modeled mission hour through dawn, daylight, dusk, and night. Sending the crew to sleep plays a closing-eye transition before the next day; events animate in the response screen and on the map.
- Build or pause facilities while managing credits, cargo, time, and operating costs.
- Seeded, replayable events may occur; compare their options' requirements, costs, and effects before choosing a response.
- Review deterministic crew-council recommendations and Academy lesson prompts.
- **Goal**: Survive your mission length without resources hitting zero

### Winning
- If you survive the full mission duration → **Victory!** 🎉
- If any life-support resource reaches 0 → crew evacuation. The debrief identifies the depleted resource and how to reduce that risk in a future run.
- Either way, your result gets saved to the leaderboard

---

## 🏗️ How the Game Engine Works

Events, expeditions, and efficient-profile transit disturbances are reproducible with the same mission seed and mission day. This makes outcomes comparable; environmental probabilities remain simplified and are not validated risk estimates. Scheduled activities are applied overnight and directly affect resources and readiness.

### Crew roles and team decisions

- **Commander**: mission objectives and crew safety.
- **Power engineer**: energy budget and facility loads.
- **Biologist**: food production and crew health.
- **Water officer**: water reserves, recycling, and leaks.

The crew council shows localized, threshold-based resource advice from each role and suggests an action from a deterministic rule set. Full-control players make all activity choices. In specialist mode, other crew members receive one rule-selected support activity per day while the player is restricted to the selected role; the player still makes consequential event and transit choices. The debrief counts recorded actions and event responses; it does not model hidden player intent or claim to predict behavior. This is an on-device team exercise, not online multiplayer.

### Resource System

Resource stores are displayed in kWh, kg, and L. These are educational game parameters, not validated habitat or NASA life-support specifications:

- **Energy:** The model applies a 0.025-hour (90-second) energy equivalent to rated facility power and crew/activity energy per modeled day. This game-only cycle/reserve scaling preserves the stated nameplate values while keeping long campaigns playable; it is not a 24-hour engineering load calculation. Solar is modeled at 15 kW on the Moon and 7 kW on Mars; lunar night has approximately 14 days of zero solar output. The reactor contributes a constant 25 kW. The 200 kWh battery's nameplate reference supports a 27 kW survival load for about 7.4 real hours; that physical runtime is not equivalent to the game's day-cycle accounting.
- **Oxygen:** 0.84 kg per crew member per modeled day. Each active life-support unit produces up to 1.8 kg/day and uses 2 kWh; electrolysis removes 1.125 L of water per kg of oxygen produced. An oxygen store at zero starts a six-game-hour emergency countdown.
- **Water:** 3.8 L per crew member per day. Recovery depends on difficulty: 98% Easy, 94% Normal (the game's Medium-equivalent), and 90% Hard. The educational ECLSS model tracks 1.0 kg CO₂ per crew member per day and Sabatier reaction stoichiometry (up to 0.818 L recovered water per kg of processed CO₂); total recovery is capped at the configured recycler rate.
- **Food:** 2.39 kg per crew member per day, including packaging. Each powered greenhouse growth cycle consumes 1.5 L water and produces 20 kg food plus 3 kg oxygen after ISRU pretreatment removes perchlorates from regolith. Pretreatment costs 2 kWh. The cabin-pressure dashboard uses illustrative 101.3 kPa nominal and 75 kPa leak estimates, not sensor readings.
- **Crew routine:** 1.5 h preparation/briefing, 2.5 h exercise, two 3.5 h shifts, 1 h lunch/rest, 1 h health check, 2.5 h dinner/personal/family communication, 0.5 h emergency buffer, and 8 h sleep. Mars adds 39 minutes to personal time for a 24 h 39 min sol.
- Facility outputs are reduced proportionally when available stored and generated energy cannot meet modeled crew, facility, and scheduled-activity demand.
- **MOXIE:** the game models a small demonstration unit at 0.24 kg oxygen/day and 6 kWh/day, not a full crew-scale oxygen plant.
- **Radiation and hazards:** The model uses 1.84 mSv/day in transit and 0.64 mSv/day on Mars surface; shelter shielding and a 600 mSv warning are simplified game mechanics, not dosimetry or a universal/current NASA career exposure limit. Mars dust storms reduce solar output by 80–95% for 3–5 days. Lunar night is modeled at -173°C. Regolith dust mitigation requires a suitport plus an online EDS.
- **Crew health, readiness, radiation exposure, events, and mission days** remain training mechanics, not medical or operational predictions. Orbital estimates use ideal two-body/Hohmann assumptions, omit real launch windows and perturbations, and do not drive campaign duration or transit resource use.

Construction dependency phases gate expansion: Phase 1 (landing pad, solar, battery, habitat, airlock, shelter), Phase 2 (command, storage, communications), Phase 3 (workshop, lab, clinic, ISRU), and Phase 4 (reactor, greenhouse, expansions). Survival Mode pauses productive facilities and holds critical loads at 27 kW: habitat 15 kW, command 6 kW, communications 3 kW, airlock 2 kW, storage 1 kW. Radiation and resource figures are game parameters; consult the project’s model disclosures and NASA references for the limitations of the educational estimates.

Mission setup provides exact roster profiles for Moon short (2/3/4), Moon base (4/6/8), Mars short (4), and Mars long (6/9/12) missions; 10 modeled cycles select a short roster and 30/60 select long. Four optional surface-operation flows—science expedition, maintenance, construction, and rescue—show crew and facility requirements and progress step by step without replacing campaign survival. Only the science expedition's rover, drilling-tool, and mass-spectrometer prerequisites were specified directly; the remaining facility gates and timer values are game assumptions. Construction validates a minimum 100-unit habitat setback. The unified animated telemetry panel displays supplies, power, modeled pressure, and cumulative radiation.

### Facilities
| Building | Produces | Consumes | Purpose |
|----------|----------|----------|---------|
| Facility | Modeled output | Rated operating load | Role |
|----------|----------------|---------------------------|------|
| Solar panels | 15 kW Moon / 7 kW Mars | Sunlight-dependent | Primary intermittent power |
| Reactor | 25 kW constant | 2 kWh per modeled cycle | Steady power |
| Life support | Up to 1.8 kg oxygen/day | 2 kW | Oxygen and CO₂ processing |
| ISRU | 4 L water and 0.84 kg oxygen/day | 6 kW | Local resource processing |
| Water recycler | Difficulty-capped recovery | 2 kW | Water conservation |
| Greenhouse | 20 kg food and 3 kg oxygen per four powered days | 7 kW; 1.5 L water/day | Food and oxygen production; requires treated regolith |
| Workshop / research lab / medical bay | No passive resource output | 4 / 4 / 3 kW | Maintenance / science / treatment |

### Difficulty Modifiers
- **Easy**: 20% lower modeled crew-supply use, a 15% event chance per day, and lower expedition risk.
- **Normal**: Baseline modeled use and a 30% event chance per day.
- **Hard**: 20% higher modeled crew-supply use, a 45% event chance per day, and higher expedition risk.

### Emergency System
When an event occurs, review the bilingual description and compare each available response's resource cost, benefit, and any facility requirement. The start screen's expandable event guide lets learners preview the full event catalog before launching.

---

## 🎓 What Makes This Educational?

### Real Engineering Concepts
- **Energy budget**: Every action has a power cost
- **Life support cascade**: Oxygen depends on energy, water on oxygen, etc.
- **Risk vs. Reward**: Exploring finds resources but uses energy
- **Preventive maintenance**: Saves long-term but costs upfront
- **Resource recycling**: Water recovery reduces dependency on production

### Critical Thinking
- "If I do maintenance today, can I afford it?"
- "Is it worth exploring when power is low?"
- "Should I prioritize research or stability?"

### Systems Thinking
Players realize:
- One decision affects multiple resources
- Short-term fixes may cause long-term problems
- Different difficulties aren't just harder—they change strategy

The cumulative Academy walks through forecasting, maintenance, food production, crew recovery, research, and emergency responses. Each lesson includes theory, a guided action, and a cumulative simulation; progress, attempts, and weak points are saved locally.

---

## 📊 Project Structure

```
src/
├── components/           # React UI
│   ├── GameScreen.tsx   # Main game loop
│   ├── BaseView.tsx     # Interactive map
│   ├── EventModal.tsx   # Decision UI
│   ├── EndScreen.tsx    # Results screen
│   └── ...
├── game/
│   ├── model.ts         # Simulation engine
│   ├── buildings.ts     # Facility definitions
│   ├── events.ts        # Bilingual emergency catalog
│   ├── teamwork.ts      # Role priorities and deterministic team recommendations
│   └── scenarios.ts     # Mission conditions
├── store/
│   ├── gameStore.ts     # Zustand state
│   ├── achievementsStore.ts
│   └── settingsStore.ts
├── hooks/
│   └── useSound.ts      # Web Audio effects
├── utils/
│   ├── leaderboard.ts   # High scores
│   ├── saveSystem.ts    # Save/load
│   └── facts.ts         # Educational content
└── i18n/
    ├── ar.ts            # Arabic translations
    └── en.ts            # English translations
```

---

## 🔧 Running Locally

### Prerequisites
- Node.js 18+ ([download](https://nodejs.org))
- npm (included with Node)

### Commands

```bash
# Install dependencies
npm install

# Start dev server (localhost:5173)
npm run dev

# Run simulation and persistence tests
npm run test

# Build for production
npm run build

# Preview production build locally
npm run preview
```

### Keyboard Shortcuts
- `Ctrl+K` → Command palette (if implemented)
- `Shift+Alt+L` → Toggle language (if hotkey implemented)
- `Space` → Confirm actions

---

## 📱 Mobile Support

The game is fully responsive:
- **Desktop**: Full UI with all panels visible
- **Tablet**: Adaptive layout, touch-friendly buttons
- **Mobile**: Portrait mode, simplified HUD, touch controls

All game features work on all screen sizes.

---

## ✨ Visual Motion & Accessibility

- The mission briefing uses a slowly orbiting satellite, a softly drifting planet, and subtle animated stars.
- Base-map system links and mission events animate to help communicate simulated activity.
- Debrief results use gentle entrance and celebration motion rather than blocking gameplay.
- The interface respects the device's `prefers-reduced-motion` setting and minimizes animation when enabled.

---

## 🔊 Sound System

Uses Web Audio API to generate:
- **Success**: High-pitched beep
- **Error**: Low-pitched buzz
- **Event Alert**: Alert tone
- **Victory**: Uplifting melody
- **Defeat**: Sad chord

Players can toggle sound with 🔊/🔇 button in top bar.

---

## 💾 Persistence

Gameplay, course progress, and preferences save to **localStorage**:
- **Game progress**: Resume interrupted missions
- **Academy progress**: Lesson completion, attempts, and weak-point topics
- **Leaderboard**: Top 5 scores
- **Achievements**: Unlock badges
- **Settings**: Language, sound, difficulty preference
- **Base customization**: Colors, shapes, add-ons

Data persists across browser sessions (even after close/reopen).

---

## 🏆 Achievement System

Unlock badges for:
- ✓ First Shifts (complete 5 mission days)
- ✓ Steady Habitat (keep core supplies above 80 for 3 mission days)
- ✓ Long Haul (survive 15 mission days)
- ✓ Safe Return (complete the selected mission objective)
- ✓ Field Scout (complete a successful expedition)
- ✓ Research Pioneer (earn 100 science points)
- ✓ Trailblazer (complete 3 successful expeditions)
- ✓ Habitat Architect (build a greenhouse and water recycler)
- ✓ Storm Ready (build a storm shelter and battery)
- ✓ Scenario Specialist (complete a non-baseline scenario)
- ✓ Flight School Graduate (complete all five guided tutorial steps)

---

## 📊 Leaderboard

Tracks your personal best 5 scores:
```
Rank | Days | Date | Difficulty | Status
-----|------|------|------------|-------
1    | 30   | Oct-7| Hard       | WIN 🏆
2    | 25   | Oct-5| Normal     | Equipment failure
3    | 20   | Oct-3| Easy       | Low food
4    | 18   | Oct-1| Normal     | Oxygen leak
5    | 15   | Sep-30| Hard      | Radiation spike
```

---

## 📲 Offline Support

The game is installable as a PWA and supports offline play.

---

## 🧪 Testing

All core systems tested:
```
npm run test

✓ Simulation logic
✓ Resource management
✓ Event generation
✓ Achievement tracking
✓ Leaderboard persistence
✓ Save/load system
✓ Difficulty modifiers
✓ Scenario effects

Total: 32/32 passing
```

---

## 🛠️ Customization Guide

### Change Game Balance
Edit `RESOURCE_RATES` and `getSolarAvailabilityFactor` in `src/game/model.ts`, then update the matching tests, facility descriptions in `src/game/buildings.ts`, and this guide. Keep displayed units consistent with the model assumptions and do not present the educational estimates as mission-ready engineering data.

### Add New Emergency
Edit `src/game/events.ts`:
```typescript
{
  id: 'new-event',
  title: 'Solar Flare',
  titleAr: 'توهج شمسي',
  description: 'High radiation detected...',
  descriptionAr: 'تم الكشف عن إشعاع عالي...',
  choices: [
    { label: 'Shelter crew', effects: { radiation: -50 } },
    { label: 'Continue work', effects: { energy: 50, radiation: 100 } }
  ]
}
```

### Add New Achievement
Edit `src/store/achievementsStore.ts`:
```typescript
{
  id: 'my-badge',
  name: 'My Achievement',
  icon: '🎯',
  description: 'Do something cool',
  check: (state) => state.someMetric > 100
}
```

---

## 🎨 Theming

### Colors
Edit `src/index.css`:
```css
:root {
  --color-primary: #0b1020;      /* Dark space blue */
  --color-accent: #7dd3fc;       /* Cyan accent */
  --color-success: #22c55e;      /* Green */
  --color-danger: #ef4444;       /* Red */
  --color-warning: #f59e0b;      /* Orange */
}
```

### Fonts
Change in `src/index.css`:
```css
body {
  font-family: 'Your Font', sans-serif;  /* Change here */
}

h1 {
  font-family: 'Your Display Font', serif;
}
```

---

## 📚 Educational Resources

Linked in-game:
- NASA Science: Moon Facts
- NASA Science: Mars Facts
- NASA: Water on the Moon
- NASA: Mars Exploration Program

Game facts include references to:
- Lunar geology
- Martian atmosphere
- Solar energy
- Life support systems
- Radiation protection

---

## 🚀 Future Enhancement Ideas

The foundation is solid for:
- **Multiplayer mode** (competitive/cooperative)
- **Campaign progression** (multiple missions)
- **Custom scenarios** (user-created challenges)
- **Telemetry tracking** (data export for teachers)
- **More detailed graphics** (3D map view)
- **Advanced difficulty** (permadeath mode)
- **Accessibility modes** (colorblind, dyslexic-friendly)

---

## 📞 Troubleshooting

### Game won't load
1. Clear browser cache (Ctrl+Shift+R)
2. Check console for errors (F12)
3. Verify JavaScript is enabled

### Saves disappeared
- Check browser's localStorage is enabled
- Private/Incognito mode doesn't persist storage
- Try different browser

### Sound not working
- Check volume isn't muted
- Ensure browser allows Web Audio API
- Refresh and click game area first

### Animations janky
- Disable animations in settings
- Update GPU drivers
- Try different browser

---

## 👥 Team Credits

Created as an independent educational prototype for the NASA Space Apps Challenge by a team passionate about space science and game-based learning.

---

## 📜 Project Status

Astra One is an independent educational prototype. It is not affiliated with or endorsed by NASA and is not intended for real mission operations.

---

## 🎓 Learning Outcomes

After playing, students should understand:
1. ✅ Life support systems are interconnected
2. ✅ Engineering involves trade-offs
3. ✅ Long-term planning beats quick fixes
4. ✅ Maintenance matters
5. ✅ Crew wellbeing affects performance
6. ✅ Resource constraints make decisions hard
7. ✅ Data-driven decisions are important
8. ✅ Science exploration takes time and resources

---

**Play. Learn. Inspire the next generation of space engineers.** 🚀✨

See TESTING.md for technical details.
