import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildInState,
  calculateMissionScore,
  canBuild,
  canToggleBuilding,
  DIFFICULTY_MODIFIERS,
  finishDay,
  forecastRadiationExposure,
  forecastResources,
  getExplorationRisk,
  getObjectiveProgress,
  getObjectiveTarget,
  initialGameState,
  isObjectiveComplete,
  deterministicRoll,
  recordTutorialStep,
  toggleBuildingInState,
} from './model'
import { canChooseEventOption, chooseEvent, EVENTS } from './events'

test('creates a 30-cycle mission with the selected crew and destination', () => {
  const state = initialGameState('mars', 3, 'Hope Base')
  assert.equal(state.maxDays, 30)
  assert.equal(state.destination, 'mars')
  assert.equal(state.crewSize, 3)
  assert.equal(state.baseName, 'Hope Base')
})

test('applies the selected mission length, objective, and difficulty', () => {
  const state = initialGameState('mars', 3, 'Hope Base', 9, {
    maxDays: 60,
    difficulty: 'hard',
    objective: 'exploration',
  })
  assert.equal(state.maxDays, 60)
  assert.equal(state.difficulty, 'hard')
  assert.equal(state.objective, 'exploration')
  assert.equal(getObjectiveTarget(state), 6)
})

test('scenario selection changes starting stores and resource pressure', () => {
  const baseline = initialGameState('mars', 2, 'Baseline', 20, { scenario: 'baseline' })
  const dust = initialGameState('mars', 2, 'Dust Base', 20, { scenario: 'dust-front' })
  const rationed = initialGameState('mars', 2, 'Water Base', 20, { scenario: 'water-rationing' })
  const oxygenShort = initialGameState('mars', 2, 'Oxygen Base', 20, { scenario: 'oxygen-shortage' })

  assert.equal(dust.resources.energy, 62)
  assert.equal(rationed.resources.water, 58)
  assert.equal(oxygenShort.resources.oxygen, 58)
  assert.ok(forecastResources(dust).energy < forecastResources(baseline).energy)
  assert.ok(forecastResources(rationed).water < forecastResources(baseline).water)
})

test('does not invent a base name when the player has not entered one', () => {
  assert.equal(initialGameState('moon', 2, '').baseName, '')
})

test('difficulty changes resource use, expedition risk, and deterministic event frequency', () => {
  const normal = initialGameState('moon', 2, 'Training Base', 37)
  const easy = { ...normal, difficulty: 'easy' as const }
  const hard = { ...normal, difficulty: 'hard' as const }
  assert.ok(forecastResources(easy).oxygen > forecastResources(normal).oxygen)
  assert.ok(forecastResources(hard).oxygen < forecastResources(normal).oxygen)
  assert.ok(getExplorationRisk(easy) < getExplorationRisk(normal))
  assert.ok(getExplorationRisk(hard) > getExplorationRisk(normal))

  const eventCounts = [easy, normal, hard].map((state) =>
    Array.from({ length: 1000 }, (_, index) => chooseEvent({ ...state, day: index + 1 }))
      .filter(Boolean).length,
  )
  assert.ok(eventCounts[0] < eventCounts[1])
  assert.ok(eventCounts[1] < eventCounts[2])
  assert.equal(DIFFICULTY_MODIFIERS.easy.consumption, 0.8)
})

test('emergency catalog has distinct bilingual events with actionable choices', () => {
  const ids = EVENTS.map((event) => event.id)
  assert.equal(new Set(ids).size, ids.length)
  assert.ok(EVENTS.length >= 10)

  for (const event of EVENTS) {
    assert.ok(event.title.ar && event.title.en, `${event.id} should have bilingual titles`)
    assert.ok(event.description.ar && event.description.en, `${event.id} should have bilingual descriptions`)
    assert.ok(event.choices.length >= 2, `${event.id} should offer meaningful choices`)
    for (const choice of event.choices) {
      assert.ok(choice.label.ar && choice.label.en, `${event.id} choices should be bilingual`)
    }
  }

  const state = initialGameState('mars', 2, 'Response Base', 53)
  const newEmergencyIds = [
    'pressure-seal',
    'panel-dust',
    'comms-blackout',
    'medical-alert',
    'water-contamination',
    'micrometeorite-impact',
    'greenhouse-nutrient',
  ]
  for (const id of newEmergencyIds) {
    const event = EVENTS.find((item) => item.id === id)
    assert.ok(event, `${id} should be registered`)
    assert.ok(event.choices.every((choice) => canChooseEventOption(state, choice)))
  }
})

test('tracks objective progress and keeps the performance score bounded', () => {
  const mission = initialGameState('mars', 2, 'Science Base', 3, {
    maxDays: 10,
    objective: 'science',
  })
  const researched = { ...mission, science: 60 }
  assert.equal(getObjectiveProgress(researched), 60)
  assert.equal(isObjectiveComplete(researched), true)
  assert.ok(calculateMissionScore(researched) >= 0 && calculateMissionScore(researched) <= 100)
})

