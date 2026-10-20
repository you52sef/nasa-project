import type { ControlMode, CrewRole, Destination, GameState, MissionDifficulty, MissionMode, MissionObjective, MissionType } from '../game/model'
import type { ScenarioId } from '../game/scenarios'
import { CREW_ROSTERS, type CrewSpecialty } from '../game/crewRosters'
import { EVENTS } from '../game/events'

const SAVE_KEY = 'little-orbit-save-v1'
const SETUP_KEY = 'little-orbit-setup-v1'

export type MissionSetup = Omit<Pick<GameState, 'destination' | 'crewSize' | 'maxDays' | 'missionType' | 'difficulty' | 'objective' | 'missionSeed' | 'scenario' | 'missionMode' | 'controlMode' | 'controlledRole' | 'controlledDutyId'>, 'missionType'> & {
  missionType?: MissionType
  astronautName?: string
  astronautDutyId?: string
}

function isDestination(value: unknown): value is Destination {
  return value === 'moon' || value === 'mars'
}

function isDifficulty(value: unknown): value is MissionDifficulty {
  return value === 'easy' || value === 'normal' || value === 'hard'
}

function isObjective(value: unknown): value is MissionObjective {
  return value === 'survival' || value === 'science' || value === 'exploration' || value === 'tutorial'
}

function isMissionType(value: unknown): value is MissionType {
  return value === 'moon-exploration' || value === 'moon-settlement' ||
    value === 'mars-opposition' || value === 'mars-conjunction'
}

function isMissionMode(value: unknown): value is MissionMode {
  return value === 'education' || value === 'simulation'
}

function isControlMode(value: unknown): value is ControlMode {
  return value === 'full' || value === 'specialist'
}

function isCrewRole(value: unknown): value is CrewRole {
  return value === 'commander' || value === 'power-engineer' || value === 'biologist' || value === 'water-officer'
}

