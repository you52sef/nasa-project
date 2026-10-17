import { BUILDING_PHASES, BUILDINGS } from './buildings'
import { estimateTransfer } from './flightPhysics'
import {
  CO2_PER_CREW_DAY,
  ENVIRONMENT,
  FOOD_PER_CREW_DAY,
  OXYGEN_PER_CREW_DAY,
  POWER_SYSTEM,
  WATER_PER_CREW_DAY,
  WATER_RECYCLE_RATE,
  getCrewDailyRoutine,
  getCrewSolDurationHours,
  getSurvivalBatteryRuntimeHours,
  GREENHOUSE_CYCLE,
  HABITAT_PRESSURE_KPA,
} from './constants'
import { SCENARIOS, type ScenarioId } from './scenarios'
import type { ActiveOperation } from './operations'
import { advanceOperationCycle } from './operations'

export type Destination = 'moon' | 'mars'
export type Action = 'research' | 'explore' | 'maintenance' | 'exercise' | 'rest'
export type ResourceName = 'energy' | 'oxygen' | 'water' | 'food' | 'health'
export type MissionDifficulty = 'easy' | 'normal' | 'hard'
export type MissionObjective = 'survival' | 'science' | 'exploration' | 'tutorial'
export type MissionMode = 'education' | 'simulation'
export type CrewRole = 'commander' | 'power-engineer' | 'biologist' | 'water-officer'
export type ControlMode = 'full' | 'specialist'
export type MissionPhase = 'outbound' | 'surface' | 'return'
export type TransitChoice = 'conservative' | 'efficient'
export type TutorialStep = 'forecast' | 'maintenance' | 'greenhouse' | 'rest' | 'research'
export type EmergencyLevel = 0 | 1 | 2 | 3 | 4
export const TUTORIAL_STEPS: readonly TutorialStep[] = ['forecast', 'maintenance', 'greenhouse', 'rest', 'research']

export interface MissionConfig {
  maxDays: number
  difficulty: MissionDifficulty
  objective: MissionObjective
  scenario: ScenarioId
  missionMode?: MissionMode
  controlMode?: ControlMode
  controlledRole?: CrewRole
}

export function getHabitatPressureKpa(state: Pick<GameState, 'buildings' | 'offlineBuildings' | 'ongoingLeak'>): number {
  const habitatOnline = state.buildings.includes('habitat') &&
    !(state.offlineBuildings || []).includes('habitat')
  if (!habitatOnline) return 0
  return state.ongoingLeak ? HABITAT_PRESSURE_KPA.leakEstimate : HABITAT_PRESSURE_KPA.nominal
}

export function pretreatRegolith(state: GameState): GameState {
  if (state.regolithPreTreated) return state
  if (!state.started || state.paused || state.isGameOver || state.missionPhase !== 'surface') {
    return { ...state, lastMessage: 'Regolith treatment is available only during active surface operations.' }
  }
  if (!state.buildings.includes('isru') || (state.offlineBuildings || []).includes('isru')) {
    return { ...state, lastMessage: 'An active ISRU plant is required to pretreat perchlorate-bearing regolith.' }
  }
  if (state.resources.energy < GREENHOUSE_CYCLE.regolithTreatmentEnergyKwh) {
    return { ...state, lastMessage: 'Insufficient energy to pretreat regolith.' }
  }
  return {
    ...state,
    regolithPreTreated: true,
    resources: {
      ...state.resources,
      energy: state.resources.energy - GREENHOUSE_CYCLE.regolithTreatmentEnergyKwh,
    },
    lastMessage: 'Regolith pretreatment complete; perchlorate-bearing soil is ready for greenhouse use.',
  }
}

export interface MissionFailure {
  resource: ResourceName
  source: 'daily-operation' | 'event' | 'transit'
  action?: Action
  eventId?: string
  choiceIndex?: number
  transitLeg?: 'outbound' | 'return'
  transitChoice?: TransitChoice
}

export const MISSION_DURATIONS = [10, 30, 60] as const
export const MISSION_DAY_START = 6
export const MISSION_BEDTIME = 20
export const MISSION_DAY_END = 22
export const ACTIVITY_DURATIONS: Record<Action, number> = {
  research: 4,
  explore: 6,
  maintenance: 3,
  exercise: 2.5,
  rest: 2,
}
export const DAILY_EXERCISE_HOURS = 2.5
export const DAILY_REST_LIMIT = 1
export const DIFFICULTY_MODIFIERS: Record<MissionDifficulty, { consumption: number; eventChance: number; explorationRisk: number }> = {
  easy: { consumption: 0.8, eventChance: 0.15, explorationRisk: -0.05 },
  normal: { consumption: 1, eventChance: 0.3, explorationRisk: 0 },
  hard: { consumption: 1.2, eventChance: 0.45, explorationRisk: 0.08 },
}
export const RESOURCE_RATES = {
  energyKwhPerCrewDay: 4,
  oxygenKgPerCrewDay: OXYGEN_PER_CREW_DAY,
  waterLitersPerCrewDay: WATER_PER_CREW_DAY,
  foodKgPerCrewDay: FOOD_PER_CREW_DAY,
  co2KgPerCrewDay: CO2_PER_CREW_DAY,
  electrolysisWaterKgPerOxygenKg: 1.125,
  restHealthRecoveryPoints: 2,
} as const

export interface Resources extends Record<ResourceName, number> {
  credits: number
  cargo: number
}

export interface GameEvent {
  id: string
  choiceIndex?: number
}

export interface GameState {
  started: boolean
  paused: boolean
  configVersion: number
  day: number
  maxDays: number
  daysSurvived: number
  missionMode: MissionMode
  controlMode: ControlMode
  controlledRole: CrewRole
  missionPhase: MissionPhase
  transitDecisions: Array<{ leg: 'outbound' | 'return'; choice: TransitChoice }>
  hour: number
  todayActions: Action[]
  destination: Destination
  crewSize: number
  difficulty: MissionDifficulty
  objective: MissionObjective
  scenario: ScenarioId
  tutorialSteps: TutorialStep[]
  resourceStreak: number
  missionSeed: number
  runId: string
  baseName: string
  resources: Resources
  fatigue: number
  morale: number
  radiationExposure: number
  permanentRadiationDamageWarning: boolean
  activeOperation: ActiveOperation | null
  regolithPreTreated: boolean
  oxygenEmergencyHoursRemaining: number | null
  survivalMode: boolean
  survivalModeOfflineBuildings: string[]
  autoShedBuildings: string[]
  emergencyLevel: EmergencyLevel
  dustStormDaysRemaining: number
  dustStormSolarLossFraction: number
  buildings: string[]
  offlineBuildings: string[]
  activeEvent: GameEvent | null
  ongoingLeak: boolean
  isGameOver: boolean
  missionResult: 'success' | 'evacuation' | 'ended' | null
  science: number
  successfulExpeditions: number
  totalRescues: number
  lastAction: Action | null
  actionHistory: Action[]
  crewSupportActionHistory: Action[]
  eventHistory: Array<{ eventId: string; choiceIndex: number; day?: number }>
  failureCause: MissionFailure | null
  log: string[]
  lessonsCompleted: number[]
  lessonResults: Record<number, { preCorrect: boolean | null; postCorrect: boolean }>
  lastMessage: string
}

