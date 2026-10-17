const KEY = 'astra-one-academy-progress-v1'

export interface AcademyProgress {
  completed: number[]
  attempts: Record<number, number>
  weakPoints: number[]
}

export const EMPTY_ACADEMY_PROGRESS: AcademyProgress = {
  completed: [],
  attempts: {},
  weakPoints: [],
}

export function readAcademyProgress(): AcademyProgress {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return EMPTY_ACADEMY_PROGRESS
    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== 'object') throw new Error('Invalid academy progress')
    const record = value as Record<string, unknown>
    return {
      completed: Array.isArray(record.completed) ? record.completed.filter((id): id is number => Number.isInteger(id) && id >= 1 && id <= 5) : [],
      attempts: record.attempts && typeof record.attempts === 'object' ? record.attempts as Record<number, number> : {},
      weakPoints: Array.isArray(record.weakPoints) ? record.weakPoints.filter((id): id is number => Number.isInteger(id) && id >= 1 && id <= 5) : [],
    }
  } catch (error) {
    console.error('Could not load Academy progress.', error)
    throw new Error('Could not load saved Academy progress.')
  }
}

export function saveAcademyProgress(progress: AcademyProgress): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(progress))
  } catch (error) {
    console.error('Could not save Academy progress.', error)
    throw new Error('Could not save Academy progress. Check available browser storage.')
  }
}
