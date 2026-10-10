# Testing Guide — Astra One

## 🧪 Test Summary

**Status**: ✅ 32/32 Tests Passing

```
✓ All simulation logic tests pass
✓ All achievement/badge tests pass
✓ All leaderboard tests pass
✓ All save/load tests pass
✓ All event/scenario tests pass
```

---

## 🏃 Running Tests

### Run all tests:
```bash
npm run test
```

### Watch mode (development):
```bash
npm run test -- --watch
```

### Single test file:
```bash
npm run test -- src/game/model.test.ts
```

### With coverage:
```bash
npm run test -- --coverage
```

---

## 📋 Test Coverage

### Core Simulation (`src/game/model.test.ts`) — 21 tests
- ✅ Mission initialization (crew, destination, difficulty)
- ✅ Scenario selection effects
- ✅ Resource consumption logic
- ✅ Building operations (build, toggle, maintenance)
- ✅ Facility production systems
- ✅ Crew health/fatigue/morale tracking
- ✅ Exploration risk calculations
- ✅ Radiation shelter mechanics
- ✅ Storm scenarios
- ✅ Event determinism (seed-based reproducibility)
- ✅ Objective progress tracking
- ✅ Tutorial progression
- ✅ Mission completion & evacuation
- ✅ 30-cycle & 10-cycle campaign completeness

### Achievements (`src/store/achievementsStore.test.ts`) — 2 tests
- ✅ Badge unlock on first achievement
- ✅ Badge persistence and new unlock reporting

### Leaderboard (`src/utils/leaderboard.test.ts`) — 2 tests
- ✅ Saves top 5 scores with uniqueness
- ✅ Clears leaderboard on demand

### Save/Load System (`src/utils/saveSystem.test.ts`) — 7 tests
- ✅ Persists full game state
- ✅ Restores state from storage
- ✅ Handles pause state
- ✅ Preserves tutorial progress
- ✅ Resolves pending emergencies
- ✅ Clears saves on demand

---

## 🎮 Manual Testing Checklist

### Start Screen
- [ ] Arabic/English toggle works
- [ ] Mission duration selector (10, 15, 20, 30 days)
- [ ] Destination selection (Moon/Mars)
- [ ] Difficulty selector (Easy/Normal/Hard)
- [ ] Base name input (optional)
- [ ] "Start Mission" launches game

### Game Screen
- [ ] Resource bars display correctly
- [ ] Map renders without errors
- [ ] Building menu opens/closes
- [ ] Action buttons work (Rest, Maintenance, Research, Explore)
- [ ] Cycle counter increments
- [ ] Mission watch panel updates
- [ ] Emergency events appear randomly

### Event Handling
- [ ] Event modal shows description
- [ ] Choices are clickable
- [ ] Resource changes apply correctly
- [ ] Sound plays (if enabled)
- [ ] Modal closes after decision

### Map Interactions
- [ ] Click building → info panel
- [ ] Click facility → toggle online/offline
- [ ] Drag selection works (if implemented)
- [ ] Scenario visual effects show (dust, radiation, etc.)

### End Screen
- [ ] Shows mission result (Victory/Defeat)
- [ ] Displays achievements unlocked
- [ ] Leaderboard shows top scores
- [ ] "Restart" button resets
- [ ] Difficulty shown in results
- [ ] Share buttons work (if social enabled)

### Settings
- [ ] Language switch (AR/EN) works
- [ ] RTL/LTR toggles correctly
- [ ] Sound on/off works
- [ ] Settings persist on reload

### Persistence
- [ ] Save game before exit
- [ ] Reload page → load game works
- [ ] Achievements persist
- [ ] Leaderboard scores persist
- [ ] Clear data button works

### Mobile Responsiveness
- [ ] Touch controls work
- [ ] Layout responsive on small screens
- [ ] Buttons easily tappable
- [ ] Text readable on mobile

---

## 🔍 Performance Testing

### Local Build Time
- Expected: < 2 minutes
- Current: ~37 seconds ✓

### Bundle Size
- CSS: 40.56 KB (gzip: 9.60 KB) ✓
- JS: 303 KB (gzip: 95 KB) ✓
- Total: < 350 KB uncompressed ✓

### Load Time
- Target: First contentful paint < 2s
- Can be verified with: `npm run preview`

### Memory Usage
- Should be < 50MB for typical gameplay
- Monitor with DevTools → Memory tab

---

## 🧬 Unit Test Details

### Test 1: Mission Creation
```typescript
✔ creates a 30-cycle mission with selected crew and destination
- Verifies: crew count, destination, duration
- Status: PASS (15.9ms)
```

### Test 2: Difficulty Modifiers
```typescript
✔ difficulty changes resource use, event frequency, and exploration risk
- Verifies: Easy = 70% consumption, Hard = 125%
- Verifies: Event channels differ by difficulty
- Status: PASS (21.0ms)
```

### Test 3: Resource Dynamics
```typescript
✔ maintenance reduces daily resource consumption
- Verifies: Maintenance building reduces burn by 10%
- Status: PASS (0.9ms)
```

### Test 4: Save/Load
```typescript
✔ persists pause state, tutorial progress, and unresolved emergency
- Verifies: State saved to localStorage
- Verifies: Can load exact state back
- Verifies: Emergency choices preserved
- Status: PASS (21.0ms)
```

### Test 5: Event Reproducibility
```typescript
✔ mission rolls are reproducible by seed, day, and independent channel
- Verifies: Same seed = same events
- Verifies: Deterministic RNG
- Status: PASS (0.49ms)
```

---

## 🐛 Known Issues & Workarounds

### None currently identified ✓

All major systems tested and stable:
- ✅ Simulation engine
- ✅ Save/load cycle
- ✅ Achievement tracking
- ✅ Leaderboard persistence
- ✅ Event generation
- ✅ Scenario effects

---

## 📈 Test Trends

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Test Pass Rate | 100% | 100% | ✅ |
| Test Count | 30+ | 32 | ✅ |
| Build Time | < 2m | ~37s | ✅ |
| Bundle Size | < 400KB | 350KB | ✅ |
| Type Safety | 100% | 100% | ✅ |

---

---

## 🎯 Testing Strategy Going Forward

When adding new features:

1. **Write test first** (TDD recommended)
2. **Run `npm run test`** to verify
3. **Check coverage** with `--coverage` flag
4. **Manual test** the feature in browser
5. **Commit with passing tests**

Example:
```typescript
describe('New Feature: X', () => {
  it('should do Y when Z happens', () => {
    const result = someFunction()
    expect(result).toBe(expected)
  })
})
```

---

## 📚 Resources

- [Vitest Docs](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [TypeScript Testing](https://www.typescriptlang.org/)

---

**Test coverage is critical for Space Apps judging. Keep tests passing! ✨**