export const RESOURCE_CAP = 100
const LEGACY_RESOURCE_CONVERSION = {
  oxygen: 0.24,
  water: 7 / 6,
  food: 0.248,
} as const

export function convertLegacyResourceDelta(resource: ResourceName, amount: number): number {
  if (resource === 'oxygen' || resource === 'water' || resource === 'food') {
    return amount * LEGACY_RESOURCE_CONVERSION[resource]
  }
  return amount
}

export function getActivityResourceCost(
  action: Action,
  difficulty: MissionDifficulty,
): Partial<Pick<Resources, 'energy' | 'oxygen'>> {
  const consumption = DIFFICULTY_MODIFIERS[difficulty].consumption
  if (action === 'research') return { energy: 9 * consumption * POWER_SYSTEM.energyBudgetHoursPerCycle, oxygen: 0.1 * consumption }
  if (action === 'explore') return { energy: 12 * consumption * POWER_SYSTEM.energyBudgetHoursPerCycle, oxygen: 0.4 * consumption }
  if (action === 'exercise') return { energy: 1.5 * consumption * POWER_SYSTEM.energyBudgetHoursPerCycle, oxygen: 0.08 * consumption }
  return {}
}

export function migrateLegacyResourceUnits(resources: Resources): Resources {
  return {
    ...resources,
    oxygen: clamp(convertLegacyResourceDelta('oxygen', resources.oxygen)),
    water: clamp(convertLegacyResourceDelta('water', resources.water)),
    food: clamp(convertLegacyResourceDelta('food', resources.food)),
  }
}

export function initialGameState(
  destination: Destination,
  crewSize: number,
  baseName: string,
  missionSeed = createMissionSeed(),
  config: Partial<MissionConfig> = {},
): GameState {
  return {
    started: true,
    paused: false,
    configVersion: 7,
    day: 1,
    maxDays: MISSION_DURATIONS.includes(config.maxDays as typeof MISSION_DURATIONS[number]) ? config.maxDays! : 30,
    daysSurvived: 0,
    missionMode: config.missionMode || 'simulation',
    controlMode: config.controlMode || 'full',
    controlledRole: config.controlledRole || 'commander',
    missionPhase: 'outbound',
    transitDecisions: [],
    hour: MISSION_DAY_START,
    todayActions: [],
    destination,
    crewSize,
    difficulty: config.difficulty || 'normal',
    objective: config.objective || 'survival',
    scenario: config.scenario || 'baseline',
    tutorialSteps: [],
    resourceStreak: 0,
    missionSeed: missionSeed >>> 0,
    runId: createMissionRunId(),
    baseName: baseName.trim(),
    resources: {
      energy: 85,
      oxygen: 90,
      water: 88,
      food: 82,
      health: 100,
      credits: 500,
      cargo: 100,
      ...SCENARIOS[config.scenario || 'baseline'].startingResources,
    },
    fatigue: 18,
    morale: 78,
    radiationExposure: 0,
    permanentRadiationDamageWarning: false,
    activeOperation: null,
    regolithPreTreated: false,
    oxygenEmergencyHoursRemaining: null,
    survivalMode: false,
    survivalModeOfflineBuildings: [],
    autoShedBuildings: [],
    emergencyLevel: 0,
    dustStormDaysRemaining: 0,
    dustStormSolarLossFraction: 0,
    buildings: ['landing-pad', 'solar-panels', 'battery', 'habitat', 'airlock', 'storm-shelter', 'life-support'],
    offlineBuildings: [],
    activeEvent: null,
    ongoingLeak: false,
    isGameOver: false,
    missionResult: null,
    science: 0,
    successfulExpeditions: 0,
    totalRescues: 0,
    lastAction: null,
    actionHistory: [],
    crewSupportActionHistory: [],
    eventHistory: [],
    failureCause: null,
    log: [],
    lessonsCompleted: [],
    lessonResults: {},
    lastMessage: '',
  }
}

function createMissionSeed(): number {
  if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
    return crypto.getRandomValues(new Uint32Array(1))[0]
  }
  return Math.floor(Math.random() * 0x1_0000_0000)
}

export function createMissionRunId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

export function deterministicRoll(seed: number, day: number, channel: number): number {
  let value = (seed ^ Math.imul(day, 0x9e3779b1) ^ Math.imul(channel, 0x85ebca6b)) >>> 0
  value ^= value >>> 16
  value = Math.imul(value, 0x7feb352d)
  value ^= value >>> 15
  value = Math.imul(value, 0x846ca68b)
  value ^= value >>> 16
  return (value >>> 0) / 0x1_0000_0000
}

const clamp = (value: number, max = RESOURCE_CAP) => Math.max(0, Math.min(max, Math.round(value * 100) / 100))
const clampPercent = (value: number) => clamp(value)

export function getExplorationRisk(state: Pick<GameState, 'destination' | 'fatigue' | 'morale' | 'resources' | 'difficulty'>): number {
  const environmentalRisk = state.destination === 'mars' ? 0.34 : 0.24
  const fatigueRisk = Math.max(0, state.fatigue - 40) * 0.005
  const healthRisk = Math.max(0, 50 - state.resources.health) * 0.004
  const moraleRisk = Math.max(0, 30 - state.morale) * 0.003
  const difficultyRisk = DIFFICULTY_MODIFIERS[state.difficulty].explorationRisk
  return Math.max(0.05, Math.min(0.85, environmentalRisk + fatigueRisk + healthRisk + moraleRisk + difficultyRisk))
}

export function getBuildingTotals(buildings: string[], offlineBuildings: string[] = []) {
  return buildings.filter((id) => !offlineBuildings.includes(id)).reduce(
    (totals, id) => {
      const building = BUILDINGS[id]
      if (!building) return totals
      for (const [resource, amount] of Object.entries(building.production || {})) {
        totals[resource as ResourceName] += amount
      }
      return totals
    },
    { energy: 0, oxygen: 0, water: 0, food: 0, health: 0 } as Record<ResourceName, number>,
  )
}

export function getEnergyCapacity(state: Pick<GameState, 'buildings' | 'offlineBuildings'>): number {
  return state.buildings.includes('battery') && !(state.offlineBuildings || []).includes('battery')
    ? POWER_SYSTEM.batteryCapacityKwh
    : 100
}

export function getSurvivalPowerLoadKw(): number {
  return Object.values(POWER_SYSTEM.survivalLoadsKw).reduce((total, load) => total + load, 0)
}

export function getPowerLoadKw(
  state: Pick<GameState, 'buildings' | 'survivalMode'> & Partial<Pick<GameState, 'offlineBuildings'>>,
): number {
  if (state.survivalMode) return POWER_SYSTEM.survivalLoadKw
  const offlineBuildings = 'offlineBuildings' in state ? state.offlineBuildings || [] : []
  return state.buildings
    .filter((id) => !offlineBuildings.includes(id))
    .reduce((total, id) => total + (POWER_SYSTEM.operatingLoadsKw[id as keyof typeof POWER_SYSTEM.operatingLoadsKw] || 0), 0)
}

export function getSolarOutputKw(destination: Destination, scenarioOutput = 18): number {
  return POWER_SYSTEM.solarOutputKw[destination] * scenarioOutput / 18
}

