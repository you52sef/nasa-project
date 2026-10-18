import { BUILDING_PHASES, BUILDINGS, getConstructionDurationHours } from './buildings'
import { SIMULATED_TRANSIT_DAYS } from './flightPhysics'
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
import { CREW_DUTIES, getCrewAssignmentById, getCrewRoster } from './crewRosters'

export type Destination = 'moon' | 'mars'
export type Action = 'research' | 'explore' | 'maintenance' | 'exercise' | 'rest'
export type ResourceName = 'energy' | 'oxygen' | 'water' | 'food' | 'health'
export type MissionDifficulty = 'easy' | 'normal' | 'hard'
export type MissionObjective = 'survival' | 'science' | 'exploration' | 'tutorial'
export type MissionType = 'moon-exploration' | 'moon-settlement' | 'mars-opposition' | 'mars-conjunction'
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
  missionType?: MissionType
  difficulty: MissionDifficulty
  objective: MissionObjective
  scenario: ScenarioId
  missionMode?: MissionMode
  controlMode?: ControlMode
  controlledRole?: CrewRole
  controlledDutyId?: string
  astronautName?: string
  astronautDutyId?: string
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

export const MISSION_DURATIONS = [10, 30, 60, 180] as const
export const MISSION_TYPE_MAX_DAYS: Readonly<Record<MissionType, number>> = {
  'moon-exploration': 30,
  'moon-settlement': 180,
  'mars-opposition': 30,
  'mars-conjunction': 180,
}
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

export type DailyResourceSnapshot = Pick<Resources, 'energy' | 'oxygen' | 'water' | 'food' | 'health'>

export interface ConstructionProject {
  buildingId: string
  totalHours: number
  hoursRemaining: number
}

export interface DailyReport {
  day: number
  actions: Action[]
  resourcesAtStart: DailyResourceSnapshot
  resourcesAtEnd: DailyResourceSnapshot
  radiationMsv: number
  events: string[]
  earthTransmission: {
    status: 'queued' | 'local'
    delayMinutes: number
  }
}

export interface CrewDailyActivity {
  dutyId: string
  title: string
  action: Action
  effect: 'inspection' | 'science' | 'power' | 'water' | 'food' | 'food-water' | 'health' | 'coordination'
}

export interface GameEvent {
  id: string
  choiceIndex?: number
}

export interface CrewCommunicationRecord {
  day: number
  dutyId: string
  action: Action
  decision: 'accepted' | 'rejected'
  reason: CrewCommunicationReason
}

export type CrewCommunicationReason =
  | 'requestAccepted'
  | 'specialtyMismatch'
  | 'emergencyPriority'
  | 'crewFatigue'
  | 'energyInsufficient'
  | 'oxygenInsufficient'
  | 'crewBusy'
  | 'requestAlreadyHandled'

