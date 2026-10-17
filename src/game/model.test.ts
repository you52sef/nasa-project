import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildInState,
  canPerformActivity,
  canSleepAndAdvance,
  calculateMissionScore,
  analyzeMissionBehavior,
  canBuild,
  canToggleBuilding,
  convertLegacyResourceDelta,
  DIFFICULTY_MODIFIERS,
  getCrewDailyEclssBalance,
  getEnergyCapacity,
  getHabitatPressureKpa,
  getPowerLoadKw,
  getSolarOutputKw,
  getSolarGenerationKwh,
  getSurvivalPowerLoadKw,
  isLunarNight,
  getLunarSurfaceTemperatureCelsius,
  finishDay,
  forecastRadiationExposure,
  forecastResources,
  getSolarAvailabilityFactor,
  getExplorationRisk,
  getObjectiveProgress,
  getObjectiveTarget,
  initialGameState,
  migrateLegacyResourceUnits,
  RESOURCE_RATES,
  resolveTransitDecision,
  scheduleActivity,
  setEmergencyLevel,
  sleepAndAdvanceDay,
  isObjectiveComplete,
  deterministicRoll,
  recordTutorialStep,
  settleAfterEvent,
  toggleBuildingInState,
  waitUntilBedtime,
  triggerDustStorm,
  pretreatRegolith,
  updateAutomaticLoadShed,
  type GameState,
} from './model'
import { CREW_DAILY_ROUTINE, ENVIRONMENT, FOOD_PER_CREW_DAY, OXYGEN_PER_CREW_DAY, POWER_SYSTEM, WATER_PER_CREW_DAY, WATER_RECYCLE_RATE, getCrewDailyRoutine, getCrewSolDurationHours, getSurvivalBatteryRuntimeHours } from './constants'
import { estimateTransfer } from './flightPhysics'
import { GREENHOUSE_CYCLE } from './constants'
import { CREW_ROSTERS, getAllowedCrewSizes, getCrewRoster } from './crewRosters'
import { advanceOperation, canStartOperation, startOperation, advanceOperationCycle, setOperationSiteDistance } from './operations'
import { canChooseEventOption, chooseEvent, EVENTS } from './events'
import { recommendDailyAction, recommendCrewSupportAction, recommendEventResponse, recommendSpecialistActivity, CREW_ROLES, getAvailableCrewRoles } from './teamwork'

const prepareSurfaceMission = (state: GameState) => resolveTransitDecision(state, 'outbound', 'conservative')

test('creates a 30-cycle mission with the selected crew and destination', () => {
  const state = initialGameState('mars', 3, 'Hope Base')
  assert.equal(state.maxDays, 30)
  assert.equal(state.destination, 'mars')
  assert.equal(state.crewSize, 3)
  assert.equal(state.baseName, 'Hope Base')
})

test('defines the requested crew supply rates, difficulty recycling, and daily routine', () => {
  assert.equal(RESOURCE_RATES.oxygenKgPerCrewDay, OXYGEN_PER_CREW_DAY)
  assert.equal(RESOURCE_RATES.waterLitersPerCrewDay, WATER_PER_CREW_DAY)
  assert.equal(RESOURCE_RATES.foodKgPerCrewDay, FOOD_PER_CREW_DAY)
  assert.equal(RESOURCE_RATES.co2KgPerCrewDay, 1)
  assert.deepEqual(WATER_RECYCLE_RATE, { easy: 0.98, normal: 0.94, hard: 0.9 })
  assert.equal(CREW_DAILY_ROUTINE.reduce((total, block) => total + block.hours, 0), 24)
  assert.equal(getCrewDailyRoutine('moon').reduce((total, block) => total + block.hours, 0), 24)
  assert.equal(getCrewSolDurationHours('mars'), 24.65)
  assert.equal(getCrewDailyRoutine('mars').find((block) => block.id === 'personal')?.hours, 3.15)
  assert.equal(CREW_DAILY_ROUTINE.find((block) => block.id === 'exercise')?.hours, 2.5)
  assert.equal(CREW_DAILY_ROUTINE.filter((block) => block.id.startsWith('shift-')).reduce((sum, block) => sum + block.hours, 0), 7)
})

test('models crew ECLSS use, Sabatier water recovery, and difficulty-specific recycling', () => {
  const medium = getCrewDailyEclssBalance(1, 'normal', true)
  const withoutRecycler = getCrewDailyEclssBalance(1, 'normal', false)
  assert.equal(medium.oxygenConsumedKg, 0.84)
  assert.equal(medium.waterConsumedLiters, 3.8)
  assert.equal(medium.foodConsumedKg, 2.39)
  assert.equal(medium.co2ProducedKg, 1)
  assert.ok(Math.abs(medium.sabatierWaterRecoveredLiters - 36 / 44) < 1e-10)
  assert.equal(medium.totalWaterRecoveredLiters, 3.8 * 0.94)
  assert.ok(withoutRecycler.totalWaterRecoveredLiters < medium.totalWaterRecoveredLiters)
  assert.equal(getCrewDailyEclssBalance(1, 'easy', true).totalWaterRecoveredLiters, 3.8 * 0.8 * 0.98)
  assert.equal(getCrewDailyEclssBalance(1, 'hard', true).totalWaterRecoveredLiters, 3.8 * 1.2 * 0.9)
})

test('defines destination conditions and survival power values', () => {
  assert.equal(ENVIRONMENT.moonGravityEarthG, 0.165)
  assert.equal(ENVIRONMENT.marsGravityEarthG, 0.38)
  assert.equal(ENVIRONMENT.marsAtmosphericPressureEarthFraction, 0.006)
  assert.deepEqual(ENVIRONMENT.marsCommunicationDelayMinutes, { min: 3, max: 22 })
  assert.equal(getSolarOutputKw('moon'), 15)
  assert.equal(getSolarOutputKw('mars'), 7)
  assert.equal(getSolarGenerationKwh('moon', 18, 1), 15 * POWER_SYSTEM.energyBudgetHoursPerCycle)
  assert.ok(Math.abs(getSolarGenerationKwh('mars', 18, 1, 0.9) - 0.7 * POWER_SYSTEM.energyBudgetHoursPerCycle) < 1e-10)
  assert.equal(getEnergyCapacity(initialGameState('moon', 2, 'Battery Test')), 200)
  assert.equal(getSurvivalPowerLoadKw(), 27)
  assert.equal(getSurvivalBatteryRuntimeHours(), 200 / 27)
})