export function getSolarGenerationKwh(destination: Destination, scenarioOutput = 18, day = 1, stormLoss = 0): number {
  return getSolarOutputKw(destination, scenarioOutput) *
    POWER_SYSTEM.solarHoursPerCycle[destination] *
    POWER_SYSTEM.energyBudgetHoursPerCycle *
    getSolarAvailabilityFactor(destination, day) *
    (1 - stormLoss)
}

export function hasRegolithDustMitigation(state: Pick<GameState, 'buildings' | 'offlineBuildings'>): boolean {
  return ['suitport', 'electrostatic-dust-shield'].every((id) =>
    state.buildings.includes(id) && !(state.offlineBuildings || []).includes(id),
  )
}

export function getCrewDailyEclssBalance(
  crewSize: number,
  difficulty: MissionDifficulty,
  hasWaterRecycler: boolean,
  hasSabatierProcessor = true,
): {
  oxygenConsumedKg: number
  waterConsumedLiters: number
  foodConsumedKg: number
  co2ProducedKg: number
  sabatierWaterRecoveredLiters: number
  totalWaterRecoveredLiters: number
} {
  const crewWaterDemand = crewSize * WATER_PER_CREW_DAY * DIFFICULTY_MODIFIERS[difficulty].consumption
  const co2ProducedKg = crewSize * CO2_PER_CREW_DAY
  const sabatierWaterRecoveredLiters = hasSabatierProcessor ? co2ProducedKg * (36 / 44) : 0
  const targetRecovery = crewWaterDemand * WATER_RECYCLE_RATE[difficulty]
  const totalWaterRecoveredLiters = hasWaterRecycler
    ? targetRecovery
    : Math.min(targetRecovery, sabatierWaterRecoveredLiters)
  return {
    oxygenConsumedKg: crewSize * OXYGEN_PER_CREW_DAY * DIFFICULTY_MODIFIERS[difficulty].consumption,
    waterConsumedLiters: crewWaterDemand,
    foodConsumedKg: crewSize * FOOD_PER_CREW_DAY * DIFFICULTY_MODIFIERS[difficulty].consumption,
    co2ProducedKg,
    sabatierWaterRecoveredLiters,
    totalWaterRecoveredLiters,
  }
}

export function setSurvivalMode(state: GameState, enabled: boolean): GameState {
  if (enabled === state.survivalMode) return state
  if (enabled) {
    const buildingsToPause = POWER_SYSTEM.productiveBuildings.filter((id) =>
      state.buildings.includes(id) && !(state.offlineBuildings || []).includes(id),
    )
    return {
      ...state,
      survivalMode: true,
      survivalModeOfflineBuildings: buildingsToPause,
      offlineBuildings: [...new Set([...(state.offlineBuildings || []), ...buildingsToPause])],
    }
  }
  const pausedBySurvival = new Set(state.survivalModeOfflineBuildings)
  return {
    ...state,
    survivalMode: false,
    survivalModeOfflineBuildings: [],
    offlineBuildings: (state.offlineBuildings || []).filter((id) =>
      !pausedBySurvival.has(id) || (state.autoShedBuildings || []).includes(id)),
  }
}

export function updateAutomaticLoadShed(state: GameState): Pick<GameState, 'offlineBuildings' | 'autoShedBuildings' | 'log'> {
  if (state.survivalMode) {
    return {
      offlineBuildings: state.offlineBuildings,
      autoShedBuildings: state.autoShedBuildings || [],
      log: state.log,
    }
  }
  const capacity = getEnergyCapacity(state)
  const lowSupplies = (['oxygen', 'water', 'food'] as const)
    .some((resource) => state.resources[resource] <= POWER_SYSTEM.automaticLoadShedEnterResourceAmount)
  const recoveryReady = state.resources.energy >= capacity * POWER_SYSTEM.automaticLoadShedRecoverEnergyFraction &&
    (['oxygen', 'water', 'food'] as const)
      .every((resource) => state.resources[resource] >= POWER_SYSTEM.automaticLoadShedRecoverResourceAmount)

  const currentAutoShedBuildings = state.autoShedBuildings || []
  if (currentAutoShedBuildings.length > 0) {
    if (!recoveryReady) {
      return {
        offlineBuildings: state.offlineBuildings,
        autoShedBuildings: currentAutoShedBuildings,
        log: state.log,
      }
    }
    const autoShed = new Set(currentAutoShedBuildings)
    return {
      offlineBuildings: state.offlineBuildings.filter((id) => !autoShed.has(id)),
      autoShedBuildings: [],
      log: [...state.log, `Day ${state.day}: automatic load shedding cleared after reserves recovered.`],
    }
  }

  const energyCritical = state.resources.energy <= capacity * POWER_SYSTEM.automaticLoadShedEnterEnergyFraction
  if (!energyCritical && !lowSupplies) {
    return { offlineBuildings: state.offlineBuildings, autoShedBuildings: [], log: state.log }
  }

  const offline = new Set(state.offlineBuildings)
  const autoShedBuildings = POWER_SYSTEM.automaticLoadShedBuildings.filter((id) =>
    state.buildings.includes(id) && !offline.has(id),
  )
  if (autoShedBuildings.length === 0) {
    return { offlineBuildings: state.offlineBuildings, autoShedBuildings: [], log: state.log }
  }
  return {
    offlineBuildings: [...state.offlineBuildings, ...autoShedBuildings],
    autoShedBuildings,
    log: [...state.log, `Day ${state.day}: automatic load shedding paused ${autoShedBuildings.join(', ')}.`],
  }
}

export function setEmergencyLevel(state: GameState, level: EmergencyLevel): GameState {
  if (![0, 1, 2, 3, 4].includes(level)) return state
  if (level === 4 && !state.buildings.includes('medical-bay')) {
    return { ...state, emergencyLevel: level, lastMessage: 'Medical emergency declared; construct the medical clinic to provide treatment.' }
  }
  const next = {
    ...state,
    emergencyLevel: level,
    lastMessage: level === 1
      ? 'Level 1: shelter the crew during the solar storm.'
      : level === 2
        ? 'Level 2: isolate the leaking section and use pressure suits.'
        : level === 3
          ? 'Level 3: switch to backup power and shed productive loads.'
          : level === 4
            ? 'Level 4: respond at the medical clinic.'
            : 'Emergency response cleared.',
  }
  if (level === 2) next.ongoingLeak = false
  return setSurvivalMode(next, level === 3)
}

function countBuilding(buildings: string[], id: string, offlineBuildings: string[] = []): number {
  return buildings.filter((buildingId) => buildingId === id && !offlineBuildings.includes(buildingId)).length
}

function dailyBuildingEnergyUse(buildings: string[], offlineBuildings: string[] = []): number {
  return buildings
    .filter((id) => !offlineBuildings.includes(id))
    .reduce((total, id) =>
      total + (POWER_SYSTEM.operatingLoadsKw[id as keyof typeof POWER_SYSTEM.operatingLoadsKw] || 0) *
        POWER_SYSTEM.energyBudgetHoursPerCycle,
    0)
}

export function getSolarAvailabilityFactor(destination: Destination, day: number): number {
  if (destination === 'mars') return 1
  const lunarDay = ((day - 1) % 29.53059) / 29.53059
  return lunarDay >= 0.25 && lunarDay < 0.75 ? 0 : 1
}