test('counts a completed expedition toward the exploration objective', () => {
  const seed = Array.from({ length: 100 }, (_, value) => value)
    .find((value) => deterministicRoll(value, 1, 1) >= 0.24)
  assert.notEqual(seed, undefined)
  const mission = initialGameState('moon', 2, 'Scout Base', seed, {
    maxDays: 10,
    objective: 'exploration',
  })
  const explored = finishDay(mission, 'explore')
  assert.equal(explored.successfulExpeditions, 1)
  assert.equal(getObjectiveProgress(explored), 1)
  assert.equal(isObjectiveComplete(explored), true)
})

test('tutorial objective advances through forecast, maintenance, construction, rest, and research', () => {
  let state = initialGameState('moon', 2, 'Tutorial Base', 17, {
    maxDays: 10,
    objective: 'tutorial',
  })
  assert.equal(getObjectiveTarget(state), 5)
  state = recordTutorialStep(state, 'rest')
  assert.equal(getObjectiveProgress(state), 0)
  state = recordTutorialStep(state, 'forecast')
  state = finishDay(state, 'maintenance')
  state = buildInState(state, 'greenhouse')
  state = finishDay(state, 'rest')
  state = finishDay(state, 'research')
  assert.deepEqual(state.tutorialSteps, ['forecast', 'maintenance', 'greenhouse', 'rest', 'research'])
  assert.equal(isObjectiveComplete(state), true)
})

test('paused missions cannot advance a cycle or operate facilities', () => {
  const mission = initialGameState('moon', 2, 'Paused Base')
  const paused = { ...mission, paused: true }
  assert.deepEqual(finishDay(paused, 'maintenance'), paused)
  assert.equal(canBuild(paused, 'greenhouse'), false)
  assert.equal(canToggleBuilding(paused, 'solar-panels'), false)
})

test('maintenance reduces daily resource consumption', () => {
  const state = initialGameState('moon', 2, 'Lunar Base')
  const ordinary = forecastResources(state)
  const maintained = forecastResources(state, 'maintenance')
  assert.ok(maintained.energy > ordinary.energy)
  assert.ok(maintained.water > ordinary.water)
  assert.ok(maintained.food > ordinary.food)
})

test('research costs energy and oxygen and earns science', () => {
  const state = initialGameState('mars', 2, 'Research Base')
  const next = finishDay(state, 'research')
  assert.ok(next.resources.energy < state.resources.energy)
  assert.ok(next.resources.oxygen < forecastResources(state).oxygen)
  assert.equal(next.science, 15)
})

test('rest restores crew health but uses extra food', () => {
  const initial = initialGameState('moon', 2, 'Rest Base')
  const state = { ...initial, resources: { ...initial.resources, health: 50 } }
  const resting = forecastResources(state, 'rest')
  const ordinary = forecastResources(state)
  assert.ok(resting.health > ordinary.health)
  assert.ok(resting.food < ordinary.food)
})

test('rest lowers fatigue and improves crew morale', () => {
  const state = initialGameState('moon', 2, 'Crew Base')
  const next = finishDay(state, 'rest')
  assert.ok(next.fatigue < state.fatigue)
  assert.ok(next.morale > state.morale)
})

test('exploration risk reflects destination and crew readiness', () => {
  const moon = initialGameState('moon', 2, 'Moon Base')
  const mars = initialGameState('mars', 2, 'Mars Base')
  assert.equal(getExplorationRisk(moon), 0.24)
  assert.equal(getExplorationRisk(mars), 0.34)

  const fatigued = { ...moon, fatigue: 90, morale: 10, resources: { ...moon.resources, health: 20 } }
  assert.ok(getExplorationRisk(fatigued) > getExplorationRisk(moon))
})

test('an active storm shelter reduces simulated cumulative radiation exposure', () => {
  const base = initialGameState('mars', 2, 'Radiation Base', 12)
  const withShelter = { ...base, buildings: [...base.buildings, 'storm-shelter'] }
  assert.ok(forecastRadiationExposure(withShelter) < forecastRadiationExposure(base))
  assert.ok(forecastRadiationExposure({ ...withShelter, offlineBuildings: ['storm-shelter'] }) > forecastRadiationExposure(withShelter))
})

test('storm shelter response is only available while the shelter is online', () => {
  const state = initialGameState('mars', 2, 'Shelter Base')
  const shelterChoice = EVENTS.find((event) => event.id === 'solar-storm')?.choices[0]
  assert.ok(shelterChoice)
  assert.equal(canChooseEventOption(state, shelterChoice), false)

  const withShelter = { ...state, buildings: [...state.buildings, 'storm-shelter'] }
  assert.equal(canChooseEventOption(withShelter, shelterChoice), true)
  assert.equal(canChooseEventOption({ ...withShelter, offlineBuildings: ['storm-shelter'] }, shelterChoice), false)
})

