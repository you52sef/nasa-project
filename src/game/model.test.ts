import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildInState,
  acknowledgeEveningDebrief,
  canPerformActivity,
  canSleepAndAdvance,
  calculateMissionScore,
  canControlFlight,
  canControlEmergencyLevel,
  analyzeMissionBehavior,
  canBuild,
  canToggleBuilding,
  convertLegacyResourceDelta,
  DIFFICULTY_MODIFIERS,
  getCrewDailyEclssBalance,
  getCrewPersonality,
  getCrewRoleEfficiency,
  getActivityDurationHours,
  getCompletedWorkShifts,
  getEnergyCapacity,
  getSupplyCapacity,
  getSurfaceSupplyTargets,
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
  getMarsCommunicationDelayMinutes,
  getSurfaceAtmosphericPressureKpa,
  getExplorationRisk,
  getRoleIneligibleMessage,
  formallyReassignCrewSpecialty,
  getObjectiveProgress,
  getObjectiveTarget,
  initialGameState,
  migrateLegacyResourceUnits,
  RESOURCE_RATES,
  resolveAutomaticTransitDecision,
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
import { estimateTransfer, SIMULATED_TRANSIT_DAYS } from './flightPhysics'
import { GREENHOUSE_CYCLE } from './constants'
import { advanceCabinEnvironment, INITIAL_CABIN_ENVIRONMENT } from './environmentEngine'
import { getConstructionDurationHours } from './buildings'
import { CREW_DUTIES, CREW_ROSTERS, getAllowedCrewSizes, getCrewRoster } from './crewRosters'
import { advanceOperation, canControlOperation, canStartOperation, getOperationReadiness, startOperation, advanceOperationCycle, setOperationSiteDistance } from './operations'
import { canChooseEventOption, chooseEvent, EVENTS } from './events'
import { evaluateCrewRequest, recommendDailyAction, recommendCrewSupportAction, recommendEventResponse, recommendSpecialistActivity, respondToCrewRequest, CREW_ROLES, getAccessibleMissionPanels, getAllowedSpecialistActions, getAstronautDutyProgress, getEveningBriefing, getAvailableCrewRoles, getMissionCrewAssignments } from './teamwork'

const prepareSurfaceMission = (state: GameState) => {
  const commandDuty = getMissionCrewAssignments(state.crewSize, state.destination, state.maxDays, state.crewSpecialtyOverrides)
    .find((assignment) => ['command', 'pilot'].includes(assignment.specialty))
  const flightReady = commandDuty ? { ...state, controlledDutyId: commandDuty.id } : state
  return resolveTransitDecision(flightReady, 'outbound', 'conservative')
}
const prepareMaintenanceMission = (state: GameState) => {
  const assignments = getMissionCrewAssignments(state.crewSize, state.destination, state.maxDays, state.crewSpecialtyOverrides)
  const engineer = assignments.find((assignment) => assignment.specialty !== 'command' && assignment.specialty !== 'pilot')
  assert.ok(engineer, 'Expected an additional crew member for the maintenance role.')
  const commandState = selectCrewSpecialty(state, 'command')
  const reassignedState = {
    ...commandState,
    crewSpecialtyOverrides: { ...commandState.crewSpecialtyOverrides, [engineer.id]: 'engineering' as const },
  }
  return selectCrewSpecialty(prepareSurfaceMission(reassignedState), 'engineering')
}
const selectCrewSpecialty = (state: GameState, specialty: string): GameState => {
  const assignments = getMissionCrewAssignments(state.crewSize, state.destination, state.maxDays, state.crewSpecialtyOverrides)
  const matching = assignments.filter((assignment) => assignment.specialty === specialty)
  const duty = (specialty === 'command'
    ? matching.find((assignment) => /\b(pilot|navigator)\b/i.test(assignment.title))
    : undefined) || matching[0]
  assert.ok(duty, `Expected mission roster to include ${specialty}`)
  return { ...state, controlledDutyId: duty.id, astronautDutyId: duty.id }
}

test('creates a 30-cycle mission with the selected crew and destination', () => {
  const state = initialGameState('mars', 3, 'Hope Base')
  assert.equal(state.maxDays, 30)
  assert.equal(state.destination, 'mars')
  assert.equal(state.crewSize, 3)
  assert.equal(state.baseName, 'Hope Base')
  assert.equal(initialGameState('moon', 2, 'Lunar Colony', 2, { maxDays: 180 }).maxDays, 180)
})

test('uses the requested compressed transit windows and restricts specialist flight control', () => {
  assert.deepEqual(SIMULATED_TRANSIT_DAYS, { moon: 2, mars: 6 })
  const specialist = initialGameState('mars', 4, 'Flight Crew', 101, {
    controlMode: 'specialist',
    controlledRole: 'water-officer',
  })
  const blocked = resolveTransitDecision(specialist, 'outbound', 'efficient')
  assert.equal(blocked.missionPhase, 'outbound')
  assert.equal(blocked.transitDecisions.length, 0)
  assert.match(blocked.lastMessage, /Commander\/Pilot/)
  const unassignedPilot = initialGameState('mars', 4, 'Systems Crew', 102, {
    controlMode: 'specialist',
    controlledDutyId: 'systems-engineer-1',
  })
  assert.equal(canControlFlight(unassignedPilot), false)
  assert.equal(resolveTransitDecision(unassignedPilot, 'outbound', 'conservative').missionPhase, 'outbound')
  assert.equal(resolveAutomaticTransitDecision(unassignedPilot, 'outbound').transitDecisions[0]?.choice, 'conservative')
  const assignedPilot = initialGameState('moon', 4, 'Pilot Crew', 103, {
    maxDays: 30,
    controlMode: 'specialist',
    controlledDutyId: 'pilot-1',
  })
  assert.equal(canControlFlight(assignedPilot), true)
  assert.equal(initialGameState('moon', 6, 'Settlement', 104, { missionType: 'moon-settlement' }).maxDays, 180)
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
  assert.equal(getConstructionDurationHours('greenhouse', 'moon'), 18)
  assert.equal(getConstructionDurationHours('habitat', 'moon'), 24)
  assert.equal(getConstructionDurationHours('habitat', 'mars'), 48)
  assert.equal(getConstructionDurationHours('solar-panels', 'moon'), 3)
  assert.equal(getConstructionDurationHours('reactor', 'mars'), 8)
  assert.equal(getConstructionDurationHours('battery', 'moon'), 4)
  assert.equal(getConstructionDurationHours('isru', 'moon'), 28)
  assert.equal(getConstructionDurationHours('isru', 'mars'), 36)
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
  const marsCrewBalance = getCrewDailyEclssBalance(1, 'normal', true, true, 'mars')
  assert.ok(marsCrewBalance.oxygenConsumedKg > medium.oxygenConsumedKg)
  assert.ok(Math.abs(marsCrewBalance.oxygenConsumedKg - medium.oxygenConsumedKg * 24.65 / 24) < 1e-10)
})

test('defines destination conditions and survival power values', () => {
  assert.equal(ENVIRONMENT.moonGravityEarthG, 0.165)
  assert.equal(ENVIRONMENT.marsGravityEarthG, 0.38)
  assert.equal(ENVIRONMENT.marsAtmosphericPressureEarthFraction, 0.006)
  assert.ok(Math.abs(getSurfaceAtmosphericPressureKpa('mars') - 101.3 * 0.006) < 1e-10)
  assert.deepEqual(ENVIRONMENT.marsCommunicationDelayMinutes, { min: 3, max: 22 })
  const marsBase = initialGameState('mars', 2, 'Latency Test', 123)
  const delay = getMarsCommunicationDelayMinutes(marsBase.missionSeed, marsBase.day, 'research')
  assert.ok(delay >= 3 && delay <= 22)
  assert.equal(getActivityDurationHours(marsBase, 'research'), 4 + delay / 60)
  assert.equal(getActivityDurationHours(marsBase, 'exercise'), 2.5)
  assert.equal(getSolarOutputKw('moon'), 15)
  assert.equal(getSolarOutputKw('mars'), 7)
  assert.equal(POWER_SYSTEM.reactorOutputKw, 25)
  assert.equal(POWER_SYSTEM.batteryCapacityKwh, 200)
  assert.equal(POWER_SYSTEM.operatingLoadsKw.habitat, 15)
  assert.equal(POWER_SYSTEM.operatingLoadsKw.isru, 35)
  assert.equal(POWER_SYSTEM.operatingLoadsKw.greenhouse, 20)
  assert.equal(getSolarGenerationKwh('moon', 18, 1), 15 * POWER_SYSTEM.energyBudgetHoursPerCycle)
  assert.ok(Math.abs(getSolarGenerationKwh('mars', 18, 1, 0.9) - 0.7 * POWER_SYSTEM.energyBudgetHoursPerCycle) < 1e-10)
  assert.equal(getEnergyCapacity(initialGameState('moon', 2, 'Battery Test')), 200)
  assert.equal(getSurvivalPowerLoadKw(), 27)
  assert.equal(getSurvivalBatteryRuntimeHours(), 200 / 27)
})

