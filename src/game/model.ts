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
import { CREW_DUTIES, getAccessDeniedMessage, getCrewAssignmentById, getCrewRoster, getMissionSpecialization, type CrewSpecialty, type MissionSpecialization } from './crewRosters'
import {
  advanceCabinEnvironment,
  getCabinEnvironmentAlert,
  INITIAL_CABIN_ENVIRONMENT,
} from './environmentEngine'

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

export function getHabitatPressureKpa(
  state: Pick<GameState, 'buildings' | 'offlineBuildings' | 'ongoingLeak'> &
    Partial<Pick<GameState, 'cabinPressureKpa'>>,
): number {
  const habitatOnline = state.buildings.includes('habitat') &&
    !(state.offlineBuildings || []).includes('habitat')
  if (!habitatOnline) return 0
  if (typeof state.cabinPressureKpa === 'number') return clamp(state.cabinPressureKpa, HABITAT_PRESSURE_KPA.nominal)
  return state.ongoingLeak ? HABITAT_PRESSURE_KPA.leakEstimate : HABITAT_PRESSURE_KPA.nominal
}

export function pretreatRegolith(state: GameState): GameState {
  if (state.regolithPreTreated) return state
  if (!canControlMissionSpecialization(state, 'geology')) {
    return { ...state, lastMessage: getAccessDeniedMessage('geology') }
  }
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
  effect: 'inspection' | 'science' | 'power' | 'water' | 'food' | 'food-water' | 'health' | 'coordination' | 'recovery'
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

export interface CrewCondition {
  health: number
  fatigue: number
  stress: number
  morale: number
}

export interface CrewPersonality {
  roleSkill: number
  stressTolerance: number
  energyUse: number
}

export function createInitialCrewConditions(
  destination: Destination,
  maxDays: number,
  crewSize: number,
  resourcesHealth = 100,
): Record<string, CrewCondition> {
  const roster = getCrewRoster(destination, maxDays, crewSize)
  if (!roster) return {}
  return Object.fromEntries(roster.assignments.flatMap((assignment) => {
    const slug = assignment.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    return Array.from({ length: assignment.count }, (_, index) => [
      `${slug}-${index + 1}`,
      { health: clampPercent(resourcesHealth), fatigue: 18, stress: INITIAL_CABIN_ENVIRONMENT.crewStress, morale: 78 },
    ] as const)
  }))
}

export function getCrewCondition(state: GameState, dutyId: string): CrewCondition {
  const condition = state.crewConditions?.[dutyId]
  return condition ? {
    ...condition,
    morale: condition.morale ?? state.morale,
  } : {
    health: state.resources.health,
    fatigue: state.fatigue,
    stress: state.crewStress,
    morale: state.morale,
  }
}

export function getCrewPersonality(state: Pick<GameState, 'missionSeed'>, dutyId: string): CrewPersonality {
  let idHash = 2166136261
  for (const character of dutyId) {
    idHash = Math.imul(idHash ^ character.charCodeAt(0), 16777619)
  }
  const trait = (channel: number) => deterministicRoll(state.missionSeed, idHash >>> 0, channel)
  return {
    roleSkill: 0.85 + trait(1) * 0.3,
    stressTolerance: 0.8 + trait(2) * 0.4,
    energyUse: 0.9 + trait(3) * 0.2,
  }
}

export function getCrewRoleEfficiency(state: GameState, dutyId: string): number {
  const condition = getCrewCondition(state, dutyId)
  const personality = getCrewPersonality(state, dutyId)
  const fatiguePenalty = Math.max(0, condition.fatigue - 35) * 0.004
  const stressPenalty = Math.max(0, condition.stress - 30) * 0.003 / personality.stressTolerance
  const healthPenalty = Math.max(0, 70 - condition.health) * 0.004
  const moraleBonus = (condition.morale - 50) * 0.001
  return Math.max(0.2, Math.min(1.15,
    personality.roleSkill - fatiguePenalty - stressPenalty - healthPenalty + moraleBonus,
  ))
}

function getCrewSpecialistEfficiency(state: GameState, specialization: MissionSpecialization): number {
  const roster = getCrewRoster(state.destination, state.maxDays, state.crewSize)
  if (!roster) return 1
  const specialists = roster.assignments.flatMap((assignment) => {
    const slug = assignment.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    return Array.from({ length: assignment.count }, (_, index) => {
      const dutyId = `${slug}-${index + 1}`
      const specialty = state.crewSpecialtyOverrides?.[dutyId] || assignment.specialty
      return getMissionSpecialization(specialty) === specialization ? dutyId : null
    }).filter((dutyId): dutyId is string => dutyId !== null)
  })
  if (!specialists.length) return 1
  const available = specialists.filter((dutyId) => isCrewMemberAvailable(state, dutyId))
  if (!available.length) return 0.65
  return available.reduce((total, dutyId) => total + getCrewRoleEfficiency(state, dutyId), 0) / specialists.length
}

function applyCrewSystemEfficiency(state: GameState, resources: Resources): Resources {
  const next = { ...resources }
  const systemRoles: Partial<Record<ResourceName, MissionSpecialization>> = {
    energy: 'engineering',
    oxygen: 'biology',
    water: 'biology',
    food: 'biology',
  }
  for (const [key, specialization] of Object.entries(systemRoles) as [ResourceName, MissionSpecialization][]) {
    const production = resources[key] - state.resources[key]
    if (production <= 0) continue
    const adjusted = state.resources[key] + production * getCrewSpecialistEfficiency(state, specialization)
    next[key] = key === 'energy'
      ? clamp(adjusted, getEnergyCapacity(state))
      : clampSupply(state, key as 'oxygen' | 'water' | 'food', adjusted)
  }
  return next
}

export function isCrewMemberAvailable(state: GameState, dutyId: string): boolean {
  const condition = getCrewCondition(state, dutyId)
  return condition.health > 20 && condition.fatigue < 90 && condition.stress < 90
}

export type CrewCommunicationReason =
  | 'requestAccepted'
  | 'commandAuthorityRequired'
  | 'selfConversation'
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
  crewConditions: Record<string, CrewCondition>
  crewSpecialtyOverrides: Record<string, CrewSpecialty>
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
  cabinPressureKpa: number
  cabinOxygenPartialPressureKpa: number
  cabinCo2PartialPressureKpa: number
  cabinTemperatureC: number
  scrubberHealth: number
  crewStress: number
  crewPulseBpm: number
  airlockIsolated: boolean
  environmentalRadiationTodayMsv: number
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
export const SURFACE_SUPPLY_BASELINE = {
  referenceCrewSize: 4,
  oxygenKg: 50,
  waterLiters: 150,
  foodKg: 100,
} as const

export function getSupplyCapacity(resource: 'oxygen' | 'water' | 'food', crewSize: number): number {
  const scale = Math.max(1, crewSize) / SURFACE_SUPPLY_BASELINE.referenceCrewSize
  if (resource === 'oxygen') return SURFACE_SUPPLY_BASELINE.oxygenKg * scale
  if (resource === 'water') return SURFACE_SUPPLY_BASELINE.waterLiters * scale
  return SURFACE_SUPPLY_BASELINE.foodKg * scale
}

export function getSurfaceSupplyTargets(
  crewSize: number,
  scenario: GameState['scenario'],
): Pick<Resources, 'oxygen' | 'water' | 'food'> {
  const crewScale = Math.max(1, crewSize) / SURFACE_SUPPLY_BASELINE.referenceCrewSize
  const scenarioFactors = {
    oxygen: scenario === 'oxygen-shortage' ? 0.5 : scenario === 'habitat-leak' ? 0.65 : 1,
    water: scenario === 'water-rationing' ? 0.5 : 1,
    food: scenario === 'greenhouse-fault' ? 0.5 : 1,
  }
  return {
    oxygen: SURFACE_SUPPLY_BASELINE.oxygenKg * crewScale * scenarioFactors.oxygen,
    water: SURFACE_SUPPLY_BASELINE.waterLiters * crewScale * scenarioFactors.water,
    food: SURFACE_SUPPLY_BASELINE.foodKg * crewScale * scenarioFactors.food,
  }
}
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
  const scenario = SCENARIOS[config.scenario || 'baseline']
  const oxygenCapacity = getSupplyCapacity('oxygen', crewSize)
  const waterCapacity = getSupplyCapacity('water', crewSize)
  const foodCapacity = getSupplyCapacity('food', crewSize)
  const resources: Resources = {
    energy: 85,
    ...scenario.startingResources,
    oxygen: scenario.startingResources.oxygen === undefined ? oxygenCapacity * 0.9 : oxygenCapacity * scenario.startingResources.oxygen / 100,
    water: scenario.startingResources.water === undefined ? waterCapacity * 0.88 : waterCapacity * scenario.startingResources.water / 100,
    food: scenario.startingResources.food === undefined ? foodCapacity * 0.82 : foodCapacity * scenario.startingResources.food / 100,
    health: scenario.startingResources.health ?? 100,
    credits: 500,
    cargo: 100 * crewSize,
  }
  const missionType = config.missionType || (destination === 'moon'
    ? (config.maxDays && config.maxDays > 30 ? 'moon-settlement' : 'moon-exploration')
    : (config.maxDays && config.maxDays > 30 ? 'mars-conjunction' : 'mars-opposition'))
  const maxDays = config.maxDays === 10 || config.maxDays === 60
    ? config.maxDays
    : MISSION_TYPE_MAX_DAYS[missionType]
  const crewConditions = createInitialCrewConditions(destination, maxDays, crewSize, resources.health)
  return {
    started: true,
    paused: false,
    configVersion: 14,
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
    crewConditions,
    crewSpecialtyOverrides: {},
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
    cabinPressureKpa: INITIAL_CABIN_ENVIRONMENT.pressureKpa,
    cabinOxygenPartialPressureKpa: INITIAL_CABIN_ENVIRONMENT.oxygenPartialPressureKpa,
    cabinCo2PartialPressureKpa: INITIAL_CABIN_ENVIRONMENT.co2PartialPressureKpa,
    cabinTemperatureC: INITIAL_CABIN_ENVIRONMENT.temperatureC,
    scrubberHealth: INITIAL_CABIN_ENVIRONMENT.scrubberHealth,
    crewStress: INITIAL_CABIN_ENVIRONMENT.crewStress,
    crewPulseBpm: INITIAL_CABIN_ENVIRONMENT.crewPulseBpm,
    airlockIsolated: INITIAL_CABIN_ENVIRONMENT.airlockIsolated,
    environmentalRadiationTodayMsv: 0,
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

const clamp = (value: number, max = RESOURCE_CAP) =>
  Number.isNaN(value) || Number.isNaN(max)
    ? 0
    : Math.max(0, Math.min(max, Math.round(value * 100) / 100))
const clampSupply = (state: Pick<GameState, 'crewSize'>, resource: 'oxygen' | 'water' | 'food', value: number) =>
  clamp(value, getSupplyCapacity(resource, state.crewSize))
const clampPercent = (value: number) => clamp(value)

function advanceMissionEnvironment(state: GameState, elapsedHours: number, action: Action | null, transit = false): GameState {
  if (elapsedHours <= 0) return state
  const cabin = {
    pressureKpa: state.cabinPressureKpa,
    oxygenPartialPressureKpa: state.cabinOxygenPartialPressureKpa,
    co2PartialPressureKpa: state.cabinCo2PartialPressureKpa,
    temperatureC: state.cabinTemperatureC,
    scrubberHealth: state.scrubberHealth,
    crewStress: state.crewStress,
    crewPulseBpm: state.crewPulseBpm,
    airlockIsolated: state.airlockIsolated,
  }
  const previousAlert = getCabinEnvironmentAlert(cabin)
  const lifeSupportOnline = state.buildings.includes('life-support') && !state.offlineBuildings.includes('life-support')
  const specialty = getControlledSpecialty(state)
  const qualifiedMaintenance = Boolean(specialty && ['engineering', 'power', 'resources'].includes(specialty))
  const environment = advanceCabinEnvironment({
    ...cabin,
    elapsedHours,
    crewSize: state.crewSize,
    difficulty: state.difficulty,
    destination: state.destination,
    day: state.day,
    action,
    lifeSupportOnline,
    scrubberOnline: lifeSupportOnline,
    powered: state.resources.energy > 0,
    ongoingLeak: state.ongoingLeak,
    dustStorm: state.destination === 'mars' && state.dustStormDaysRemaining > 0,
    fatigue: state.fatigue,
    morale: state.morale,
    shielded: state.buildings.includes('storm-shelter') && !state.offlineBuildings.includes('storm-shelter'),
    transit,
    qualifiedMaintenance,
  })
  const next: GameState = {
    ...state,
    crewConditions: Object.fromEntries(Object.entries(state.crewConditions || {}).map(([dutyId, condition]) => [
      dutyId,
      {
        health: clampPercent(condition.health - environment.healthLoss),
        fatigue: clampPercent(condition.fatigue - (action === 'rest' ? elapsedHours * 1.25 : 0)),
        stress: clampPercent(condition.stress + environment.crewStress - state.crewStress - (action === 'rest' ? elapsedHours * .35 : 0)),
        morale: clampPercent(condition.morale - Math.max(0, environment.crewStress - state.crewStress) * 0.25 +
          (action === 'rest' ? elapsedHours * 0.15 : 0)),
      },
    ])),
    cabinPressureKpa: environment.pressureKpa,
    cabinOxygenPartialPressureKpa: environment.oxygenPartialPressureKpa,
    cabinCo2PartialPressureKpa: environment.co2PartialPressureKpa,
    cabinTemperatureC: environment.temperatureC,
    scrubberHealth: clamp(environment.scrubberHealth, 100),
    crewStress: clampPercent(environment.crewStress),
    crewPulseBpm: clamp(environment.crewPulseBpm, 200),
    airlockIsolated: environment.airlockIsolated,
    ongoingLeak: environment.leakRepaired ? false : state.ongoingLeak,
    environmentalRadiationTodayMsv: state.environmentalRadiationTodayMsv + environment.radiationAddedMsv,
    radiationExposure: state.radiationExposure + environment.radiationAddedMsv,
    permanentRadiationDamageWarning: state.permanentRadiationDamageWarning ||
      state.radiationExposure + environment.radiationAddedMsv >= ENVIRONMENT.gameRadiationWarningThresholdMsv,
    resources: { ...state.resources, health: clamp(state.resources.health - environment.healthLoss) },
  }
  if (action === 'maintenance') {
    next.scrubberHealth = clamp(
      next.scrubberHealth + elapsedHours * (qualifiedMaintenance ? 3 : -0.5),
      100,
    )
    if (environment.leakRepaired) next.lastMessage = 'Qualified crew completed the pressure-seal repair.'
  }
  const currentAlert = getCabinEnvironmentAlert({
    pressureKpa: next.cabinPressureKpa,
    oxygenPartialPressureKpa: next.cabinOxygenPartialPressureKpa,
    co2PartialPressureKpa: next.cabinCo2PartialPressureKpa,
    temperatureC: next.cabinTemperatureC,
    scrubberHealth: next.scrubberHealth,
    crewStress: next.crewStress,
    crewPulseBpm: next.crewPulseBpm,
    airlockIsolated: next.airlockIsolated,
  })
  if (currentAlert !== 'nominal' && currentAlert !== previousAlert) {
    next.log = [...state.log, `Day ${state.day} ${state.hour.toFixed(2)} h: cabin environment alert · ${currentAlert}.`]
    next.lastMessage = `Cabin environment alert: ${currentAlert}. Emergency response is required.`
  }
  if (environment.fatalReason) {
    next.isGameOver = true
    next.missionResult = 'evacuation'
    next.failureCause = {
      resource: environment.fatalReason === 'hypothermia' ? 'health' : 'oxygen',
      source: 'daily-operation',
      action: action || undefined,
    }
    next.lastMessage = `Cabin environmental limit exceeded: ${environment.fatalReason}. Crew evacuation required.`
    next.log = [...next.log, `Day ${state.day}: environmental emergency · ${environment.fatalReason}; mission evacuated.`]
  } else if (next.resources.health <= 0) {
    next.isGameOver = true
    next.missionResult = 'evacuation'
    next.failureCause = { resource: 'health', source: 'daily-operation', action: action || undefined }
    next.lastMessage = 'Crew health reached zero after prolonged environmental exposure; mission evacuated.'
  }
  return next
}

export function getCrewCognitiveEfficiency(
  state: Pick<GameState, 'fatigue' | 'morale'> &
    Partial<Pick<GameState, 'crewStress' | 'cabinCo2PartialPressureKpa' | 'cabinOxygenPartialPressureKpa' | 'cabinTemperatureC'>>,
): number {
  const stressPenalty = (state.crewStress ?? 0) * 0.0035
  const co2Penalty = Math.max(0, (state.cabinCo2PartialPressureKpa ?? 0) - 0.5) * 0.18
  const oxygenPenalty = Math.max(0, 16 - (state.cabinOxygenPartialPressureKpa ?? 21.2)) * 0.035
  const fatiguePenalty = Math.max(0, state.fatigue - 45) * 0.003
  const moralePenalty = Math.max(0, 45 - state.morale) * 0.002
  const coldPenalty = Math.max(0, 10 - (state.cabinTemperatureC ?? 22)) * 0.015
  return Math.max(0.25, Math.min(1, 1 - stressPenalty - co2Penalty - oxygenPenalty - fatiguePenalty - moralePenalty - coldPenalty))
}

export function getExplorationRisk(
  state: Pick<GameState, 'destination' | 'fatigue' | 'morale' | 'resources' | 'difficulty'> &
    Partial<Pick<GameState, 'crewStress' | 'cabinCo2PartialPressureKpa' | 'cabinOxygenPartialPressureKpa' | 'cabinTemperatureC'>>,
): number {
  const gravity = state.destination === 'mars' ? ENVIRONMENT.marsGravityEarthG : ENVIRONMENT.moonGravityEarthG
  const atmosphericPressureFraction = state.destination === 'mars'
    ? ENVIRONMENT.marsAtmosphericPressureEarthFraction
    : 0
  const gravityAndPressureRisk = (1 - gravity) * 0.01 + (1 - atmosphericPressureFraction) * 0.01
  const environmentalRisk = (state.destination === 'mars' ? 0.34 : 0.24) + gravityAndPressureRisk
  const fatigueRisk = Math.max(0, state.fatigue - 40) * 0.005
  const healthRisk = Math.max(0, 50 - state.resources.health) * 0.004
  const moraleRisk = Math.max(0, 30 - state.morale) * 0.003
  const cognitiveRisk = (1 - getCrewCognitiveEfficiency(state)) * 0.12
  const difficultyRisk = DIFFICULTY_MODIFIERS[state.difficulty].explorationRisk
  return Math.max(0.05, Math.min(0.85, environmentalRisk + fatigueRisk + healthRisk + moraleRisk + cognitiveRisk + difficultyRisk))
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
  crewConditionMultiplier = 1,
): {
  oxygenConsumedKg: number
  waterConsumedLiters: number
  foodConsumedKg: number
  co2ProducedKg: number
  sabatierWaterRecoveredLiters: number
  totalWaterRecoveredLiters: number
} {
  const solLengthFactor = getCrewSolDurationHours(destination) / 24
  const conditionMultiplier = Number.isFinite(crewConditionMultiplier)
    ? Math.max(0.8, Math.min(1.5, crewConditionMultiplier))
    : 1
  const crewWaterDemand = crewSize * WATER_PER_CREW_DAY * DIFFICULTY_MODIFIERS[difficulty].consumption * solLengthFactor * conditionMultiplier
  const co2ProducedKg = crewSize * CO2_PER_CREW_DAY * solLengthFactor * conditionMultiplier
  const sabatierWaterRecoveredLiters = hasSabatierProcessor ? co2ProducedKg * (36 / 44) : 0
  const targetRecovery = crewWaterDemand * WATER_RECYCLE_RATE[difficulty]
  const totalWaterRecoveredLiters = hasWaterRecycler
    ? targetRecovery
    : Math.min(targetRecovery, sabatierWaterRecoveredLiters)
  return {
    oxygenConsumedKg: crewSize * OXYGEN_PER_CREW_DAY * DIFFICULTY_MODIFIERS[difficulty].consumption * solLengthFactor * conditionMultiplier,
    waterConsumedLiters: crewWaterDemand,
    foodConsumedKg: crewSize * FOOD_PER_CREW_DAY * DIFFICULTY_MODIFIERS[difficulty].consumption * solLengthFactor * conditionMultiplier,
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
  if (level > 0 && !canControlEmergencyLevel(state, level)) {
    return { ...state, lastMessage: getAccessDeniedMessage('command') }
  }
  if (level === 0 && !canControlMissionSpecialization(state, 'command')) {
    return { ...state, lastMessage: getAccessDeniedMessage('command') }
  }
  if (level === 4 && !state.buildings.includes('medical-bay')) {
    return { ...state, emergencyLevel: level, lastMessage: 'Medical emergency declared; construct the medical clinic to provide treatment.' }
  }
  const next = {
    ...state,
    emergencyLevel: level,
    airlockIsolated: level === 2 ? true : state.airlockIsolated,
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
  return setSurvivalMode(next, level === 3)
}

export function canControlEmergencyLevel(state: GameState, level: EmergencyLevel): boolean {
  return [0, 1, 2, 3, 4].includes(level) && canControlMissionSpecialization(state, 'command')
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
  const solarIncidence = state.destination === 'mars'
    ? 0.82 + 0.18 * Math.max(0, Math.cos((state.day - 80) * Math.PI * 2 / 687))
    : 1
  const generatedEnergy =
    solarCount * getSolarGenerationKwh(state.destination, scenario.solarOutput * solarIncidence, state.day, 1 - solarLossFactor) +
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
  const conditionMultiplier = clamp(
    1 + state.crewStress * 0.001 + Math.max(0, state.fatigue - 50) * 0.001 +
      Math.max(0, 16 - state.cabinOxygenPartialPressureKpa) * 0.006 +
      Math.max(0, 18 - state.cabinTemperatureC) * 0.005,
    1.5,
  )
  const eclss = getCrewDailyEclssBalance(
    state.crewSize,
    state.difficulty,
    recyclerCount > 0,
    lifeSupportCount > 0,
    state.destination,
    conditionMultiplier,
  )
  const crewWaterUse = eclss.waterConsumedLiters * scenario.waterUseMultiplier
  const waterRecovered = eclss.totalWaterRecoveredLiters * powerFactor * scenario.waterUseMultiplier
  const waterElectrolysisUse = lifeSupportOxygen * RESOURCE_RATES.electrolysisWaterKgPerOxygenKg
  const waterLeakUse = state.ongoingLeak
    ? convertLegacyResourceDelta('water', 5) * consumptionFactor * scenario.waterUseMultiplier
    : 0
  const greenhouseWaterUse = greenhouseCount * GREENHOUSE_CYCLE.waterLitersPerCycle / GREENHOUSE_CYCLE.growthDays
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
  next.oxygen = clampSupply(state, 'oxygen',
    next.oxygen + production.oxygen * powerFactor + greenhouseOxygen - oxygenUse -
      additionalActions.reduce((total, item) => total + (getActivityResourceCost(item, state.difficulty).oxygen || 0), 0),
  )
  next.water = clampSupply(state, 'water',
    next.water + production.water * powerFactor -
      (crewWaterUse - waterRecovered) -
      waterElectrolysisUse -
      greenhouseWaterUse * greenhouseFactor -
      waterLeakUse,
  )
  const foodProduction = greenhouseCount > 0
    ? greenhouseCount * (GREENHOUSE_CYCLE.foodKg / GREENHOUSE_CYCLE.growthDays) * greenhouseFactor
    : production.food * powerFactor
  next.food = clampSupply(state, 'food', next.food + foodProduction - eclss.foodConsumedKg)
  next.health = clamp(
    next.health + production.health +
      actions.filter((item) => item === 'rest').length * RESOURCE_RATES.restHealthRecoveryPoints,
  )
  const explorations = actions.filter((item) => item === 'explore').length
  const expectedExplorationHealthLoss = explorations * 16 * getExplorationRisk(state)
  const fatigueHealthLoss = state.fatigue >= 80 ? 3 : 0
  const projectedRadiation = forecastRadiationExposure(state, actions)
  const radiationHealthLoss = projectedRadiation >= ENVIRONMENT.gameRadiationWarningThresholdMsv ? 2 : 0
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
  const fallbackRadiation = state.environmentalRadiationTodayMsv > 0
    ? 0
    : Math.max(0, forecastRadiationExposure(state, actions) - state.radiationExposure)
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
    resources: applyCrewSystemEfficiency(state, forecastResources(state, actions)),
    daysSurvived: state.daysSurvived + 1,
  }
  const tutorialState = actions.reduce((current, item) => {
    const step = tutorialStep[item]
    return step ? recordTutorialStep(current, step) : current
  }, cycleState)
  const next = { ...advanceOperationCycle(tutorialState) }
  next.actionHistory = [...state.actionHistory, ...actions]
  next.radiationExposure = state.radiationExposure + fallbackRadiation
  next.environmentalRadiationTodayMsv = state.environmentalRadiationTodayMsv + fallbackRadiation
  next.permanentRadiationDamageWarning =
    state.permanentRadiationDamageWarning || next.radiationExposure >= ENVIRONMENT.gameRadiationWarningThresholdMsv
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
    ? Math.round(15 * (0.7 + state.morale / 250) * getCrewCognitiveEfficiency(state))
    : item === 'explore' ? 8 : 0), 0)
  const explorations = actions.filter((item) => item === 'explore').length
  for (let index = 0; index < explorations; index += 1) {
    const success = deterministicRoll(state.missionSeed, state.day, 1 + index) >= getExplorationRisk(state)
    if (success) {
      next.successfulExpeditions += 1
      next.resources.credits += 60
      next.resources.water = clampSupply(next, 'water', next.resources.water + 12)
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
    next.lastMessage = 'Game-model warning: cumulative radiation reached the 600 mSv training threshold. This is not a medical or mission exposure limit.'
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
      radiationMsv: Math.max(0, state.environmentalRadiationTodayMsv + fallbackRadiation),
      events: reportEvents,
      earthTransmission: state.destination === 'mars'
        ? { status: 'queued', delayMinutes: getMarsCommunicationDelayMinutes(state.missionSeed, state.day, 'research') }
        : { status: 'local', delayMinutes: 0 },
    },
  ]
  next.environmentalRadiationTodayMsv = 0
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

const ACTION_SPECIALIZATION: Partial<Record<Action, MissionSpecialization>> = {
  research: 'biology',
  explore: 'geology',
  maintenance: 'engineering',
}

type CrewAssignmentSpecialty = NonNullable<ReturnType<typeof getCrewAssignmentById>>['specialty']

function getControlledSpecialty(state: GameState): CrewAssignmentSpecialty | undefined {
  if (!state.controlledDutyId) return undefined
  return getCrewAssignmentById(
    state.destination,
    state.maxDays,
    state.crewSize,
    state.controlledDutyId,
    state.crewSpecialtyOverrides,
  )?.specialty
}

export function getControlledMissionSpecialization(state: GameState): MissionSpecialization | undefined {
  const specialty = getControlledSpecialty(state)
  return specialty ? getMissionSpecialization(specialty) : undefined
}

export function canControlMissionSpecialization(state: GameState, required: MissionSpecialization): boolean {
  return Boolean(state.controlledDutyId) && getControlledMissionSpecialization(state) === required &&
    isCrewMemberAvailable(state, state.controlledDutyId)
}

export function canControlFlight(state: Pick<GameState, 'controlMode' | 'controlledRole' | 'controlledDutyId' | 'destination' | 'maxDays' | 'crewSize'> & Partial<Pick<GameState, 'crewSpecialtyOverrides' | 'crewConditions' | 'resources' | 'fatigue' | 'crewStress'>>): boolean {
  if (!state.controlledDutyId) return false
  if (state.crewConditions) {
    const condition = state.crewConditions[state.controlledDutyId] || {
      health: state.resources?.health ?? 100,
      fatigue: state.fatigue ?? 0,
      stress: state.crewStress ?? 0,
    }
    if (condition.health <= 20 || condition.fatigue >= 90 || condition.stress >= 90) return false
  }
  const assignment = getCrewAssignmentById(state.destination, state.maxDays, state.crewSize, state.controlledDutyId, state.crewSpecialtyOverrides)
  if (!assignment) return false
  return getMissionSpecialization(assignment.specialty) === 'command'
}

export function canPerformActivity(state: GameState, action: Action): boolean {
  const specialty = getControlledSpecialty(state)
  const requiredSpecialization = ACTION_SPECIALIZATION[action]
  const permitted = action === 'exercise' || action === 'rest'
    ? Boolean(specialty)
    : Boolean(specialty && requiredSpecialization && getMissionSpecialization(specialty) === requiredSpecialization)
  if (!permitted) return false
  const condition = state.controlledDutyId ? getCrewCondition(state, state.controlledDutyId) : null
  if (condition && (condition.health <= 20 || condition.stress >= 90 || condition.fatigue >= 90)) {
    return action === 'rest'
  }
  return true
}

export function getRoleIneligibleMessage(state: GameState, action: Action, language: 'en' | 'ar' = 'en'): string {
  const specialty = getControlledSpecialty(state)
  const required = ACTION_SPECIALIZATION[action]
  if (!required || (specialty && getMissionSpecialization(specialty) === required)) return ''
  return getAccessDeniedMessage(required, language)
}

export function formallyReassignCrewSpecialty(state: GameState, dutyId: string, specialty: CrewSpecialty): GameState {
  const target = getCrewAssignmentById(state.destination, state.maxDays, state.crewSize, dutyId, state.crewSpecialtyOverrides)
  if (!target) return { ...state, lastMessage: 'Crew reassignment failed: the selected astronaut is not assigned to this mission.' }
  if (getControlledMissionSpecialization(state) !== 'command') {
    return { ...state, lastMessage: getAccessDeniedMessage('command') }
  }
  if (!state.started || state.paused || state.isGameOver || state.activeEvent || state.missionPhase !== 'surface' || state.activeOperation?.status === 'active') {
    return { ...state, lastMessage: 'Crew reassignment is unavailable during transit, emergencies, active operations, or a paused mission.' }
  }
  if (!isCrewMemberAvailable(state, dutyId)) {
    return { ...state, lastMessage: 'Crew reassignment requires an available astronaut; recover the selected crew member first.' }
  }
  if (target.specialty === specialty) return { ...state, lastMessage: 'That astronaut already holds the selected specialty.' }
  if (state.hour + 3 > MISSION_DAY_END || !preservesDailyRequirements(state, 3)) {
    return { ...state, lastMessage: 'Reserve at least three shift hours for command-authorized role transfer.' }
  }
  if (state.resources.energy < 5) return { ...state, lastMessage: 'Crew reassignment requires 5 energy units for training and system handover.' }
  const assignments = getCrewRoster(state.destination, state.maxDays, state.crewSize)
  if (!assignments) return { ...state, lastMessage: 'Crew reassignment failed: no valid mission roster is available.' }
  const currentDuties = assignments.assignments.flatMap((assignment) => {
    const slug = assignment.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    return Array.from({ length: assignment.count }, (_, index) => {
      const id = `${slug}-${index + 1}`
      return { id, specialty: state.crewSpecialtyOverrides[id] || assignment.specialty }
    })
  })
  const currentlyCommand = currentDuties.some((member) =>
    member.id === dutyId && getMissionSpecialization(member.specialty) === 'command',
  )
  const remainingCommanders = currentDuties.filter((member) =>
    member.id !== dutyId && getMissionSpecialization(member.specialty) === 'command',
  ).length
  if (currentlyCommand && remainingCommanders === 0 && specialty !== 'command') {
    return { ...state, lastMessage: 'Keep at least one Commander assigned to retain mission-level clearance.' }
  }
  const crewConditions = {
    ...state.crewConditions,
    [dutyId]: {
      ...getCrewCondition(state, dutyId),
      fatigue: clampPercent(getCrewCondition(state, dutyId).fatigue + 5),
      stress: clampPercent(getCrewCondition(state, dutyId).stress + 4),
    },
  }
  const transferred: GameState = {
    ...state,
    crewConditions,
    crewSpecialtyOverrides: { ...state.crewSpecialtyOverrides, [dutyId]: specialty },
    resources: { ...state.resources, energy: clamp(state.resources.energy - 5, getEnergyCapacity(state)) },
    hour: state.hour + 3,
    log: [...state.log, `Day ${state.day}: command transferred ${dutyId} to ${specialty}; 3 shift hours and 5 energy used.`],
    lastMessage: `Formal reassignment complete: ${dutyId} is now assigned to ${specialty}.`,
  }
  return advanceMissionEnvironment(transferred, 3, null)
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

function updateCrewConditionForAction(
  condition: CrewCondition,
  action: Action,
  specialty: CrewSpecialty = 'command',
  personality: CrewPersonality = { roleSkill: 1, stressTolerance: 1, energyUse: 1 },
): CrewCondition {
  const strainBySpecialty: Record<CrewSpecialty, number> = {
    command: 1,
    pilot: 1.2,
    science: 1,
    medical: 0.8,
    engineering: 1,
    communications: 0.8,
    power: 0.9,
    resources: 0.9,
    robotics: 1.1,
    agriculture: 0.8,
    'agriculture-resources': 0.9,
    'science-medical': 0.9,
    'engineering-science': 1,
    'geology-agriculture': 1,
  }
  const strain = strainBySpecialty[specialty]
  const adjustments: Record<Action, { health: number; fatigue: number; stress: number }> = {
    research: { health: specialty === 'medical' ? 1 : 0, fatigue: 5 * strain, stress: 4 * strain },
    explore: { health: -1, fatigue: 12 * strain, stress: 10 * strain },
    maintenance: { health: 0, fatigue: 8 * strain, stress: 6 * strain },
    exercise: { health: 0, fatigue: 4, stress: -6 },
    rest: { health: specialty === 'medical' ? 3 : 1, fatigue: -18, stress: -14 },
  }
  const change = adjustments[action]
  const moraleChange: Record<Action, number> = {
    research: 1,
    explore: -4,
    maintenance: 0,
    exercise: 3,
    rest: 5,
  }
  return {
    health: clampPercent(condition.health + change.health),
    fatigue: clampPercent(condition.fatigue + change.fatigue),
    stress: clampPercent(condition.stress + change.stress / personality.stressTolerance),
    morale: clampPercent(condition.morale + moraleChange[action] * personality.stressTolerance),
  }
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
    const roleMessage = getRoleIneligibleMessage(state, action)
    const selectedCondition = state.controlledDutyId ? getCrewCondition(state, state.controlledDutyId) : null
    const lastMessage = roleMessage
      ? roleMessage
      : selectedCondition && (selectedCondition.health <= 20 || selectedCondition.fatigue >= 90 || selectedCondition.stress >= 90) && action !== 'rest'
        ? 'Crew member unavailable: schedule rest and recovery before assigning another task.'
        : action === 'rest' && state.todayActions.includes('rest')
      ? 'The daily rest block has already been used.'
      : 'Reserve time for daily exercise and both work shifts before scheduling optional activities.'
    return { ...state, lastMessage }
  }
  const duration = getActivityDurationHours(state, action)
  const cost = getActivityResourceCost(action, state.difficulty)
  const personality = state.controlledDutyId
    ? getCrewPersonality(state, state.controlledDutyId)
    : { roleSkill: 1, stressTolerance: 1, energyUse: 1 }
  const energyCapacity = getEnergyCapacity(state)
  const resources = { ...state.resources }
  if (cost.energy !== undefined) resources.energy = clamp(resources.energy - cost.energy * personality.energyUse, energyCapacity)
  if (cost.oxygen !== undefined) resources.oxygen = clampSupply(state, 'oxygen', resources.oxygen - cost.oxygen)
  const scheduled = {
    ...state,
    crewConditions: state.controlledDutyId ? {
      ...state.crewConditions,
      [state.controlledDutyId]: updateCrewConditionForAction(
        getCrewCondition(state, state.controlledDutyId),
        action,
        getControlledSpecialty(state),
        personality,
      ),
    } : state.crewConditions,
    resources,
    hour: state.hour + duration,
    todayActions: [...state.todayActions, action],
    log: [...state.log, `Day ${state.day} ${action} scheduled`],
    lastMessage: '',
  }
  const elapsed = advanceMissionEnvironment(
    advanceOxygenEmergency(advanceConstruction(scheduled, duration), duration),
    duration,
    action,
  )
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
  return advanceMissionEnvironment(
    advanceOxygenEmergency(
      advanceConstruction({ ...state, hour: MISSION_BEDTIME }, elapsedHours),
      elapsedHours,
    ),
    elapsedHours,
    'rest',
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
  const crewEfficiency = (state.difficulty === 'easy' ? 1.2 : state.difficulty === 'hard' ? 0.8 : 1) *
    getCrewCognitiveEfficiency(state)
  const actions: Action[] = [...state.todayActions, ...(crewCoordinatedAction ? [crewCoordinatedAction] : []), 'rest']
  const afterSleep = advanceMissionEnvironment(
    advanceOxygenEmergency(advanceConstruction(state, 8), 8),
    8,
    'rest',
  )
  if (afterSleep.isGameOver) return afterSleep
  let next = finishDay(afterSleep, actions, 0)
  next.actionHistory = [...state.actionHistory, ...state.todayActions]
  next.lastAction = state.todayActions[state.todayActions.length - 1] || crewCoordinatedAction || 'rest'
  if (assistantActivities.length && !next.isGameOver) {
    const resources = { ...next.resources }
    let scienceGain = 0
    let repairComplete = false
    const crewConditions = { ...next.crewConditions }
    for (const activity of assistantActivities) {
      const duty = getCrewAssignmentById(
        state.destination,
        state.maxDays,
        state.crewSize,
        activity.dutyId,
        state.crewSpecialtyOverrides,
      )
      if (!duty) throw new Error(`Automated crew duty "${activity.dutyId}" is unavailable for this mission.`)
      const individualEfficiency = crewEfficiency * getCrewRoleEfficiency(state, activity.dutyId)
      crewConditions[activity.dutyId] = updateCrewConditionForAction(
        getCrewCondition(next, activity.dutyId),
        activity.action,
        duty.specialty,
        getCrewPersonality(state, activity.dutyId),
      )
      switch (activity.effect) {
        case 'science':
          scienceGain += 4 * individualEfficiency
          break
        case 'power':
          if (state.buildings.some((id) => ['reactor', 'solar-panels'].includes(id) && !state.offlineBuildings.includes(id))) {
            resources.energy = clamp(resources.energy + 0.5 * individualEfficiency, getEnergyCapacity(next))
          }
          break
        case 'recovery':
          break
        case 'water':
          if (state.buildings.some((id) => ['water-recycler', 'isru'].includes(id) && !state.offlineBuildings.includes(id))) {
            resources.water = clampSupply(state, 'water', resources.water + 0.3 * individualEfficiency)
          }
          break
        case 'food':
          if (state.buildings.includes('greenhouse') && !state.offlineBuildings.includes('greenhouse')) {
            resources.food = clampSupply(state, 'food', resources.food + 0.3 * individualEfficiency)
            resources.oxygen = clampSupply(state, 'oxygen', resources.oxygen + 0.1 * individualEfficiency)
          }
          break
        case 'food-water':
          if (state.buildings.includes('greenhouse') && !state.offlineBuildings.includes('greenhouse')) {
            resources.food = clampSupply(state, 'food', resources.food + 0.3 * individualEfficiency)
            resources.oxygen = clampSupply(state, 'oxygen', resources.oxygen + 0.1 * individualEfficiency)
          }
          if (state.buildings.some((id) => ['water-recycler', 'isru'].includes(id) && !state.offlineBuildings.includes(id))) {
            resources.water = clampSupply(state, 'water', resources.water + 0.3 * individualEfficiency)
          }
          break
        case 'health':
          resources.health = clamp(resources.health + 0.25 * individualEfficiency)
          for (const [dutyId, condition] of Object.entries(crewConditions)) {
            crewConditions[dutyId] = {
              ...condition,
              stress: clampPercent(condition.stress - 1.5 * individualEfficiency),
              morale: clampPercent(condition.morale + 0.5 * individualEfficiency),
            }
          }
          break
        case 'coordination':
          next.morale = clampPercent(next.morale + 0.25 * individualEfficiency)
          break
        case 'inspection':
          repairComplete = repairComplete || state.ongoingLeak
          break
      }
    }
    next = {
      ...next,
      resources,
      crewConditions,
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
    Math.max(0, 50 - state.morale) * 0.002 +
    (1 - getCrewCognitiveEfficiency(state)) * 0.35
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
      const specialty = state.crewSpecialtyOverrides?.[dutyId] || assignment.specialty
      let action: Action
      let effect: CrewDailyActivity['effect']
      if (!isCrewMemberAvailable(state, dutyId)) {
        activities.push({
          dutyId,
          title: assignment.count > 1 ? `${assignment.title} ${index + 1}` : assignment.title,
          action: 'rest',
          effect: 'recovery',
        })
        continue
      }
      switch (getMissionSpecialization(specialty)) {
        case 'command':
          action = 'exercise'
          effect = 'coordination'
          break
        case 'engineering':
          action = 'maintenance'
          effect = specialty === 'power' ? 'power' : 'inspection'
          break
        case 'biology':
          action = 'research'
          effect = specialty === 'medical' || specialty === 'science-medical'
            ? 'health'
            : specialty === 'agriculture-resources'
              ? 'food-water'
              : 'food'
          break
        case 'geology':
          action = 'explore'
          effect = specialty === 'resources' ? 'water' : 'science'
          break
      }
      const individualReliability = Math.min(1,
        Math.max(0.45, baseReliability - readinessPenalty) * getCrewRoleEfficiency(state, dutyId),
      )
      if (deterministicRoll(state.missionSeed, state.day, rollChannel) >= individualReliability) {
        activities.push({
          dutyId,
          title: assignment.count > 1 ? `${assignment.title} ${index + 1}` : assignment.title,
          action: 'rest',
          effect: 'recovery',
        })
        continue
      }
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
    return { ...state, lastMessage: getAccessDeniedMessage('command') }
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
    next.resources.oxygen = clampSupply(state, 'oxygen', next.resources.oxygen - eclss.oxygenConsumedKg - (exerciseCost.oxygen || 0))
    next.resources.water = clampSupply(state, 'water', next.resources.water -
      (eclss.waterConsumedLiters - eclss.totalWaterRecoveredLiters) * scenario.waterUseMultiplier)
    next.resources.food = clampSupply(state, 'food', next.resources.food - eclss.foodConsumedKg)
    if (next.resources.water <= 0 || next.resources.food <= 0) {
      next.resources.health = clamp(next.resources.health - 10)
    }
    transitEvents.push(`${leg} transit day ${transitDay}/${transitDays}: 2.5h mandatory exercise and 8h sleep completed`)
    Object.assign(next, advanceMissionEnvironment(next, 24, 'rest', true))
    if (next.isGameOver) {
      next.log = [...state.log, ...transitEvents, next.lastMessage]
      return next
    }
    const hazardRoll = deterministicRoll(state.missionSeed, state.day + transitDay - 1, leg === 'outbound' ? 91 : 101)
    if (hazardRoll < 0.05) {
      const hazard = Math.floor(deterministicRoll(state.missionSeed, state.day + transitDay - 1, leg === 'outbound' ? 92 : 102) * 6)
      if (hazard === 0) {
        next.resources.energy = clamp(next.resources.energy - 3, getEnergyCapacity(state))
        transitEvents.push(`${leg} transit day ${transitDay}: electrical fault; 3 energy lost`)
      } else if (hazard === 1) {
        next.resources.oxygen = clampSupply(state, 'oxygen', next.resources.oxygen - 2)
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
    state.permanentRadiationDamageWarning || next.radiationExposure >= ENVIRONMENT.gameRadiationWarningThresholdMsv
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
  next.log = [...state.log, `اليوم ${state.day}: ${leg} transit (${choice}) · ${transitDays} simulated days`, ...transitEvents]
  if (leg === 'outbound') {
    const supplies = getSurfaceSupplyTargets(state.crewSize, state.scenario)
    const before = { oxygen: next.resources.oxygen, water: next.resources.water, food: next.resources.food }
    next.resources.oxygen = clampSupply(state, 'oxygen', Math.max(supplies.oxygen, next.resources.oxygen))
    next.resources.water = clampSupply(state, 'water', Math.max(supplies.water, next.resources.water))
    next.resources.food = clampSupply(state, 'food', Math.max(supplies.food, next.resources.food))
    const transferred = next.resources.oxygen - before.oxygen +
      next.resources.water - before.water +
      next.resources.food - before.food
    next.resources.cargo = Math.max(0, next.resources.cargo - transferred)
    next.log.push(
      `Surface landing: transferred ${Number((next.resources.oxygen - before.oxygen).toFixed(1))} kg O₂, ${Number((next.resources.water - before.water).toFixed(1))} L water, and ${Number((next.resources.food - before.food).toFixed(1))} kg food from lander cargo.`,
    )
  }
  next.dailyResourceStart = snapshotDailyResources(next.resources)
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
      next.lastMessage += ' Game-model warning: cumulative radiation reached the 600 mSv training threshold; this is not a medical or mission exposure limit.'
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
  if (building && !canManageFacility(state, buildingId)) return false
  if (!building || state.constructionProject || state.buildings.includes(buildingId) ||
    (building.destination && building.destination !== state.destination)) return false
  if (buildingId === 'greenhouse' && !state.regolithPreTreated) return false
  const earlierPhases = BUILDING_PHASES.filter((phase) => phase.phase < building.phase)
  if (earlierPhases.some((phase) => phase.buildings.some((requiredId) => {
    const required = BUILDINGS[requiredId]
    return (!required.destination || required.destination === state.destination) && !state.buildings.includes(requiredId)
  }))) return false
  if (state.resources.credits < building.cost || state.resources.cargo < building.cargo) return false
  if (state.resources.energy < building.energyCost) return false
  return true
}

export function canToggleBuilding(state: GameState, buildingId: string): boolean {
  if (!canManageMissionActivity(state) || state.hour + 1 > MISSION_DAY_END || !preservesDailyRequirements(state, 1) || !state.buildings.includes(buildingId) || !BUILDINGS[buildingId]) return false
  if (!canManageFacility(state, buildingId)) return false
  if (state.survivalMode && POWER_SYSTEM.productiveBuildings.includes(buildingId as typeof POWER_SYSTEM.productiveBuildings[number])) return false
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
    const requiredSpecialization = BUILDING_SPECIALIZATIONS[buildingId]
    const lastMessage = state.buildings.includes(buildingId) &&
      requiredSpecialization &&
      !canControlMissionSpecialization(state, requiredSpecialization)
      ? getAccessDeniedMessage(requiredSpecialization)
      : state.buildings.includes(buildingId) &&
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
  return advanceMissionEnvironment(
    advanceOxygenEmergency(advanceConstruction(next, 1), 1),
    1,
    'maintenance',
  )
}

export function buildInState(state: GameState, buildingId: string): GameState {
  if (!canBuild(state, buildingId)) {
    const building = BUILDINGS[buildingId]
    const requiredSpecialization = BUILDING_SPECIALIZATIONS[buildingId]
    const earlierPhases = building
      ? BUILDING_PHASES.filter((phase) => phase.phase < building.phase)
      : []
    const missingDependency = earlierPhases.some((phase) =>
      phase.buildings.some((requiredId) => {
        const required = BUILDINGS[requiredId]
        return (!required.destination || required.destination === state.destination) && !state.buildings.includes(requiredId)
      }),
    )
    const lastMessage = building && requiredSpecialization && !canControlMissionSpecialization(state, requiredSpecialization)
      ? getAccessDeniedMessage(requiredSpecialization)
      : buildingId === 'greenhouse' && !state.regolithPreTreated
      ? 'Pretreat perchlorate-bearing regolith at an active ISRU plant before building the greenhouse.'
      : !canManageMissionActivity(state)
      ? 'Facility work is unavailable during this mission phase.'
      : state.hour + 2 > MISSION_DAY_END || !preservesDailyRequirements(state, 2)
        ? 'Not enough shift time remains for construction.'
        : building && state.buildings.includes(buildingId)
          ? 'This facility has already been constructed.'
          : missingDependency
            ? 'Complete all facilities in earlier construction phases first.'
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
  const elapsed = advanceMissionEnvironment(
    advanceOxygenEmergency(advanceConstruction(next, 2), 2),
    2,
    'maintenance',
  )
  return elapsed
}

function canManageMissionActivity(state: GameState): boolean {
  if (!state.started || state.paused || state.isGameOver || state.activeEvent ||
    (state.controlledDutyId && !isCrewMemberAvailable(state, state.controlledDutyId))) return false
  return (state.missionPhase !== 'outbound' || state.transitDecisions.some((decision) => decision.leg === 'outbound')) &&
    (state.missionPhase !== 'return' || state.transitDecisions.some((decision) => decision.leg === 'return'))
}

export function canManageFacility(state: GameState, buildingId: string): boolean {
  const specialty = getControlledSpecialty(state)
  const requiredSpecialization = BUILDING_SPECIALIZATIONS[buildingId]
  return Boolean(
    specialty &&
    requiredSpecialization &&
    getMissionSpecialization(specialty) === requiredSpecialization &&
    isCrewMemberAvailable(state, state.controlledDutyId),
  )
}

const BUILDING_SPECIALIZATIONS: Readonly<Record<string, MissionSpecialization>> = {
  'command-center': 'engineering',
  communications: 'engineering',
  'landing-pad': 'engineering',
  'solar-panels': 'engineering',
  reactor: 'engineering',
  battery: 'engineering',
  habitat: 'engineering',
  airlock: 'engineering',
  suitport: 'engineering',
  'electrostatic-dust-shield': 'engineering',
  storage: 'engineering',
  workshop: 'engineering',
  expansion: 'engineering',
  'storm-shelter': 'engineering',
  'medical-bay': 'biology',
  'life-support': 'biology',
  greenhouse: 'biology',
  moxie: 'biology',
  'water-recycler': 'biology',
  'water-tank': 'biology',
  isru: 'geology',
  'pressurized-rover': 'geology',
  'drilling-tools': 'geology',
  'mass-spectrometer': 'geology',
  'robotics-unit': 'geology',
  'research-lab': 'geology',
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
