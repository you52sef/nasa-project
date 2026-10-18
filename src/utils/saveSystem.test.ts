import assert from 'node:assert/strict'
import { test } from 'node:test'
import { initialGameState, type GameState } from '../game/model'
import { deleteSave, hasSavedGame, loadGame, loadMissionSetup, saveGame, saveMissionSetup } from './saveSystem'

const memoryStorage = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (key: string) => memoryStorage.get(key) ?? null,
    setItem: (key: string, value: string) => memoryStorage.set(key, value),
    removeItem: (key: string) => memoryStorage.delete(key),
  },
})

test('persists pause state, schedule, specialist mode, and an unresolved emergency', () => {
  memoryStorage.clear()
  const mission = initialGameState('mars', 3, 'Paused Tutorial', 123, {
    maxDays: 10,
    difficulty: 'easy',
    objective: 'tutorial',
    missionMode: 'education',
  })

  test('persists the selected specialist control mode and role in mission setup', () => {
    memoryStorage.clear()
    const setup = {
      destination: 'mars' as const,
      crewSize: 6,
      maxDays: 180,
      missionType: 'mars-conjunction' as const,
      difficulty: 'normal' as const,
      objective: 'science' as const,
      missionSeed: 91,
      scenario: 'habitat-leak' as const,
      missionMode: 'simulation' as const,
      controlMode: 'specialist' as const,
      controlledRole: 'water-officer' as const,
      controlledDutyId: 'sabatier-isru-fuel-chemist-1',
      astronautName: 'Mission Specialist',
      astronautDutyId: 'space-agriculture-scientist-1',
    }
    saveMissionSetup(setup)
    assert.deepEqual(loadMissionSetup(), setup)
  })
  const pausedMission: GameState = {
    ...mission,
    started: false,
    paused: true,
    tutorialSteps: ['forecast', 'maintenance'],
    activeEvent: { id: 'water-leak' },
    actionHistory: ['maintenance', 'rest'],
    eventHistory: [{ eventId: 'water-leak', choiceIndex: 0 }],
    controlMode: 'specialist',
    controlledRole: 'biologist',
    crewDailyActivities: [{
      dutyId: 'systems-engineer-1',
      title: 'Systems Engineer',
      action: 'maintenance',
      effect: 'inspection',
    }],
    missionPhase: 'return',
    transitDecisions: [
      { leg: 'outbound', choice: 'conservative' },
      { leg: 'return', choice: 'efficient' },
    ],
    hour: 18,
    todayActions: ['research'],
    crewSupportActionHistory: ['maintenance'],
  }

  saveGame(pausedMission)
  const saved = loadGame()
  assert.equal(hasSavedGame(), true)
  assert.deepEqual(saved?.state, pausedMission)
  assert.ok(saved?.savedAt)

  deleteSave()
  assert.equal(hasSavedGame(), false)
})

test('persists a 180-day mission with a 12-person crew', () => {
  memoryStorage.clear()
  const setup = {
    destination: 'mars' as const,
    crewSize: 12,
    maxDays: 180,
    missionType: 'mars-conjunction' as const,
    difficulty: 'hard' as const,
    objective: 'survival' as const,
    missionSeed: 204,
    scenario: 'baseline' as const,
    missionMode: 'simulation' as const,
    controlMode: 'full' as const,
    controlledRole: 'commander' as const,
    controlledDutyId: 'commander-1',
  }
  saveMissionSetup(setup)
  assert.deepEqual(loadMissionSetup(), setup)
})