test('provides the specified mission-duration crew rosters and role counts', () => {
  const crewSizes = Array.from({ length: 11 }, (_, index) => index + 2)
  assert.deepEqual(getAllowedCrewSizes('moon', 10), [2, 3, 4])
  assert.deepEqual(getAllowedCrewSizes('moon', 180), [4, 6, 8])
  assert.deepEqual(getAllowedCrewSizes('mars', 30), [4])
  assert.deepEqual(getAllowedCrewSizes('mars', 180), [6, 9, 12])
  for (const crewSize of [9, 12]) {
    const commandDuties = getMissionCrewAssignments(crewSize, 'mars', 180)
      .filter((duty) => duty.specialty === 'command')
    assert.equal(commandDuties.length, 2)
    assert.ok(commandDuties.some((duty) => duty.title.includes('Co-Commander')))
  }
  for (const roster of CREW_ROSTERS) {
    assert.equal(roster.assignments.reduce((sum, assignment) => sum + assignment.count, 0), roster.crewSize)
    assert.equal(getCrewRoster(roster.destination, roster.missionLength === 'short' ? 10 : 180, roster.crewSize), roster)
    assert.ok(getAllowedCrewSizes(roster.destination, roster.missionLength === 'short' ? 10 : 180).includes(roster.crewSize))
    for (const assignment of roster.assignments) {
      assert.ok(CREW_DUTIES[assignment.title], `Missing job description for ${assignment.title}`)
    }
    const duties = getMissionCrewAssignments(roster.crewSize, roster.destination, roster.missionLength === 'short' ? 10 : 180)
    assert.equal(duties.length, roster.crewSize)
    assert.equal(new Set(duties.map((duty) => duty.id)).size, roster.crewSize)
  }
  for (const destination of ['moon', 'mars'] as const) {
    for (const size of crewSizes) {
      const roster = getCrewRoster(destination, 180, size)
      assert.equal(roster?.assignments.reduce((sum, assignment) => sum + assignment.count, 0), size)
    }
  }
})

test('mission operations enforce prerequisites, steps, setback, and failure timers', () => {
  const initial = prepareSurfaceMission(selectCrewSpecialty(initialGameState('mars', 4, 'Field Operations', 19, { maxDays: 10 }), 'command'))
  const expeditionReady = {
    ...initial,
    buildings: [...initial.buildings, 'pressurized-rover', 'drilling-tools', 'mass-spectrometer'],
  }
  const expeditionController = selectCrewSpecialty(expeditionReady, 'science')
  assert.equal(canStartOperation(expeditionController, 'science-expedition'), true)
  assert.deepEqual(getOperationReadiness(expeditionController, 'science-expedition'), { ready: true, blocker: null })
  const geologist = getMissionCrewAssignments(expeditionReady.crewSize, expeditionReady.destination, expeditionReady.maxDays)
    .find((duty) => duty.specialty === 'science')
  const engineer = getMissionCrewAssignments(expeditionReady.crewSize, expeditionReady.destination, expeditionReady.maxDays)
    .find((duty) => duty.specialty === 'engineering')
  assert.ok(geologist)
  assert.ok(engineer)
  assert.deepEqual(getOperationReadiness({
    ...expeditionController,
    crewSpecialtyOverrides: { ...expeditionReady.crewSpecialtyOverrides, [engineer.id]: 'communications' },
    crewConditions: { ...expeditionReady.crewConditions, [geologist.id]: { health: 100, fatigue: 95, stress: 0, morale: 78 } },
  }, 'science-expedition'), { ready: false, blocker: 'specialist-unavailable' })
  assert.equal(getOperationReadiness({ ...expeditionController, offlineBuildings: ['mass-spectrometer'] }, 'science-expedition').blocker, 'facility')
  let expedition = startOperation(expeditionController, 'science-expedition')
  assert.match(expedition.log.at(-1) || '', /launched; telemetry online/)
  for (let step = 0; step < 5; step += 1) expedition = advanceOperation(expedition)
  assert.equal(expedition.activeOperation?.status, 'complete')
  assert.equal(expedition.science, 10)
  assert.match(expedition.log.at(-1) || '', /telemetry · 5\/5 · operation complete/)
  const stormAborted = advanceOperation({
    ...startOperation(expeditionController, 'science-expedition'),
    dustStormDaysRemaining: 3,
  })

  test('outbound landing provisions crew-scaled surface survival reserves from lander cargo', () => {
    const outbound = selectCrewSpecialty(initialGameState('mars', 4, 'Supply Landing', 719, { maxDays: 10 }), 'command')
    const landed = resolveTransitDecision(outbound, 'outbound', 'conservative')
    assert.equal(landed.missionPhase, 'surface')
    assert.equal(landed.isGameOver, false)
    assert.deepEqual(
      { oxygen: landed.resources.oxygen, water: landed.resources.water, food: landed.resources.food },
      getSurfaceSupplyTargets(4, landed.scenario),
    )
    assert.equal(landed.resources.oxygen, 50)
    assert.equal(landed.resources.water, 150)
    assert.equal(landed.resources.food, 100)
    assert.ok(landed.resources.cargo < outbound.resources.cargo)
    assert.equal(landed.dailyResourceStart.oxygen, 50)
    assert.equal(landed.dailyResourceStart.water, 150)
    assert.equal(landed.dailyResourceStart.food, 100)
    assert.match(landed.log.at(-1) || '', /transferred .* kg O₂/)
    assert.equal(getSupplyCapacity('water', 2), 75)
    assert.equal(getSurfaceSupplyTargets(2, 'water-rationing').water, 37.5)

    const catastrophic = resolveTransitDecision({
      ...outbound,
      resources: { ...outbound.resources, oxygen: 0 },
    }, 'outbound', 'conservative')
    assert.equal(catastrophic.isGameOver, true)
    assert.equal(catastrophic.resources.oxygen, 0)
  })
  assert.equal(stormAborted.activeOperation?.status, 'failed')

  const constructionInitial = prepareSurfaceMission(selectCrewSpecialty(initialGameState('mars', 9, 'Remote Construction', 23, { maxDays: 60 }), 'command'))
  const constructionReady = {
    ...selectCrewSpecialty(constructionInitial, 'power'),
    buildings: [...constructionInitial.buildings, 'workshop', 'robotics-unit', 'isru'],
  }
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

  const maintenanceReady = {
    ...selectCrewSpecialty(initial, 'engineering'),
    buildings: [...initial.buildings, 'workshop'],
  }
  let maintenance = startOperation(maintenanceReady, 'maintenance')
  assert.equal(maintenance.resources.cargo, maintenanceReady.resources.cargo - 5)
  for (let cycle = 0; cycle < 3; cycle += 1) maintenance = advanceOperationCycle(maintenance)
  assert.equal(maintenance.activeOperation?.status, 'failed')
  assert.equal(maintenance.activeOperation?.partialDamage, true)

  let repaired = startOperation({ ...maintenanceReady, ongoingLeak: true }, 'maintenance')
  for (let step = 0; step < 5; step += 1) repaired = advanceOperation(repaired)
  assert.equal(repaired.activeOperation?.status, 'complete')
  assert.equal(repaired.ongoingLeak, false)

  const rescueBase = prepareSurfaceMission(selectCrewSpecialty(
    initialGameState('moon', 3, 'Rescue Mission', 29, { maxDays: 10 }),
    'command',
  ))
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
  const mission = initialGameState('moon', 2, 'Botany')
  const scienceDuty = getMissionCrewAssignments(mission.crewSize, mission.destination, mission.maxDays)
    .find((assignment) => assignment.specialty === 'science-medical')
  assert.ok(scienceDuty)
  const outbound = prepareSurfaceMission(selectCrewSpecialty(mission, 'command'))
  const geologyState = {
    ...outbound,
    crewSpecialtyOverrides: { ...outbound.crewSpecialtyOverrides, [scienceDuty.id]: 'science' as const },
  }
  const surface = selectCrewSpecialty(geologyState, 'science')
  const state = mission.buildings
  const base = {
    ...surface,
    buildings: [...state, 'greenhouse', 'reactor', 'isru'],
    resources: { ...surface.resources, food: 20, oxygen: 10 },
  }
  const untreated = forecastResources(base, 'maintenance')
  const treated = forecastResources({ ...base, regolithPreTreated: true }, 'maintenance')
  assert.ok(Math.abs(treated.food - untreated.food - GREENHOUSE_CYCLE.foodKg / GREENHOUSE_CYCLE.growthDays) < 1e-9)
  assert.ok(GREENHOUSE_CYCLE.foodKg / GREENHOUSE_CYCLE.growthDays >= 2 * FOOD_PER_CREW_DAY)
  assert.ok(Math.abs(
    treated.oxygen - untreated.oxygen - GREENHOUSE_CYCLE.oxygenKg / GREENHOUSE_CYCLE.growthDays,
  ) < 1e-10)
  assert.equal(untreated.water - treated.water, GREENHOUSE_CYCLE.waterLitersPerCycle / GREENHOUSE_CYCLE.growthDays)
  assert.equal(base.regolithPreTreated, false)

  const treatedRegolith = pretreatRegolith({ ...base, resources: { ...base.resources, energy: 100 } })
  assert.equal(treatedRegolith.regolithPreTreated, true)
  assert.equal(treatedRegolith.resources.energy, 100 - GREENHOUSE_CYCLE.regolithTreatmentEnergyKwh)
  assert.equal(getHabitatPressureKpa(base), 101.3)
  assert.equal(getHabitatPressureKpa({ ...base, ongoingLeak: true }), 101.3)
})