function isScenario(value: unknown): value is ScenarioId {
  return value === 'baseline' || value === 'dust-front' || value === 'water-rationing' || value === 'oxygen-shortage' ||
    value === 'solar-flare' || value === 'habitat-leak' || value === 'greenhouse-fault'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isOptionalChoice(value: unknown, choices: readonly string[]): boolean {
  return value === undefined || (typeof value === 'string' && choices.includes(value))
}

const ACTIONS = ['research', 'explore', 'maintenance', 'exercise', 'rest'] as const

function isAction(value: unknown): boolean {
  return typeof value === 'string' && ACTIONS.includes(value as typeof ACTIONS[number])
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

const CREW_SPECIALTIES: readonly CrewSpecialty[] = [
  'command', 'pilot', 'science', 'medical', 'engineering', 'communications', 'power',
  'resources', 'robotics', 'agriculture', 'agriculture-resources', 'science-medical',
  'engineering-science', 'geology-agriculture',
]

function isCrewCondition(value: unknown): boolean {
  return isRecord(value) &&
    isFiniteNumber(value.health) && value.health >= 0 && value.health <= 100 &&
    isFiniteNumber(value.fatigue) && value.fatigue >= 0 && value.fatigue <= 100 &&
    isFiniteNumber(value.stress) && value.stress >= 0 && value.stress <= 100 &&
    (value.morale === undefined || (isFiniteNumber(value.morale) && value.morale >= 0 && value.morale <= 100))
}

function isOptionalArray(value: unknown, validateItem: (item: unknown) => boolean): boolean {
  return value === undefined || (Array.isArray(value) && value.every(validateItem))
}

function isOptionalStringArray(value: unknown): boolean {
  return isOptionalArray(value, (item) => typeof item === 'string')
}

function isResourceSnapshot(value: unknown): boolean {
  return isRecord(value) &&
    ['energy', 'oxygen', 'water', 'food', 'health'].every((key) => isFiniteNumber(value[key]))
}

function isValidFailureCause(value: unknown): boolean {
  if (value === undefined || value === null) return true
  if (!isRecord(value) ||
    !isOptionalChoice(value.resource, ['energy', 'oxygen', 'water', 'food', 'health']) ||
    value.resource === undefined ||
    !isOptionalChoice(value.source, ['daily-operation', 'event', 'transit']) ||
    value.source === undefined ||
    !isOptionalChoice(value.action, ACTIONS) ||
    !isOptionalChoice(value.transitLeg, ['outbound', 'return']) ||
    !isOptionalChoice(value.transitChoice, ['conservative', 'efficient'])) return false
  if (value.eventId !== undefined) {
    const event = EVENTS.find((candidate) => candidate.id === value.eventId)
    if (!event) return false
    if (value.choiceIndex !== undefined &&
      (!Number.isInteger(value.choiceIndex) || (value.choiceIndex as number) < 0 ||
        (value.choiceIndex as number) >= event.choices.length)) return false
  }
  return value.choiceIndex === undefined ||
    (Number.isInteger(value.choiceIndex) && (value.choiceIndex as number) >= 0)
}

function isValidActiveEvent(value: unknown): boolean {
  if (value === undefined || value === null) return true
  if (!isRecord(value)) return false
  const event = EVENTS.find((candidate) => candidate.id === value.id)
  return event !== undefined &&
    (value.choiceIndex === undefined ||
      (Number.isInteger(value.choiceIndex) && (value.choiceIndex as number) >= 0 &&
        (value.choiceIndex as number) < event.choices.length))
}

function isValidActiveOperation(value: unknown): boolean {
  if (value === undefined || value === null) return true
  if (!isRecord(value)) return false
  const stepCounts = {
    'science-expedition': 5,
    maintenance: 5,
    construction: 4,
    rescue: 6,
  } as const
  if (typeof value.id !== 'string' || !(value.id in stepCounts)) return false
  const stepCount = stepCounts[value.id as keyof typeof stepCounts]
  return Number.isInteger(value.step) && (value.step as number) >= 0 && (value.step as number) < stepCount &&
    isOptionalChoice(value.status, ['active', 'complete', 'failed']) && value.status !== undefined &&
    isFiniteNumber(value.cyclesRemaining) && value.cyclesRemaining >= 0 &&
    typeof value.partialDamage === 'boolean' &&
    isFiniteNumber(value.suitOxygenPercent) && value.suitOxygenPercent >= 0 && value.suitOxygenPercent <= 100 &&
    isFiniteNumber(value.siteDistanceUnits) && value.siteDistanceUnits >= 0
}

function isValidDailyReport(value: unknown): boolean {
  if (!isRecord(value) || !isFiniteNumber(value.day) || !isOptionalArray(value.actions, isAction) ||
    !Array.isArray(value.actions) || !isOptionalStringArray(value.events) || !Array.isArray(value.events) ||
    !isFiniteNumber(value.radiationMsv)) return false
  if (!isResourceSnapshot(value.resourcesAtStart) || !isResourceSnapshot(value.resourcesAtEnd)) return false
  if (value.earthTransmission === undefined) return true
  return isRecord(value.earthTransmission) &&
    isOptionalChoice(value.earthTransmission.status, ['queued', 'local']) &&
    isFiniteNumber(value.earthTransmission.delayMinutes) && value.earthTransmission.delayMinutes >= 0
}

function isValidSavedGameState(value: unknown): value is GameState {
  if (!isRecord(value) || !isRecord(value.resources)) return false
  const resources = value.resources
  return (
    (value.destination === 'moon' || value.destination === 'mars') &&
    typeof value.crewSize === 'number' && Number.isInteger(value.crewSize) && value.crewSize >= 2 && value.crewSize <= 12 &&
    typeof value.maxDays === 'number' && [10, 30, 60, 180].includes(value.maxDays) &&
    (value.missionType === undefined || (
      typeof value.missionType === 'string' &&
      isOptionalChoice(value.missionType, ['moon-exploration', 'moon-settlement', 'mars-opposition', 'mars-conjunction']) &&
      value.missionType.startsWith(value.destination)
    )) &&
    isOptionalChoice(value.missionMode, ['education', 'simulation']) &&
    isOptionalChoice(value.controlMode, ['full', 'specialist']) &&
    isOptionalChoice(value.controlledRole, ['commander', 'power-engineer', 'biologist', 'water-officer']) &&
    isOptionalChoice(value.missionPhase, ['outbound', 'surface', 'return']) &&
    isOptionalChoice(value.difficulty, ['easy', 'normal', 'hard']) &&
    isOptionalChoice(value.objective, ['survival', 'science', 'exploration', 'tutorial']) &&
    isOptionalChoice(value.scenario, ['baseline', 'dust-front', 'water-rationing', 'oxygen-shortage', 'solar-flare', 'habitat-leak', 'greenhouse-fault']) &&
    (value.missionSeed === undefined || (isFiniteNumber(value.missionSeed) && Number.isInteger(value.missionSeed) && value.missionSeed >= 0 && value.missionSeed <= 0xffff_ffff)) &&
    ['started', 'paused', 'airlockIsolated', 'permanentRadiationDamageWarning', 'regolithPreTreated', 'survivalMode', 'ongoingLeak', 'isGameOver']
      .every((key) => value[key] === undefined || typeof value[key] === 'boolean') &&
    Array.isArray(value.buildings) && value.buildings.every((building) => typeof building === 'string') &&
    isOptionalStringArray(value.offlineBuildings) &&
    isOptionalStringArray(value.survivalModeOfflineBuildings) &&
    isOptionalStringArray(value.autoShedBuildings) &&
    isOptionalStringArray(value.constructionEventsToday) &&
    isOptionalStringArray(value.log) &&
    isOptionalArray(value.todayActions, isAction) &&
    isOptionalArray(value.actionHistory, isAction) &&
    isOptionalArray(value.crewSupportActionHistory, isAction) &&
    isOptionalArray(value.tutorialSteps, (step) =>
      typeof step === 'string' && ['forecast', 'maintenance', 'greenhouse', 'rest', 'research'].includes(step),
    ) &&
    isOptionalArray(value.lessonsCompleted, (lesson) => Number.isInteger(lesson) && (lesson as number) > 0) &&
    isOptionalArray(value.dailyReports, isValidDailyReport) &&
    isOptionalArray(value.transitDecisions, (decision) => isRecord(decision) &&
      isOptionalChoice(decision.leg, ['outbound', 'return']) && decision.leg !== undefined &&
      isOptionalChoice(decision.choice, ['conservative', 'efficient']) && decision.choice !== undefined,
    ) &&
    isOptionalArray(value.eventHistory, (event) => isRecord(event) &&
      EVENTS.some((definition) => definition.id === event.eventId) &&
      (event.choiceIndex === undefined || (Number.isInteger(event.choiceIndex) && (event.choiceIndex as number) >= 0)) &&
      (event.day === undefined || isFiniteNumber(event.day)),
    ) &&
    isOptionalArray(value.crewDailyActivities, (activity) => isRecord(activity) &&
      typeof activity.dutyId === 'string' && typeof activity.title === 'string' &&
      isAction(activity.action) &&
      isOptionalChoice(activity.effect, ['inspection', 'science', 'power', 'water', 'food', 'food-water', 'health', 'coordination', 'recovery']) &&
      activity.effect !== undefined,
    ) &&
    isOptionalArray(value.crewCommunications, (request) => isRecord(request) &&
      isFiniteNumber(request.day) && typeof request.dutyId === 'string' &&
      isAction(request.action) && isOptionalChoice(request.decision, ['accepted', 'rejected']) &&
      request.decision !== undefined && typeof request.reason === 'string',
    ) &&
    (value.crewConditions === undefined || (isRecord(value.crewConditions) && Object.values(value.crewConditions).every(isCrewCondition))) &&
    (value.crewSpecialtyOverrides === undefined || (isRecord(value.crewSpecialtyOverrides) &&
      Object.entries(value.crewSpecialtyOverrides).every(([dutyId, specialty]) =>
        typeof dutyId === 'string' && typeof specialty === 'string' && CREW_SPECIALTIES.includes(specialty as CrewSpecialty),
      ))) &&
    isValidActiveEvent(value.activeEvent) &&
    isValidActiveOperation(value.activeOperation) &&
    isValidFailureCause(value.failureCause) &&
    (value.baseName === undefined || typeof value.baseName === 'string') &&
    (value.astronautName === undefined || typeof value.astronautName === 'string') &&
    (value.runId === undefined || typeof value.runId === 'string') &&
    (value.lastMessage === undefined || typeof value.lastMessage === 'string') &&
    (value.dailyResourceStart === undefined || isResourceSnapshot(value.dailyResourceStart)) &&
    (value.lessonResults === undefined ||
      (isRecord(value.lessonResults) && Object.values(value.lessonResults).every((lesson) =>
        isRecord(lesson) &&
        (lesson.preCorrect === null || typeof lesson.preCorrect === 'boolean') &&
        typeof lesson.postCorrect === 'boolean',
      ))) &&
    (value.missionResult === undefined || value.missionResult === null ||
      isOptionalChoice(value.missionResult, ['success', 'failure', 'evacuation', 'ended'])) &&
    (value.lastAction === undefined || value.lastAction === null || isAction(value.lastAction)) &&
    (value.isGameOver === undefined || typeof value.isGameOver === 'boolean') &&
    ['energy', 'oxygen', 'water', 'food', 'health', 'credits', 'cargo'].every((key) =>
      typeof resources[key] === 'number' && Number.isFinite(resources[key]),
    )
  )
}

export function loadMissionSetup(): Partial<MissionSetup> {
  try {
    const raw = localStorage.getItem(SETUP_KEY)
    if (!raw) return {}
    const setup: unknown = JSON.parse(raw)
    if (!setup || typeof setup !== 'object') throw new Error('Invalid mission setup')
    const value = setup as Record<string, unknown>
    return {
      ...(isDestination(value.destination) ? { destination: value.destination } : {}),
      ...(typeof value.crewSize === 'number' && CREW_ROSTERS.some((roster) => roster.crewSize === value.crewSize) ? { crewSize: value.crewSize } : {}),
      ...(typeof value.maxDays === 'number' && [10, 30, 60, 180].includes(value.maxDays) ? { maxDays: value.maxDays } : {}),
      ...(isMissionType(value.missionType) ? { missionType: value.missionType } : {}),
      ...(isDifficulty(value.difficulty) ? { difficulty: value.difficulty } : {}),
      ...(isObjective(value.objective) ? { objective: value.objective } : {}),
      ...(isMissionMode(value.missionMode) ? { missionMode: value.missionMode } : {}),
      ...(isControlMode(value.controlMode) ? { controlMode: value.controlMode } : {}),
      ...(isCrewRole(value.controlledRole) ? { controlledRole: value.controlledRole } : {}),
      ...(typeof value.controlledDutyId === 'string' ? { controlledDutyId: value.controlledDutyId } : {}),
      ...(typeof value.astronautName === 'string' ? { astronautName: value.astronautName.slice(0, 40) } : {}),
      ...(typeof value.astronautDutyId === 'string' ? { astronautDutyId: value.astronautDutyId } : {}),
      ...(isScenario(value.scenario) ? { scenario: value.scenario } : {}),
      ...(typeof value.missionSeed === 'number' && Number.isInteger(value.missionSeed) && value.missionSeed >= 0 && value.missionSeed <= 0xffff_ffff
        ? { missionSeed: value.missionSeed }
        : {}),
    }
  } catch (error) {
    console.error('Could not load Astra One mission setup.', error)
    return {}
  }
}

export function saveMissionSetup(setup: MissionSetup): void {
  try {
    localStorage.setItem(SETUP_KEY, JSON.stringify(setup))
  } catch (error) {
    console.error('Could not save Astra One mission setup.', error)
  }
}

export interface SavedGame {
  state: GameState
  savedAt: string
}

export function saveGame(state: GameState): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ state, savedAt: new Date().toISOString() } satisfies SavedGame))
  } catch (error) {
    console.error('Could not save Astra One progress.', error)
    throw new Error('تعذر حفظ اللعبة. تحقق من مساحة التخزين في المتصفح.')
  }
}

export function loadGame(): SavedGame | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return null
    const saved: unknown = JSON.parse(raw)
    if (
      !isRecord(saved) ||
      typeof saved.savedAt !== 'string' ||
      !isValidSavedGameState(saved.state) ||
      typeof saved.state.day !== 'number' ||
      !Number.isFinite(saved.state.day)
    ) {
      throw new Error('Invalid saved game structure')
    }
    return { state: saved.state, savedAt: saved.savedAt }
  } catch (error) {
    console.error('Could not load Astra One save.', error)
    throw new Error('ملف الحفظ غير صالح. احذفه وابدأ مهمة جديدة.')
  }
}

export function hasSavedGame(): boolean {
  try {
    return localStorage.getItem(SAVE_KEY) !== null
  } catch (error) {
    console.error('Could not inspect Astra One save.', error)
    return false
  }
}

export function deleteSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY)
  } catch (error) {
    console.error('Could not delete Astra One save.', error)
    throw new Error('تعذر حذف الحفظ من المتصفح.')
  }
}
