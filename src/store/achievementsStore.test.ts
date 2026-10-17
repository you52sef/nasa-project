import assert from 'node:assert/strict'
import { test } from 'node:test'
import { initialGameState } from '../game/model'
import { ACHIEVEMENTS, useAchievementsStore } from './achievementsStore'

const values = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  },
})

test('unlocks badges once, retains them, and reports new unlocks', () => {
  values.clear()
  useAchievementsStore.setState({ unlocked: {}, newUnlocks: [] })
  const mission = {
    ...initialGameState('moon', 2, 'Badge Base', 31),
    daysSurvived: 5,
  }

  useAchievementsStore.getState().checkAchievements(mission)
  assert.ok(useAchievementsStore.getState().unlocked['first-shifts'])
  assert.deepEqual(useAchievementsStore.getState().newUnlocks, ['first-shifts', 'storm-ready'])

  useAchievementsStore.getState().clearNewUnlocks()
  useAchievementsStore.getState().checkAchievements(mission)
  assert.deepEqual(useAchievementsStore.getState().newUnlocks, [])
  assert.equal(ACHIEVEMENTS.length, 11)

  const persisted = JSON.parse(values.get('little-orbit-achievements-v1') || '{}')
  assert.ok(persisted['first-shifts'])

  useAchievementsStore.getState().clearNewUnlocks()
  useAchievementsStore.getState().checkAchievements({ ...mission, daysSurvived: 2, resourceStreak: 3 })
  assert.ok(useAchievementsStore.getState().unlocked['steady-habitat'])
  assert.deepEqual(useAchievementsStore.getState().newUnlocks, ['steady-habitat'])

  useAchievementsStore.setState({ unlocked: {}, newUnlocks: [] })
  useAchievementsStore.getState().checkAchievements({
    ...mission,
    daysSurvived: 2,
    resourceStreak: 3,
    activeEvent: { id: 'solar-storm' },
  })
  assert.equal(useAchievementsStore.getState().unlocked['steady-habitat'], undefined)
})
