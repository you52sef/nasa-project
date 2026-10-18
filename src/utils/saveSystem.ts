import type { ControlMode, CrewRole, Destination, GameState, MissionDifficulty, MissionMode, MissionObjective, MissionType } from '../game/model'
import type { ScenarioId } from '../game/scenarios'
import { CREW_ROSTERS } from '../game/crewRosters'

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
    const saved: SavedGame = JSON.parse(raw)
    if (!saved.state || typeof saved.state.day !== 'number' || typeof saved.state.resources !== 'object') {
      throw new Error('Invalid saved game structure')
    }
    return saved
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