export function forecastResources(state: GameState, action: Action | readonly Action[] | null = null): Resources {
  const actions = normalizeActions(action)
  const additionalActions = getAdditionalActions(state.todayActions, actions)
  const next = { ...state.resources }
  const offlineBuildings = state.offlineBuildings || []
  const production = getBuildingTotals(state.buildings, offlineBuildings)
  const consumptionFactor = DIFFICULTY_MODIFIERS[state.difficulty || 'normal'].consumption
  const maintenanceFactor = actions.includes('maintenance') ? 0.72 : 1
  const solarCount = countBuilding(state.buildings, 'solar-panels', offlineBuildings)
  const lifeSupportCount = countBuilding(state.buildings, 'life-support', offlineBuildings)
  const recyclerCount = countBuilding(state.buildings, 'water-recycler', offlineBuildings)
  const greenhouseCount = countBuilding(state.buildings, 'greenhouse', offlineBuildings)
  const crewEnergyUse = RESOURCE_RATES.energyKwhPerCrewDay * state.crewSize *
    maintenanceFactor * consumptionFactor * POWER_SYSTEM.energyBudgetHoursPerCycle
  const activityEnergyUse = additionalActions.reduce(
    (total, item) => total + (getActivityResourceCost(item, state.difficulty).energy || 0),
    0,
  )
  const scenario = SCENARIOS[state.scenario || 'baseline']
  const solarLossFactor = state.dustStormDaysRemaining > 0
    ? 1 - state.dustStormSolarLossFraction
    : 1
  const generatedEnergy =
    solarCount * getSolarGenerationKwh(state.destination, scenario.solarOutput, state.day, 1 - solarLossFactor) +
    countBuilding(state.buildings, 'reactor', offlineBuildings) *
      POWER_SYSTEM.reactorOutputKw * POWER_SYSTEM.energyBudgetHoursPerCycle
  const requiredEnergy = (state.survivalMode
    ? POWER_SYSTEM.survivalLoadKw * POWER_SYSTEM.energyBudgetHoursPerCycle
    : dailyBuildingEnergyUse(state.buildings, offlineBuildings)) +
    crewEnergyUse + activityEnergyUse
  const powerFactor = requiredEnergy === 0
    ? 1
    : Math.min(1, Math.max(0, next.energy + generatedEnergy) / requiredEnergy)
  const lifeSupportOxygen = lifeSupportCount * 1.8 * powerFactor
  const eclss = getCrewDailyEclssBalance(state.crewSize, state.difficulty, recyclerCount > 0, lifeSupportCount > 0)
  const crewWaterUse = eclss.waterConsumedLiters * scenario.waterUseMultiplier
  const waterRecovered = eclss.totalWaterRecoveredLiters * powerFactor * scenario.waterUseMultiplier
  const waterElectrolysisUse = lifeSupportOxygen * RESOURCE_RATES.electrolysisWaterKgPerOxygenKg
  const waterLeakUse = state.ongoingLeak
    ? convertLegacyResourceDelta('water', 5) * consumptionFactor * scenario.waterUseMultiplier
    : 0
  const greenhouseWaterUse = greenhouseCount * GREENHOUSE_CYCLE.waterLitersPerDay
  const waterBeforeGreenhouse = Math.max(0, next.water + production.water * powerFactor -
    (crewWaterUse - waterRecovered) - waterElectrolysisUse - waterLeakUse)
  const greenhouseFactor = state.regolithPreTreated && greenhouseCount > 0
    ? Math.min(powerFactor, greenhouseWaterUse > 0 ? waterBeforeGreenhouse / greenhouseWaterUse : powerFactor)
    : 0
  const greenhouseOxygen = greenhouseCount > 0
    ? greenhouseCount * (GREENHOUSE_CYCLE.oxygenKg / GREENHOUSE_CYCLE.growthDays) * greenhouseFactor
    : 0
  const oxygenUse = eclss.oxygenConsumedKg

  next.energy = clamp(
    next.energy + generatedEnergy - requiredEnergy,
    getEnergyCapacity(state),
  )
  next.oxygen = clamp(
    next.oxygen + production.oxygen * powerFactor + greenhouseOxygen - oxygenUse -
      additionalActions.reduce((total, item) => total + (getActivityResourceCost(item, state.difficulty).oxygen || 0), 0),
  )
  next.water = clamp(
    next.water + production.water * powerFactor -
      (crewWaterUse - waterRecovered) -
      waterElectrolysisUse -
      greenhouseWaterUse * greenhouseFactor -
      waterLeakUse,
  )
  const foodProduction = greenhouseCount > 0
    ? greenhouseCount * (GREENHOUSE_CYCLE.foodKg / GREENHOUSE_CYCLE.growthDays) * greenhouseFactor
    : production.food * powerFactor
  next.food = clamp(next.food + foodProduction - eclss.foodConsumedKg)
  next.health = clamp(
    next.health + production.health +
      actions.filter((item) => item === 'rest').length * RESOURCE_RATES.restHealthRecoveryPoints,
  )
  const explorations = actions.filter((item) => item === 'explore').length
  const expectedExplorationHealthLoss = explorations * 16 * getExplorationRisk(state)
  const fatigueHealthLoss = state.fatigue >= 80 ? 3 : 0
  const projectedRadiation = forecastRadiationExposure(state, actions)
  const radiationHealthLoss = projectedRadiation >= ENVIRONMENT.careerRadiationLimitMsv ? 2 : 0
  const resourceShortageHealthLoss = next.water <= 0 || next.food <= 0 ? 10 : 0
  next.health = clamp(next.health - expectedExplorationHealthLoss - fatigueHealthLoss - radiationHealthLoss - resourceShortageHealthLoss)
  return next
}

export function forecastRadiationExposure(state: GameState, action: Action | readonly Action[] | null = null): number {
  const shelterOnline =
    state.buildings.includes('storm-shelter') &&
    !(state.offlineBuildings || []).includes('storm-shelter')
  const isTransit = state.missionPhase === 'outbound' || state.missionPhase === 'return'
  const ambientExposure = isTransit
    ? ENVIRONMENT.transitRadiationMsvPerDay
    : state.destination === 'mars'
      ? ENVIRONMENT.marsSurfaceRadiationMsvPerDay
      : 1.4
  void action
  const shieldingFactor = shelterOnline ? 0.25 : 1
  return state.radiationExposure + ambientExposure * shieldingFactor
}

function advanceOxygenEmergency(state: GameState, elapsedHours: number): GameState {
  if (state.resources.oxygen > 0) return { ...state, oxygenEmergencyHoursRemaining: null }
  const remaining = Math.max(0, (state.oxygenEmergencyHoursRemaining ?? 6) - elapsedHours)
  if (remaining > 0) return { ...state, oxygenEmergencyHoursRemaining: remaining }
  const failureCause: MissionFailure = { resource: 'oxygen', source: 'daily-operation' }
  return {
    ...state,
    oxygenEmergencyHoursRemaining: 0,
    isGameOver: true,
    missionResult: 'evacuation',
    failureCause,
    lastMessage: 'Oxygen is depleted; the six-hour emergency reserve has expired.',
  }
}