test('provides the specified mission-duration crew rosters and role counts', () => {
  assert.deepEqual(getAllowedCrewSizes('moon', 10), [2, 3, 4])
  assert.deepEqual(getAllowedCrewSizes('moon', 30), [4, 6, 8])
  assert.deepEqual(getAllowedCrewSizes('mars', 10), [4])
  assert.deepEqual(getAllowedCrewSizes('mars', 60), [6, 9, 12])
  for (const roster of CREW_ROSTERS) {
    assert.equal(roster.assignments.reduce((sum, assignment) => sum + assignment.count, 0), roster.crewSize)
    assert.equal(getCrewRoster(roster.destination, roster.missionLength === 'short' ? 10 : 30, roster.crewSize), roster)
  }
})

test('mission operations enforce prerequisites, steps, setback, and failure timers', () => {
  const initial = prepareSurfaceMission(initialGameState('mars', 4, 'Field Operations', 19, { maxDays: 10 }))
  const expeditionReady = {
    ...initial,
    buildings: [...initial.buildings, 'pressurized-rover', 'drilling-tools', 'mass-spectrometer'],
  }
  assert.equal(canStartOperation(expeditionReady, 'science-expedition'), true)
  let expedition = startOperation(expeditionReady, 'science-expedition')
  for (let step = 0; step < 5; step += 1) expedition = advanceOperation(expedition)
  assert.equal(expedition.activeOperation?.status, 'complete')
  assert.equal(expedition.science, 10)
  const stormAborted = advanceOperation({
    ...startOperation(expeditionReady, 'science-expedition'),
    dustStormDaysRemaining: 3,
  })
  assert.equal(stormAborted.activeOperation?.status, 'failed')

  const constructionInitial = prepareSurfaceMission(initialGameState('mars', 9, 'Remote Construction', 23, { maxDays: 30 }))
  const constructionReady = { ...constructionInitial, buildings: [...constructionInitial.buildings, 'workshop', 'robotics-unit', 'isru'] }
  let construction = startOperation(constructionReady, 'construction')
  construction = advanceOperation(construction)
  assert.equal(construction.activeOperation?.step, 0)
  construction = setOperationSiteDistance(construction, 100)
  construction = advanceOperation(construction)
  assert.equal(construction.activeOperation?.step, 1)
  construction = advanceOperation(construction)
  assert.equal(construction.activeOperation?.cyclesRemaining, 2)
  construction = advanceOperation(construction)
  assert.equal(construction.activeOperation?.step, 2)
  construction = advanceOperationCycle(advanceOperationCycle(construction))
  assert.equal(construction.activeOperation?.cyclesRemaining, 0)
  construction = advanceOperation(construction)
  assert.equal(construction.activeOperation?.step, 3)
  construction = advanceOperation(construction)
  assert.equal(construction.activeOperation?.status, 'complete')

  const maintenanceReady = { ...initial, buildings: [...initial.buildings, 'workshop'] }
  let maintenance = startOperation(maintenanceReady, 'maintenance')
  assert.equal(maintenance.resources.cargo, maintenanceReady.resources.cargo - 5)
  for (let cycle = 0; cycle < 3; cycle += 1) maintenance = advanceOperationCycle(maintenance)
  assert.equal(maintenance.activeOperation?.status, 'failed')
  assert.equal(maintenance.activeOperation?.partialDamage, true)

  let repaired = startOperation({ ...maintenanceReady, ongoingLeak: true }, 'maintenance')
  for (let step = 0; step < 5; step += 1) repaired = advanceOperation(repaired)
  assert.equal(repaired.activeOperation?.status, 'complete')
  assert.equal(repaired.ongoingLeak, false)

  const rescueBase = prepareSurfaceMission(initialGameState('moon', 3, 'Rescue Mission', 29, { maxDays: 10 }))
  const rescueReady = {
    ...rescueBase,
    buildings: [...rescueBase.buildings, 'workshop', 'medical-bay'],
    resources: { ...rescueBase.resources, health: 70 },
    ongoingLeak: true,
  }
  assert.equal(canStartOperation(rescueReady, 'rescue'), true)
  let rescue = startOperation(rescueReady, 'rescue')
  for (let step = 0; step < 6; step += 1) rescue = advanceOperation(rescue)
  assert.equal(rescue.activeOperation?.status, 'complete')
  assert.equal(rescue.totalRescues, 1)
  assert.equal(rescue.resources.health, 80)
  assert.equal(rescue.ongoingLeak, false)
})

test('greenhouse requires treated regolith and balances four-day food, oxygen, water, and power flows', () => {
  const state = initialGameState('moon', 2, 'Botany').buildings
  const base = {
    ...prepareSurfaceMission(initialGameState('moon', 2, 'Botany')),
    buildings: [...state, 'greenhouse', 'reactor', 'isru'],
  }
  const untreated = forecastResources(base, 'maintenance')
  const treated = forecastResources({ ...base, regolithPreTreated: true }, 'maintenance')
  assert.equal(treated.food - untreated.food, GREENHOUSE_CYCLE.foodKg / GREENHOUSE_CYCLE.growthDays)
  assert.ok(GREENHOUSE_CYCLE.foodKg / GREENHOUSE_CYCLE.growthDays >= 2 * FOOD_PER_CREW_DAY)
  assert.ok(Math.abs(
    treated.oxygen - untreated.oxygen - GREENHOUSE_CYCLE.oxygenKg / GREENHOUSE_CYCLE.growthDays,
  ) < 1e-10)
  assert.equal(untreated.water - treated.water, GREENHOUSE_CYCLE.waterLitersPerDay)
  assert.equal(base.regolithPreTreated, false)

  const treatedRegolith = pretreatRegolith({ ...base, resources: { ...base.resources, energy: 10 } })
  assert.equal(treatedRegolith.regolithPreTreated, true)
  assert.equal(treatedRegolith.resources.energy, 10 - GREENHOUSE_CYCLE.regolithTreatmentEnergyKwh)
  assert.equal(getHabitatPressureKpa(base), 101.3)
  assert.equal(getHabitatPressureKpa({ ...base, ongoingLeak: true }), 75)
})

