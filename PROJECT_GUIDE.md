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
- Energy production affects oxygen generation
- Crew morale impacts food consumption
- Choosing maintenance over research gives short-term stability but loses science points
- Every decision has consequences

This makes kids **experience** engineering in their guts, not just understand it in their heads.

---

## 🎮 Two Parts: Learn and Simulate

The first screen offers two paths. **Education** starts a simplified 10-cycle Moon mission with a small crew and low difficulty, using the same outbound transit, surface operations, and return stages as the full simulation. The astronaut tutor is accessed from its map icon, while Flight School contains six optional lessons. **Mission Simulation** opens custom mission setup.

Mission Simulation lets learners configure destination, scenario, crew size, full or specialist control, selected specialty, duration, difficulty, objective, base name, and a reproducible seed. The seed is used to replay modeled outcomes for comparison, not to estimate real mission risk.

Education includes bilingual science tips and proactive low-resource warnings. The optional astronaut tutor and simulation robot answer questions using the local rule-based guide, or the optional Google Gemini API configured through the server-side settings in `.env.example`; assistants guide decisions but do not change game state on the learner’s behalf. The simulation robot’s name and appearance are customizable and saved on-device.

Both modes include an interactive outbound spacecraft leg before base operations and a return-flight decision after the surface phase. Decisions appear in an animated cockpit-window view with a side console. The four crew roles must reach consensus on each transit route as well as on event responses. Transit choices trade energy and food against fatigue or health. Those resource changes remain part of the mission results. Mission Simulation includes additional thermal-drop and habitat-isolation conditions with scenario-specific emergencies.

## 🎮 How to Play

### Start Screen
1. Choose **Education** for the preset learning mission or **Mission Simulation** for custom setup.
2. For simulation, choose **destination, scenario, crew, control mode, specialty, duration, difficulty, objective, and seed**.
3. Enter a base name and start the mission.

### Gameplay
- Each mission day has a fictional **06:00–22:00 activity window** and a fixed **22:00–06:00 crew sleep period**.
- Schedule multiple activities before bedtime: maintenance (2 h), research (3 h), rest (2 h), or exploration (5 h). Construction takes 3 h; operating a facility takes 1 h.
- End the work shift to wait until 22:00 if the remaining time cannot fit another activity. Sleeping applies daily life-support use, crew recovery, and mission events before the next day starts.
- Choose **full crew control** or lead one specialty. In specialist mode, the onboard assistant manages supporting crew work, handles their event votes, and requests approval before a critical end-of-day support plan.
- Seeded, replayable events may occur; consult the crew-role advice, compare choices, and reach a four-role consensus before responding.
- **Goal**: Survive your mission length without resources hitting zero

### Winning
- If you survive the full mission duration → **Victory!** 🎉
- If any life-support resource reaches 0 → crew evacuation. The debrief identifies the depleted resource and how to reduce that risk in a future run.
- Either way, your result gets saved to the leaderboard

---

## 🏗️ How the Game Engine Works

Every event and expedition is reproducible with the same mission seed and cycle. This makes outcomes comparable rather than unpredictable; the model still contains simplified seeded probabilities and does not represent real operational risk.

### Crew roles and team decisions

- **Commander**: mission objectives and crew safety.
- **Power engineer**: energy budget and facility loads.
- **Biologist**: food production and crew health.
- **Water officer**: water reserves, recycling, and leaks.

The crew council shows localized resource-based advice. In full-control mode, emergency choices are committed only after all four roles agree; in specialist mode, the player confirms the choice while the assistant coordinates the other roles. This is an on-device team exercise, not online multiplayer. The decision-pattern panel summarizes player activities from the current local mission log, not assistant work.

### Resource System
```
Energy:  Powers everything. Too much consumption = shutdown.
Oxygen:  Crew breathing. Needs recycling or generation.
Water:   Hydration, cooling. Can be recycled.
Food:    Crew nutrition. Affects morale and health.
```

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
- **Easy**: 30% less resource consumption, fewer events
- **Normal**: Standard difficulty
- **Hard**: 25% more consumption, 70% event chance, harder events

### Emergency System
When an event occurs, you choose your response. Each choice affects resources differently. Example:

```
SOLAR PANEL MALFUNCTION ⚠️
A sensor failed on Panel 3. Energy output drops.

Option A: Quick Fix (-20 energy, +1 day)
Option B: Deep Inspection (-30 energy, -5 oxygen, +2 days, +2 science)
Option C: Leave it (Energy -30% this cycle)
```

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

The guided mission tutorial walks through forecasting, maintenance, food production, crew recovery, and research. Each step explains the decision, its trade-off, and how to verify its effect in the simulation. In Flight School, periodic lesson facts appear every three completed cycles.

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
│   ├── events.ts        # 20+ emergency types
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

# Run tests (should see 32 passing)
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
- ✓ First Shifts (complete 5 operating cycles)
- ✓ Steady Habitat (keep core supplies above 80 for 3 cycles)
- ✓ Long Haul (survive 15 operating cycles)
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
Edit `src/game/model.ts`:
```typescript
const baseConsumption = {
  energy: 20,
  oxygen: 15,
  water: 10,
  food: 5,
}

// Easy mode is now 40% less
const easyModifier = 0.6  // Change from 0.7
```

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