function updateDustStorm(state: GameState): Pick<GameState, 'dustStormDaysRemaining' | 'dustStormSolarLossFraction'> {
  if (state.dustStormDaysRemaining > 0) {
    const remaining = state.dustStormDaysRemaining - 1
    return {
      dustStormDaysRemaining: remaining,
      dustStormSolarLossFraction: remaining > 0 ? state.dustStormSolarLossFraction : 0,
    }
  }
  if (state.destination !== 'mars' || deterministicRoll(state.missionSeed, state.day, 71) >= 0.06) {
    return { dustStormDaysRemaining: 0, dustStormSolarLossFraction: 0 }
  }
  const durationRoll = deterministicRoll(state.missionSeed, state.day, 72)
  const lossRoll = deterministicRoll(state.missionSeed, state.day, 73)
  return {
    dustStormDaysRemaining: 3 + Math.floor(durationRoll * 3),
    dustStormSolarLossFraction: 0.8 + lossRoll * 0.15,
  }
}

export function triggerDustStorm(state: GameState, durationDays: number, solarLossFraction: number): GameState {
  if (
    state.destination !== 'mars' ||
    !Number.isInteger(durationDays) ||
    durationDays < ENVIRONMENT.marsSolarStormDays.min ||
    durationDays > ENVIRONMENT.marsSolarStormDays.max ||
    solarLossFraction < ENVIRONMENT.marsSolarStormLossFraction.min ||
    solarLossFraction > ENVIRONMENT.marsSolarStormLossFraction.max
  ) {
    return { ...state, lastMessage: 'Dust storm parameters are outside the supported Mars hazard range.' }
  }
  return { ...state, dustStormDaysRemaining: durationDays, dustStormSolarLossFraction: solarLossFraction }
}

export function isLunarNight(day: number): boolean {
  const lunarPhase = ((day - 1) % 29.53059) / 29.53059
  return lunarPhase >= 0.25 && lunarPhase < 0.75
}

export function getLunarSurfaceTemperatureCelsius(day: number): number | null {
  return isLunarNight(day) ? ENVIRONMENT.lunarNightTemperatureCelsius : null
}

export function finishDay(state: GameState, action: Action | readonly Action[]): GameState {
  if (!state.started || state.paused || state.isGameOver || state.activeEvent || state.daysSurvived >= state.maxDays) return state
  const actions = normalizeActions(action)
  if (!actions.length) actions.push('rest')
  const depletedBeforeAdvance = (['energy', 'health'] as const)
    .find((resource) => state.resources[resource] <= 0)
  if (depletedBeforeAdvance) {
    const failureCause: MissionFailure = {
      resource: depletedBeforeAdvance,
      source: 'daily-operation',
      action: actions[actions.length - 1],
    }
    return endIfDepleted({ ...state, failureCause }, failureCause)
  }
  const tutorialStep: Partial<Record<Action, TutorialStep>> = {
    maintenance: 'maintenance',
    rest: 'rest',
    research: 'research',
  }
  const cycleState = {
    ...state,
    resources: forecastResources(state, actions),
    daysSurvived: state.daysSurvived + 1,
  }
  const tutorialState = actions.reduce((current, item) => {
    const step = tutorialStep[item]
    return step ? recordTutorialStep(current, step) : current
  }, cycleState)
  const next = { ...advanceOperationCycle(tutorialState) }
  next.actionHistory = [...state.actionHistory, ...actions]
  next.radiationExposure = forecastRadiationExposure(state, actions)
  next.permanentRadiationDamageWarning =
    state.permanentRadiationDamageWarning || next.radiationExposure >= ENVIRONMENT.careerRadiationLimitMsv
  next.oxygenEmergencyHoursRemaining = next.resources.oxygen <= 0
    ? state.oxygenEmergencyHoursRemaining ?? 6
    : null
  const radiationLimitJustReached = next.permanentRadiationDamageWarning && !state.permanentRadiationDamageWarning
  Object.assign(next, updateDustStorm(state))
  const fatigueChange: Record<Action, number> = {
    research: 8,
    explore: 20,
    maintenance: 3,
    exercise: 8,
    rest: -24,
  }
  const moraleChange: Record<Action, number> = {
    research: 1,
    explore: -7,
    maintenance: 3,
    exercise: 2,
    rest: 8,
  }
  next.fatigue = clampPercent(state.fatigue + actions.reduce((total, item) => total + 4 + fatigueChange[item], 0))
  next.morale = clampPercent(state.morale + actions.reduce((total, item) => total - 2 + moraleChange[item], 0))
  next.science += actions.reduce((total, item) => total + (item === 'research'
    ? Math.round(15 * (0.7 + state.morale / 250))
    : item === 'explore' ? 8 : 0), 0)
  const explorations = actions.filter((item) => item === 'explore').length
  for (let index = 0; index < explorations; index += 1) {
    const success = deterministicRoll(state.missionSeed, state.day, 1 + index) >= getExplorationRisk(state)
    if (success) {
      next.successfulExpeditions += 1
      next.resources.credits += 60
      next.resources.water = clamp(next.resources.water + 12)
      next.lastMessage = 'نجحت الرحلة الاستكشافية! عثر الفريق على عينات ومخزون ماء.'
    } else {
      next.resources.health = clamp(next.resources.health - 16)
      next.lastMessage = 'واجه الفريق تضاريس خطرة في الرحلة وعاد بإصابات طفيفة.'
    }
  }
  const lastAction = actions[actions.length - 1]
  if (explorations === 0 && actions.includes('research')) {
    next.lastMessage = `اكتمل البحث العلمي وأُضيفت نقاط علم. إرهاق الطاقم ${next.fatigue}٪ ومعنوياته ${next.morale}٪.`
  } else if (explorations === 0 && actions.includes('maintenance')) {
    next.lastMessage = `الصيانة خفّضت استهلاك الموارد. إرهاق الطاقم ${next.fatigue}٪.`
  } else {
    next.lastMessage = `استعاد الطاقم عافيته؛ الإرهاق ${next.fatigue}٪ والمعنويات ${next.morale}٪.`
  }
  if (radiationLimitJustReached) {
    next.lastMessage = 'Warning: cumulative radiation has reached NASA’s 600 mSv career-limit reference.'
  }
  next.lastAction = lastAction
  next.log = [...state.log, `اليوم ${state.day}: ${actions.join(', ')}`]
  const suppliesAboveThreshold = (['energy', 'oxygen', 'water', 'food'] as const)
    .every((resource) => next.resources[resource] > 80)
  next.resourceStreak = suppliesAboveThreshold ? state.resourceStreak + 1 : 0
  Object.assign(next, updateAutomaticLoadShed(next))

  const depleted = (['energy', 'health'] as const).find(
    (key) => next.resources[key] <= 0,
  )
  if (depleted) {
    next.isGameOver = true
    next.missionResult = 'evacuation'
    next.failureCause = { resource: depleted, source: 'daily-operation', action: lastAction }
    next.lastMessage = `انخفض ${depleted} إلى الصفر، واضطر الطاقم إلى الإخلاء.`
    return next
  }
  if (next.daysSurvived >= next.maxDays) {
    next.day = next.maxDays
    next.hour = MISSION_DAY_START
    next.todayActions = []
    next.missionPhase = 'return'
    next.lastMessage = 'اكتملت العمليات السطحية؛ بدأت رحلة العودة إلى الأرض.'
    return next
  }
  next.day += 1
  next.hour = MISSION_DAY_START
  next.todayActions = []
  next.missionPhase = 'surface'
  return next
}