test('enforces construction phase prerequisites for each destination', () => {
  const initial = prepareSurfaceMission(initialGameState('mars', 2, 'Phased Base'))
  assert.equal(canBuild(initial, 'command-center'), true)
  assert.equal(canBuild({ ...initial, buildings: initial.buildings.filter((id) => id !== 'landing-pad') }, 'command-center'), false)
  const phaseTwo = { ...initial, buildings: [...initial.buildings, 'command-center', 'storage', 'communications'] }
  assert.equal(canBuild(phaseTwo, 'workshop'), true)
  assert.equal(canBuild(phaseTwo, 'reactor'), false)
  const phaseThree = {
    ...phaseTwo,
    buildings: [...phaseTwo.buildings, 'workshop', 'research-lab', 'medical-bay', 'isru'],
    regolithPreTreated: true,
  }
  assert.equal(canBuild(phaseThree, 'reactor'), true)
  assert.equal(canBuild(phaseThree, 'greenhouse'), true)
})

test('activates survival power at 27 kW and restores only loads it shut down', () => {
  const initial = prepareSurfaceMission(initialGameState('moon', 2, 'Backup Grid'))
  const productive = {
    ...initial,
    buildings: [...initial.buildings, 'greenhouse', 'workshop'],
    offlineBuildings: ['greenhouse'],
  }
  const survival = setEmergencyLevel(productive, 3)
  assert.equal(survival.survivalMode, true)
  assert.equal(survival.emergencyLevel, 3)
  assert.equal(getPowerLoadKw(survival), 27)
  assert.deepEqual(survival.survivalModeOfflineBuildings, ['workshop'])
  const restored = setEmergencyLevel(survival, 0)
  assert.equal(restored.survivalMode, false)
  assert.deepEqual(restored.offlineBuildings, ['greenhouse'])
  assert.equal(restored.emergencyLevel, 0)
})

test('balances modeled kW-rated generation against kWh reserves without mixing output types', () => {
  const initial = initialGameState('moon', 2, 'Power Ledger')
  const fullCharge = { ...initial.resources, energy: 100 }
  const solarOnly = forecastResources({ ...initial, resources: fullCharge })
  assert.equal(solarOnly.energy, 99.68)

  const reactorAndSolar = forecastResources({
    ...initial,
    buildings: [...initial.buildings, 'reactor'],
    resources: fullCharge,
  })
  assert.ok(Math.abs(reactorAndSolar.energy - 100.25) < 1e-10)

  const lunarNight = forecastResources({
    ...initial,
    day: 15,
    resources: fullCharge,
  })
  assert.ok(Math.abs(lunarNight.energy - 99.3) < 1e-10)
})

test('automatically sheds only nonessential loads at low reserves and restores them with hysteresis', () => {
  const base = initialGameState('mars', 2, 'Automatic Load Shed')
  const stressed = {
    ...base,
    buildings: [...base.buildings, 'workshop', 'research-lab', 'robotics-unit', 'greenhouse', 'isru'],
    offlineBuildings: ['robotics-unit'],
    resources: { ...base.resources, energy: 20, water: 10 },
  }
  const shed = updateAutomaticLoadShed(stressed)
  assert.deepEqual(shed.autoShedBuildings, ['workshop', 'research-lab'])
  assert.deepEqual(shed.offlineBuildings, ['robotics-unit', 'workshop', 'research-lab'])
  assert.ok(!shed.offlineBuildings.includes('greenhouse'))
  assert.ok(!shed.offlineBuildings.includes('isru'))

  const restored = updateAutomaticLoadShed({
    ...stressed,
    ...shed,
    resources: { ...stressed.resources, energy: 120, oxygen: 50, water: 50, food: 50 },
  })
  assert.deepEqual(restored.autoShedBuildings, [])
  assert.deepEqual(restored.offlineBuildings, ['robotics-unit'])
})

test('models lunar night and seeded Mars dust-storm power reductions', () => {
  assert.equal(isLunarNight(15), true)
  assert.equal(getLunarSurfaceTemperatureCelsius(15), -173)
  assert.equal(isLunarNight(1), false)
  const mars = initialGameState('mars', 2, 'Dust Storm', 42)
  const storm = triggerDustStorm(mars, 4, 0.9)
  assert.equal(storm.dustStormDaysRemaining, 4)
  assert.equal(storm.dustStormSolarLossFraction, 0.9)
  assert.ok(forecastResources(storm).energy < forecastResources(mars).energy)
  assert.equal(triggerDustStorm(initialGameState('moon', 2, 'Not Mars'), 4, 0.9).dustStormDaysRemaining, 0)
})

test('water and food shortages lower health daily, while oxygen starts a six-hour emergency', () => {
  const surface = prepareSurfaceMission(initialGameState('mars', 2, 'ECLSS Emergency'))
  const shortages = {
    ...surface,
    resources: { ...surface.resources, water: 0, food: 0, health: 100 },
  }
  const shortageForecast = forecastResources(shortages, 'maintenance')
  assert.equal(shortageForecast.health, 90)
  const shortageCycle = finishDay(shortages, 'maintenance')
  assert.equal(shortageCycle.isGameOver, false)
  assert.equal(shortageCycle.resources.health, 90)

  const noOxygenProduction = {
    ...surface,
    buildings: [],
    resources: { ...surface.resources, oxygen: 0.5 },
  }
  const oxygenEmergency = finishDay(noOxygenProduction, 'maintenance')
  assert.equal(oxygenEmergency.resources.oxygen, 0)
  assert.equal(oxygenEmergency.oxygenEmergencyHoursRemaining, 6)
  assert.equal(oxygenEmergency.isGameOver, false)

  const firstAction = scheduleActivity({
    ...oxygenEmergency,
    hour: 6,
    oxygenEmergencyHoursRemaining: 6,
  }, 'rest')
  assert.equal(firstAction.oxygenEmergencyHoursRemaining, 4)
  const expired = scheduleActivity(firstAction, 'research')
  assert.equal(expired.isGameOver, true)
  assert.deepEqual(expired.failureCause, { resource: 'oxygen', source: 'daily-operation', action: 'research' })

  const startsAtDepletion = scheduleActivity({
    ...surface,
    hour: 6,
    todayActions: [],
    resources: { ...surface.resources, oxygen: 0 },
    oxygenEmergencyHoursRemaining: null,
  }, 'exercise')
  assert.equal(startsAtDepletion.oxygenEmergencyHoursRemaining, 3.5)
})

