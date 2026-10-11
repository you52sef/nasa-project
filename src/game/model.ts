import { BUILDINGS } from './buildings'
import { SCENARIOS, type ScenarioId } from './scenarios'

export type Destination = 'moon' | 'mars'
export type Action = 'research' | 'explore' | 'maintenance' | 'rest'
export type ResourceName = 'energy' | 'oxygen' | 'water' | 'food' | 'health'
export type MissionDifficulty = 'easy' | 'normal' | 'hard'
export type MissionObjective = 'survival' | 'science' | 'exploration' | 'tutorial'
export type MissionMode = 'education' | 'simulation'
export type CrewRole = 'commander' | 'power-engineer' | 'biologist' | 'water-officer'
export type ControlMode = 'full' | 'specialist'
export type MissionPhase = 'outbound' | 'surface' | 'return'
export type TransitChoice = 'conservative' | 'efficient'
export type TutorialStep = 'forecast' | 'maintenance' | 'greenhouse' | 'rest' | 'research'
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
  rest: 2,
}
export const DIFFICULTY_MODIFIERS: Record<MissionDifficulty, { consumption: number; eventChance: number; explorationRisk: number }> = {
  easy: { consumption: 0.8, eventChance: 0.15, explorationRisk: -0.05 },
  normal: { consumption: 1, eventChance: 0.3, explorationRisk: 0 },
  hard: { consumption: 1.2, eventChance: 0.45, explorationRisk: 0.08 },
}
export const RESOURCE_RATES = {
  energyKwhPerCrewDay: 4,
  oxygenKgPerCrewDay: 0.84,
  waterLitersPerCrewDay: 3.5,
  waterRecoveryFraction: 0.98,
  greenhouseWaterRecoveryFraction: 0.9,
  foodKgPerCrewDay: 0.62,
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
  assistantActionHistory: Action[]
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
  if (action === 'research') return { energy: 9 * consumption, oxygen: 0.1 * consumption }
  if (action === 'explore') return { energy: 12 * consumption, oxygen: 0.4 * consumption }
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
    configVersion: 4,
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
    buildings: ['solar-panels', 'life-support'],
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
    assistantActionHistory: [],
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
      for (const [resource, amount] of Object.entries(building.consumption || {})) {
        totals[resource as ResourceName] -= amount
      }
      return totals
    },
    { energy: 0, oxygen: 0, water: 0, food: 0, health: 0 } as Record<ResourceName, number>,
  )
}

function countBuilding(buildings: string[], id: string, offlineBuildings: string[] = []): number {
  return buildings.filter((buildingId) => buildingId === id && !offlineBuildings.includes(buildingId)).length
}

function dailyBuildingEnergyUse(buildings: string[], offlineBuildings: string[] = []): number {
  return buildings
    .filter((id) => !offlineBuildings.includes(id))
    .reduce((total, id) => total + (BUILDINGS[id]?.consumption.energy || 0), 0)
}