test('enforces construction phase prerequisites for each destination', () => {
  const initial = prepareMaintenanceMission(initialGameState('mars', 4, 'Phased Base'))
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
  assert.equal(canBuild(selectCrewSpecialty(phaseThree, 'medical'), 'greenhouse'), true)
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

test('emergency isolation requires qualified duties and remains sealed until cabin recovery', () => {
  const mission = selectCrewSpecialty(initialGameState('moon', 3, 'Pressure Response'), 'command')
  const leakResponse = setEmergencyLevel({ ...mission, ongoingLeak: true }, 2)
  assert.equal(canControlEmergencyLevel(mission, 2), true)
  assert.equal(leakResponse.airlockIsolated, true)
  assert.equal(setEmergencyLevel(leakResponse, 0).airlockIsolated, true)

  const pilotOnly = initialGameState('moon', 4, 'Specialist Response', 31, {
    controlMode: 'specialist',
    controlledDutyId: 'pilot-1',
  })
  assert.equal(canControlEmergencyLevel(pilotOnly, 1), true)
  assert.equal(canControlEmergencyLevel(pilotOnly, 2), true)
  assert.equal(setEmergencyLevel(pilotOnly, 2).emergencyLevel, 2)
})

test('cabin environment advances deterministically and qualified repairs stop the leak', () => {
  const input = {
    ...INITIAL_CABIN_ENVIRONMENT,
    elapsedHours: 1.5,
    crewSize: 3,
    difficulty: 'normal' as const,
    destination: 'moon' as const,
    day: 1,
    action: 'maintenance' as const,
    lifeSupportOnline: true,
    scrubberOnline: true,
    powered: true,
    ongoingLeak: true,
    dustStorm: false,
    fatigue: 25,
    morale: 75,
    shielded: false,
    qualifiedMaintenance: true,
  }
  const repaired = advanceCabinEnvironment(input)
  assert.deepEqual(repaired, advanceCabinEnvironment(input))
  assert.equal(repaired.leakRepaired, true)
  assert.ok(repaired.pressureKpa > 90)
  assert.ok(repaired.scrubberHealth < INITIAL_CABIN_ENVIRONMENT.scrubberHealth)
  assert.ok(repaired.pressureKpa >= 0 && repaired.pressureKpa <= 101.3)
  assert.ok(repaired.co2PartialPressureKpa >= 0 && repaired.co2PartialPressureKpa <= 10)
  assert.ok(repaired.crewStress >= 0 && repaired.crewStress <= 100)
})

test('cabin environment rejects elapsed times that would create an unbounded fixed-step loop', () => {
  assert.throws(
    () => advanceCabinEnvironment({
      ...INITIAL_CABIN_ENVIRONMENT,
      elapsedHours: Number.MAX_VALUE,
      crewSize: 3,
      difficulty: 'normal',
      destination: 'mars',
      day: 1,
      action: 'rest',
      lifeSupportOnline: true,
      scrubberOnline: true,
      powered: true,
      ongoingLeak: false,
      dustStorm: false,
      fatigue: 30,
      morale: 70,
      shielded: false,
      qualifiedMaintenance: false,
    }),
    RangeError,
  )
})

test('cabin environment results do not depend on how elapsed time is partitioned', () => {
  const input = {
    ...INITIAL_CABIN_ENVIRONMENT,
    elapsedHours: 2,
    crewSize: 4,
    difficulty: 'normal' as const,
    destination: 'mars' as const,
    day: 1,
    action: 'rest' as const,
    lifeSupportOnline: true,
    scrubberOnline: true,
    powered: true,
    ongoingLeak: false,
    dustStorm: false,
    fatigue: 35,
    morale: 75,
    shielded: false,
    qualifiedMaintenance: false,
  }
  const whole = advanceCabinEnvironment(input)
  const firstHalf = advanceCabinEnvironment({ ...input, elapsedHours: 1 })
  const secondHalf = advanceCabinEnvironment({
    ...input,
    ...firstHalf,
    elapsedHours: 1,
  })

  for (const key of [
    'pressureKpa',
    'oxygenPartialPressureKpa',
    'co2PartialPressureKpa',
    'temperatureC',
    'scrubberHealth',
    'crewStress',
    'crewPulseBpm',
  ] as const) {
    assert.ok(Math.abs(whole[key] - secondHalf[key]) < 1e-8, `${key} changed with tick partitioning`)
  }
  assert.ok(Math.abs(whole.radiationAddedMsv - firstHalf.radiationAddedMsv - secondHalf.radiationAddedMsv) < 1e-10)
  assert.ok(Math.abs(whole.healthLoss - firstHalf.healthLoss - secondHalf.healthLoss) < 1e-10)
})

test('prolonged unpowered cabin conditions trigger a thermal evacuation rather than an oxygen failure', () => {
  const result = advanceCabinEnvironment({
    ...INITIAL_CABIN_ENVIRONMENT,
    elapsedHours: 24,
    crewSize: 3,
    difficulty: 'normal',
    destination: 'mars',
    day: 1,
    action: 'rest',
    lifeSupportOnline: false,
    scrubberOnline: false,
    powered: false,
    ongoingLeak: false,
    dustStorm: false,
    fatigue: 30,
    morale: 70,
    shielded: false,
    qualifiedMaintenance: false,
  })
  assert.equal(result.fatalReason, 'hypothermia')
  assert.ok(result.temperatureC <= 0)
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

test('automatically sheds nonessential loads at or below fifteen percent battery reserve', () => {
  const base = initialGameState('mars', 2, 'Critical Power')
  const withWorkshop = { ...base, buildings: [...base.buildings, 'workshop'] }
  const critical = updateAutomaticLoadShed({
    ...withWorkshop,
    resources: { ...base.resources, energy: POWER_SYSTEM.batteryCapacityKwh * 0.15 },
  })
  const aboveThreshold = updateAutomaticLoadShed({
    ...withWorkshop,
    resources: { ...base.resources, energy: POWER_SYSTEM.batteryCapacityKwh * 0.15 + 0.01 },
  })

  assert.deepEqual(critical.autoShedBuildings, ['workshop'])
  assert.deepEqual(aboveThreshold.autoShedBuildings, [])
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
  const surface = selectCrewSpecialty(
    prepareSurfaceMission(selectCrewSpecialty(initialGameState('mars', 4, 'ECLSS Emergency'), 'command')),
    'engineering',
  )
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
  const expired = scheduleActivity(selectCrewSpecialty(firstAction, 'medical'), 'research')
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

test('tracks cumulative radiation in mSv and warns at the game-model 600 mSv threshold', () => {
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
  assert.ok(next.radiationExposure >= ENVIRONMENT.gameRadiationWarningThresholdMsv)
})

test('includes fallback radiation in the daily report when a cycle has no timed environment steps', () => {
  const mission = initialGameState('mars', 2, 'Radiation Report')
  const surface = { ...mission, missionPhase: 'surface' as const }
  const next = finishDay(surface, 'maintenance')
  const expectedDose = ENVIRONMENT.marsSurfaceRadiationMsvPerDay * 0.25

  assert.ok(Math.abs(next.radiationExposure - expectedDose) < 1e-10)
  assert.ok(Math.abs(next.dailyReports[0].radiationMsv - expectedDose) < 1e-10)
})

test('adds transit radiation at the specified daily rate and flags the Mars round-trip dose', () => {
  const initial = selectCrewSpecialty(initialGameState('mars', 4, 'Transit Radiation', 1), 'command')
  const outbound = resolveTransitDecision(initial, 'outbound', 'conservative')
  const outboundDose = 6 * ENVIRONMENT.transitRadiationMsvPerDay
  assert.ok(Math.abs(outbound.radiationExposure - outboundDose) < 1e-9)
  assert.ok(outbound.radiationExposure < outboundDose + 6 * 4)
  assert.equal(outbound.permanentRadiationDamageWarning, false)
  assert.equal(outbound.resources.oxygen, getSupplyCapacity('oxygen', initial.crewSize))
  assert.equal(outbound.resources.water, getSupplyCapacity('water', initial.crewSize))
  assert.equal(outbound.resources.food, getSupplyCapacity('food', initial.crewSize))

  const lunarOutbound = resolveTransitDecision(selectCrewSpecialty(initialGameState('moon', 2, 'Lunar Transfer', 1), 'command'), 'outbound', 'efficient')
  assert.ok(Math.abs(lunarOutbound.radiationExposure - 2 * ENVIRONMENT.transitRadiationMsvPerDay) < 1e-9)

  const returning = resolveTransitDecision({
    ...outbound,
    missionPhase: 'return',
  }, 'return', 'conservative')
  const roundTripDose = outboundDose * 2
  assert.ok(Math.abs(returning.radiationExposure - roundTripDose) < 1e-9)
  assert.ok(returning.radiationExposure < roundTripDose + 12 * 4)
  assert.equal(returning.permanentRadiationDamageWarning, false)
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
  const nonFinite = migrateLegacyResourceUnits({
    ...state.resources,
    oxygen: Number.NaN,
    water: Number.POSITIVE_INFINITY,
    food: Number.NEGATIVE_INFINITY,
  })
  assert.deepEqual(
    { oxygen: nonFinite.oxygen, water: nonFinite.water, food: nonFinite.food },
    { oxygen: 0, water: 100, food: 0 },
  )
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
  assert.ok(Math.abs(noLeak.water - leak.water - expectedLeak) < 0.011)
})

test('requires exercise and two work shifts before waiting or sleeping, and limits rest loops', () => {
  let state = initialGameState('moon', 3, 'Timed Mission', 123)
  state = selectCrewSpecialty(state, 'command')
  state = resolveTransitDecision(state, 'outbound', 'conservative')
  state = selectCrewSpecialty(state, 'medical')
  const research = scheduleActivity(state, 'research')
  assert.equal(research.hour, 10)
  const selectedCrewEnergyUse = getCrewPersonality(state, state.controlledDutyId).energyUse
  assert.ok(Math.abs(research.resources.energy - (
    state.resources.energy - 9 * selectedCrewEnergyUse * POWER_SYSTEM.energyBudgetHoursPerCycle
  )) < 0.01)
  assert.ok(Math.abs(research.resources.oxygen - (state.resources.oxygen - 0.1)) < 0.01)
  assert.deepEqual(research.todayActions, ['research'])
  assert.equal(canSleepAndAdvance(research), false)
  assert.equal(waitUntilBedtime(research).hour, 10)
  assert.equal(canSleepAndAdvance({ ...research, hour: 20 }), false)
  const exercised = scheduleActivity(research, 'exercise')
  assert.equal(exercised.hour, 12.5)
  assert.ok(Math.abs(exercised.resources.energy - (research.resources.energy - 1.5 * selectedCrewEnergyUse * POWER_SYSTEM.energyBudgetHoursPerCycle)) < 0.01)
  assert.equal(getCompletedWorkShifts(exercised.todayActions), 1)
  assert.equal(canSleepAndAdvance({ ...exercised, hour: 20 }), false)
  const onceRested = scheduleActivity(exercised, 'rest')
  assert.equal(scheduleActivity(onceRested, 'rest').todayActions.filter((action) => action === 'rest').length, 1)

  const twoShifts = scheduleActivity(selectCrewSpecialty(onceRested, 'engineering-science'), 'maintenance')
  assert.equal(getCompletedWorkShifts(twoShifts.todayActions), 2)
  const bedtime = { ...twoShifts, hour: 20 }
  assert.equal(canSleepAndAdvance(bedtime), true)
  const next = sleepAndAdvanceDay(bedtime)
  assert.equal(next.day, 2)
  assert.equal(next.hour, 6)
  assert.deepEqual(next.todayActions, [])
  assert.deepEqual(next.actionHistory, ['research', 'exercise', 'rest', 'maintenance'])
  assert.ok(next.science > 0)

  const coordinated = sleepAndAdvanceDay(bedtime, 'maintenance')
  assert.deepEqual(coordinated.actionHistory, ['research', 'exercise', 'rest', 'maintenance'])
  assert.equal(coordinated.crewSupportActionHistory.at(-1), 'maintenance')
  assert.equal(coordinated.crewSupportActionHistory.length, coordinated.crewDailyActivities.length + 1)
})

test('does not allow a completed mission day to advance twice', () => {
  const completed = {
    ...initialGameState('moon', 2, 'Single Shift', 13, { maxDays: 10 }),
    daysSurvived: 10,
    day: 10,
    hour: 20,
    todayActions: ['exercise', 'maintenance', 'research'] as GameState['todayActions'],
  }
  assert.equal(canSleepAndAdvance(completed), false)
  assert.equal(sleepAndAdvanceDay(completed), completed)
  assert.equal(finishDay(completed, 'rest'), completed)
})

test('acknowledges an eligible evening debrief once per mission day without bypassing an event', () => {
  const bedtime = {
    ...initialGameState('moon', 3, 'Debrief Gate', 37),
    missionPhase: 'surface' as const,
    transitDecisions: [{ leg: 'outbound' as const, choice: 'conservative' as const }],
    hour: 20,
    todayActions: ['exercise', 'maintenance', 'research'] as GameState['todayActions'],
  }
  const acknowledged = acknowledgeEveningDebrief(bedtime)
  assert.equal(acknowledged.lastDebriefDay, bedtime.day)
  assert.equal(acknowledgeEveningDebrief(acknowledged), acknowledged)
  const emergency = { ...bedtime, activeEvent: { id: 'solar-storm' } }
  assert.equal(acknowledgeEveningDebrief(emergency), emergency)
  assert.equal(acknowledgeEveningDebrief({ ...acknowledged, day: bedtime.day + 1 }).lastDebriefDay, bedtime.day + 1)
})

test('enforces specialist activities and prevents scheduling past end of shift', () => {
  const specialist = {
    ...selectCrewSpecialty(initialGameState('mars', 4, 'Specialist Mission', 44, {
      controlMode: 'specialist',
    }), 'medical'),
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
  const base = initialGameState('mars', 9, 'Solo Crew', 29, {
    maxDays: 180,
    controlMode: 'specialist',
  })
  const commander = selectCrewSpecialty(base, 'command')
  const powerEngineer = selectCrewSpecialty(base, 'power')
  const biologist = selectCrewSpecialty(base, 'medical')
  const geologist = selectCrewSpecialty(base, 'science')

  assert.equal(canPerformActivity(commander, 'explore'), false)
  assert.equal(canPerformActivity(powerEngineer, 'maintenance'), true)
  assert.equal(canPerformActivity(powerEngineer, 'research'), false)
  assert.equal(canPerformActivity(biologist, 'research'), true)
  assert.equal(canPerformActivity(biologist, 'explore'), false)
  assert.equal(canPerformActivity(geologist, 'explore'), true)
  assert.equal(canPerformActivity(geologist, 'research'), false)
  assert.equal(recommendSpecialistActivity(commander), 'exercise')
  assert.equal(recommendSpecialistActivity(powerEngineer), 'maintenance')
  assert.equal(recommendSpecialistActivity(biologist), 'research')
  assert.equal(recommendSpecialistActivity(geologist), 'explore')
  assert.equal(recommendSpecialistActivity({
    ...powerEngineer,
    resources: { ...powerEngineer.resources, energy: 20 },
  }), 'maintenance')
})

test('coordinates a supporting crew activity without automatically repeating the player action', () => {
  const state = {
    ...selectCrewSpecialty(initialGameState('mars', 9, 'Crew Support', 71, {
      maxDays: 180,
      controlMode: 'specialist',
    }), 'medical'),
    missionPhase: 'surface' as const,
    objective: 'science' as const,
    todayActions: ['research'] as GameState['todayActions'],
  }
  assert.equal(recommendCrewSupportAction(state), 'rest')
  assert.equal(recommendCrewSupportAction({
    ...state,
    todayActions: [],
    resources: { ...state.resources, water: 20 },
  }), 'research')
  assert.equal(recommendCrewSupportAction({
    ...state,
    fatigue: 75,
    todayActions: [],
  }), 'rest')
})

test('filters specialist panels and daily activity choices by the selected crew specialty', () => {
  const base = initialGameState('mars', 6, 'Role Filter', 73, {
    maxDays: 180,
    controlMode: 'specialist',
  })
  const duties = getMissionCrewAssignments(base.crewSize, base.destination, base.maxDays)
  const forSpecialty = (specialty: string) => {
    const duty = duties.find((assignment) => assignment.specialty === specialty)
    assert.ok(duty)
    return { ...base, controlledDutyId: duty.id, astronautDutyId: duty.id }
  }

  const commander = forSpecialty('command')
  assert.deepEqual(getAccessibleMissionPanels(commander), ['resources', 'crew', 'systems', 'forecast', 'communications', 'operations'])
  assert.ok(!getAccessibleMissionPanels(commander).includes('infrastructure'))
  const pilotBase = initialGameState('moon', 4, 'Pilot Role Filter', 74, {
    maxDays: 180,
    controlMode: 'specialist',
  })
  const pilotDuty = getMissionCrewAssignments(pilotBase.crewSize, pilotBase.destination, pilotBase.maxDays)
    .find((assignment) => assignment.specialty === 'pilot')
  assert.ok(pilotDuty)
  const pilot = { ...pilotBase, controlledDutyId: pilotDuty.id, astronautDutyId: pilotDuty.id }
  assert.deepEqual(getAccessibleMissionPanels(pilot), ['resources', 'crew', 'systems', 'forecast', 'communications', 'operations'])
  const engineer = forSpecialty('power')
  assert.ok(getAccessibleMissionPanels(engineer).includes('infrastructure'))
  assert.ok(getAccessibleMissionPanels(engineer).includes('systems'))
  assert.ok(getAccessibleMissionPanels(engineer).includes('crew'))
  assert.ok(!getAccessibleMissionPanels(engineer).includes('forecast'))
  assert.ok(!getAccessibleMissionPanels(engineer).includes('communications'))
  const doctor = forSpecialty('medical')
  assert.ok(getAccessibleMissionPanels(doctor).includes('crew'))
  assert.ok(getAccessibleMissionPanels(doctor).includes('systems'))
  assert.ok(getAccessibleMissionPanels(doctor).includes('operations'))
  assert.ok(!getAccessibleMissionPanels(doctor).includes('infrastructure'))
  assert.ok(!getAccessibleMissionPanels(doctor).includes('forecast'))
  assert.ok(!getAccessibleMissionPanels(doctor).includes('communications'))
  const botanist = forSpecialty('agriculture')
  assert.ok(getAccessibleMissionPanels(botanist).includes('operations'))
  assert.ok(getAccessibleMissionPanels(botanist).includes('crew'))
  assert.ok(getAccessibleMissionPanels(botanist).includes('systems'))
  assert.ok(!getAccessibleMissionPanels(botanist).includes('infrastructure'))
  const geologist = forSpecialty('resources')
  assert.ok(getAccessibleMissionPanels(geologist).includes('operations'))
  assert.ok(!getAccessibleMissionPanels(geologist).includes('systems'))
  assert.ok(!getAccessibleMissionPanels(geologist).includes('infrastructure'))
  assert.ok(!getAccessibleMissionPanels(geologist).includes('communications'))
  assert.deepEqual(getAccessibleMissionPanels(selectCrewSpecialty({ ...base, controlMode: 'full' }, 'command')), ['resources', 'crew', 'systems', 'forecast', 'communications', 'operations'])
  assert.ok(!getAllowedSpecialistActions(doctor).includes('explore'))
  assert.ok(!getAllowedSpecialistActions(botanist).includes('explore'))

  for (const duty of duties.filter((assignment) => ['medical', 'agriculture'].includes(assignment.specialty))) {
    const state = { ...base, controlledDutyId: duty.id, astronautDutyId: duty.id }
    const progress = getAstronautDutyProgress(state, 'en')
    assert.ok(progress.tasks.every((task) => canPerformActivity(state, task.action)), duty.title)
  }
})

test('enforces specialist-only actions and requires command authorization for reassignment', () => {
  const surface = prepareSurfaceMission(selectCrewSpecialty(initialGameState('mars', 4, 'Role Isolation', 317, {
    maxDays: 10,
    controlMode: 'specialist',
  }), 'command'))
  assert.equal(canPerformActivity(surface, 'research'), false)
  assert.equal(canPerformActivity(surface, 'maintenance'), false)
  assert.equal(getRoleIneligibleMessage(surface, 'maintenance'), 'Access Denied: Action requires Systems Engineer')
  const rejected = scheduleActivity(surface, 'research')
  assert.deepEqual(rejected.todayActions, surface.todayActions)
  assert.match(rejected.lastMessage, /^Access Denied: Action requires/)

  const target = getMissionCrewAssignments(surface.crewSize, surface.destination, surface.maxDays)
    .find((duty) => duty.specialty === 'science')
  assert.ok(target)
  const reassigned = formallyReassignCrewSpecialty(surface, target.id, 'engineering')
  assert.equal(reassigned.crewSpecialtyOverrides[target.id], 'engineering')
  assert.equal(reassigned.controlledDutyId, surface.controlledDutyId)
  assert.equal(reassigned.hour, surface.hour + 3)
  assert.match(reassigned.lastMessage, /Formal reassignment complete/)
  const unauthorized = formallyReassignCrewSpecialty({ ...surface, controlledDutyId: target.id }, target.id, 'engineering')
  assert.equal(unauthorized.lastMessage, 'Access Denied: Action requires Commander/Pilot')

  const moonMission = initialGameState('moon', 4, 'Pilot Reassignment', 318, {
    maxDays: 180,
    controlMode: 'specialist',
  })
  const moonDuties = getMissionCrewAssignments(moonMission.crewSize, moonMission.destination, moonMission.maxDays)
  const pilot = moonDuties.find((duty) => duty.specialty === 'pilot')
  const geologist = moonDuties.find((duty) => duty.specialty === 'science')
  assert.ok(pilot)
  assert.ok(geologist)
  const pilotSurface = prepareSurfaceMission({ ...moonMission, controlledDutyId: pilot.id })
  const pilotReassignment = formallyReassignCrewSpecialty(pilotSurface, geologist.id, 'engineering')
  assert.equal(pilotReassignment.crewSpecialtyOverrides[geologist.id], 'engineering')
})

test('restricts field operations to authorized specialist specialties', () => {
  const base = initialGameState('moon', 8, 'Operation Permissions', 73, {
    maxDays: 180,
    controlMode: 'specialist',
  })
  const duties = getMissionCrewAssignments(base.crewSize, base.destination, base.maxDays)
  const dutyFor = (specialty: string) => {
    const duty = duties.find((assignment) => assignment.specialty === specialty)
    assert.ok(duty)
    return { ...base, controlledDutyId: duty.id }
  }
  const pilotState = initialGameState('moon', 4, 'Pilot Permissions', 74, {
    maxDays: 180,
    controlMode: 'specialist',
  })
  const pilotDuty = getMissionCrewAssignments(pilotState.crewSize, pilotState.destination, pilotState.maxDays)
    .find((assignment) => assignment.specialty === 'pilot')
  assert.ok(pilotDuty)
  const pilot = { ...pilotState, controlledDutyId: pilotDuty.id }
  const engineer = dutyFor('power')
  const medic = dutyFor('medical')
  const agronomist = dutyFor('agriculture')
  const commander = dutyFor('command')

  assert.equal(canControlOperation(pilot, 'science-expedition'), false)
  assert.equal(canControlOperation(dutyFor('resources'), 'science-expedition'), true)
  assert.equal(canControlOperation(engineer, 'maintenance'), true)
  assert.equal(canControlOperation(engineer, 'construction'), true)
  assert.equal(canControlOperation(medic, 'rescue'), false)
  assert.equal(canControlOperation(commander, 'rescue'), true)
  assert.equal(canControlOperation(agronomist, 'construction'), false)
  assert.equal(canStartOperation(agronomist, 'construction'), false)
  assert.equal(canControlOperation({ ...base, controlledDutyId: '' }, 'maintenance'), false)

  const unauthorizedActiveOperation = {
    ...agronomist,
    activeOperation: {
      id: 'construction' as const,
      step: 0,
      status: 'active' as const,
      cyclesRemaining: 0,
      partialDamage: false,
      suitOxygenPercent: 100,
      siteDistanceUnits: 100,
    },
  }
  assert.equal(advanceOperation(unauthorizedActiveOperation).activeOperation?.step, 0)
  assert.match(advanceOperation(unauthorizedActiveOperation).lastMessage, /Access Denied/)
})

test('autonomous crew performance is deterministic and responds to mission difficulty and readiness', () => {
  const base = {
    ...initialGameState('moon', 6, 'Crew Performance', 61, {
      maxDays: 180,
      controlMode: 'specialist',
    }),
    missionPhase: 'surface' as const,
    transitDecisions: [{ leg: 'outbound' as const, choice: 'conservative' as const }],
    controlledDutyId: 'commander-1',
    controlledRole: 'commander' as const,
    hour: 20,
    todayActions: ['exercise', 'maintenance', 'research'] as GameState['todayActions'],
  }
  const easyState = { ...base, difficulty: 'easy' as const }
  const hardState = { ...base, difficulty: 'hard' as const }
  const easy = sleepAndAdvanceDay(easyState)
  const hard = sleepAndAdvanceDay(hardState)
  assert.equal(easy.crewDailyActivities.length, 5)
  assert.deepEqual(hard.crewDailyActivities, sleepAndAdvanceDay(hardState).crewDailyActivities)
  const easyRecoveryCount = easy.crewDailyActivities.filter((activity) => activity.effect === 'recovery').length
  const hardRecoveryCount = hard.crewDailyActivities.filter((activity) => activity.effect === 'recovery').length
  assert.ok(hardRecoveryCount >= easyRecoveryCount)
  assert.ok(hard.fatigue >= easy.fatigue)
  assert.ok(hard.morale <= easy.morale)

  const fullControlState = { ...base, controlMode: 'full' as const }
  const fullControl = sleepAndAdvanceDay(fullControlState)
  assert.equal(fullControl.crewDailyActivities.length, 5)
  assert.ok(fullControl.crewDailyActivities.every((activity) => activity.dutyId !== fullControlState.controlledDutyId))
})

test('crew traits are seeded per astronaut and strain lowers specialist efficiency deterministically', () => {
  const state = initialGameState('mars', 4, 'Crew Traits', 501, { maxDays: 10 })
  const duties = getMissionCrewAssignments(state.crewSize, state.destination, state.maxDays)
  const engineer = duties.find((duty) => duty.specialty === 'engineering')
  const geologist = duties.find((duty) => duty.specialty === 'science')
  assert.ok(engineer)
  assert.ok(geologist)
  assert.deepEqual(getCrewPersonality(state, engineer.id), getCrewPersonality(state, engineer.id))
  assert.notDeepEqual(getCrewPersonality(state, engineer.id), getCrewPersonality(state, geologist.id))
  const restedEfficiency = getCrewRoleEfficiency(state, engineer.id)
  const strained = {
    ...state,
    crewConditions: {
      ...state.crewConditions,
      [engineer.id]: { ...state.crewConditions[engineer.id], fatigue: 95, stress: 95, morale: 10 },
    },
  }
  assert.ok(getCrewRoleEfficiency(strained, engineer.id) < restedEfficiency)
  const unavailable = {
    ...state,
    crewConditions: {
      ...state.crewConditions,
      [engineer.id]: { ...state.crewConditions[engineer.id], health: 10 },
    },
  }
  assert.ok(getCrewRoleEfficiency(unavailable, engineer.id) < restedEfficiency)
  assert.deepEqual(getAccessibleMissionPanels(unavailable), ['resources', 'crew'])

  const routine = ['exercise', 'maintenance', 'research'] as const
  const first = finishDay(state, routine)
  const replay = finishDay(state, routine)
  assert.deepEqual(first.resources, replay.resources)
  const poweredBase = {
    ...state,
    buildings: ['reactor', 'solar-panels'],
    resources: { ...state.resources, energy: 20 },
  }
  const operationalPower = finishDay(poweredBase, routine).resources.energy
  const degradedPower = finishDay({
    ...poweredBase,
    crewConditions: {
      ...poweredBase.crewConditions,
      [engineer.id]: { ...poweredBase.crewConditions[engineer.id], health: 10 },
    },
  }, routine).resources.energy
  assert.ok(operationalPower > degradedPower)
})

test('daily report includes crew proposal outcomes alongside automated duty events', () => {
  const state = {
    ...initialGameState('moon', 6, 'Crew Report', 61, { maxDays: 180 }),
    missionPhase: 'surface' as const,
    transitDecisions: [{ leg: 'outbound' as const, choice: 'conservative' as const }],
    hour: 20,
    todayActions: ['exercise', 'maintenance', 'research'] as GameState['todayActions'],
    crewCommunications: [{
      day: 1,
      dutyId: 'colony-engineer-1',
      action: 'maintenance' as const,
      decision: 'accepted' as const,
      reason: 'requestAccepted' as const,
    }],
  }
  const closedDay = sleepAndAdvanceDay(state)
  assert.ok(closedDay.dailyReports[0].events.some((event) => event.includes('Crew request accepted')))
})

test('builds the evening briefing from actual daily actions, resources, crew roles, and modeled signal delay', () => {
  const state = {
    ...initialGameState('mars', 6, 'Debrief', 83, {
      maxDays: 180,
      controlMode: 'specialist',
      scenario: 'dust-front',
    }),
    controlledDutyId: 'colony-commander-1',
    astronautName: 'Youssef',
    todayActions: ['exercise', 'maintenance', 'research'] as GameState['todayActions'],
    eventHistory: [{ eventId: 'solar-storm', choiceIndex: 0, day: 1 }],
    resources: { ...initialGameState('mars', 6, 'Debrief', 83, { maxDays: 180 }).resources, water: 70 },
    dailyResourceStart: { ...initialGameState('mars', 6, 'Debrief', 83, { maxDays: 180 }).dailyResourceStart, water: 75 },
  }
  const briefing = getEveningBriefing(state, 'en')
  assert.equal(briefing.actionCount, 3)
  assert.equal(briefing.completedWorkShifts, 2)
  assert.equal(briefing.exerciseComplete, true)
  assert.ok(briefing.crew.some((member) => member.name === 'Youssef'))
  assert.equal(briefing.resourceDeltas.find((resource) => resource.id === 'water')?.delta, -5)
  assert.match(briefing.nextShiftWatch, /Dust watch/)
  assert.match(briefing.eventsReviewed[0], /Solar storm/)
  assert.equal(briefing.reportDelayMinutes, getMarsCommunicationDelayMinutes(state.missionSeed, state.day, 'research'))
})

test('evaluates, applies, and records crew requests using specialty, reserves, readiness, and emergencies', () => {
  const initial = initialGameState('mars', 6, 'Comm-Link', 89, {
    maxDays: 180,
    controlMode: 'specialist',
  })
  const roster = getMissionCrewAssignments(initial.crewSize, initial.destination, initial.maxDays)
  const engineer = roster.find((duty) => duty.specialty === 'power')
  const agronomist = roster.find((duty) => duty.specialty === 'agriculture')
  assert.ok(engineer)
  assert.ok(agronomist)
  const commander = roster.find((duty) => duty.specialty === 'command' || duty.specialty === 'pilot')
  assert.ok(commander)
  const surface = {
    ...initial,
    missionPhase: 'surface' as const,
    transitDecisions: [{ leg: 'outbound' as const, choice: 'conservative' as const }],
    controlledDutyId: 'colony-commander-1',
    astronautDutyId: engineer.id,
  }

  assert.equal(evaluateCrewRequest(surface, commander.id, 'maintenance'), 'selfConversation')
  const selfRequest = respondToCrewRequest(surface, commander.id, 'maintenance', 'en')
  assert.equal(selfRequest.crewCommunications.length, 0)
  assert.match(selfRequest.lastMessage, /cannot send a request to themselves/)

  const nonCommanderState = { ...surface, controlledDutyId: engineer.id }
  assert.equal(evaluateCrewRequest(nonCommanderState, agronomist.id, 'research'), 'commandAuthorityRequired')
  const unauthorizedRequest = respondToCrewRequest(nonCommanderState, agronomist.id, 'research', 'en')
  assert.equal(unauthorizedRequest.crewCommunications.length, 0)
  assert.match(unauthorizedRequest.lastMessage, /Only the Commander or Pilot/)

  assert.equal(evaluateCrewRequest(surface, engineer.id, 'explore'), 'specialtyMismatch')
  assert.equal(evaluateCrewRequest(surface, engineer.id, 'research'), 'specialtyMismatch')
  const maintained = respondToCrewRequest(surface, engineer.id, 'maintenance', 'en')
  assert.equal(maintained.crewCommunications[0].decision, 'accepted')
  assert.equal(getAstronautDutyProgress(maintained, 'en').percent, 100)
  assert.equal(evaluateCrewRequest(maintained, engineer.id, 'maintenance'), 'requestAlreadyHandled')
  assert.ok(maintained.resources.energy > surface.resources.energy)

  assert.equal(evaluateCrewRequest({ ...surface, resources: { ...surface.resources, energy: 0 } }, agronomist.id, 'research'), 'energyInsufficient')
  assert.equal(evaluateCrewRequest({ ...surface, resources: { ...surface.resources, oxygen: 0 } }, agronomist.id, 'research'), 'oxygenInsufficient')
  assert.equal(evaluateCrewRequest({
    ...surface,
    crewConditions: { ...surface.crewConditions, [engineer.id]: { health: 100, fatigue: 95, stress: 0, morale: 78 } },
  }, engineer.id, 'maintenance'), 'crewFatigue')
  assert.equal(evaluateCrewRequest({ ...surface, activeEvent: { id: 'solar-storm' } }, engineer.id, 'maintenance'), 'emergencyPriority')
  assert.equal(evaluateCrewRequest({ ...surface, ongoingLeak: true }, agronomist.id, 'research'), 'emergencyPriority')
  const leakRepair = respondToCrewRequest({ ...surface, ongoingLeak: true }, engineer.id, 'maintenance', 'en')
  assert.equal(leakRepair.ongoingLeak, true)
  assert.equal(leakRepair.crewCommunications[0].decision, 'rejected')

  const briefing = getEveningBriefing({ ...maintained, crewCommunications: maintained.crewCommunications.concat({
    day: maintained.day,
    dutyId: agronomist.id,
    action: 'research',
    decision: 'rejected',
    reason: 'emergencyPriority',
  }) }, 'en')
  assert.equal(briefing.communicationNotes.length, 2)
  assert.equal(briefing.communicationNotes[0].decision, 'accepted')
  assert.equal(briefing.communicationNotes[1].reason, 'emergencyPriority')
})

test('resolves outbound and return flight decisions as separate seeded legs', () => {
  const initial = selectCrewSpecialty(initialGameState('moon', 2, 'Flight Mission', 55), 'command')
  const outbound = resolveTransitDecision(initial, 'outbound', 'efficient')
  assert.equal(outbound.missionPhase, 'surface')
  assert.equal(outbound.transitDecisions.length, 1)
  assert.ok(Math.abs(outbound.resources.energy - (
    initial.resources.energy - 3 -
    2 * (POWER_SYSTEM.survivalLoadKw * POWER_SYSTEM.energyBudgetHoursPerCycle +
      2 * RESOURCE_RATES.energyKwhPerCrewDay * POWER_SYSTEM.energyBudgetHoursPerCycle +
      1.5 * POWER_SYSTEM.energyBudgetHoursPerCycle)
  )) < 0.01)
  assert.equal(resolveTransitDecision(outbound, 'outbound', 'conservative'), outbound)

  const returning = {
    ...outbound,
    missionPhase: 'return' as const,
    resources: { ...outbound.resources, energy: 50 },
  }
  const completedLeg = resolveTransitDecision(returning, 'return', 'conservative')
  assert.equal(completedLeg.missionPhase, 'return')
  assert.deepEqual(completedLeg.transitDecisions.map(({ leg }) => leg), ['outbound', 'return'])
  assert.ok(completedLeg.resources.energy < 42)

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

test('evacuates during transit when the oxygen reserve is exhausted', () => {
  const base = selectCrewSpecialty(initialGameState('mars', 4, 'Oxygen Transit', 55), 'command')
  const initial = {
    ...base,
    resources: {
      ...base.resources,
      energy: 100,
      oxygen: 0.1,
      health: 100,
    },
  }
  const result = resolveTransitDecision(initial, 'outbound', 'conservative')
  assert.equal(result.isGameOver, true)
  assert.equal(result.missionResult, 'evacuation')
  assert.deepEqual(result.failureCause, {
    resource: 'oxygen',
    source: 'transit',
    transitLeg: 'outbound',
    transitChoice: 'conservative',
  })
})

test('completes the surface campaign only after the return leg and exposes the debrief state', () => {
  const initial = selectCrewSpecialty(initialGameState('moon', 2, 'Return Report', 901, { maxDays: 10 }), 'command')
  const lastSurfaceDay = {
    ...initial,
    missionPhase: 'surface' as const,
    transitDecisions: [{ leg: 'outbound' as const, choice: 'conservative' as const }],
    daysSurvived: initial.maxDays - 1,
    day: initial.maxDays,
    hour: 20,
    todayActions: ['exercise', 'maintenance', 'research'] as GameState['todayActions'],
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

test('reports a safe return as failure when a goal-based objective was not completed', () => {
  const state = {
    ...selectCrewSpecialty(initialGameState('mars', 6, 'Unfinished Research', 902, {
      missionType: 'mars-opposition',
      objective: 'exploration',
    }), 'command'),
    missionPhase: 'return' as const,
    daysSurvived: 30,
    successfulExpeditions: 1,
    transitDecisions: [{ leg: 'outbound' as const, choice: 'conservative' as const }],
  }
  const result = resolveTransitDecision(state, 'return', 'conservative')
  assert.equal(result.isGameOver, true)
  assert.equal(result.missionResult, 'failure')
  assert.equal(isObjectiveComplete(result), false)
})

test('completes every destination, difficulty, duration, and transit-profile combination', () => {
  let seed = 4_000
  for (const destination of ['moon', 'mars'] as const) {
    for (const difficulty of ['easy', 'normal', 'hard'] as const) {
      for (const maxDays of [10, 30, 60] as const) {
        for (const outboundChoice of ['conservative', 'efficient'] as const) {
          for (const returnChoice of ['conservative', 'efficient'] as const) {
            const crewSize = destination === 'moon' ? 2 : 4
            let state = resolveTransitDecision(
              selectCrewSpecialty(initialGameState(destination, crewSize, 'Scenario Matrix', seed++, {
                maxDays,
                difficulty,
              }), 'command'),
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
    const state = selectCrewSpecialty(initialGameState('mars', 4, 'Crew Council', 45), 'command')
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
    const scienceSpecialist = selectCrewSpecialty(state, 'medical')
    assert.equal(recommendDailyAction({ ...scienceSpecialist, objective: 'science' }), 'research')
  })

  test('event recommendations account for resource caps, depletion, and ongoing leaks', () => {
    const base = selectCrewSpecialty(initialGameState('moon', 6, 'Event Advice', 46, { maxDays: 180 }), 'engineering')
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
      ...selectCrewSpecialty(base, 'medical'),
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
  assert.equal(getObjectiveTarget(state), 3)
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
  assert.ok(Math.abs(rationed.resources.water - getSupplyCapacity('water', 2) * 0.58) < 1e-9)
  assert.ok(Math.abs(oxygenShort.resources.oxygen - getSupplyCapacity('oxygen', 2) * 0.58) < 1e-9)
  assert.equal(solarFlare.resources.health, 82)
  assert.ok(Math.abs(habitatLeak.resources.oxygen - getSupplyCapacity('oxygen', 2) * 0.66) < 1e-9)
  assert.ok(Math.abs(greenhouseFault.resources.food - getSupplyCapacity('food', 2) * 0.62) < 1e-9)
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

test('limits specialist roles to specialties assigned on the selected mission roster', () => {
  assert.deepEqual(
    getAvailableCrewRoles(2, 'moon', 30).map((role) => role.id),
    ['commander', 'biologist'],
  )
  assert.deepEqual(
    getAvailableCrewRoles(4, 'mars', 30).map((role) => role.id),
    ['commander', 'power-engineer', 'biologist', 'water-officer'],
  )
  assert.deepEqual(
    getAvailableCrewRoles(6, 'mars', 180).map((role) => role.id),
    ['commander', 'power-engineer', 'biologist', 'water-officer'],
  )
  const lunarEngineerGeologist = getMissionCrewAssignments(3, 'moon', 30)
    .find((duty) => duty.title === 'Flight Engineer/Geologist')
  assert.ok(lunarEngineerGeologist)
  assert.equal(lunarEngineerGeologist?.controlRole, 'power-engineer')
  assert.equal(
    canPerformActivity({
      ...initialGameState('moon', 3, 'Lunar Geologist', 25, { maxDays: 30, controlMode: 'specialist' }),
      controlledRole: lunarEngineerGeologist.controlRole,
      controlledDutyId: lunarEngineerGeologist.id,
    }, 'explore'),
    false,
  )
})

test('selected mission duties constrain work and facility controls to the assigned specialty', () => {
  const missionBase = initialGameState('mars', 12, 'Duty Controls', 47, {
    maxDays: 180,
    controlMode: 'specialist',
  })
  const readyForShift = {
    ...missionBase,
    missionPhase: 'surface' as const,
    hour: 18,
    survivalMode: false,
    todayActions: ['exercise', 'maintenance', 'research'] as GameState['todayActions'],
    buildings: ['reactor', 'greenhouse', 'isru', 'pressurized-rover'],
  }
  const duties = getMissionCrewAssignments(missionBase.crewSize, missionBase.destination, missionBase.maxDays)
  const powerDuty = duties.find((assignment) => assignment.specialty === 'power')
  const geologyDuty = duties.find((assignment) => assignment.specialty === 'science')
  assert.ok(powerDuty)
  assert.ok(geologyDuty)
  const powerEngineer = {
    ...readyForShift,
    controlledDutyId: powerDuty.id,
  }
  assert.equal(canPerformActivity(powerEngineer, 'maintenance'), true)
  assert.equal(canPerformActivity(powerEngineer, 'explore'), false)
  assert.equal(canToggleBuilding(powerEngineer, 'reactor'), true)
  assert.equal(canToggleBuilding(powerEngineer, 'greenhouse'), false)

  const geologist = {
    ...readyForShift,
    controlledDutyId: geologyDuty.id,
  }
  assert.equal(canToggleBuilding(geologist, 'isru'), true)
  assert.equal(canToggleBuilding(geologist, 'greenhouse'), false)
  assert.equal(canToggleBuilding(geologist, 'reactor'), false)
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

test('starts the return leg when the primary objective is achieved before the mission limit', () => {
  const mission = initialGameState('mars', 4, 'Early Return', 31, {
    maxDays: 30,
    objective: 'science',
  })
  const surface = {
    ...mission,
    missionPhase: 'surface' as const,
    transitDecisions: [{ leg: 'outbound' as const, choice: 'conservative' as const }],
    science: 115,
  }
  const completed = finishDay(surface, 'research')
  assert.ok(completed.science >= 120)
  assert.equal(completed.missionPhase, 'return')
  assert.equal(completed.daysSurvived, 1)
  assert.equal(completed.day, 1)
  assert.equal(completed.maxDays, 30)
})

test('other specialists perform visible autonomous duties during individual play', () => {
  const specialist = initialGameState('moon', 6, 'Crew Operations', 61, {
    maxDays: 180,
    controlMode: 'specialist',
  })
  const bedtime = {
    ...specialist,
    missionPhase: 'surface' as const,
    transitDecisions: [{ leg: 'outbound' as const, choice: 'conservative' as const }],
    controlledDutyId: 'commander-1',
    controlledRole: 'commander' as const,
    hour: 20,
    todayActions: ['exercise', 'maintenance', 'research'] as GameState['todayActions'],
  }
  const next = sleepAndAdvanceDay(bedtime)
  assert.equal(next.crewDailyActivities.length, 5)
  assert.ok(next.crewDailyActivities.every((activity) => activity.dutyId !== bedtime.controlledDutyId))
  assert.ok(next.crewDailyActivities.some((activity) => activity.effect === 'health'))
  assert.ok(next.crewDailyActivities.some((activity) => activity.effect === 'inspection'))
  assert.equal(next.crewSupportActionHistory.length, 5)
  assert.ok(next.dailyReports[0].events.some((event) => event.startsWith('Crew duty:')))
})

test('tracks objective progress and keeps the performance score bounded', () => {
  const mission = initialGameState('mars', 2, 'Science Base', 3, {
    maxDays: 10,
    objective: 'science',
  })
  const researched = { ...mission, science: 120 }
  assert.equal(getObjectiveProgress(researched), 120)
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
  assert.equal(isObjectiveComplete(explored), false)
  assert.equal(isObjectiveComplete({ ...explored, successfulExpeditions: 3 }), true)
})

test('tutorial objective advances through forecast, maintenance, construction, rest, and research', () => {
  const mission = initialGameState('moon', 4, 'Tutorial Base', 17, {
    maxDays: 10,
    objective: 'tutorial',
  })
  const pilot = getMissionCrewAssignments(mission.crewSize, mission.destination, mission.maxDays)
    .find((assignment) => assignment.specialty === 'pilot')
  assert.ok(pilot)
  const initial = {
    ...selectCrewSpecialty(mission, 'command'),
    crewSpecialtyOverrides: { ...mission.crewSpecialtyOverrides, [pilot.id]: 'engineering' as const },
  }
  let state = {
    ...initial,
    buildings: [...initial.buildings, 'command-center', 'storage', 'communications', 'workshop', 'research-lab', 'medical-bay', 'isru'],
    resources: { ...initial.resources, energy: 200 },
  }
  assert.equal(getObjectiveTarget(state), 5)
  state = recordTutorialStep(state, 'rest')
  assert.equal(getObjectiveProgress(state), 0)
  state = recordTutorialStep(state, 'forecast')
  state = selectCrewSpecialty(state, 'engineering')
  state = finishDay(state, 'maintenance')
  const geologist = getMissionCrewAssignments(state.crewSize, state.destination, state.maxDays, state.crewSpecialtyOverrides)
    .find((assignment) => assignment.specialty === 'science')
  assert.ok(geologist)
  state = selectCrewSpecialty(state, 'science')
  state = pretreatRegolith(state)
  state = selectCrewSpecialty(state, 'medical')
  state = buildInState(state, 'greenhouse')
  assert.equal(state.tutorialSteps.includes('greenhouse'), false)
  state = finishDay(state, 'rest')
  state = finishDay(state, 'rest')
  assert.equal(state.tutorialSteps.includes('greenhouse'), true)
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
    resources: {
      ...base.resources,
      energy: 0,
      oxygen: getSupplyCapacity('oxygen', base.crewSize),
      food: getSupplyCapacity('food', base.crewSize),
    },
  }
  const amplePower = {
    ...base,
    resources: {
      ...base.resources,
      energy: 100,
      oxygen: getSupplyCapacity('oxygen', base.crewSize),
      food: getSupplyCapacity('food', base.crewSize),
    },
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
  assert.ok(Math.abs(getExplorationRisk(moon) - 0.26339) < 1e-10)
  assert.ok(Math.abs(getExplorationRisk(mars) - 0.36118) < 1e-10)

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
  const mars = selectCrewSpecialty(prepareSurfaceMission(initialGameState('mars', 4, 'Mars Base')), 'medical')
  const phaseTwoReady = { ...mars, buildings: [...mars.buildings, 'command-center', 'storage', 'communications'] }
  assert.equal(canBuild(phaseTwoReady, 'moxie'), true)
  assert.equal(canBuild(selectCrewSpecialty(prepareSurfaceMission(initialGameState('moon', 2, 'Moon Base')), 'science-medical'), 'moxie'), false)
})

test('charges construction resources up front and completes a structure only after its timer', () => {
  const initial = selectCrewSpecialty(prepareSurfaceMission(initialGameState('moon', 2, 'Base')), 'science-medical')
  const state = {
    ...initial,
    buildings: [...initial.buildings, 'command-center', 'storage', 'communications', 'workshop', 'research-lab', 'medical-bay', 'isru'],
    regolithPreTreated: true,
  }
  const started = buildInState(state, 'greenhouse')
  assert.equal(started.buildings.includes('greenhouse'), false)
  assert.deepEqual(started.constructionProject, { buildingId: 'greenhouse', totalHours: 18, hoursRemaining: 16 })
  assert.equal(started.resources.credits, state.resources.credits - 90)
  assert.equal(started.resources.cargo, state.resources.cargo - 18)
  assert.equal(started.resources.energy, state.resources.energy - 7)
  assert.equal(started.hour, state.hour + 2)
  assert.equal(canBuild(started, 'water-recycler'), false)

  const firstDay = finishDay(started, ['exercise', 'research'])
  assert.equal(firstDay.constructionProject, null)
  assert.equal(firstDay.buildings.includes('greenhouse'), true)
  assert.ok(firstDay.dailyReports.at(-1)?.events.includes('Greenhouse construction started'))
  assert.ok(firstDay.dailyReports.at(-1)?.events.includes('Greenhouse construction completed'))
})

test('construction progresses through scheduled hours and sleep rather than only day counters', () => {
  const surface = prepareSurfaceMission(selectCrewSpecialty(initialGameState('moon', 3, 'Timed Build', 72), 'command'))
  const engineer = selectCrewSpecialty(surface, 'engineering-science')
  const constructionSite = {
    ...engineer,
    buildings: [...engineer.buildings, 'command-center', 'storage', 'communications'],
  }
  const started = buildInState(constructionSite, 'workshop')
  assert.equal(started.constructionProject?.hoursRemaining, 22)
  const exercised = scheduleActivity(started, 'exercise')
  assert.equal(exercised.constructionProject?.hoursRemaining, 19.5)
  const firstShift = scheduleActivity(exercised, 'maintenance')
  const secondShift = scheduleActivity(firstShift, 'maintenance')
  const bedtime = waitUntilBedtime(secondShift)
  assert.equal(bedtime.constructionProject?.hoursRemaining, 10)
  const nextDay = sleepAndAdvanceDay(bedtime)
  assert.equal(nextDay.constructionProject?.hoursRemaining, 2)
  const completed = scheduleActivity(nextDay, 'exercise')
  assert.equal(completed.constructionProject, null)
  assert.ok(completed.buildings.includes('workshop'))
})

test('daily close records actions, resource fluctuations, and radiation exposure', () => {
  const initial = prepareSurfaceMission(initialGameState('moon', 2, 'Daily Report', 70))
  const next = finishDay(initial, ['exercise', 'research', 'maintenance'])
  const report = next.dailyReports[0]
  assert.equal(report.day, initial.day)
  assert.deepEqual(report.actions, ['exercise', 'research', 'maintenance'])
  assert.deepEqual(report.resourcesAtStart, {
    energy: initial.resources.energy,
    oxygen: initial.resources.oxygen,
    water: initial.resources.water,
    food: initial.resources.food,
    health: initial.resources.health,
  })
  assert.deepEqual(report.resourcesAtEnd, {
    energy: next.resources.energy,
    oxygen: next.resources.oxygen,
    water: next.resources.water,
    food: next.resources.food,
    health: next.resources.health,
  })
  assert.ok(report.radiationMsv > 0)
  assert.deepEqual(report.events, [])
  assert.deepEqual(report.earthTransmission, { status: 'local', delayMinutes: 0 })
})

test('queues Mars daily reports with a deterministic communication delay', () => {
  const initial = prepareSurfaceMission(initialGameState('mars', 2, 'Earth Packet', 71))
  const next = finishDay(initial, ['exercise', 'research', 'maintenance'])
  const report = next.dailyReports[0]
  assert.equal(report.earthTransmission.status, 'queued')
  assert.equal(report.earthTransmission.delayMinutes, getMarsCommunicationDelayMinutes(initial.missionSeed, initial.day, 'research'))
  assert.ok(report.earthTransmission.delayMinutes >= 3 && report.earthTransmission.delayMinutes <= 22)
})

test('rejects a build when the base cannot afford its cargo', () => {
  const initial = prepareSurfaceMission(initialGameState('moon', 2, 'Base'))
  const state = { ...initial, resources: { ...initial.resources, cargo: 0 } }
  assert.equal(canBuild(state, 'greenhouse'), false)
  assert.equal(buildInState(state, 'greenhouse').buildings.includes('greenhouse'), false)
})

test('taking a facility offline removes its output and operating costs', () => {
  const initial = prepareMaintenanceMission(initialGameState('moon', 2, 'Systems Base'))
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
  const state = selectCrewSpecialty(
    prepareSurfaceMission(selectCrewSpecialty(initialGameState('mars', 4, 'Life Support Base'), 'command')),
    'medical',
  )
  assert.equal(canToggleBuilding(state, 'life-support'), false)
  assert.deepEqual(toggleBuildingInState(state, 'life-support').offlineBuildings, [])
  assert.match(toggleBuildingInState(state, 'life-support').lastMessage, /oxygen-production/)
})

test('completes a 30-day lunar mission with storage, power generation, and life-support recovery', () => {
  let state = prepareMaintenanceMission(initialGameState('moon', 2, 'Long Mission'))
  state = {
    ...state,
    buildings: [...new Set([...state.buildings, 'command-center', 'storage', 'communications', 'workshop', 'research-lab', 'medical-bay', 'isru', 'reactor', 'greenhouse', 'water-recycler'])],
    regolithPreTreated: true,
  }
  while (!state.isGameOver) {
    if (state.missionPhase === 'return') {
      state = resolveTransitDecision(selectCrewSpecialty(state, 'command'), 'return', 'conservative')
      continue
    }
    const action = state.daysSurvived % 3 === 2 ? 'rest' : 'maintenance'
    state = finishDay(state, action)
  }
  assert.equal(state.daysSurvived, 30)
  assert.equal(state.missionResult, 'success')
})

test('high continuous ISRU and greenhouse loads eventually exhaust a single lunar power system', () => {
  let state = prepareMaintenanceMission(initialGameState('moon', 4, 'Extended Lunar Base', 17, {
    maxDays: 60,
    difficulty: 'easy',
  }))
  const agricultureDuty = getMissionCrewAssignments(state.crewSize, state.destination, state.maxDays, state.crewSpecialtyOverrides)
    .find((assignment) => assignment.specialty === 'medical')
  assert.ok(agricultureDuty)
  state = {
    ...state,
    crewSpecialtyOverrides: { ...state.crewSpecialtyOverrides, [agricultureDuty.id]: 'agriculture' },
    buildings: [...new Set([...state.buildings, 'command-center', 'storage', 'communications', 'workshop', 'research-lab', 'medical-bay', 'isru', 'reactor', 'greenhouse', 'water-recycler'])],
    regolithPreTreated: true,
  }
  while (!state.isGameOver) {
    if (state.missionPhase === 'return') {
      state = resolveTransitDecision(selectCrewSpecialty(state, 'command'), 'return', 'conservative')
      continue
    }
    state = finishDay(state, state.daysSurvived % 3 === 2 ? 'rest' : 'maintenance')
  }
  assert.ok(state.daysSurvived < 60)
  assert.equal(state.missionResult, 'evacuation')
  assert.equal(state.failureCause?.resource, 'energy')
})

test('a selected 10-cycle survival campaign completes after ten operating cycles', () => {
  let state = prepareMaintenanceMission(initialGameState('moon', 2, 'Short Mission', 17, { maxDays: 10 }))
  state = {
    ...state,
    buildings: [...new Set([...state.buildings, 'command-center', 'storage', 'communications', 'workshop', 'research-lab', 'medical-bay', 'isru', 'reactor', 'greenhouse', 'water-recycler'])],
    regolithPreTreated: true,
  }
  while (!state.isGameOver) {
    if (state.missionPhase === 'return') {
      state = resolveTransitDecision(selectCrewSpecialty(state, 'command'), 'return', 'conservative')
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