test('tracks cumulative radiation in mSv and warns at the 600 mSv career reference', () => {
  const transit = initialGameState('mars', 2, 'Transit Dose')
  assert.equal(forecastRadiationExposure(transit), 1.84 * 0.25)
  const surface = {
    ...transit,
    missionPhase: 'surface' as const,
    radiationExposure: 599.5,
    offlineBuildings: ['storm-shelter'],
  }
  assert.equal(forecastRadiationExposure(surface), 600.14)
  const next = finishDay(surface, 'maintenance')
  assert.equal(next.permanentRadiationDamageWarning, true)
  assert.ok(next.radiationExposure >= ENVIRONMENT.careerRadiationLimitMsv)
})

test('adds transit radiation at the specified daily rate and flags the Mars round-trip dose', () => {
  const initial = initialGameState('mars', 2, 'Transit Radiation')
  const outbound = resolveTransitDecision(initial, 'outbound', 'conservative')
  const outboundDose = estimateTransfer('earth-mars').durationDays * ENVIRONMENT.transitRadiationMsvPerDay
  assert.equal(outbound.radiationExposure, outboundDose)
  assert.equal(outbound.permanentRadiationDamageWarning, false)

  const returning = resolveTransitDecision({
    ...outbound,
    missionPhase: 'return',
  }, 'return', 'conservative')
  const roundTripDose = outboundDose
    + estimateTransfer('mars-earth').durationDays * ENVIRONMENT.transitRadiationMsvPerDay
  assert.equal(returning.radiationExposure, roundTripDose)
  assert.equal(returning.permanentRadiationDamageWarning, true)
})

test('migrates legacy relative resource stores into approximate physical-unit balances', () => {
  const state = initialGameState('mars', 2, 'Legacy Save')
  const migrated = migrateLegacyResourceUnits({
    ...state.resources,
    oxygen: 90,
    water: 60,
    food: 80,
  })

  assert.equal(migrated.energy, state.resources.energy)
  assert.equal(migrated.oxygen, 21.6)
  assert.equal(migrated.water, 70)
  assert.equal(migrated.food, 19.84)
  assert.equal(migrateLegacyResourceUnits({ ...state.resources, food: 1000 }).food, 100)
})

test('converts legacy event effects once to match displayed physical resource units', () => {
  const leakRepair = EVENTS.find((event) => event.id === 'water-leak')?.choices[0]
  const pressureRepair = EVENTS.find((event) => event.id === 'pressure-seal')?.choices[0]
  const greenhouseRepair = EVENTS.find((event) => event.id === 'greenhouse-nutrient')?.choices[0]
  const communications = EVENTS.find((event) => event.id === 'comms-blackout')?.choices[1]

  assert.ok(leakRepair)
  assert.ok(pressureRepair)
  assert.ok(greenhouseRepair)
  assert.ok(communications)
  assert.equal(leakRepair.effects.water, convertLegacyResourceDelta('water', 10))
  assert.equal(pressureRepair.effects.oxygen, convertLegacyResourceDelta('oxygen', -3))
  assert.equal(greenhouseRepair.effects.food, convertLegacyResourceDelta('food', 10))
  assert.equal(leakRepair.effects.energy, -10)
  assert.equal(communications.effects.credits, -30)
})

test('forecast matches daily resolution for scheduled actions without stochastic outcomes', () => {
  const initial = initialGameState('mars', 2, 'Forecast Match')
  const state: GameState = {
    ...initial,
    buildings: [],
    resources: { ...initial.resources, energy: 50, health: 70 },
    fatigue: 85,
    radiationExposure: 59,
  }
  const actions = ['research', 'rest'] as const
  const forecast = forecastResources(state, actions)
  const resolved = finishDay(state, actions).resources

  assert.deepEqual(forecast, resolved)
})

test('research energy is charged once and an ongoing legacy leak uses converted liters', () => {
  const base = initialGameState('mars', 2, 'Resource Accounting')
  const state: GameState = {
    ...base,
    buildings: [],
    resources: { ...base.resources, energy: 50 },
  }
  const withoutResearch = forecastResources(state)
  const withResearch = forecastResources(state, 'research')
  assert.ok(Math.abs(withResearch.energy - (
    withoutResearch.energy - 9 * POWER_SYSTEM.energyBudgetHoursPerCycle
  )) < 0.01)

  const noLeak = forecastResources(state)
  const leak = forecastResources({ ...state, ongoingLeak: true })
  const expectedLeak = Math.round(convertLegacyResourceDelta('water', 5) * 100) / 100
  assert.ok(Math.abs(noLeak.water - leak.water - expectedLeak) < 1e-9)
})

test('requires exercise and work before waiting or sleeping, and limits rest loops', () => {
  let state = initialGameState('moon', 2, 'Timed Mission', 123)
  state = resolveTransitDecision(state, 'outbound', 'conservative')
  const research = scheduleActivity(state, 'research')
  assert.equal(research.hour, 10)
  assert.ok(Math.abs(research.resources.energy - (
    state.resources.energy - 9 * POWER_SYSTEM.energyBudgetHoursPerCycle
  )) < 0.01)
  assert.equal(research.resources.oxygen, state.resources.oxygen - 0.1)
  assert.deepEqual(research.todayActions, ['research'])
  assert.equal(canSleepAndAdvance(research), false)
  assert.equal(waitUntilBedtime(research).hour, 10)
  assert.equal(canSleepAndAdvance({ ...research, hour: 20 }), false)
  const exercised = scheduleActivity(research, 'exercise')
  assert.equal(exercised.hour, 12.5)
  assert.equal(canSleepAndAdvance({ ...exercised, hour: 20 }), true)
  const onceRested = scheduleActivity(exercised, 'rest')
  assert.equal(scheduleActivity(onceRested, 'rest').todayActions.filter((action) => action === 'rest').length, 1)

  const bedtime = { ...exercised, hour: 20 }
  assert.equal(canSleepAndAdvance(bedtime), true)
  const next = sleepAndAdvanceDay(bedtime)
  assert.equal(next.day, 2)
  assert.equal(next.hour, 6)
  assert.deepEqual(next.todayActions, [])
  assert.deepEqual(next.actionHistory, ['research', 'exercise'])
  assert.ok(next.science > 0)

  const coordinated = sleepAndAdvanceDay(bedtime, 'maintenance')
  assert.deepEqual(coordinated.actionHistory, ['research', 'exercise'])
  assert.deepEqual(coordinated.crewSupportActionHistory, ['maintenance'])
})

