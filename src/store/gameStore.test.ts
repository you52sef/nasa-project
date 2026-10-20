import assert from 'node:assert/strict'
import test from 'node:test'
import { canChooseEventOption, chooseEvent, EVENTS, getEventChoiceRequiredSpecialization } from '../game/events'
import { getEnergyCapacity, getSupplyCapacity, initialGameState, type GameState } from '../game/model'
import { getMissionSpecialization } from '../game/crewRosters'
import { getMissionCrewAssignments } from '../game/teamwork'
import { useGameStore } from './gameStore'

test('advances the mission day before an event and preserves the new day resource baseline', () => {
  const missionSeed = Array.from({ length: 500 }, (_, seed) => seed)
    .find((seed) => chooseEvent({
      ...initialGameState('moon', 6, 'Event Day', seed, { maxDays: 180 }),
      day: 2,
      missionPhase: 'surface',
      transitDecisions: [{ leg: 'outbound', choice: 'conservative' }],
    }) !== null)
  if (missionSeed === undefined) throw new Error('Could not find a deterministic event seed for the regression test.')

  const state: GameState = {
    ...initialGameState('moon', 6, 'Event Day', missionSeed, { maxDays: 180 }),
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
  const requiredSpecialization = getEventChoiceRequiredSpecialization(event.id)
  const eligibleCrewMember = getMissionCrewAssignments(eventState.crewSize, eventState.destination, eventState.maxDays)
    .find((assignment) => !requiredSpecialization || getMissionSpecialization(assignment.specialty) === requiredSpecialization)
  assert.ok(eligibleCrewMember, `No qualified astronaut for ${event.id}`)
  useGameStore.setState({ controlledDutyId: eligibleCrewMember.id })
  const authorizedState = useGameStore.getState()
  const choiceIndex = event.choices.findIndex((choice) => canChooseEventOption(authorizedState, choice, event.id))
  assert.notEqual(choiceIndex, -1)

  useGameStore.getState().resolveEvent(choiceIndex)
  const resolvedState = useGameStore.getState()
  assert.equal(resolvedState.day, 2)
  assert.deepEqual(resolvedState.dailyResourceStart, resourcesAtStart)
  const reportAfterResolution = resolvedState.dailyReports.find((report) => report.day === 1)
  assert.ok(reportAfterResolution)
  assert.equal(reportAfterResolution.events.length, reportBeforeResolution.events.length + 1)
})

test('manual mission end records a goal-based outcome and preserves final report data', () => {
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
  assert.equal(ended.missionResult, 'failure')
  assert.equal(ended.science, 36)
  assert.equal(ended.successfulExpeditions, 2)
  assert.deepEqual(ended.actionHistory, ['research', 'explore'])
  assert.equal(ended.savedGameExists, true)

  useGameStore.setState({
    ...state,
    objective: 'science',
    science: 120,
  })
  useGameStore.getState().endMission()
  assert.equal(useGameStore.getState().missionResult, 'success')
})

test('mission seed setter rejects non-finite input without corrupting setup state', () => {
  const state = useGameStore.getState()
  const previousSeed = state.missionSeed
  assert.throws(() => state.setMissionSeed(Number.NaN), /finite number/)
  assert.equal(useGameStore.getState().missionSeed, previousSeed)
})

test('restoring a mission clamps all persisted resource values to their valid ranges', () => {
  const storage = new Map<string, string>()
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    },
  })
  const mission = initialGameState('moon', 2, 'Resource Bounds', 45)
  useGameStore.setState({
    ...mission,
    resources: {
      ...mission.resources,
      energy: 1_000,
      oxygen: -5,
      water: 1_000,
      food: -10,
      health: 150,
      credits: -1,
      cargo: -1,
    },
  })

  useGameStore.getState().save()
  useGameStore.getState().load()

  const { resources } = useGameStore.getState()
  assert.equal(resources.energy, getEnergyCapacity(mission))
  assert.equal(resources.oxygen, 0)
  assert.equal(resources.water, getSupplyCapacity('water', mission.crewSize))
  assert.equal(resources.food, 0)
  assert.equal(resources.health, 100)
  assert.equal(resources.credits, 0)
  assert.equal(resources.cargo, 0)
})