function normalizeActions(action: Action | readonly Action[] | null): Action[] {
  if (action === null) return []
  return typeof action === 'string' ? [action] : [...action]
}

function getAdditionalActions(scheduled: readonly Action[], planned: readonly Action[]): Action[] {
  const scheduledCounts = new Map<Action, number>()
  for (const action of scheduled) {
    scheduledCounts.set(action, (scheduledCounts.get(action) || 0) + 1)
  }
  const plannedCounts = new Map<Action, number>()
  return planned.filter((action) => {
    const count = (plannedCounts.get(action) || 0) + 1
    plannedCounts.set(action, count)
    return count > (scheduledCounts.get(action) || 0)
  })
}

const SPECIALIST_ACTIONS: Record<CrewRole, readonly Action[]> = {
  commander: ['explore', 'maintenance', 'exercise', 'rest'],
  'power-engineer': ['maintenance', 'research', 'exercise', 'rest'],
  biologist: ['research', 'explore', 'exercise', 'rest'],
  'water-officer': ['maintenance', 'explore', 'exercise', 'rest'],
}

export function canPerformActivity(state: GameState, action: Action): boolean {
  if (state.controlMode === 'full') return true
  return SPECIALIST_ACTIONS[state.controlledRole].includes(action)
}

function hasCompletedDailyRequirements(actions: readonly Action[]): boolean {
  return actions.includes('exercise') &&
    actions.some((action) => action === 'maintenance' || action === 'research' || action === 'explore')
}

function preservesDailyRequirements(state: GameState, elapsedHours: number): boolean {
  if (hasCompletedDailyRequirements(state.todayActions)) return true
  const exerciseRemaining = state.todayActions.includes('exercise') ? 0 : DAILY_EXERCISE_HOURS
  const workRemaining = state.todayActions.some((action) =>
    action === 'maintenance' || action === 'research' || action === 'explore',
  ) ? 0 : ACTIVITY_DURATIONS.maintenance
  return state.hour + elapsedHours + exerciseRemaining + workRemaining <= MISSION_DAY_END
}

export function canScheduleActivity(state: GameState, action: Action): boolean {
  if (!state.started || state.paused || state.isGameOver || state.activeEvent) return false
  if (state.missionPhase === 'outbound' && !state.transitDecisions.some((decision) => decision.leg === 'outbound')) return false
  if (state.missionPhase === 'return' && !state.transitDecisions.some((decision) => decision.leg === 'return')) return false
  if (!canPerformActivity(state, action) || state.hour + ACTIVITY_DURATIONS[action] > MISSION_DAY_END) return false
  if (action === 'rest' && state.todayActions.filter((item) => item === 'rest').length >= DAILY_REST_LIMIT) return false

  const actionsAfterSchedule = [...state.todayActions, action]
  return preservesDailyRequirements({ ...state, todayActions: actionsAfterSchedule }, ACTIVITY_DURATIONS[action])
}

export function scheduleActivity(state: GameState, action: Action): GameState {
  if (!canScheduleActivity(state, action)) {
    const lastMessage = action === 'rest' && state.todayActions.includes('rest')
      ? 'The daily rest block has already been used.'
      : 'Reserve time for daily exercise and at least one work activity before scheduling optional activities.'
    return { ...state, lastMessage }
  }
  const cost = getActivityResourceCost(action, state.difficulty)
  const energyCapacity = getEnergyCapacity(state)
  const resources = { ...state.resources }
  if (cost.energy !== undefined) resources.energy = clamp(resources.energy - cost.energy, energyCapacity)
  if (cost.oxygen !== undefined) resources.oxygen = clamp(resources.oxygen - cost.oxygen)
  const scheduled = {
    ...state,
    resources,
    hour: state.hour + ACTIVITY_DURATIONS[action],
    todayActions: [...state.todayActions, action],
    lastMessage: '',
  }
  const elapsed = advanceOxygenEmergency(scheduled, ACTIVITY_DURATIONS[action])
  return endIfDepleted(elapsed, { resource: (['energy', 'oxygen'] as const).find((resource) => resources[resource] <= 0) || 'energy', source: 'daily-operation', action })
}

export function canSleepAndAdvance(state: GameState): boolean {
  const transitReady = (state.missionPhase !== 'outbound' || state.transitDecisions.some((decision) => decision.leg === 'outbound'))
    && (state.missionPhase !== 'return' || state.transitDecisions.some((decision) => decision.leg === 'return'))
  return transitReady && state.daysSurvived < state.maxDays && state.hour >= MISSION_BEDTIME &&
    !state.activeEvent && !state.isGameOver && state.started && !state.paused &&
    hasCompletedDailyRequirements(state.todayActions)
}

export function canWaitUntilBedtime(state: GameState): boolean {
  const transitReady = (state.missionPhase !== 'outbound' || state.transitDecisions.some((decision) => decision.leg === 'outbound'))
    && (state.missionPhase !== 'return' || state.transitDecisions.some((decision) => decision.leg === 'return'))
  return transitReady && !state.paused && !state.isGameOver && !state.activeEvent && state.started &&
    state.hour < MISSION_BEDTIME && hasCompletedDailyRequirements(state.todayActions)
}

export function waitUntilBedtime(state: GameState): GameState {
  const transitReady = (state.missionPhase !== 'outbound' || state.transitDecisions.some((decision) => decision.leg === 'outbound'))
    && (state.missionPhase !== 'return' || state.transitDecisions.some((decision) => decision.leg === 'return'))
  if (!transitReady || !state.started || state.paused || state.isGameOver || state.activeEvent || state.hour >= MISSION_BEDTIME) return state
  if (!hasCompletedDailyRequirements(state.todayActions)) {
    return { ...state, lastMessage: 'Complete daily exercise and one work activity before advancing to bedtime.' }
  }
  return advanceOxygenEmergency(
    { ...state, hour: MISSION_BEDTIME },
    MISSION_BEDTIME - state.hour,
  )
}

export function sleepAndAdvanceDay(state: GameState, crewCoordinatedAction?: Action): GameState {
  if (!canSleepAndAdvance(state)) return state
  const actions: Action[] = [...state.todayActions, ...(crewCoordinatedAction ? [crewCoordinatedAction] : []), 'rest']
  const afterSleep = advanceOxygenEmergency(state, 8)
  if (afterSleep.isGameOver) return afterSleep
  const next = finishDay(afterSleep, actions)
  next.actionHistory = [...state.actionHistory, ...state.todayActions]
  next.lastAction = state.todayActions[state.todayActions.length - 1] || crewCoordinatedAction || 'rest'
  if (next.failureCause?.source === 'daily-operation') {
    next.failureCause = { ...next.failureCause, action: next.lastAction }
  }
  if (crewCoordinatedAction) {
    next.crewSupportActionHistory = [...state.crewSupportActionHistory, crewCoordinatedAction]
    next.log = [...next.log, `Day ${state.day}: crew support activity ${crewCoordinatedAction}`]
  }
  return next
}

