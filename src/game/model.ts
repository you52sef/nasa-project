import { BUILDINGS } from './buildings'
import { SCENARIOS, type ScenarioId } from './scenarios'

export type Destination = 'moon' | 'mars'
export type Action = 'research' | 'explore' | 'maintenance' | 'rest'
export type ResourceName = 'energy' | 'oxygen' | 'water' | 'food' | 'health'
export type MissionDifficulty = 'easy' | 'normal' | 'hard'
export type MissionObjective = 'survival' | 'science' | 'exploration' | 'tutorial'
export type TutorialStep = 'forecast' | 'maintenance' | 'greenhouse' | 'rest' | 'research'
export const TUTORIAL_STEPS: readonly TutorialStep[] = ['forecast', 'maintenance', 'greenhouse', 'rest', 'research']

export interface MissionConfig {
  maxDays: number
  difficulty: MissionDifficulty
  objective: MissionObjective
  scenario: ScenarioId
}

export const MISSION_DURATIONS = [10, 30, 60] as const
export const DIFFICULTY_MODIFIERS: Record<MissionDifficulty, { consumption: number; eventChance: number; explorationRisk: number }> = {
  easy: { consumption: 0.8, eventChance: 0.15, explorationRisk: -0.05 },
  normal: { consumption: 1, eventChance: 0.3, explorationRisk: 0 },
  hard: { consumption: 1.2, eventChance: 0.45, explorationRisk: 0.08 },
}

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
  log: string[]
  lessonsCompleted: number[]
  lessonResults: Record<number, { preCorrect: boolean; postCorrect: boolean }>
  lastMessage: string
}

export const RESOURCE_CAP = 100

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
    configVersion: 2,
    day: 1,
    maxDays: MISSION_DURATIONS.includes(config.maxDays as typeof MISSION_DURATIONS[number]) ? config.maxDays! : 30,
    daysSurvived: 0,
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

const clamp = (value: number, max = RESOURCE_CAP) => Math.max(0, Math.min(max, Math.round(value)))
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

export function forecastResources(state: GameState, action: Action | null = null): Resources {
  const next = { ...state.resources }
  const crewFactor = state.crewSize / 2
  const offlineBuildings = state.offlineBuildings || []
  const production = getBuildingTotals(state.buildings, offlineBuildings)
  const consumptionFactor = DIFFICULTY_MODIFIERS[state.difficulty || 'normal'].consumption
  const maintenanceFactor = action === 'maintenance' ? 0.72 : 1

  const scenario = SCENARIOS[state.scenario || 'baseline']
  const generatedEnergy =
    countBuilding(state.buildings, 'solar-panels', offlineBuildings) * scenario.solarOutput +
    countBuilding(state.buildings, 'reactor', offlineBuildings) * 25
  next.energy = clamp(
    next.energy + generatedEnergy - dailyBuildingEnergyUse(state.buildings, offlineBuildings) - 9 * crewFactor * maintenanceFactor * consumptionFactor,
    countBuilding(state.buildings, 'battery', offlineBuildings) ? 150 : 100,
  )
  next.oxygen = clamp(next.oxygen + production.oxygen - 7 * crewFactor * maintenanceFactor * consumptionFactor)
  next.water = clamp(
    next.water + production.water - 6 * crewFactor * maintenanceFactor * consumptionFactor * scenario.waterUseMultiplier - (state.ongoingLeak ? 5 * consumptionFactor * scenario.waterUseMultiplier : 0),
  )
  next.food = clamp(next.food + production.food - 5 * crewFactor * maintenanceFactor * consumptionFactor)
  next.health = clamp(
    next.health + production.health - (state.destination === 'moon' ? 3 : 4) * crewFactor + (action === 'rest' ? 12 : 0),
  )
  if (action === 'research') {
    next.energy = clamp(next.energy - 9 * consumptionFactor, countBuilding(state.buildings, 'battery', offlineBuildings) ? 150 : 100)
    next.oxygen = clamp(next.oxygen - 3 * consumptionFactor)
  }
  if (action === 'explore') {
    next.energy = clamp(next.energy - 12 * consumptionFactor, countBuilding(state.buildings, 'battery', offlineBuildings) ? 150 : 100)
    next.oxygen = clamp(next.oxygen - 5 * consumptionFactor)
    next.health = clamp(next.health - 8)
  }
  if (action === 'rest') next.food = clamp(next.food - 3 * crewFactor * consumptionFactor)
  return next
}

export function forecastRadiationExposure(state: GameState, action: Action | null = null): number {
  const shelterOnline =
    state.buildings.includes('storm-shelter') &&
    !(state.offlineBuildings || []).includes('storm-shelter')
  const ambientExposure = state.destination === 'moon' ? 1.4 : 1.1
  const activityExposure = action === 'explore' ? 4 : 0
  const shieldingFactor = shelterOnline ? 0.25 : 1
  return Math.min(100, state.radiationExposure + (ambientExposure + activityExposure) * shieldingFactor)
}

