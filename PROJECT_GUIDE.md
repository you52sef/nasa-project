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

The first screen begins with two paths and reveals setup only after one is selected. **Education** starts a guided 10-day Moon mission at easy difficulty with the five-step tutorial, an astronaut tutor, and rotating facts. **Decision Simulation** opens the configurable setup for destination, scenario, crew size, duration, difficulty, objective, role/control, and a reproducible seed. The simulation objectives do not include the guided tutorial, which belongs to Education. Additional scenarios cover solar activity, habitat pressure, and greenhouse faults. Both paths use the same decision model; simulation is a deeper educational scenario, not a physically realistic mission model.

Players can choose full crew control or a specialist role. Specialist mode limits the player's activities and facility work to that role; every specialist has role-appropriate actions, and the assistant plans a complementary supporting activity rather than automatically duplicating the player's scheduled task. The astronaut tutor in Education and mission assistant in Decision Simulation provide a chat-only interface with local rules when the optional API is unavailable. The Vercel serverless chat functions use server-side provider settings; visitors never need a provider key. See the Vercel setup and public-use limits in README.

After choosing a path, the event guide lists every event's cause and response options. The in-mission crew council shows four perspectives—commander, power engineer, biologist, and water officer—and a deterministic recommendation based on current resource and readiness thresholds. The player discusses those trade-offs and makes the final choice. This is a team-learning exercise on one device, not online multiplayer or simulated voting. Flight screens additionally show idealized Earth–Moon and Earth–Mars orbital transfer estimates, clearly separated from the accelerated travel animation.

## 🎮 How to Play

### Start Screen
1. Choose **Education** for the preset learning mission or **Decision Simulation** for custom setup. Use **Back to mission mode selection** any time before launch to switch paths.
2. Review **How to play** and expand the event list to see each event and available response.
3. In simulation, choose **destination, scenario, crew, duration, difficulty, objective, control style, and seed**.
4. Enter a base name and start the mission.

### Gameplay
- A modeled day runs from 06:00 to 22:00. Schedule activities by duration: research (4 h), exploration (6 h), maintenance (3 h), and rest (2 h). Building a facility takes 2 h; changing its operating state takes 1 h.
- The crew can go to sleep at 20:00 or later. Sleeping resolves daily resource use and readiness, then advances to the next day.
- Inspect the resource bar and forecast, consult the four role perspectives, and plan activities within the remaining time.
- After mission setup, the launch scene leads to a spacecraft cabin. Choose a flight profile and simulation speed (1×, 2×, or 4×); the approach and docking animation completes before surface operations begin. The route panel shows ideal Hohmann/two-body transfer time, departure velocity change, and phase angle. Those are theoretical estimates, not flight plans; campaign days and supplies do not advance over the transfer duration.
- The map follows the modeled mission hour through dawn, daylight, dusk, and night. Sending the crew to sleep plays a closing-eye transition before the next day; events animate in the response screen and on the map.
- Build or pause facilities while managing credits, cargo, time, and operating costs.
- Seeded, replayable events may occur; compare their options' requirements, costs, and effects before choosing a response.
- Open the astronaut tutor or robot station from the base map for proactive advice and chat.
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

The crew council shows localized, threshold-based resource advice from each role and suggests an action from a deterministic rule set. Full-control players make all activity choices. In specialist mode, other crew members receive one assistant-coordinated activity per day while the player is restricted to the selected role; the player still makes consequential event and transit choices. The debrief counts recorded actions and event responses; it does not model hidden player intent or claim to predict behavior. This is an on-device team exercise, not online multiplayer.

### Resource System

Resource stores are displayed in kWh, kg, and L, but the rates below are planning assumptions for the game—not validated habitat specifications:

- **Energy:** 4 kWh per crew member per modeled day, plus active facility and scheduled activity loads. Solar output follows a smooth idealized lunar illumination cycle and inverse-square distance scaling at Mars; scenario values are mean daily output at 1 AU. Reactors provide a steady 25 kWh/day.
- **Oxygen:** 0.84 kg per crew member per modeled day. Each active life-support unit produces up to 1.8 kg/day and uses 2 kWh; its electrolysis demand removes 1.125 L of water per kg of oxygen produced. Research and exploration add small activity allowances.
- **Water:** 3.5 L per crew member per day before recovery. An active, powered recycler returns up to 98% of crew water use and 90% of greenhouse irrigation in this simplified loop. A liter is treated as approximately one kilogram for electrolysis accounting.
- **Food:** 0.62 kg per crew member per day. Each powered greenhouse supplies up to 1 kg/day and uses 1.5 L of water and 4 kWh.
- Facility outputs are reduced proportionally when available stored and generated energy cannot meet modeled crew, facility, and scheduled-activity demand.
- **MOXIE:** the game models a small demonstration unit at 0.24 kg oxygen/day and 6 kWh/day, not a full crew-scale oxygen plant.
- **Crew health, readiness, radiation exposure, events, and mission days** remain training indices or simplified mechanics, not medical or operational predictions. Orbital estimates use ideal two-body/Hohmann assumptions, omit real launch windows and perturbations, and do not drive campaign duration or transit resource use.

### Facilities
| Building | Produces | Consumes | Purpose |
|----------|----------|----------|---------|
| Solar Panel | Energy | Sunlight 😄 | Primary power |
| Oxygen Gen | Oxygen | 5 energy | Breathable air |
| Water Recycler | Water | 3 energy | Conservation |
| Hydroponic Farm | Food | 8 energy | Nutrition |
| Storm Shelter | Protection | 4 energy | Radiation shield |
| Laboratory | Science | 10 energy | Research |

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

The guided mission tutorial walks through forecasting, maintenance, food production, crew recovery, and research. Each step explains the decision, its trade-off, and how to verify its effect in the simulation. The astronaut tutor rotates a mission fact each day in Education.

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

Everything saves to **localStorage**:
- **Game progress**: Resume interrupted missions
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