test('does not allow a completed mission day to advance twice', () => {
  const completed = {
    ...initialGameState('moon', 2, 'Single Shift', 13, { maxDays: 10 }),
    daysSurvived: 10,
    day: 10,
    hour: 20,
    todayActions: ['exercise', 'maintenance'] as GameState['todayActions'],
  }
  assert.equal(canSleepAndAdvance(completed), false)
  assert.equal(sleepAndAdvanceDay(completed), completed)
  assert.equal(finishDay(completed, 'rest'), completed)
})

test('enforces specialist activities and prevents scheduling past end of shift', () => {
  const specialist = {
    ...initialGameState('mars', 3, 'Specialist Mission', 44),
    controlMode: 'specialist' as const,
    controlledRole: 'biologist' as const,
    missionPhase: 'surface' as const,
  }
  assert.equal(canPerformActivity(specialist, 'research'), true)
  assert.equal(canPerformActivity(specialist, 'maintenance'), false)
  assert.equal(scheduleActivity(specialist, 'maintenance').hour, specialist.hour)
  assert.equal(scheduleActivity({ ...specialist, hour: 19 }, 'research').hour, 19)
  assert.equal(recommendSpecialistActivity({ ...specialist, objective: 'science' }), 'research')
  assert.equal(recommendSpecialistActivity({ ...specialist, resources: { ...specialist.resources, water: 10 } }), 'research')
  const greenhouseReady = {
    ...specialist,
    regolithPreTreated: true,
    buildings: [...specialist.buildings, 'command-center', 'storage', 'communications', 'workshop', 'research-lab', 'medical-bay', 'isru'],
  }
  assert.equal(canBuild(greenhouseReady, 'greenhouse'), true)
  assert.equal(canBuild(specialist, 'reactor'), false)
})

test('gives each solo specialist role useful activities and a role-specific recommendation', () => {
  const base = {
    ...initialGameState('moon', 3, 'Solo Crew', 29),
    controlMode: 'specialist' as const,
    missionPhase: 'surface' as const,
    objective: 'exploration' as const,
  }
  const commander = { ...base, controlledRole: 'commander' as const }
  const powerEngineer = { ...base, controlledRole: 'power-engineer' as const, objective: 'science' as const }
  const biologist = { ...base, controlledRole: 'biologist' as const }
  const waterOfficer = { ...base, controlledRole: 'water-officer' as const }

  assert.equal(canPerformActivity(powerEngineer, 'research'), true)
  assert.equal(canPerformActivity(biologist, 'explore'), true)
  assert.equal(canPerformActivity(waterOfficer, 'explore'), true)
  assert.equal(recommendSpecialistActivity(commander), 'explore')
  assert.equal(recommendSpecialistActivity(powerEngineer), 'research')
  assert.equal(recommendSpecialistActivity(biologist), 'explore')
  assert.equal(recommendSpecialistActivity(waterOfficer), 'explore')
  assert.equal(recommendSpecialistActivity({
    ...powerEngineer,
    resources: { ...powerEngineer.resources, energy: 20 },
  }), 'maintenance')
})

test('coordinates a supporting crew activity without automatically repeating the player action', () => {
  const state = {
    ...initialGameState('mars', 3, 'Crew Support', 71),
    controlMode: 'specialist' as const,
    controlledRole: 'biologist' as const,
    missionPhase: 'surface' as const,
    objective: 'science' as const,
    todayActions: ['research'] as GameState['todayActions'],
  }
  assert.equal(recommendCrewSupportAction(state), 'maintenance')
  assert.equal(recommendCrewSupportAction({
    ...state,
    todayActions: [],
    resources: { ...state.resources, water: 20 },
  }), 'maintenance')
  assert.equal(recommendCrewSupportAction({
    ...state,
    fatigue: 75,
    todayActions: [],
  }), 'rest')
})

test('resolves outbound and return flight decisions as separate seeded legs', () => {
  const initial = initialGameState('moon', 2, 'Flight Mission', 55)
  const outbound = resolveTransitDecision(initial, 'outbound', 'efficient')
  assert.equal(outbound.missionPhase, 'surface')
  assert.equal(outbound.transitDecisions.length, 1)
  assert.equal(outbound.resources.energy, initial.resources.energy - 3)
  assert.equal(resolveTransitDecision(outbound, 'outbound', 'conservative'), outbound)

  const returning = {
    ...outbound,
    missionPhase: 'return' as const,
    resources: { ...outbound.resources, energy: 50 },
  }
  const completedLeg = resolveTransitDecision(returning, 'return', 'conservative')
  assert.equal(completedLeg.missionPhase, 'return')
  assert.deepEqual(completedLeg.transitDecisions.map(({ leg }) => leg), ['outbound', 'return'])
  assert.equal(completedLeg.resources.energy, 42)

  const lowEnergy = {
    ...initial,
    resources: { ...initial.resources, energy: 8 },
  }
  const evacuated = resolveTransitDecision(lowEnergy, 'outbound', 'conservative')
  assert.equal(evacuated.missionResult, 'evacuation')
  assert.deepEqual(evacuated.failureCause, {
    resource: 'energy',
    source: 'transit',
    transitLeg: 'outbound',
    transitChoice: 'conservative',
  })
})

test('completes the surface campaign only after the return leg and exposes the debrief state', () => {
  const initial = initialGameState('moon', 2, 'Return Report', 901, { maxDays: 10 })
  const lastSurfaceDay = {
    ...initial,
    missionPhase: 'surface' as const,
    transitDecisions: [{ leg: 'outbound' as const, choice: 'conservative' as const }],
    daysSurvived: initial.maxDays - 1,
    day: initial.maxDays,
    hour: 20,
    todayActions: ['exercise', 'maintenance'] as GameState['todayActions'],
    resources: { ...initial.resources, energy: 100, oxygen: 100, water: 100, food: 100 },
  }
  const readyToReturn = sleepAndAdvanceDay(lastSurfaceDay)
  assert.equal(readyToReturn.missionPhase, 'return')
  assert.equal(readyToReturn.isGameOver, false)
  assert.equal(readyToReturn.daysSurvived, readyToReturn.maxDays)

  const debrief = resolveTransitDecision(readyToReturn, 'return', 'efficient')
  assert.equal(debrief.isGameOver, true)
  assert.equal(debrief.missionResult, 'success')
})