export function getSolarAvailabilityFactor(destination: Destination, day: number): number {
  if (destination === 'mars') return 1 / 1.523679 ** 2
  const lunarDay = ((day - 1) % 29.53059) / 29.53059
  return Math.max(0, Math.cos(2 * Math.PI * lunarDay)) * Math.PI
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
    maintenanceFactor * consumptionFactor
  const activityEnergyUse = additionalActions.reduce(
    (total, item) => total + (getActivityResourceCost(item, state.difficulty).energy || 0),
    0,
  )
  const scenario = SCENARIOS[state.scenario || 'baseline']
  const generatedEnergy =
    solarCount * scenario.solarOutput * getSolarAvailabilityFactor(state.destination, state.day) +
    countBuilding(state.buildings, 'reactor', offlineBuildings) * 25
  const requiredEnergy = dailyBuildingEnergyUse(state.buildings, offlineBuildings) +
    crewEnergyUse + activityEnergyUse
  const powerFactor = requiredEnergy === 0
    ? 1
    : Math.min(1, Math.max(0, next.energy + generatedEnergy) / requiredEnergy)
  const lifeSupportOxygen = lifeSupportCount * 1.8 * powerFactor
  const crewWaterUse = state.crewSize * RESOURCE_RATES.waterLitersPerCrewDay *
    consumptionFactor * SCENARIOS[state.scenario || 'baseline'].waterUseMultiplier
  const waterRecovery = recyclerCount ? RESOURCE_RATES.waterRecoveryFraction * powerFactor : 0
  const greenhouseWaterUse = greenhouseCount * (BUILDINGS.greenhouse.consumption.water || 0)
  const greenhouseWaterRecovery = recyclerCount
    ? greenhouseWaterUse * RESOURCE_RATES.greenhouseWaterRecoveryFraction * powerFactor
    : 0
  const waterElectrolysisUse = lifeSupportOxygen * RESOURCE_RATES.electrolysisWaterKgPerOxygenKg
  const oxygenUse = state.crewSize * RESOURCE_RATES.oxygenKgPerCrewDay * consumptionFactor

  next.energy = clamp(
    next.energy + generatedEnergy - requiredEnergy,
    countBuilding(state.buildings, 'battery', offlineBuildings) ? 150 : 100,
  )
  next.oxygen = clamp(
    next.oxygen + production.oxygen * powerFactor - oxygenUse -
      additionalActions.reduce((total, item) => total + (getActivityResourceCost(item, state.difficulty).oxygen || 0), 0),
  )
  next.water = clamp(
    next.water + production.water + greenhouseWaterRecovery -
      crewWaterUse * (1 - waterRecovery) -
      waterElectrolysisUse -
      (state.ongoingLeak
        ? convertLegacyResourceDelta('water', 5) * consumptionFactor * scenario.waterUseMultiplier
        : 0),
  )
  next.food = clamp(
    next.food + production.food * powerFactor -
      state.crewSize * RESOURCE_RATES.foodKgPerCrewDay * consumptionFactor,
  )
  next.health = clamp(
    next.health + production.health +
      actions.filter((item) => item === 'rest').length * RESOURCE_RATES.restHealthRecoveryPoints,
  )
  const explorations = actions.filter((item) => item === 'explore').length
  const expectedExplorationHealthLoss = explorations * 16 * getExplorationRisk(state)
  const fatigueHealthLoss = state.fatigue >= 80 ? 3 : 0
  const projectedRadiation = forecastRadiationExposure(state, actions)
  const radiationHealthLoss = projectedRadiation >= 60 ? 2 : 0
  next.health = clamp(next.health - expectedExplorationHealthLoss - fatigueHealthLoss - radiationHealthLoss)
  return next
}

export function forecastRadiationExposure(state: GameState, action: Action | readonly Action[] | null = null): number {
  const shelterOnline =
    state.buildings.includes('storm-shelter') &&
    !(state.offlineBuildings || []).includes('storm-shelter')
  const ambientExposure = state.destination === 'moon' ? 1.4 : 1.1
  const actions = normalizeActions(action)
  const activityExposure = actions.filter((item) => item === 'explore').length * 4
  const shieldingFactor = shelterOnline ? 0.25 : 1
  return Math.min(100, state.radiationExposure + (ambientExposure + activityExposure) * shieldingFactor)
}

