import assert from 'node:assert/strict'
import { test } from 'node:test'
import { initialGameState, type GameState } from '../game/model'
import { deleteSave, hasSavedGame, loadGame, saveGame } from './saveSystem'

const memoryStorage = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (key: string) => memoryStorage.get(key) ?? null,
    setItem: (key: string, value: string) => memoryStorage.set(key, value),
    removeItem: (key: string) => memoryStorage.delete(key),
  },
})

test('persists pause state, tutorial progress, and an unresolved emergency', () => {
  memoryStorage.clear()
  const mission = initialGameState('mars', 3, 'Paused Tutorial', 123, {
    maxDays: 10,
    difficulty: 'easy',
    objective: 'tutorial',
  })
  const pausedMission: GameState = {
    ...mission,
    started: false,
    paused: true,
    tutorialSteps: ['forecast', 'maintenance'],
    activeEvent: { id: 'water-leak' },
  }

  saveGame(pausedMission)
  const saved = loadGame()
  assert.equal(hasSavedGame(), true)
  assert.deepEqual(saved?.state, pausedMission)
  assert.ok(saved?.savedAt)

  deleteSave()
  assert.equal(hasSavedGame(), false)
})