export interface GameState {
  started: boolean
  paused: boolean
  configVersion: number
  day: number
  maxDays: number
  missionType: MissionType
  daysSurvived: number
  missionMode: MissionMode
  controlMode: ControlMode
  controlledRole: CrewRole
  controlledDutyId: string
  astronautName: string
  astronautDutyId: string
  crewDailyActivities: CrewDailyActivity[]
  crewCommunications: CrewCommunicationRecord[]
  lastDebriefDay?: number | null
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
  dailyResourceStart: DailyResourceSnapshot
  dailyReports: DailyReport[]
  constructionEventsToday: string[]
  fatigue: number
  morale: number
  radiationExposure: number
  permanentRadiationDamageWarning: boolean
  activeOperation: ActiveOperation | null
  constructionProject: ConstructionProject | null
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
  missionResult: 'success' | 'failure' | 'evacuation' | 'ended' | null
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

export function snapshotDailyResources(resources: Resources): DailyResourceSnapshot {
  return {
    energy: resources.energy,
    oxygen: resources.oxygen,
    water: resources.water,
    food: resources.food,
    health: resources.health,
  }
}

export function initialGameState(
  destination: Destination,
  crewSize: number,
  baseName: string,
  missionSeed = createMissionSeed(),
  config: Partial<MissionConfig> = {},
): GameState {
  const resources: Resources = {
    energy: 85,
    oxygen: 90,
    water: 88,
    food: 82,
    health: 100,
    credits: 500,
    cargo: 100,
    ...SCENARIOS[config.scenario || 'baseline'].startingResources,
  }
  const missionType = config.missionType || (destination === 'moon'
    ? (config.maxDays && config.maxDays > 30 ? 'moon-settlement' : 'moon-exploration')
    : (config.maxDays && config.maxDays > 30 ? 'mars-conjunction' : 'mars-opposition'))
  const maxDays = config.maxDays === 10 || config.maxDays === 60
    ? config.maxDays
    : MISSION_TYPE_MAX_DAYS[missionType]
  return {
    started: true,
    paused: false,
    configVersion: 9,
    day: 1,
    maxDays,
    daysSurvived: 0,
    missionType,
    missionMode: config.missionMode || 'simulation',
    controlMode: config.controlMode || 'full',
    controlledRole: config.controlledRole || 'commander',
    controlledDutyId: config.controlledDutyId || '',
    astronautName: config.astronautName || '',
    astronautDutyId: config.astronautDutyId || config.controlledDutyId || '',
    crewDailyActivities: [],
    crewCommunications: [],
    lastDebriefDay: null,
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
    resources,
    dailyResourceStart: snapshotDailyResources(resources),
    dailyReports: [],
    constructionEventsToday: [],
    fatigue: 18,
    morale: 78,
    radiationExposure: 0,
    permanentRadiationDamageWarning: false,
    activeOperation: null,
    constructionProject: null,
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

export function getMarsCommunicationDelayMinutes(seed: number, day: number, action: Action): number {
  const actionChannel: Record<Action, number> = {
    research: 81,
    explore: 82,
    maintenance: 83,
    exercise: 84,
    rest: 85,
  }
  const { min, max } = ENVIRONMENT.marsCommunicationDelayMinutes
  return min + Math.floor(deterministicRoll(seed, day, actionChannel[action]) * (max - min + 1))
}

export function getActivityDurationHours(state: Pick<GameState, 'destination' | 'missionSeed' | 'day'>, action: Action): number {
  const isRemoteWork = action === 'research' || action === 'explore' || action === 'maintenance'
  const communicationDelayHours = state.destination === 'mars' && isRemoteWork
    ? getMarsCommunicationDelayMinutes(state.missionSeed, state.day, action) / 60
    : 0
  return ACTIVITY_DURATIONS[action] + communicationDelayHours
}

export function getSurfaceAtmosphericPressureKpa(destination: Destination): number {
  return 101.3 * (destination === 'mars' ? ENVIRONMENT.marsAtmosphericPressureEarthFraction : 0)
}

const clamp = (value: number, max = RESOURCE_CAP) => Math.max(0, Math.min(max, Math.round(value * 100) / 100))
const clampPercent = (value: number) => clamp(value)

export function getExplorationRisk(state: Pick<GameState, 'destination' | 'fatigue' | 'morale' | 'resources' | 'difficulty'>): number {
  const gravity = state.destination === 'mars' ? ENVIRONMENT.marsGravityEarthG : ENVIRONMENT.moonGravityEarthG
  const atmosphericPressureFraction = state.destination === 'mars'
    ? ENVIRONMENT.marsAtmosphericPressureEarthFraction
    : 0
  const gravityAndPressureRisk = (1 - gravity) * 0.01 + (1 - atmosphericPressureFraction) * 0.01
  const environmentalRisk = (state.destination === 'mars' ? 0.34 : 0.24) + gravityAndPressureRisk
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
  destination: Destination = 'moon',
): {
  oxygenConsumedKg: number
  waterConsumedLiters: number
  foodConsumedKg: number
  co2ProducedKg: number
  sabatierWaterRecoveredLiters: number
  totalWaterRecoveredLiters: number
} {
  const solLengthFactor = getCrewSolDurationHours(destination) / 24
  const crewWaterDemand = crewSize * WATER_PER_CREW_DAY * DIFFICULTY_MODIFIERS[difficulty].consumption * solLengthFactor
  const co2ProducedKg = crewSize * CO2_PER_CREW_DAY * solLengthFactor
  const sabatierWaterRecoveredLiters = hasSabatierProcessor ? co2ProducedKg * (36 / 44) : 0
  const targetRecovery = crewWaterDemand * WATER_RECYCLE_RATE[difficulty]
  const totalWaterRecoveredLiters = hasWaterRecycler
    ? targetRecovery
    : Math.min(targetRecovery, sabatierWaterRecoveredLiters)
  return {
    oxygenConsumedKg: crewSize * OXYGEN_PER_CREW_DAY * DIFFICULTY_MODIFIERS[difficulty].consumption * solLengthFactor,
    waterConsumedLiters: crewWaterDemand,
    foodConsumedKg: crewSize * FOOD_PER_CREW_DAY * DIFFICULTY_MODIFIERS[difficulty].consumption * solLengthFactor,
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
  const eclss = getCrewDailyEclssBalance(state.crewSize, state.difficulty, recyclerCount > 0, lifeSupportCount > 0, state.destination)
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

function advanceConstruction(state: GameState, elapsedHours: number): GameState {
  const project = state.constructionProject
  if (!project || elapsedHours <= 0) return state
  const hoursRemaining = Math.max(0, project.hoursRemaining - elapsedHours)
  if (hoursRemaining > 0) {
    return { ...state, constructionProject: { ...project, hoursRemaining } }
  }

  const completion = `${BUILDINGS[project.buildingId].name.en} construction completed`
  const next: GameState = {
    ...state,
    buildings: [...state.buildings, project.buildingId],
    constructionProject: null,
    constructionEventsToday: [...(state.constructionEventsToday || []), completion],
    log: [...state.log, `Day ${state.day}: ${completion}`],
    lastMessage: completion,
  }
  if (state.survivalMode && POWER_SYSTEM.productiveBuildings.includes(project.buildingId as typeof POWER_SYSTEM.productiveBuildings[number])) {
    next.offlineBuildings = [...new Set([...state.offlineBuildings, project.buildingId])]
    next.survivalModeOfflineBuildings = [...new Set([...state.survivalModeOfflineBuildings, project.buildingId])]
  }
  if (project.buildingId === 'greenhouse') {
    next.tutorialSteps = recordTutorialStep(next, 'greenhouse').tutorialSteps
  }
  return next
}

export function finishDay(state: GameState, action: Action | readonly Action[], constructionElapsedHours = 24): GameState {
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
  const constructionState = advanceConstruction(state, constructionElapsedHours)
  const cycleState = {
    ...constructionState,
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
  const reportEvents: string[] = [...(next.constructionEventsToday || [])]
  if (next.dustStormDaysRemaining > 0 && state.dustStormDaysRemaining === 0) {
    reportEvents.push(`Mars dust storm: ${next.dustStormDaysRemaining} days, ${Math.round(next.dustStormSolarLossFraction * 100)}% solar loss`)
  } else if (state.dustStormDaysRemaining > 0 && next.dustStormDaysRemaining === 0) {
    reportEvents.push('Mars dust storm cleared')
  }
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
  next.dailyReports = [
    ...state.dailyReports,
    {
      day: state.day,
      actions,
      resourcesAtStart: state.dailyResourceStart || snapshotDailyResources(state.resources),
      resourcesAtEnd: snapshotDailyResources(next.resources),
      radiationMsv: Math.max(0, next.radiationExposure - state.radiationExposure),
      events: reportEvents,
      earthTransmission: state.destination === 'mars'
        ? { status: 'queued', delayMinutes: getMarsCommunicationDelayMinutes(state.missionSeed, state.day, 'research') }
        : { status: 'local', delayMinutes: 0 },
    },
  ]
  next.constructionEventsToday = []
  next.dailyResourceStart = snapshotDailyResources(next.resources)

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
  if (isObjectiveComplete(next) || next.daysSurvived >= next.maxDays) {
    next.day = next.daysSurvived
    next.hour = MISSION_DAY_START
    next.todayActions = []
    next.missionPhase = 'return'
    next.lastMessage = isObjectiveComplete(next)
      ? 'اكتمل الهدف الرئيسي للمهمة؛ بدأ الاستعداد للعودة إلى الأرض.'
      : 'بلغت المهمة حدها الزمني؛ بدأ الاستعداد للعودة إلى الأرض.'
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

const DUTY_ACTIONS: Record<CrewAssignmentSpecialty, readonly Action[]> = {
  command: ['explore', 'maintenance', 'exercise', 'rest'],
  pilot: ['explore', 'maintenance', 'exercise', 'rest'],
  science: ['research', 'explore', 'exercise', 'rest'],
  medical: ['research', 'maintenance', 'exercise', 'rest'],
  engineering: ['maintenance', 'research', 'exercise', 'rest'],
  communications: ['maintenance', 'research', 'exercise', 'rest'],
  power: ['maintenance', 'research', 'exercise', 'rest'],
  resources: ['maintenance', 'research', 'exercise', 'rest'],
  robotics: ['maintenance', 'research', 'exercise', 'rest'],
  agriculture: ['research', 'maintenance', 'exercise', 'rest'],
  'agriculture-resources': ['research', 'maintenance', 'exercise', 'rest'],
  'science-medical': ['research', 'explore', 'maintenance', 'exercise', 'rest'],
  'engineering-science': ['maintenance', 'research', 'explore', 'exercise', 'rest'],
  'geology-agriculture': ['research', 'explore', 'maintenance', 'exercise', 'rest'],
}

type CrewAssignmentSpecialty = NonNullable<ReturnType<typeof getCrewAssignmentById>>['specialty']

function getControlledSpecialty(state: GameState): CrewAssignmentSpecialty | undefined {
  if (!state.controlledDutyId) return undefined
  return getCrewAssignmentById(state.destination, state.maxDays, state.crewSize, state.controlledDutyId)?.specialty
}

export function canControlFlight(state: Pick<GameState, 'controlMode' | 'controlledRole' | 'controlledDutyId' | 'destination' | 'maxDays' | 'crewSize'>): boolean {
  if (state.controlMode === 'full') return true
  if (!state.controlledDutyId) return state.controlledRole === 'commander'
  const assignment = getCrewAssignmentById(state.destination, state.maxDays, state.crewSize, state.controlledDutyId)
  if (!assignment) return false
  if (/\b(pilot|navigator)\b/i.test(assignment.title)) return true
  const roster = getCrewRoster(state.destination, state.maxDays, state.crewSize)
  const hasAssignedPilot = roster?.assignments.some((crewAssignment) => /\b(pilot|navigator)\b/i.test(crewAssignment.title)) || false
  return !hasAssignedPilot && assignment.specialty === 'command' && /\bcommander\b/i.test(assignment.title)
}

export function canPerformActivity(state: GameState, action: Action): boolean {
  if (state.controlMode === 'full') return true
  const specialty = getControlledSpecialty(state)
  if (specialty) return DUTY_ACTIONS[specialty].includes(action)
  if (state.controlledDutyId) return false
  return SPECIALIST_ACTIONS[state.controlledRole].includes(action)
}

export function getCompletedWorkShifts(actions: readonly Action[]): number {
  return actions.filter((action) => action === 'maintenance' || action === 'research' || action === 'explore').length
}

function hasCompletedDailyRequirements(actions: readonly Action[]): boolean {
  return actions.includes('exercise') && getCompletedWorkShifts(actions) >= 2
}

function preservesDailyRequirements(state: GameState, elapsedHours: number): boolean {
  if (hasCompletedDailyRequirements(state.todayActions)) return true
  const exerciseRemaining = state.todayActions.includes('exercise') ? 0 : getActivityDurationHours(state, 'exercise')
  const workRemaining = Math.max(0, 2 - getCompletedWorkShifts(state.todayActions)) *
    getActivityDurationHours(state, 'maintenance')
  return state.hour + elapsedHours + exerciseRemaining + workRemaining <= MISSION_DAY_END
}

export function canScheduleActivity(state: GameState, action: Action): boolean {
  if (!state.started || state.paused || state.isGameOver || state.activeEvent) return false
  if (state.missionPhase === 'outbound' && !state.transitDecisions.some((decision) => decision.leg === 'outbound')) return false
  if (state.missionPhase === 'return' && !state.transitDecisions.some((decision) => decision.leg === 'return')) return false
  const duration = getActivityDurationHours(state, action)
  if (!canPerformActivity(state, action) || state.hour + duration > MISSION_DAY_END) return false
  if (action === 'rest' && state.todayActions.filter((item) => item === 'rest').length >= DAILY_REST_LIMIT) return false

  const actionsAfterSchedule = [...state.todayActions, action]
  return preservesDailyRequirements({ ...state, todayActions: actionsAfterSchedule }, duration)
}

export function scheduleActivity(state: GameState, action: Action): GameState {
  if (!canScheduleActivity(state, action)) {
    const lastMessage = action === 'rest' && state.todayActions.includes('rest')
      ? 'The daily rest block has already been used.'
      : 'Reserve time for daily exercise and both work shifts before scheduling optional activities.'
    return { ...state, lastMessage }
  }
  const duration = getActivityDurationHours(state, action)
  const cost = getActivityResourceCost(action, state.difficulty)
  const energyCapacity = getEnergyCapacity(state)
  const resources = { ...state.resources }
  if (cost.energy !== undefined) resources.energy = clamp(resources.energy - cost.energy, energyCapacity)
  if (cost.oxygen !== undefined) resources.oxygen = clamp(resources.oxygen - cost.oxygen)
  const scheduled = {
    ...state,
    resources,
    hour: state.hour + duration,
    todayActions: [...state.todayActions, action],
    log: [...state.log, `Day ${state.day} ${action} scheduled`],
    lastMessage: '',
  }
  const elapsed = advanceOxygenEmergency(advanceConstruction(scheduled, duration), duration)
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
    return { ...state, lastMessage: 'Complete daily exercise and both work shifts before advancing to bedtime.' }
  }
  const elapsedHours = MISSION_BEDTIME - state.hour
  return advanceOxygenEmergency(
    advanceConstruction({ ...state, hour: MISSION_BEDTIME }, elapsedHours),
    elapsedHours,
  )
}

export function acknowledgeEveningDebrief(state: GameState): GameState {
  if (!canSleepAndAdvance(state) || state.lastDebriefDay === state.day) return state
  return {
    ...state,
    lastDebriefDay: state.day,
    log: [...state.log, `Day ${state.day}: evening crew debrief acknowledged.`],
  }
}

export function sleepAndAdvanceDay(state: GameState, crewCoordinatedAction?: Action): GameState {
  if (!canSleepAndAdvance(state)) return state
  const assistantActivities = getAutomatedCrewActivities(state)
  const roster = getCrewRoster(state.destination, state.maxDays, state.crewSize)
  const expectedAutomatedDuties = roster
    ? Math.max(0, roster.assignments.reduce((total, assignment) => total + assignment.count, 0) -
      (getCrewAssignmentById(state.destination, state.maxDays, state.crewSize, state.controlledDutyId) ? 1 : 0))
    : 0
  const delayedDuties = Math.max(0, expectedAutomatedDuties - assistantActivities.length)
  const crewEfficiency = state.difficulty === 'easy' ? 1.2 : state.difficulty === 'hard' ? 0.8 : 1
  const actions: Action[] = [...state.todayActions, ...(crewCoordinatedAction ? [crewCoordinatedAction] : []), 'rest']
  const afterSleep = advanceOxygenEmergency(advanceConstruction(state, 8), 8)
  if (afterSleep.isGameOver) return afterSleep
  let next = finishDay(afterSleep, actions, 0)
  next.actionHistory = [...state.actionHistory, ...state.todayActions]
  next.lastAction = state.todayActions[state.todayActions.length - 1] || crewCoordinatedAction || 'rest'
  if (assistantActivities.length && !next.isGameOver) {
    const resources = { ...next.resources }
    let scienceGain = 0
    let repairComplete = false
    for (const activity of assistantActivities) {
      switch (activity.effect) {
        case 'science':
          scienceGain += 4 * crewEfficiency
          break
        case 'power':
          if (state.buildings.some((id) => ['reactor', 'solar-panels'].includes(id) && !state.offlineBuildings.includes(id))) {
            resources.energy = Math.min(getEnergyCapacity(next), resources.energy + 0.5 * crewEfficiency)
          }
          break
        case 'water':
          if (state.buildings.some((id) => ['water-recycler', 'isru'].includes(id) && !state.offlineBuildings.includes(id))) {
            resources.water = Math.min(100, resources.water + 0.3 * crewEfficiency)
          }
          break
        case 'food':
          if (state.buildings.includes('greenhouse') && !state.offlineBuildings.includes('greenhouse')) {
            resources.food = Math.min(100, resources.food + 0.3 * crewEfficiency)
          }
          break
        case 'food-water':
          if (state.buildings.includes('greenhouse') && !state.offlineBuildings.includes('greenhouse')) {
            resources.food = Math.min(100, resources.food + 0.3 * crewEfficiency)
          }
          if (state.buildings.some((id) => ['water-recycler', 'isru'].includes(id) && !state.offlineBuildings.includes(id))) {
            resources.water = Math.min(100, resources.water + 0.3 * crewEfficiency)
          }
          break
        case 'health':
          resources.health = Math.min(100, resources.health + 0.25 * crewEfficiency)
          break
        case 'coordination':
          next.morale = clampPercent(next.morale + 0.25 * crewEfficiency)
          break
        case 'inspection':
          repairComplete = repairComplete || state.ongoingLeak
          break
      }
    }
    next = {
      ...next,
      resources,
      science: next.science + Math.min(8, scienceGain),
      ongoingLeak: repairComplete ? false : next.ongoingLeak,
      crewDailyActivities: assistantActivities,
      crewSupportActionHistory: [...state.crewSupportActionHistory, ...assistantActivities.map((activity) => activity.action)],
      log: [
        ...next.log,
        ...assistantActivities.map((activity) => `Day ${state.day}: ${activity.title} completed ${activity.action}.`),
      ],
      dailyReports: next.dailyReports.map((report) => report.day === state.day
        ? {
            ...report,
            resourcesAtEnd: snapshotDailyResources(resources),
            events: [
              ...report.events,
              ...assistantActivities.map((activity) => `Crew duty: ${activity.title} · ${activity.action}.`),
            ],
          }
        : report),
    }
    if (next.missionPhase === 'surface' && isObjectiveComplete(next)) {
      next.missionPhase = 'return'
      next.day = next.daysSurvived
      next.hour = MISSION_DAY_START
      next.todayActions = []
      next.lastMessage = 'اكتمل الهدف الرئيسي للمهمة؛ بدأ الاستعداد للعودة إلى الأرض.'
    }
  } else {
    next.crewDailyActivities = []
  }
  if (delayedDuties > 0 && !next.isGameOver) {
    next = {
      ...next,
      fatigue: clampPercent(next.fatigue + delayedDuties * (state.difficulty === 'hard' ? 4 : 2)),
      morale: clampPercent(next.morale - delayedDuties * (state.difficulty === 'hard' ? 4 : 2)),
      log: [...next.log, `Day ${state.day}: ${delayedDuties} automated crew duty/duties delayed.`],
      dailyReports: next.dailyReports.map((report) => report.day === state.day
        ? {
            ...report,
            events: [...report.events, `Crew duties delayed: ${delayedDuties}.`],
          }
        : report),
    }
  }
  const crewCommunicationEvents = state.crewCommunications
    .filter((request) => request.day === state.day)
    .map((request) => `Crew request ${request.decision}: ${request.dutyId} · ${request.action} · ${request.reason}.`)
  if (crewCommunicationEvents.length) {
    next.dailyReports = next.dailyReports.map((report) => report.day === state.day
      ? { ...report, events: [...report.events, ...crewCommunicationEvents] }
      : report)
  }
  if (crewCoordinatedAction) {
    next.crewSupportActionHistory = [...next.crewSupportActionHistory, crewCoordinatedAction]
    next.log = [...next.log, `Day ${state.day}: crew support activity ${crewCoordinatedAction}`]
  }
  if (next.failureCause?.source === 'daily-operation') {
    next.failureCause = { ...next.failureCause, action: next.lastAction || undefined }
  }
  return next
}

function getAutomatedCrewActivities(state: GameState): CrewDailyActivity[] {
  const roster = getCrewRoster(state.destination, state.maxDays, state.crewSize)
  if (!roster) return []
  const activities: CrewDailyActivity[] = []
  const baseReliability = state.difficulty === 'easy' ? 1 : state.difficulty === 'hard' ? 0.72 : 0.9
  const readinessPenalty = Math.max(0, state.fatigue - 50) * 0.003 +
    Math.max(0, 50 - state.morale) * 0.002
  let dutyOrdinal = 0
  for (const assignment of roster.assignments) {
    const duties = CREW_DUTIES[assignment.title]
    if (!duties) throw new Error(`Missing mission duty for crew assignment "${assignment.title}".`)
    const slug = assignment.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    for (let index = 0; index < assignment.count; index += 1) {
      const dutyId = `${slug}-${index + 1}`
      const rollChannel = 100 + dutyOrdinal
      dutyOrdinal += 1
      if (dutyId === state.controlledDutyId) continue
      let action: Action
      let effect: CrewDailyActivity['effect']
      switch (assignment.specialty) {
        case 'command':
        case 'communications':
          action = 'maintenance'
          effect = 'coordination'
          break
        case 'pilot':
        case 'science':
        case 'engineering-science':
        case 'geology-agriculture':
          action = 'explore'
          effect = 'science'
          break
        case 'medical':
        case 'science-medical':
          action = 'rest'
          effect = 'health'
          break
        case 'engineering':
        case 'power':
        case 'robotics':
          action = 'maintenance'
          effect = assignment.specialty === 'power' ? 'power' : 'inspection'
          break
        case 'resources':
          action = 'maintenance'
          effect = 'water'
          break
        case 'agriculture':
          action = 'research'
          effect = 'food'
          break
        case 'agriculture-resources':
          action = 'research'
          effect = 'food-water'
          break
      }
      if (deterministicRoll(state.missionSeed, state.day, rollChannel) >= Math.max(0.45, baseReliability - readinessPenalty)) continue
      activities.push({
        dutyId,
        title: assignment.count > 1 ? `${assignment.title} ${index + 1}` : assignment.title,
        action,
        effect,
      })
    }
  }
  return activities
}

export function resolveTransitDecision(
  state: GameState,
  leg: 'outbound' | 'return',
  choice: TransitChoice,
): GameState {
  if (state.missionPhase !== leg || state.transitDecisions.some((decision) => decision.leg === leg)) return state
  if (!canControlFlight(state)) {
    return { ...state, lastMessage: 'Flight controls are restricted to the assigned commander/pilot.' }
  }
  return completeTransitDecision(state, leg, choice)
}

export function resolveAutomaticTransitDecision(state: GameState, leg: 'outbound' | 'return'): GameState {
  return completeTransitDecision(state, leg, 'conservative')
}

function completeTransitDecision(state: GameState, leg: 'outbound' | 'return', choice: TransitChoice): GameState {
  if (state.missionPhase !== leg || state.transitDecisions.some((decision) => decision.leg === leg)) return state
  const next: GameState = {
    ...state,
    resources: { ...state.resources },
    transitDecisions: [...state.transitDecisions, { leg, choice }],
    missionPhase: leg === 'outbound' ? 'surface' : 'return',
  }
  const transitDays = SIMULATED_TRANSIT_DAYS[state.destination]
  const eclss = getCrewDailyEclssBalance(
    state.crewSize,
    state.difficulty,
    state.buildings.includes('water-recycler') && !state.offlineBuildings.includes('water-recycler'),
    true,
    state.destination,
  )
  const scenario = SCENARIOS[state.scenario || 'baseline']
  const exerciseCost = getActivityResourceCost('exercise', state.difficulty)
  const transitEvents: string[] = []
  for (let transitDay = 1; transitDay <= transitDays; transitDay += 1) {
    next.fatigue = clampPercent(next.fatigue - 8)
    next.morale = clampPercent(next.morale + 6)
    next.resources.energy = clamp(next.resources.energy -
      POWER_SYSTEM.survivalLoadKw * POWER_SYSTEM.energyBudgetHoursPerCycle -
      RESOURCE_RATES.energyKwhPerCrewDay * state.crewSize * POWER_SYSTEM.energyBudgetHoursPerCycle -
      (exerciseCost.energy || 0), getEnergyCapacity(state))
    next.resources.oxygen = clamp(next.resources.oxygen - eclss.oxygenConsumedKg - (exerciseCost.oxygen || 0))
    next.resources.water = clamp(next.resources.water -
      (eclss.waterConsumedLiters - eclss.totalWaterRecoveredLiters) * scenario.waterUseMultiplier)
    next.resources.food = clamp(next.resources.food - eclss.foodConsumedKg)
    if (next.resources.water <= 0 || next.resources.food <= 0) {
      next.resources.health = clamp(next.resources.health - 10)
    }
    transitEvents.push(`${leg} transit day ${transitDay}/${transitDays}: 2.5h mandatory exercise and 8h sleep completed`)
    next.radiationExposure += ENVIRONMENT.transitRadiationMsvPerDay
    const hazardRoll = deterministicRoll(state.missionSeed, state.day + transitDay - 1, leg === 'outbound' ? 91 : 101)
    if (hazardRoll < 0.05) {
      const hazard = Math.floor(deterministicRoll(state.missionSeed, state.day + transitDay - 1, leg === 'outbound' ? 92 : 102) * 6)
      if (hazard === 0) {
        next.resources.energy = clamp(next.resources.energy - 3, getEnergyCapacity(state))
        transitEvents.push(`${leg} transit day ${transitDay}: electrical fault; 3 energy lost`)
      } else if (hazard === 1) {
        next.resources.oxygen = clamp(next.resources.oxygen - 2)
        transitEvents.push(`${leg} transit day ${transitDay}: ECLSS pressure anomaly; 2 oxygen lost`)
      } else if (hazard === 2) {
        next.resources.health = clamp(next.resources.health - 3)
        transitEvents.push(`${leg} transit day ${transitDay}: crew treated a minor cabin fire`)
      } else if (hazard === 3) {
        next.resources.health = clamp(next.resources.health - 2)
        transitEvents.push(`${leg} transit day ${transitDay}: elevated cabin CO2; scrubber checks completed`)
      } else if (hazard === 4) {
        transitEvents.push(`${leg} transit day ${transitDay}: communications blackout delayed the Earth check-in`)
      } else {
        next.radiationExposure += 4
        transitEvents.push(`${leg} transit day ${transitDay}: solar particle event increased radiation`)
      }
    }
    const depletedResource = (['energy', 'health'] as const)
      .find((resource) => next.resources[resource] <= 0) ||
      (next.resources.oxygen <= 0 ? 'oxygen' : undefined)
    if (depletedResource) {
      const failureCause: MissionFailure = {
        resource: depletedResource,
        source: 'transit',
        transitLeg: leg,
        transitChoice: choice,
      }
      if (depletedResource === 'oxygen') next.oxygenEmergencyHoursRemaining = 0
      next.failureCause = failureCause
      next.log = [
        ...state.log,
        `Day ${state.day}: ${leg} transit (${choice}) · ${transitDays} simulated days`,
        ...transitEvents,
      ]
      return endIfDepleted(next, failureCause)
    }
  }
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
  next.dailyResourceStart = snapshotDailyResources(next.resources)
  next.log = [...state.log, `اليوم ${state.day}: ${leg} transit (${choice}) · ${transitDays} simulated days`, ...transitEvents]
  const depleted = (['energy', 'oxygen', 'health'] as const)
    .find((resource) => next.resources[resource] <= 0)
  if (!depleted) {
    if (leg === 'return') {
      next.isGameOver = true
      next.missionResult = isObjectiveComplete(next) ? 'success' : 'failure'
      next.lastMessage = next.missionResult === 'success'
        ? 'اكتملت الرحلة وعاد الطاقم إلى الأرض بسلام.'
        : 'عاد الطاقم إلى الأرض بسلام، لكن هدف المهمة لم يكتمل.'
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
  if (state.objective === 'science') return 120
  if (state.objective === 'exploration') return 3
  if (state.objective === 'tutorial') return TUTORIAL_STEPS.length
  return state.maxDays
}

export function getObjectiveProgress(state: Pick<GameState, 'objective' | 'maxDays' | 'daysSurvived' | 'science' | 'successfulExpeditions' | 'tutorialSteps'>): number {
  if (state.objective === 'science') return state.science
  if (state.objective === 'exploration') return state.successfulExpeditions
  if (state.objective === 'tutorial') return state.tutorialSteps.length
  return state.daysSurvived
}

export function isObjectiveComplete(state: Parameters<typeof getObjectiveProgress>[0] & Pick<GameState, 'objective' | 'maxDays'>): boolean {
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
    return {
      ...state,
      activeEvent: null,
      isGameOver: true,
      missionResult: isObjectiveComplete(state) ? 'success' : 'failure',
      hour: MISSION_DAY_START,
      todayActions: [],
    }
  }
  const next = { ...state, activeEvent: null, day: state.day + 1, hour: MISSION_DAY_START, todayActions: [] }
  return { ...next, ...updateAutomaticLoadShed(next) }
}

export function canBuild(state: GameState, buildingId: string): boolean {
  if (!canManageMissionActivity(state) || state.hour + 2 > MISSION_DAY_END || !preservesDailyRequirements(state, 2)) return false
  const building = BUILDINGS[buildingId]
  if (!building || state.constructionProject || state.buildings.includes(buildingId) ||
    (building.destination && building.destination !== state.destination)) return false
  if (buildingId === 'greenhouse' && !state.regolithPreTreated) return false
  const earlierPhases = BUILDING_PHASES.filter((phase) => phase.phase < building.phase)
  if (earlierPhases.some((phase) => phase.buildings.some((requiredId) => {
    const required = BUILDINGS[requiredId]
    return (!required.destination || required.destination === state.destination) && !state.buildings.includes(requiredId)
  }))) return false
  if (state.controlMode === 'specialist' && !canManageFacility(state, buildingId)) return false
  if (state.resources.credits < building.cost || state.resources.cargo < building.cargo) return false
  if (state.resources.energy < building.energyCost) return false
  return true
}

export function canToggleBuilding(state: GameState, buildingId: string): boolean {
  if (!canManageMissionActivity(state) || state.hour + 1 > MISSION_DAY_END || !preservesDailyRequirements(state, 1) || !state.buildings.includes(buildingId) || !BUILDINGS[buildingId]) return false
  if (state.survivalMode && POWER_SYSTEM.productiveBuildings.includes(buildingId as typeof POWER_SYSTEM.productiveBuildings[number])) return false
  if (state.controlMode === 'specialist' && !canManageFacility(state, buildingId)) return false
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
      ? 'Reserve time for daily exercise and both work shifts before operating facilities.'
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
    log: [...state.log, `Day ${state.day}: ${BUILDINGS[buildingId].name.en} ${isOffline ? 'returned online' : 'taken offline'}`],
    lastMessage: `${BUILDINGS[buildingId].name.en} ${isOffline ? 'returned to service' : 'placed offline'} by crew command.`,
  }
  return advanceOxygenEmergency(advanceConstruction(next, 1), 1)
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
        : building && state.controlMode === 'specialist' && !canManageFacility(state, buildingId)
          ? 'This facility is outside your selected specialist role.'
          : !building || (building.destination && building.destination !== state.destination)
            ? 'This facility is unavailable for the selected destination.'
            : 'Insufficient credits, cargo, or power to build this facility.'
    return { ...state, lastMessage }
  }
  const building = BUILDINGS[buildingId]
  const durationHours = getConstructionDurationHours(buildingId, state.destination)
  const next: GameState = {
    ...state,
    hour: state.hour + 2,
    resources: {
      ...state.resources,
      credits: state.resources.credits - building.cost,
      cargo: state.resources.cargo - building.cargo,
      energy: state.resources.energy - building.energyCost,
    },
    constructionProject: {
      buildingId,
      totalHours: durationHours,
      hoursRemaining: durationHours,
    },
    log: [...state.log, `Day ${state.day}: ${building.name.en} construction started`],
    constructionEventsToday: [...(state.constructionEventsToday || []), `${building.name.en} construction started`],
    lastMessage: `${building.name.en} construction started; ${durationHours} hour(s) remaining.`,
  }
  const elapsed = advanceOxygenEmergency(advanceConstruction(next, 2), 2)
  return elapsed
}

function canManageMissionActivity(state: GameState): boolean {
  if (!state.started || state.paused || state.isGameOver || state.activeEvent) return false
  return (state.missionPhase !== 'outbound' || state.transitDecisions.some((decision) => decision.leg === 'outbound')) &&
    (state.missionPhase !== 'return' || state.transitDecisions.some((decision) => decision.leg === 'return'))
}

function canManageFacility(state: GameState, buildingId: string): boolean {
  const specialty = getControlledSpecialty(state)
  if (specialty) {
    const facilities: Record<CrewAssignmentSpecialty, readonly string[]> = {
      command: ['command-center', 'communications', 'landing-pad'],
      pilot: ['landing-pad', 'pressurized-rover'],
      science: ['research-lab', 'pressurized-rover', 'drilling-tools', 'mass-spectrometer'],
      medical: ['medical-bay', 'life-support', 'storm-shelter'],
      engineering: ['habitat', 'airlock', 'suitport', 'workshop', 'life-support', 'landing-pad', 'storage', 'expansion'],
      communications: ['command-center', 'communications'],
      power: ['solar-panels', 'reactor', 'battery', 'life-support', 'storm-shelter'],
      resources: ['isru', 'water-recycler', 'water-tank', 'moxie'],
      robotics: ['robotics-unit', 'workshop', 'pressurized-rover', 'communications'],
      agriculture: ['greenhouse', 'research-lab'],
      'agriculture-resources': ['greenhouse', 'research-lab', 'isru', 'water-recycler', 'water-tank'],
      'science-medical': ['medical-bay', 'research-lab', 'pressurized-rover', 'drilling-tools', 'mass-spectrometer'],
      'engineering-science': ['habitat', 'airlock', 'suitport', 'workshop', 'life-support', 'landing-pad', 'storage', 'expansion', 'research-lab', 'pressurized-rover', 'drilling-tools', 'mass-spectrometer'],
      'geology-agriculture': ['greenhouse', 'research-lab', 'pressurized-rover', 'drilling-tools', 'mass-spectrometer'],
    }
    return facilities[specialty].includes(buildingId)
  }
  if (state.controlledDutyId) return false
  const role = state.controlledRole
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