test('mission rolls are reproducible by seed, day, and independent channel', () => {
  const eventRoll = deterministicRoll(42, 8, 2)
  assert.equal(deterministicRoll(42, 8, 2), eventRoll)
  assert.notEqual(deterministicRoll(42, 8, 2), deterministicRoll(42, 8, 3))
  assert.ok(eventRoll >= 0 && eventRoll < 1)
})

test('exploration and event outcomes are reproducible for the same seeded cycle', () => {
  const state = initialGameState('mars', 2, 'Replay Base', 123456)
  assert.deepEqual(finishDay(state, 'explore'), finishDay(state, 'explore'))
  assert.equal(chooseEvent(state), chooseEvent(state))
})

test('lunar solar output has no invented four-day cycle', () => {
  const dayOne = initialGameState('moon', 2, 'Lunar Base', 7)
  const dayFour = { ...dayOne, day: 4 }
  assert.equal(forecastResources(dayOne).energy, forecastResources(dayFour).energy)
})

test('allows MOXIE on Mars but not on the Moon', () => {
  assert.equal(canBuild(initialGameState('mars', 2, 'Mars Base'), 'moxie'), true)
  assert.equal(canBuild(initialGameState('moon', 2, 'Moon Base'), 'moxie'), false)
})

test('charges credits, cargo, and energy when a structure is built', () => {
  const state = initialGameState('moon', 2, 'Base')
  const next = buildInState(state, 'greenhouse')
  assert.ok(next.buildings.includes('greenhouse'))
  assert.equal(next.resources.credits, state.resources.credits - 90)
  assert.equal(next.resources.cargo, state.resources.cargo - 18)
  assert.equal(next.resources.energy, state.resources.energy - 7)
})

test('rejects a build when the base cannot afford its cargo', () => {
  const initial = initialGameState('moon', 2, 'Base')
  const state = { ...initial, resources: { ...initial.resources, cargo: 0 } }
  assert.equal(canBuild(state, 'greenhouse'), false)
  assert.equal(buildInState(state, 'greenhouse').buildings.includes('greenhouse'), false)
})

test('taking a facility offline removes its output and operating costs', () => {
  const state = initialGameState('moon', 2, 'Systems Base')
  const before = forecastResources(state)
  const offline = toggleBuildingInState(state, 'solar-panels')
  const after = forecastResources(offline)

  assert.deepEqual(offline.offlineBuildings, ['solar-panels'])
  assert.equal(after.energy, before.energy - 18)
  assert.equal(canToggleBuilding(offline, 'solar-panels'), true)
  assert.deepEqual(toggleBuildingInState(offline, 'solar-panels').offlineBuildings, [])
})

test('protects the last active oxygen producer from shutdown', () => {
  const state = initialGameState('mars', 2, 'Life Support Base')
  assert.equal(canToggleBuilding(state, 'life-support'), false)
  assert.deepEqual(toggleBuildingInState(state, 'life-support').offlineBuildings, [])
  assert.match(toggleBuildingInState(state, 'life-support').lastMessage, /oxygen-production/)
})

test('completes the 30-cycle mission with life support, food, water recycling, and crew recovery', () => {
  let state = initialGameState('moon', 2, 'Long Mission')
  for (const buildingId of ['greenhouse', 'water-recycler', 'storm-shelter']) {
    state = buildInState(state, buildingId)
  }
  while (!state.isGameOver) {
    const action = state.daysSurvived % 3 === 2 ? 'rest' : 'maintenance'
    state = finishDay(state, action)
  }
  assert.equal(state.daysSurvived, 30)
  assert.equal(state.missionResult, 'success')
})

test('a selected 10-cycle survival campaign completes after ten operating cycles', () => {
  let state = initialGameState('moon', 2, 'Short Mission', 17, { maxDays: 10 })
  for (const buildingId of ['greenhouse', 'water-recycler', 'storm-shelter']) {
    state = buildInState(state, buildingId)
  }
  while (!state.isGameOver) {
    state = finishDay(state, state.daysSurvived % 3 === 2 ? 'rest' : 'maintenance')
  }
  assert.equal(state.daysSurvived, 10)
  assert.equal(state.missionResult, 'success')
  assert.equal(isObjectiveComplete(state), true)
})

test('evacuates the crew when a life-support resource reaches zero', () => {
  const initial = initialGameState('mars', 2, 'Emergency Base')
  const state = { ...initial, resources: { ...initial.resources, health: 1 } }
  const next = finishDay(state, 'research')
  assert.equal(next.isGameOver, true)
  assert.equal(next.missionResult, 'evacuation')
})