export function resolveTransitDecision(
  state: GameState,
  leg: 'outbound' | 'return',
  choice: TransitChoice,
): GameState {
  if (state.missionPhase !== leg || state.transitDecisions.some((decision) => decision.leg === leg)) return state
  const next: GameState = {
    ...state,
    resources: { ...state.resources },
    transitDecisions: [...state.transitDecisions, { leg, choice }],
    missionPhase: leg === 'outbound' ? 'surface' : 'return',
  }
  const transferRoute = state.destination === 'moon'
    ? leg === 'outbound' ? 'earth-moon' : 'moon-earth'
    : leg === 'outbound' ? 'earth-mars' : 'mars-earth'
  next.radiationExposure += estimateTransfer(transferRoute).durationDays * ENVIRONMENT.transitRadiationMsvPerDay
  next.permanentRadiationDamageWarning =
    state.permanentRadiationDamageWarning || next.radiationExposure >= ENVIRONMENT.careerRadiationLimitMsv
  if (choice === 'conservative') {
    next.resources.energy = clamp(next.resources.energy - 8)
    next.fatigue = clampPercent(next.fatigue + 3)
    next.lastMessage = 'اختير مسار محافظ: استهلاك طاقة أعلى مقابل عبور منخفض المخاطر.'
  } else {
    next.resources.energy = clamp(next.resources.energy - 3)
    const channel = leg === 'outbound' ? 40 : 41
    if (deterministicRoll(state.missionSeed, state.day, channel) < 0.25) {
      next.resources.health = clamp(next.resources.health - 12)
      next.fatigue = clampPercent(next.fatigue + 12)
      next.lastMessage = 'المسار السريع وفر الطاقة، لكن اضطرابًا في العبور أرهق الطاقم.'
    } else {
      next.fatigue = clampPercent(next.fatigue + 4)
      next.lastMessage = 'اكتمل المسار السريع دون اضطراب؛ تم توفير الطاقة.'
    }
  }
  next.log = [...state.log, `اليوم ${state.day}: ${leg} transit (${choice})`]
  const depleted = (['energy', 'health'] as const)
    .find((resource) => next.resources[resource] <= 0)
  if (!depleted) {
    if (leg === 'return') {
      next.isGameOver = true
      next.missionResult = 'success'
      next.lastMessage = 'اكتملت الرحلة وعاد الطاقم إلى الأرض بسلام.'
    }
    if (next.permanentRadiationDamageWarning && !state.permanentRadiationDamageWarning) {
      next.lastMessage += ' Warning: cumulative radiation has reached the 600 mSv career-limit reference.'
    }
    return next
  }
  next.failureCause = { resource: depleted, source: 'transit', transitLeg: leg, transitChoice: choice }
  return endIfDepleted(next, next.failureCause)
}

export function getObjectiveTarget(state: Pick<GameState, 'objective' | 'maxDays'>): number {
  if (state.objective === 'science') return state.maxDays * 6
  if (state.objective === 'exploration') return Math.max(1, Math.ceil(state.maxDays / 10))
  if (state.objective === 'tutorial') return TUTORIAL_STEPS.length
  return state.maxDays
}

export function getObjectiveProgress(state: Pick<GameState, 'objective' | 'maxDays' | 'daysSurvived' | 'science' | 'successfulExpeditions' | 'tutorialSteps'>): number {
  if (state.objective === 'science') return state.science
  if (state.objective === 'exploration') return state.successfulExpeditions
  if (state.objective === 'tutorial') return state.tutorialSteps.length
  return state.daysSurvived
}

export function isObjectiveComplete(state: Parameters<typeof getObjectiveProgress>[0] & Pick<GameState, 'objective'>): boolean {
  return getObjectiveProgress(state) >= getObjectiveTarget(state)
}

export function calculateMissionScore(state: Pick<GameState, 'daysSurvived' | 'maxDays' | 'science' | 'resources' | 'fatigue' | 'morale' | 'radiationExposure' | 'totalRescues'>): number {
  const survival = Math.min(1, state.daysSurvived / state.maxDays) * 40
  const science = Math.min(1, state.science / (state.maxDays * 8)) * 25
  const crewReadiness = ((state.resources.health + state.morale + (100 - state.fatigue)) / 3) * 0.2
  const supplies = (state.resources.energy + state.resources.oxygen + state.resources.water + state.resources.food) / 4 * 0.15
  const rescueBonus = Math.min(5, state.totalRescues)
  const radiationPenalty = Math.min(10, state.radiationExposure * 0.1)
  return Math.max(0, Math.min(100, Math.round(survival + science + crewReadiness + supplies + rescueBonus - radiationPenalty)))
}

export function recordTutorialStep(state: GameState, step: TutorialStep): GameState {
  if (state.objective !== 'tutorial') return state
  const steps = state.tutorialSteps || []
  if (TUTORIAL_STEPS[steps.length] !== step) return state
  return { ...state, tutorialSteps: [...steps, step] }
}

export function resetResourceStreakIfNeeded(state: GameState): GameState {
  const allSuppliesHealthy = (['energy', 'oxygen', 'water', 'food'] as const)
    .every((resource) => state.resources[resource] > 80)
  return allSuppliesHealthy || state.resourceStreak === 0
    ? state
    : { ...state, resourceStreak: 0 }
}

export function settleAfterEvent(state: GameState, failureCause?: MissionFailure): GameState {
  const depleted = (['energy', 'health'] as const).find(
    (key) => state.resources[key] <= 0,
  )
  if (depleted) {
    return {
      ...state,
      activeEvent: null,
      isGameOver: true,
      missionResult: 'evacuation',
      failureCause: failureCause || state.failureCause || { resource: depleted, source: 'event' },
      lastMessage: `انخفض ${depleted} إلى الصفر، واضطر الطاقم إلى الإخلاء.`,
    }
  }
  if (state.resources.oxygen <= 0 && state.oxygenEmergencyHoursRemaining === null) {
    state = { ...state, oxygenEmergencyHoursRemaining: 6 }
  } else if (state.resources.oxygen > 0) {
    state = { ...state, oxygenEmergencyHoursRemaining: null }
  }
  if (state.daysSurvived >= state.maxDays) {
    return { ...state, activeEvent: null, isGameOver: true, missionResult: 'success', hour: MISSION_DAY_START, todayActions: [] }
  }
  const next = { ...state, activeEvent: null, day: state.day + 1, hour: MISSION_DAY_START, todayActions: [] }
  return { ...next, ...updateAutomaticLoadShed(next) }
}

export function canBuild(state: GameState, buildingId: string): boolean {
  if (!canManageMissionActivity(state) || state.hour + 2 > MISSION_DAY_END || !preservesDailyRequirements(state, 2)) return false
  const building = BUILDINGS[buildingId]
  if (!building || state.buildings.includes(buildingId) || (building.destination && building.destination !== state.destination)) return false
  if (buildingId === 'greenhouse' && !state.regolithPreTreated) return false
  const earlierPhases = BUILDING_PHASES.filter((phase) => phase.phase < building.phase)
  if (earlierPhases.some((phase) => phase.buildings.some((requiredId) => {
    const required = BUILDINGS[requiredId]
    return (!required.destination || required.destination === state.destination) && !state.buildings.includes(requiredId)
  }))) return false
  if (state.controlMode === 'specialist' && !canManageFacility(state.controlledRole, buildingId)) return false
  if (state.resources.credits < building.cost || state.resources.cargo < building.cargo) return false
  if (state.resources.energy < building.energyCost) return false
  return true
}