test('completes every destination, difficulty, duration, and transit-profile combination', () => {
  let seed = 4_000
  for (const destination of ['moon', 'mars'] as const) {
    for (const difficulty of ['easy', 'normal', 'hard'] as const) {
      for (const maxDays of [10, 30, 60] as const) {
        for (const outboundChoice of ['conservative', 'efficient'] as const) {
          for (const returnChoice of ['conservative', 'efficient'] as const) {
            let state = resolveTransitDecision(
              initialGameState(destination, 2, 'Scenario Matrix', seed++, {
                maxDays,
                difficulty,
              }),
              'outbound',
              outboundChoice,
            )
            for (let cycle = 0; cycle < maxDays + 2 && !state.isGameOver; cycle += 1) {
              state = state.missionPhase === 'return'
                ? resolveTransitDecision(state, 'return', returnChoice)
                : finishDay(state, 'maintenance')
            }
            assert.equal(state.isGameOver, true, `${destination}/${difficulty}/${maxDays}/${outboundChoice}/${returnChoice}`)
            assert.ok(
              state.missionResult === 'success' || state.missionResult === 'evacuation',
              `${destination}/${difficulty}/${maxDays} should finish with a reportable outcome`,
            )
          }
        }
      }
    }
  }
})

test('records decisions for behavior analysis and reports the depleted resource cause', () => {
  const mission = initialGameState('mars', 2, 'Recorded Mission', 22)
  const researched = finishDay(mission, 'research')
  const rested = finishDay(researched, 'rest')
  assert.deepEqual(rested.actionHistory, ['research', 'rest'])
  assert.deepEqual(analyzeMissionBehavior(rested.actionHistory), {
    research: 1,
    explore: 0,
    maintenance: 0,
    exercise: 0,
    rest: 1,
  })

  const lowHealth = {
    ...mission,
    resources: { ...mission.resources, health: 0 },
  }
  const evacuated = finishDay(lowHealth, 'research')
  assert.equal(evacuated.missionResult, 'evacuation')
  assert.deepEqual(evacuated.failureCause, {
    resource: 'health',
    source: 'daily-operation',
    action: 'research',
  })
})