export function finishDay(state: GameState, action: Action | readonly Action[]): GameState {
  if (!state.started || state.paused || state.isGameOver || state.activeEvent || state.daysSurvived >= state.maxDays) return state
  const actions = normalizeActions(action)
  if (!actions.length) actions.push('rest')
  const depletedBeforeAdvance = (['energy', 'oxygen', 'water', 'food', 'health'] as const)
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
  const next = { ...tutorialState }
  next.actionHistory = [...state.actionHistory, ...actions]
  next.radiationExposure = forecastRadiationExposure(state, actions)
  const fatigueChange: Record<Action, number> = {
    research: 8,
    explore: 20,
    maintenance: 3,
    rest: -24,
  }
  const moraleChange: Record<Action, number> = {
    research: 1,
    explore: -7,
    maintenance: 3,
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
  next.lastAction = lastAction
  next.log = [...state.log, `اليوم ${state.day}: ${actions.join(', ')}`]
  const suppliesAboveThreshold = (['energy', 'oxygen', 'water', 'food'] as const)
    .every((resource) => next.resources[resource] > 80)
  next.resourceStreak = suppliesAboveThreshold ? state.resourceStreak + 1 : 0

  const depleted = (['energy', 'oxygen', 'water', 'food', 'health'] as ResourceName[]).find(
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
  commander: ['explore', 'maintenance', 'rest'],
  'power-engineer': ['maintenance', 'research', 'rest'],
  biologist: ['research', 'explore', 'rest'],
  'water-officer': ['maintenance', 'explore', 'rest'],
}

export function canPerformActivity(state: GameState, action: Action): boolean {
  if (state.controlMode === 'full') return true
  return SPECIALIST_ACTIONS[state.controlledRole].includes(action)
}

export function scheduleActivity(state: GameState, action: Action): GameState {
  if (!state.started || state.paused || state.isGameOver || state.activeEvent) return state
  if (state.missionPhase === 'outbound' && !state.transitDecisions.some((decision) => decision.leg === 'outbound')) return state
  if (state.missionPhase === 'return' && !state.transitDecisions.some((decision) => decision.leg === 'return')) return state
  if (!canPerformActivity(state, action) || state.hour + ACTIVITY_DURATIONS[action] > MISSION_DAY_END) return state
  const cost = getActivityResourceCost(action, state.difficulty)
  const batteryOnline = state.buildings.includes('battery') && !(state.offlineBuildings || []).includes('battery')
  const resources = { ...state.resources }
  if (cost.energy !== undefined) resources.energy = clamp(resources.energy - cost.energy, batteryOnline ? 150 : 100)
  if (cost.oxygen !== undefined) resources.oxygen = clamp(resources.oxygen - cost.oxygen)
  const scheduled = {
    ...state,
    resources,
    hour: state.hour + ACTIVITY_DURATIONS[action],
    todayActions: [...state.todayActions, action],
    lastMessage: '',
  }
  return endIfDepleted(scheduled, { resource: (['energy', 'oxygen'] as const).find((resource) => resources[resource] <= 0) || 'energy', source: 'daily-operation', action })
}

export function canSleepAndAdvance(state: GameState): boolean {
  const transitReady = (state.missionPhase !== 'outbound' || state.transitDecisions.some((decision) => decision.leg === 'outbound'))
    && (state.missionPhase !== 'return' || state.transitDecisions.some((decision) => decision.leg === 'return'))
  return transitReady && state.daysSurvived < state.maxDays && state.hour >= MISSION_BEDTIME &&
    !state.activeEvent && !state.isGameOver && state.started && !state.paused
}

export function waitUntilBedtime(state: GameState): GameState {
  const transitReady = (state.missionPhase !== 'outbound' || state.transitDecisions.some((decision) => decision.leg === 'outbound'))
    && (state.missionPhase !== 'return' || state.transitDecisions.some((decision) => decision.leg === 'return'))
  if (!transitReady || !state.started || state.paused || state.isGameOver || state.activeEvent || state.hour >= MISSION_BEDTIME) return state
  return { ...state, hour: MISSION_BEDTIME }
}

export function sleepAndAdvanceDay(state: GameState, crewCoordinatedAction?: Action): GameState {
  if (!canSleepAndAdvance(state)) return state
  const actions: Action[] = [...state.todayActions, ...(crewCoordinatedAction ? [crewCoordinatedAction] : []), 'rest']
  const next = finishDay(state, actions)
  next.actionHistory = [...state.actionHistory, ...state.todayActions]
  next.lastAction = state.todayActions[state.todayActions.length - 1] || crewCoordinatedAction || 'rest'
  if (next.failureCause?.source === 'daily-operation') {
    next.failureCause = { ...next.failureCause, action: next.lastAction }
  }
  if (crewCoordinatedAction) {
    next.assistantActionHistory = [...state.assistantActionHistory, crewCoordinatedAction]
    next.log = [...next.log, `Day ${state.day}: assistant-coordinated ${crewCoordinatedAction}`]
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
  const depleted = (['energy', 'oxygen', 'water', 'food', 'health'] as const)
    .find((resource) => next.resources[resource] <= 0)
  if (!depleted) {
    if (leg === 'return') {
      next.isGameOver = true
      next.missionResult = 'success'
      next.lastMessage = 'اكتملت الرحلة وعاد الطاقم إلى الأرض بسلام.'
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
  const depleted = (['energy', 'oxygen', 'water', 'food', 'health'] as ResourceName[]).find(
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
  if (state.daysSurvived >= state.maxDays) {
    return { ...state, activeEvent: null, isGameOver: true, missionResult: 'success', hour: MISSION_DAY_START, todayActions: [] }
  }
  return { ...state, activeEvent: null, day: state.day + 1, hour: MISSION_DAY_START, todayActions: [] }
}

export function canBuild(state: GameState, buildingId: string): boolean {
  if (!canManageMissionActivity(state) || state.hour + 2 > MISSION_DAY_END) return false
  const building = BUILDINGS[buildingId]
  if (!building || (building.destination && building.destination !== state.destination)) return false
  if (state.controlMode === 'specialist' && !canManageFacility(state.controlledRole, buildingId)) return false
  if (state.resources.credits < building.cost || state.resources.cargo < building.cargo) return false
  if (state.resources.energy < building.energyCost) return false
  return true
}

export function canToggleBuilding(state: GameState, buildingId: string): boolean {
  if (!canManageMissionActivity(state) || state.hour + 1 > MISSION_DAY_END || !state.buildings.includes(buildingId) || !BUILDINGS[buildingId]) return false
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
    return {
      ...state,
      lastMessage: state.buildings.includes(buildingId)
        ? 'Keep at least one oxygen-production system online.'
        : 'That facility is not part of this base.',
    }
  }
  const offlineBuildings = state.offlineBuildings || []
  const isOffline = offlineBuildings.includes(buildingId)
  const updatedOfflineBuildings = isOffline
    ? offlineBuildings.filter((id) => id !== buildingId)
    : [...offlineBuildings, buildingId]
  return {
    ...state,
    hour: state.hour + 1,
    offlineBuildings: updatedOfflineBuildings,
    lastMessage: `${BUILDINGS[buildingId].name.en} ${isOffline ? 'returned to service' : 'placed offline'} by crew command.`,
  }
}

export function buildInState(state: GameState, buildingId: string): GameState {
  if (!canBuild(state, buildingId)) {
    const building = BUILDINGS[buildingId]
    const lastMessage = !canManageMissionActivity(state)
      ? 'Facility work is unavailable during this mission phase.'
      : state.hour + 2 > MISSION_DAY_END
        ? 'Not enough shift time remains for construction.'
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
    offlineBuildings: state.offlineBuildings || [],
    lastMessage: `تم بناء ${building.name.ar} بنجاح.`,
  }
  return buildingId === 'greenhouse' ? recordTutorialStep(next, 'greenhouse') : next
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
  const depleted = (['energy', 'oxygen', 'water', 'food', 'health'] as ResourceName[]).find(
    (key) => state.resources[key] <= 0,
  )
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
  }, { research: 0, explore: 0, maintenance: 0, rest: 0 })
}