test('restoring a mission bounds corrupted telemetry and accumulated counters', () => {
  const storage = new Map<string, string>()
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    },
  })
  const mission = initialGameState('moon', 2, 'Telemetry Bounds', 45)
  useGameStore.setState({
    ...mission,
    day: 0,
    daysSurvived: mission.maxDays + 50,
    hour: 99,
    fatigue: Number.NaN,
    morale: 150,
    radiationExposure: -5,
    cabinTemperatureC: 1_000,
    crewStress: -5,
    crewPulseBpm: 500,
    oxygenEmergencyHoursRemaining: 20,
    science: Number.POSITIVE_INFINITY,
    dustStormDaysRemaining: 12,
  })

  useGameStore.getState().save()
  useGameStore.getState().load()

  const restored = useGameStore.getState()
  assert.equal(restored.day, 1)
  assert.equal(restored.daysSurvived, mission.maxDays)
  assert.equal(restored.hour, 22)
  assert.equal(restored.fatigue, mission.fatigue)
  assert.equal(restored.morale, 100)
  assert.equal(restored.radiationExposure, 0)
  assert.equal(restored.cabinTemperatureC, 60)
  assert.equal(restored.crewStress, 0)
  assert.equal(restored.crewPulseBpm, 200)
  assert.equal(restored.oxygenEmergencyHoursRemaining, 6)
  assert.equal(restored.science, 0)
  assert.equal(restored.dustStormDaysRemaining, 5)
})

test('restores active crew, personal morale, ECLSS telemetry, and Sol progress', () => {
  const storage = new Map<string, string>()
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    },
  })
  const mission = initialGameState('mars', 4, 'Crew Restore', 46, { maxDays: 10 })
  const engineer = getMissionCrewAssignments(mission.crewSize, mission.destination, mission.maxDays)
    .find((duty) => duty.specialty === 'engineering')
  assert.ok(engineer)
  useGameStore.setState({
    ...mission,
    controlledDutyId: engineer.id,
    astronautDutyId: engineer.id,
    controlledRole: 'power-engineer',
    day: 4,
    daysSurvived: 3,
    morale: 61,
    resources: { ...mission.resources, oxygen: 42 },
    cabinOxygenPartialPressureKpa: 17.5,
    crewConditions: {
      ...mission.crewConditions,
      [engineer.id]: { health: 86, fatigue: 28, stress: 31, morale: 67 },
    },
  })
  useGameStore.getState().save()
  useGameStore.setState({ ...mission, controlledDutyId: '' })
  useGameStore.getState().load()

  const restored = useGameStore.getState()
  assert.equal(restored.controlledDutyId, engineer.id)
  assert.equal(restored.controlledRole, 'power-engineer')
  assert.equal(restored.day, 4)
  assert.equal(restored.daysSurvived, 3)
  assert.equal(restored.resources.oxygen, 42)
  assert.equal(restored.cabinOxygenPartialPressureKpa, 17.5)
  assert.deepEqual(restored.crewConditions[engineer.id], {
    health: 86,
    fatigue: 28,
    stress: 31,
    morale: 67,
  })

  const legacySave = JSON.parse(storage.get('little-orbit-save-v1') || '{}') as {
    state: { configVersion: number; crewConditions: Record<string, { morale?: number }> }
  }
  legacySave.state.configVersion = 13
  delete legacySave.state.crewConditions[engineer.id].morale
  storage.set('little-orbit-save-v1', JSON.stringify(legacySave))
  useGameStore.getState().load()
  assert.equal(useGameStore.getState().crewConditions[engineer.id].morale, 61)
})

test('rejects a saved construction project for an unknown facility', () => {
  const storage = new Map<string, string>()
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    },
  })
  const mission = initialGameState('moon', 2, 'Invalid Construction', 45)
  useGameStore.setState({
    ...mission,
    constructionProject: {
      buildingId: 'not-a-facility',
      totalHours: 24,
      hoursRemaining: 12,
    },
  })
  useGameStore.getState().save()

  assert.throws(() => useGameStore.getState().load(), /Invalid construction project/)
})
