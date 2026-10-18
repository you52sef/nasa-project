const KEY = 'astra-one-academy-progress-v1'
export const ACADEMY_LESSON_COUNT = 5

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

export function getCumulativeLessonIds(lessonId: number): number[] {
  if (!Number.isInteger(lessonId) || lessonId < 1 || lessonId > ACADEMY_LESSON_COUNT) return []
  return Array.from({ length: lessonId }, (_, index) => index + 1)
}

function normalizeProgress(value: unknown): AcademyProgress {
  if (!value || typeof value !== 'object') throw new Error('Invalid academy progress')
  const record = value as Record<string, unknown>
  const completedSet = new Set(
    Array.isArray(record.completed)
      ? record.completed.filter((id): id is number =>
        Number.isInteger(id) && id >= 1 && id <= ACADEMY_LESSON_COUNT,
      )
      : [],
  )
  const completed: number[] = []
  for (let id = 1; id <= ACADEMY_LESSON_COUNT && completedSet.has(id); id += 1) completed.push(id)

  const attempts: Record<number, number> = {}
  if (record.attempts && typeof record.attempts === 'object' && !Array.isArray(record.attempts)) {
    for (const [rawId, count] of Object.entries(record.attempts)) {
      const id = Number(rawId)
      if (
        Number.isInteger(id) && id >= 1 && id <= ACADEMY_LESSON_COUNT &&
        typeof count === 'number' && Number.isFinite(count) && count >= 0
      ) {
        attempts[id] = Math.floor(count)
      }
    }
  }
  const weakPoints = Array.isArray(record.weakPoints)
    ? [...new Set(record.weakPoints.filter((id): id is number =>
      Number.isInteger(id) && id >= 1 && id <= ACADEMY_LESSON_COUNT,
    ))]
    : []
  return { completed, attempts, weakPoints }
}

export function readAcademyProgress(): AcademyProgress {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return EMPTY_ACADEMY_PROGRESS
    const value: unknown = JSON.parse(raw)
    return normalizeProgress(value)
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