export function canToggleBuilding(state: GameState, buildingId: string): boolean {
  if (!canManageMissionActivity(state) || state.hour + 1 > MISSION_DAY_END || !preservesDailyRequirements(state, 1) || !state.buildings.includes(buildingId) || !BUILDINGS[buildingId]) return false
  if (state.survivalMode && POWER_SYSTEM.productiveBuildings.includes(buildingId as typeof POWER_SYSTEM.productiveBuildings[number])) return false
  if (state.controlMode === 'specialist' && !canManageFacility(state.controlledRole, buildingId)) return false
  const offlineBuildings = state.offlineBuildings || []
  if (!offlineBuildings.includes(buildingId) && buildingId === 'life-support') {
    const otherActiveOxygenSources = state.buildings.some((id) =>
      id !== buildingId &&
      !offlineBuildings.includes(id) &&
      (BUILDINGS[id]?.production.oxygen || 0) > 0,
    )
    if (!otherActiveOxygenSources) return false
  }
  return true
}

export function toggleBuildingInState(state: GameState, buildingId: string): GameState {
  if (!canToggleBuilding(state, buildingId)) {
    const lastMessage = state.buildings.includes(buildingId) &&
      state.hour + 1 <= MISSION_DAY_END &&
      !preservesDailyRequirements(state, 1)
      ? 'Reserve time for daily exercise and one work activity before operating facilities.'
      : state.buildings.includes(buildingId) &&
        state.survivalMode &&
        POWER_SYSTEM.productiveBuildings.includes(buildingId as typeof POWER_SYSTEM.productiveBuildings[number])
        ? 'Productive facilities are offline during Survival Mode.'
        : state.buildings.includes(buildingId)
          ? 'Keep at least one oxygen-production system online or check crew authorization.'
          : 'That facility is not part of this base.'
    return {
      ...state,
      lastMessage,
    }
  }
  const offlineBuildings = state.offlineBuildings || []
  const isOffline = offlineBuildings.includes(buildingId)
  const updatedOfflineBuildings = isOffline
    ? offlineBuildings.filter((id) => id !== buildingId)
    : [...offlineBuildings, buildingId]
  const next = {
    ...state,
    hour: state.hour + 1,
    offlineBuildings: updatedOfflineBuildings,
    autoShedBuildings: isOffline
      ? (state.autoShedBuildings || []).filter((id) => id !== buildingId)
      : state.autoShedBuildings,
    lastMessage: `${BUILDINGS[buildingId].name.en} ${isOffline ? 'returned to service' : 'placed offline'} by crew command.`,
  }
  return advanceOxygenEmergency(next, 1)
}

export function buildInState(state: GameState, buildingId: string): GameState {
  if (!canBuild(state, buildingId)) {
    const building = BUILDINGS[buildingId]
    const earlierPhases = building
      ? BUILDING_PHASES.filter((phase) => phase.phase < building.phase)
      : []
    const missingDependency = earlierPhases.some((phase) =>
      phase.buildings.some((requiredId) => {
        const required = BUILDINGS[requiredId]
        return (!required.destination || required.destination === state.destination) && !state.buildings.includes(requiredId)
      }),
    )
    const lastMessage = buildingId === 'greenhouse' && !state.regolithPreTreated
      ? 'Pretreat perchlorate-bearing regolith at an active ISRU plant before building the greenhouse.'
      : !canManageMissionActivity(state)
      ? 'Facility work is unavailable during this mission phase.'
      : state.hour + 2 > MISSION_DAY_END || !preservesDailyRequirements(state, 2)
        ? 'Not enough shift time remains for construction.'
        : building && state.buildings.includes(buildingId)
          ? 'This facility has already been constructed.'
          : missingDependency
            ? 'Complete all facilities in earlier construction phases first.'
        : building && state.controlMode === 'specialist' && !canManageFacility(state.controlledRole, buildingId)
          ? 'This facility is outside your selected specialist role.'
          : !building || (building.destination && building.destination !== state.destination)
            ? 'This facility is unavailable for the selected destination.'
            : 'Insufficient credits, cargo, or power to build this facility.'
    return { ...state, lastMessage }
  }
  const building = BUILDINGS[buildingId]
  const next: GameState = {
    ...state,
    hour: state.hour + 2,
    resources: {
      ...state.resources,
      credits: state.resources.credits - building.cost,
      cargo: state.resources.cargo - building.cargo,
      energy: state.resources.energy - building.energyCost,
    },
    buildings: [...state.buildings, buildingId],
    offlineBuildings: state.survivalMode && POWER_SYSTEM.productiveBuildings.includes(buildingId as typeof POWER_SYSTEM.productiveBuildings[number])
      ? [...new Set([...(state.offlineBuildings || []), buildingId])]
      : state.offlineBuildings || [],
    lastMessage: `تم بناء ${building.name.ar} بنجاح.`,
  }
  if (state.survivalMode && POWER_SYSTEM.productiveBuildings.includes(buildingId as typeof POWER_SYSTEM.productiveBuildings[number])) {
    next.survivalModeOfflineBuildings = [...state.survivalModeOfflineBuildings, buildingId]
  }
  const elapsed = advanceOxygenEmergency(next, 2)
  return buildingId === 'greenhouse' ? recordTutorialStep(elapsed, 'greenhouse') : elapsed
}

function canManageMissionActivity(state: GameState): boolean {
  if (!state.started || state.paused || state.isGameOver || state.activeEvent) return false
  return (state.missionPhase !== 'outbound' || state.transitDecisions.some((decision) => decision.leg === 'outbound')) &&
    (state.missionPhase !== 'return' || state.transitDecisions.some((decision) => decision.leg === 'return'))
}

function canManageFacility(role: CrewRole, buildingId: string): boolean {
  if (role === 'commander') return true
  if (role === 'power-engineer') return ['solar-panels', 'reactor', 'battery', 'life-support', 'storm-shelter'].includes(buildingId)
  if (role === 'biologist') return ['greenhouse', 'medical-bay', 'research-lab'].includes(buildingId)
  return ['water-recycler', 'water-tank'].includes(buildingId)
}

export function endIfDepleted(state: GameState, failureCause?: MissionFailure): GameState {
  let depleted: ResourceName | undefined = (['energy', 'health'] as const).find(
    (key) => state.resources[key] <= 0,
  )
  if (!depleted && state.resources.oxygen <= 0 && state.oxygenEmergencyHoursRemaining === 0) {
    depleted = 'oxygen'
  }
  return depleted
    ? {
        ...state,
        isGameOver: true,
        missionResult: 'evacuation',
        failureCause: failureCause || state.failureCause || { resource: depleted, source: 'event' },
        lastMessage: `نفد ${depleted} وتم إجلاء الطاقم.`,
      }
    : state
}

export function analyzeMissionBehavior(history: readonly Action[]): Record<Action, number> {
  return history.reduce<Record<Action, number>>((counts, action) => {
    counts[action] += 1
    return counts
  }, { research: 0, explore: 0, maintenance: 0, exercise: 0, rest: 0 })
}