export function finishDay(state: GameState, action: Action): GameState {
  if (!state.started || state.paused || state.isGameOver || state.activeEvent) return state
  const tutorialStep: Partial<Record<Action, TutorialStep>> = {
    maintenance: 'maintenance',
    rest: 'rest',
    research: 'research',
  }
  const cycleState = {
    ...state,
    resources: forecastResources(state, action),
    daysSurvived: state.daysSurvived + 1,
  }
  const step = tutorialStep[action]
  const tutorialState = step ? recordTutorialStep(cycleState, step) : cycleState
  const next = { ...tutorialState }
  next.radiationExposure = forecastRadiationExposure(state, action)
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
  next.fatigue = clampPercent(state.fatigue + 4 + fatigueChange[action])
  next.morale = clampPercent(state.morale - 2 + moraleChange[action])
  next.science += action === 'research'
    ? Math.round(15 * (0.7 + state.morale / 250))
    : action === 'explore'
      ? 8
      : 0
  if (state.fatigue >= 80) next.resources.health = clamp(next.resources.health - 3)
  if (next.radiationExposure >= 60) next.resources.health = clamp(next.resources.health - 2)
  if (action === 'explore') {
    const success = deterministicRoll(state.missionSeed, state.day, 1) >= getExplorationRisk(state)
    if (success) {
      next.successfulExpeditions += 1
      next.resources.credits += 60
      next.resources.water = clamp(next.resources.water + 12)
      next.lastMessage = 'نجحت الرحلة الاستكشافية! عثر الفريق على عينات ومخزون ماء.'
    } else {
      next.resources.health = clamp(next.resources.health - 16)
      next.lastMessage = 'واجه الفريق تضاريس خطرة في الرحلة وعاد بإصابات طفيفة.'
    }

  } else if (action === 'research') {
    next.lastMessage = `اكتمل البحث العلمي وأُضيفت نقاط علم. إرهاق الطاقم ${next.fatigue}٪ ومعنوياته ${next.morale}٪.`
  } else if (action === 'maintenance') {
    next.lastMessage = `الصيانة خفّضت استهلاك الموارد. إرهاق الطاقم ${next.fatigue}٪.`
  } else {
    next.lastMessage = `استعاد الطاقم عافيته؛ الإرهاق ${next.fatigue}٪ والمعنويات ${next.morale}٪.`
  }
  next.lastAction = action
  next.log = [...state.log, `اليوم ${state.day}: ${action}`]
  const suppliesAboveThreshold = (['energy', 'oxygen', 'water', 'food'] as const)
    .every((resource) => next.resources[resource] > 80)
  next.resourceStreak = suppliesAboveThreshold ? state.resourceStreak + 1 : 0

  const depleted = (['energy', 'oxygen', 'water', 'food', 'health'] as ResourceName[]).find(
    (key) => next.resources[key] <= 0,
  )
  if (depleted) {
    next.isGameOver = true
    next.missionResult = 'evacuation'
    next.lastMessage = `انخفض ${depleted} إلى الصفر، واضطر الطاقم إلى الإخلاء.`
    return next
  }
  if (next.daysSurvived >= next.maxDays) {
    next.isGameOver = true
    next.missionResult = 'success'
    next.lastMessage = 'اكتملت المهمة وعاد الطاقم بسلام!'
    return next
  }
  next.day += 1
  return next
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

export function settleAfterEvent(state: GameState): GameState {
  const depleted = (['energy', 'oxygen', 'water', 'food', 'health'] as ResourceName[]).find(
    (key) => state.resources[key] <= 0,
  )
  if (depleted) {
    return {
      ...state,
      activeEvent: null,
      isGameOver: true,
      missionResult: 'evacuation',
      lastMessage: `انخفض ${depleted} إلى الصفر، واضطر الطاقم إلى الإخلاء.`,
    }
  }
  if (state.daysSurvived >= state.maxDays) {
    return { ...state, activeEvent: null, isGameOver: true, missionResult: 'success' }
  }
  return { ...state, activeEvent: null, day: state.day + 1 }
}

export function canBuild(state: GameState, buildingId: string): boolean {
  if (!state.started || state.paused || state.isGameOver || state.activeEvent) return false
  const building = BUILDINGS[buildingId]
  if (!building || (building.destination && building.destination !== state.destination)) return false
  if (state.resources.credits < building.cost || state.resources.cargo < building.cargo) return false
  if (state.resources.energy < building.energyCost) return false
  return true
}

export function canToggleBuilding(state: GameState, buildingId: string): boolean {
  if (!state.started || state.paused || state.isGameOver || state.activeEvent || !state.buildings.includes(buildingId) || !BUILDINGS[buildingId]) return false
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
    offlineBuildings: updatedOfflineBuildings,
    lastMessage: `${BUILDINGS[buildingId].name.en} ${isOffline ? 'returned to service' : 'placed offline'} by crew command.`,
  }
}

export function buildInState(state: GameState, buildingId: string): GameState {
  if (!canBuild(state, buildingId)) return { ...state, lastMessage: 'لا تكفي الاعتمادات أو سعة الشحن أو الطاقة لبناء هذا المبنى.' }
  const building = BUILDINGS[buildingId]
  const next: GameState = {
    ...state,
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

export function endIfDepleted(state: GameState): GameState {
  const depleted = (['energy', 'oxygen', 'water', 'food', 'health'] as ResourceName[]).find(
    (key) => state.resources[key] <= 0,
  )
  return depleted
    ? { ...state, isGameOver: true, missionResult: 'evacuation', lastMessage: `نفد ${depleted} وتم إجلاء الطاقم.` }
    : state
}
