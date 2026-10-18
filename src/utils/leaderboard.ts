import type { Destination, GameState, MissionDifficulty, MissionObjective } from '../game/model'
import { calculateMissionScore } from '../game/model'

const LEADERBOARD_KEY = 'little-orbit-leaderboard-v1'
const MAX_ENTRIES = 5

export interface LeaderboardEntry {
  runId: string
  day: number
  maxDays: number
  status: 'success' | 'failure' | 'evacuation' | 'ended'
  date: string
  score: number
  difficulty: MissionDifficulty
  objective: MissionObjective
  destination: Destination
}

function compareEntries(a: LeaderboardEntry, b: LeaderboardEntry): number {
  return b.score - a.score || b.day - a.day || b.date.localeCompare(a.date)
}

function isEntry(value: unknown): value is LeaderboardEntry {
  if (!value || typeof value !== 'object') return false
  const entry = value as Partial<LeaderboardEntry>
  return typeof entry.runId === 'string' &&
    typeof entry.day === 'number' &&
    typeof entry.maxDays === 'number' &&
    (entry.status === 'success' || entry.status === 'failure' || entry.status === 'evacuation' || entry.status === 'ended') &&
    typeof entry.date === 'string' &&
    typeof entry.score === 'number' &&
    (entry.difficulty === 'easy' || entry.difficulty === 'normal' || entry.difficulty === 'hard') &&
    (entry.objective === 'survival' || entry.objective === 'science' || entry.objective === 'exploration' || entry.objective === 'tutorial') &&
    (entry.destination === 'moon' || entry.destination === 'mars')
}

export function getLeaderboard(): LeaderboardEntry[] {
  try {
    const raw = localStorage.getItem(LEADERBOARD_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) throw new Error('Invalid leaderboard structure')
    if (!parsed.every(isEntry)) throw new Error('Invalid leaderboard entry')
    return [...parsed].sort(compareEntries).slice(0, MAX_ENTRIES)
  } catch (error) {
    console.error('Could not read Astra One leaderboard.', error)
    throw new Error('Could not read the leaderboard. Clear the corrupted results and try again.')
  }
}

export function saveScore(state: GameState): LeaderboardEntry[] {
  if (!state.isGameOver || !state.missionResult) {
    throw new Error('A mission must be complete before its score can be saved.')
  }
  const current = getLeaderboard()
  if (current.some((entry) => entry.runId === state.runId)) return current

  const entry: LeaderboardEntry = {
    runId: state.runId,
    day: state.daysSurvived,
    maxDays: state.maxDays,
    status: state.missionResult,
    date: new Date().toISOString().slice(0, 10),
    score: calculateMissionScore(state),
    difficulty: state.difficulty,
    objective: state.objective,
    destination: state.destination,
  }
  const ranked = [...current, entry].sort(compareEntries).slice(0, MAX_ENTRIES)
  try {
    localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(ranked))
  } catch (error) {
    console.error('Could not save Astra One leaderboard.', error)
    throw new Error('Could not save this result. Check your browser storage settings.')
  }
  return ranked
}

export function clearLeaderboard(): void {
  try {
    localStorage.removeItem(LEADERBOARD_KEY)
  } catch (error) {
    console.error('Could not clear Astra One leaderboard.', error)
    throw new Error('Could not clear the leaderboard. Check your browser storage settings.')
  }
}