test('explains event-response failures while keeping the event and choice linked', () => {
  const mission = initialGameState('moon', 2, 'Event Review', 24)
  const failed = settleAfterEvent({
    ...mission,
    daysSurvived: 1,
    resources: { ...mission.resources, water: 0 },
  }, {
    resource: 'water',
    source: 'event',
    eventId: 'water-leak',
    choiceIndex: 1,
  })
  assert.equal(failed.isGameOver, false)
  assert.equal(failed.failureCause, null)

  test('uses role-specific resource priorities to reach a deterministic team response', () => {
    const state = initialGameState('mars', 3, 'Crew Council', 45)
    const storm = EVENTS.find((event) => event.id === 'solar-storm')
    assert.ok(storm)
    const recommendation = recommendEventResponse(state, storm)

    assert.deepEqual(CREW_ROLES.map((role) => role.id), [
      'commander',
      'power-engineer',
      'biologist',
      'water-officer',
    ])
    assert.equal(recommendation.recommendedIndex, 0)
    assert.deepEqual(Object.values(recommendation.votes), [0, 0, 0, 0])

    const lowHealth = { ...state, resources: { ...state.resources, health: 30 } }
    assert.equal(recommendDailyAction(lowHealth), 'rest')
    assert.equal(recommendDailyAction({ ...state, objective: 'science' }), 'research')
  })

  test('event recommendations account for resource caps, depletion, and ongoing leaks', () => {
    const base = initialGameState('moon', 2, 'Event Advice')
    const lowLight = EVENTS.find((event) => event.id === 'low-light')
    const leak = EVENTS.find((event) => event.id === 'water-leak')
    assert.ok(lowLight)
    assert.ok(leak)

    assert.equal(recommendEventResponse(base, lowLight).recommendedIndex, 0)
    assert.equal(recommendEventResponse({
      ...base,
      resources: { ...base.resources, health: 20 },
    }, lowLight).recommendedIndex, 1)
    assert.equal(recommendEventResponse({
      ...base,
      resources: { ...base.resources, water: 20 },
    }, leak).recommendedIndex, 0)
  })
  assert.equal(failed.missionResult, null)
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
  const solarFlare = initialGameState('mars', 2, 'Solar Base', 20, { scenario: 'solar-flare' })
  const habitatLeak = initialGameState('mars', 2, 'Habitat Base', 20, { scenario: 'habitat-leak' })
  const greenhouseFault = initialGameState('mars', 2, 'Greenhouse Base', 20, { scenario: 'greenhouse-fault' })

  assert.equal(dust.resources.energy, 62)
  assert.equal(rationed.resources.water, 58)
  assert.equal(oxygenShort.resources.oxygen, 58)
  assert.equal(solarFlare.resources.health, 82)
  assert.equal(habitatLeak.resources.oxygen, 66)
  assert.equal(greenhouseFault.resources.food, 62)
  assert.ok(forecastResources(dust).energy < forecastResources(baseline).energy)
  assert.ok(forecastResources(rationed).water < forecastResources(baseline).water)
  for (const scenario of ['solar-flare', 'habitat-leak', 'greenhouse-fault'] as const) {
    const mission = initialGameState('mars', 2, scenario, 20, { scenario })
    const eventCounts = Array.from({ length: 1200 }, (_, index) => chooseEvent({ ...mission, day: index + 1 }))
      .filter((id) => id && {
        'solar-flare': ['solar-storm', 'low-light', 'panel-dust'],
        'habitat-leak': ['pressure-seal', 'water-leak', 'comms-blackout'],
        'greenhouse-fault': ['crop-failure', 'greenhouse-nutrient', 'water-contamination'],
      }[scenario].includes(id)).length
    assert.ok(eventCounts > 20, `${scenario} should make its related incidents more likely`)
  }
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

test('keeps surprise events from recurring within the same 30-day period', () => {
  const initial = initialGameState('mars', 2, 'Event Cadence', 138, {
    maxDays: 60,
    difficulty: 'hard',
  })
  const history: GameState['eventHistory'] = []
  let eventCount = 0

  for (let day = 1; day <= 60; day += 1) {
    const eventId = chooseEvent({ ...initial, day, eventHistory: history })
    if (!eventId) continue
    eventCount += 1
    const previousEvents = history.filter((entry) => entry.eventId === eventId)
    assert.ok(previousEvents.every((entry) => Math.floor((entry.day! - 1) / 30) < Math.floor((day - 1) / 30)))
    assert.ok(previousEvents.every((entry) => day - entry.day! >= 7))
    history.push({ eventId, choiceIndex: 0, day })
  }

  assert.ok(eventCount > 0, 'the seeded mission should generate events to validate the recurrence policy')
})

test('limits selectable crew roles to crew size in priority order', () => {
  assert.deepEqual(getAvailableCrewRoles(2).map((role) => role.id), ['commander', 'power-engineer'])
  assert.deepEqual(getAvailableCrewRoles(3).map((role) => role.id), ['commander', 'power-engineer', 'biologist'])
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
  const initial = initialGameState('moon', 2, 'Tutorial Base', 17, {
    maxDays: 10,
    objective: 'tutorial',
  })
  let state = {
    ...initial,
    buildings: [...initial.buildings, 'command-center', 'storage', 'communications', 'workshop', 'research-lab', 'medical-bay', 'isru'],
    resources: { ...initial.resources, energy: 200 },
  }
  assert.equal(getObjectiveTarget(state), 5)
  state = recordTutorialStep(state, 'rest')
  assert.equal(getObjectiveProgress(state), 0)
  state = recordTutorialStep(state, 'forecast')
  state = finishDay(state, 'maintenance')
  state = pretreatRegolith(state)
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

test('maintenance reduces habitat power draw without changing life-support mass flow', () => {
  const state = { ...initialGameState('moon', 2, 'Lunar Base'), day: 15 }
  const ordinary = forecastResources(state)
  const maintained = forecastResources(state, 'maintenance')
  assert.ok(maintained.energy > ordinary.energy)
  assert.equal(maintained.water, ordinary.water)
  assert.equal(maintained.food, ordinary.food)
})

test('crew metabolic oxygen demand is mass-based and research adds a small activity demand', () => {
  const state = initialGameState('mars', 2, 'Research Base')
  const next = finishDay(state, 'research')
  assert.ok(next.resources.energy < state.resources.energy)
  assert.ok(next.resources.oxygen < forecastResources(state).oxygen)
  assert.equal(RESOURCE_RATES.oxygenKgPerCrewDay, 0.84)
  assert.equal(next.science, 15)
})

test('power shortages constrain modeled life-support and greenhouse production', () => {
  const base = {
    ...initialGameState('mars', 2, 'Power Limited Base'),
    buildings: ['solar-panels', 'life-support', 'greenhouse', 'water-recycler'],
    regolithPreTreated: true,
  }
  const lowPower = {
    ...base,
    resources: { ...base.resources, energy: 0, oxygen: 50, food: 50 },
  }
  const amplePower = {
    ...base,
    resources: { ...base.resources, energy: 100, oxygen: 50, food: 50 },
  }

  assert.ok(forecastResources(lowPower).oxygen < forecastResources(amplePower).oxygen)
  assert.ok(forecastResources(lowPower).food < forecastResources(amplePower).food)
})

test('rest supports gradual crew recovery without inventing extra food demand', () => {
  const initial = initialGameState('moon', 2, 'Rest Base')
  const state = { ...initial, resources: { ...initial.resources, health: 50 } }
  const resting = forecastResources(state, 'rest')
  const ordinary = forecastResources(state)
  assert.ok(resting.health > ordinary.health)
  assert.equal(resting.food, ordinary.food)
})

test('lunar solar generation follows the synodic light and dark cycle', () => {
  assert.equal(getSolarAvailabilityFactor('moon', 1), 1)
  assert.equal(getSolarAvailabilityFactor('moon', 15), 0)
  assert.equal(getSolarAvailabilityFactor('mars', 1), 1)
  const baseline = {
    ...initialGameState('moon', 2, 'Baseline'),
    day: 1,
    resources: { ...initialGameState('moon', 2, 'Baseline').resources, energy: 20 },
  }
  assert.ok(Math.abs(
    forecastResources({ ...baseline, scenario: 'dust-front' }).energy -
    (forecastResources(baseline).energy - 5 * POWER_SYSTEM.energyBudgetHoursPerCycle),
  ) < 0.01)
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

test('resource forecast weights exploration health loss by risk and includes existing health penalties', () => {
  const moon = initialGameState('moon', 2, 'Moon Forecast', 10)
  const mars = initialGameState('mars', 2, 'Mars Forecast', 10)
  assert.ok(forecastResources(mars, 'explore').health < forecastResources(moon, 'explore').health)

  const vulnerable = {
    ...moon,
    fatigue: 90,
    radiationExposure: 58,
    resources: { ...moon.resources, health: 80 },
  }
  assert.ok(forecastResources(vulnerable, 'explore').health < forecastResources(moon, 'explore').health)
  assert.ok(forecastResources(vulnerable, 'rest').health < forecastResources(moon, 'rest').health)
})

test('an active storm shelter reduces simulated cumulative radiation exposure', () => {
  const base = initialGameState('mars', 2, 'Radiation Base', 12)
  const withoutShelter = { ...base, buildings: base.buildings.filter((id) => id !== 'storm-shelter') }
  const withShelter = { ...withoutShelter, buildings: [...withoutShelter.buildings, 'storm-shelter'] }
  assert.ok(forecastRadiationExposure(withShelter) < forecastRadiationExposure(withoutShelter))
  assert.ok(forecastRadiationExposure({ ...withShelter, offlineBuildings: ['storm-shelter'] }) > forecastRadiationExposure(withShelter))
})

test('storm shelter response is only available while the shelter is online', () => {
  const initial = initialGameState('mars', 2, 'Shelter Base')
  const state = { ...initial, buildings: initial.buildings.filter((id) => id !== 'storm-shelter') }
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
  const mars = prepareSurfaceMission(initialGameState('mars', 2, 'Mars Base'))
  const phaseTwoReady = { ...mars, buildings: [...mars.buildings, 'command-center', 'storage', 'communications'] }
  assert.equal(canBuild(phaseTwoReady, 'moxie'), true)
  assert.equal(canBuild(prepareSurfaceMission(initialGameState('moon', 2, 'Moon Base')), 'moxie'), false)
})

test('charges credits, cargo, and energy when a structure is built', () => {
  const initial = prepareSurfaceMission(initialGameState('moon', 2, 'Base'))
  const state = {
    ...initial,
    buildings: [...initial.buildings, 'command-center', 'storage', 'communications', 'workshop', 'research-lab', 'medical-bay', 'isru'],
    regolithPreTreated: true,
  }
  const next = buildInState(state, 'greenhouse')
  assert.ok(next.buildings.includes('greenhouse'))
  assert.equal(next.resources.credits, state.resources.credits - 90)
  assert.equal(next.resources.cargo, state.resources.cargo - 18)
  assert.equal(next.resources.energy, state.resources.energy - 7)
  assert.equal(next.hour, state.hour + 2)
})

test('rejects a build when the base cannot afford its cargo', () => {
  const initial = prepareSurfaceMission(initialGameState('moon', 2, 'Base'))
  const state = { ...initial, resources: { ...initial.resources, cargo: 0 } }
  assert.equal(canBuild(state, 'greenhouse'), false)
  assert.equal(buildInState(state, 'greenhouse').buildings.includes('greenhouse'), false)
})

test('taking a facility offline removes its output and operating costs', () => {
  const initial = prepareSurfaceMission(initialGameState('moon', 2, 'Systems Base'))
  const state = { ...initial, day: 7, resources: { ...initial.resources, energy: 50 } }
  const before = forecastResources(state)
  const offline = toggleBuildingInState(state, 'solar-panels')
  const after = forecastResources(offline)

  assert.deepEqual(offline.offlineBuildings, ['solar-panels'])
  assert.equal(offline.hour, state.hour + 1)
  assert.ok(Math.abs(
    after.energy - (before.energy - 15 * getSolarAvailabilityFactor('moon', 7) * POWER_SYSTEM.energyBudgetHoursPerCycle),
  ) < 0.01)
  assert.equal(canToggleBuilding(offline, 'solar-panels'), true)
  assert.deepEqual(toggleBuildingInState(offline, 'solar-panels').offlineBuildings, [])
})

test('protects the last active oxygen producer from shutdown', () => {
  const state = prepareSurfaceMission(initialGameState('mars', 2, 'Life Support Base'))
  assert.equal(canToggleBuilding(state, 'life-support'), false)
  assert.deepEqual(toggleBuildingInState(state, 'life-support').offlineBuildings, [])
  assert.match(toggleBuildingInState(state, 'life-support').lastMessage, /oxygen-production/)
})

test('completes a 30-day lunar mission with storage, power generation, and life-support recovery', () => {
  let state = prepareSurfaceMission(initialGameState('moon', 2, 'Long Mission'))
  state = {
    ...state,
    buildings: [...state.buildings, 'command-center', 'storage', 'communications', 'workshop', 'research-lab', 'medical-bay', 'isru'],
    regolithPreTreated: true,
  }
  for (const buildingId of ['reactor', 'greenhouse', 'water-recycler', 'storm-shelter']) {
    state = buildInState(state, buildingId)
  }
  while (!state.isGameOver) {
    if (state.missionPhase === 'return') {
      state = resolveTransitDecision(state, 'return', 'conservative')
      continue
    }
    const action = state.daysSurvived % 3 === 2 ? 'rest' : 'maintenance'
    state = finishDay(state, action)
  }
  assert.equal(state.daysSurvived, 30)
  assert.equal(state.missionResult, 'success')
})

test('sustains a 60-cycle lunar campaign across repeated light and dark periods', () => {
  let state = prepareSurfaceMission(initialGameState('moon', 2, 'Extended Lunar Base', 17, { maxDays: 60 }))
  state = {
    ...state,
    buildings: [...state.buildings, 'command-center', 'storage', 'communications', 'workshop', 'research-lab', 'medical-bay', 'isru'],
    regolithPreTreated: true,
  }
  for (const buildingId of ['reactor', 'greenhouse', 'water-recycler', 'storm-shelter']) {
    state = buildInState(state, buildingId)
  }
  while (!state.isGameOver) {
    if (state.missionPhase === 'return') {
      state = resolveTransitDecision(state, 'return', 'conservative')
      continue
    }
    state = finishDay(state, state.daysSurvived % 3 === 2 ? 'rest' : 'maintenance')
  }
  assert.equal(state.daysSurvived, 60)
  assert.equal(state.missionResult, 'success')
  assert.ok(state.resources.energy > 0)
  assert.ok(state.resources.food > 0)
  assert.ok(state.resources.water > 0)
})

test('a selected 10-cycle survival campaign completes after ten operating cycles', () => {
  let state = prepareSurfaceMission(initialGameState('moon', 2, 'Short Mission', 17, { maxDays: 10 }))
  state = {
    ...state,
    buildings: [...state.buildings, 'command-center', 'storage', 'communications', 'workshop', 'research-lab', 'medical-bay', 'isru', 'reactor'],
    regolithPreTreated: true,
  }
  for (const buildingId of ['greenhouse', 'water-recycler', 'storm-shelter']) {
    state = buildInState(state, buildingId)
  }
  while (!state.isGameOver) {
    if (state.missionPhase === 'return') {
      state = resolveTransitDecision(state, 'return', 'conservative')
      continue
    }
    state = finishDay(state, state.daysSurvived % 3 === 2 ? 'rest' : 'maintenance')
  }
  assert.equal(state.daysSurvived, 10)
  assert.equal(state.missionResult, 'success')
  assert.equal(isObjectiveComplete(state), true)
})

test('evacuates the crew when a life-support resource reaches zero', () => {
  const initial = initialGameState('mars', 2, 'Emergency Base')
  const state = { ...initial, resources: { ...initial.resources, health: 0 } }
  const next = finishDay(state, 'research')
  assert.equal(next.isGameOver, true)
  assert.equal(next.missionResult, 'evacuation')
})
