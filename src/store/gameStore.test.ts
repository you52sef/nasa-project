import assert from 'node:assert/strict'
import test from 'node:test'
import { canChooseEventOption, chooseEvent, EVENTS } from '../game/events'
import { initialGameState, type GameState } from '../game/model'
import { useGameStore } from './gameStore'

test('advances the mission day before an event and preserves the new day resource baseline', () => {
  const missionSeed = Array.from({ length: 500 }, (_, seed) => seed)
    .find((seed) => chooseEvent({
      ...initialGameState('moon', 2, 'Event Day', seed),
      day: 2,
      missionPhase: 'surface',
      transitDecisions: [{ leg: 'outbound', choice: 'conservative' }],
    }) !== null)
  if (missionSeed === undefined) throw new Error('Could not find a deterministic event seed for the regression test.')

  const state: GameState = {
    ...initialGameState('moon', 2, 'Event Day', missionSeed),
    started: true,
    missionPhase: 'surface',
    transitDecisions: [{ leg: 'outbound', choice: 'conservative' }],
    hour: 20,
    todayActions: ['exercise', 'maintenance', 'research'],
  }
  const storage = new Map<string, string>()
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    },
  })

  useGameStore.setState(state)
  useGameStore.getState().sleepAndAdvance()
  const eventState = useGameStore.getState()
  assert.equal(eventState.day, 1)
  assert.ok(eventState.activeEvent)
  const reportBeforeResolution = eventState.dailyReports.find((report) => report.day === 1)
  assert.ok(reportBeforeResolution)
  const resourcesAtStart = eventState.dailyResourceStart
  const event = EVENTS.find((candidate) => candidate.id === eventState.activeEvent?.id)
  assert.ok(event)
  const choiceIndex = event.choices.findIndex((choice) => canChooseEventOption(eventState, choice))
  assert.notEqual(choiceIndex, -1)

  useGameStore.getState().resolveEvent(choiceIndex)
  const resolvedState = useGameStore.getState()
  assert.equal(resolvedState.day, 2)
  assert.deepEqual(resolvedState.dailyResourceStart, resourcesAtStart)
  const reportAfterResolution = resolvedState.dailyReports.find((report) => report.day === 1)
  assert.ok(reportAfterResolution)
  assert.equal(reportAfterResolution.events.length, reportBeforeResolution.events.length + 1)
})

test('manual mission end preserves the final report data and remains distinct from success', () => {
  const storage = new Map<string, string>()
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    },
  })
  const state: GameState = {
    ...initialGameState('mars', 2, 'Early End', 91),
    started: true,
    science: 36,
    successfulExpeditions: 2,
    actionHistory: ['research', 'explore'],
  }
  useGameStore.setState(state)
  useGameStore.getState().endMission()

  const ended = useGameStore.getState()
  assert.equal(ended.isGameOver, true)
  assert.equal(ended.missionResult, 'ended')
  assert.equal(ended.science, 36)
  assert.equal(ended.successfulExpeditions, 2)
  assert.deepEqual(ended.actionHistory, ['research', 'explore'])
})
