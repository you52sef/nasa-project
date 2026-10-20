export const ACADEMY_PROGRESS_KEY = 'nasaTrainingProgress'
export const ACADEMY_PHASE_COUNT = 5
export const ACADEMY_LESSON_COUNT = ACADEMY_PHASE_COUNT

export interface AcademyProgress {
  completedPhases: number[]
  quizPassedPhases: number[]
  trialAttempts: Record<number, number>
  trialOutcomes: Record<number, boolean[]>
  examAttempts: number
  examBestScore: number
  certified: boolean
  learnerName: string
}

export const EMPTY_ACADEMY_PROGRESS: AcademyProgress = {
  completedPhases: [],
  quizPassedPhases: [],
  trialAttempts: {},
  trialOutcomes: {},
  examAttempts: 0,
  examBestScore: 0,
  certified: false,
  learnerName: '',
}

export function normalizeAcademyProgress(value: unknown): AcademyProgress {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid academy progress')
  }
  const record = value as Record<string, unknown>
  const rawQuizPassedPhases = Array.isArray(record.quizPassedPhases) ? record.quizPassedPhases : []
  const hasQuizProgress = Array.isArray(record.quizPassedPhases)
  const legacyCompletedPhases = Array.isArray(record.completedPhases) ? record.completedPhases : []
  const legacyFinalTrialPassed = !hasQuizProgress && legacyCompletedPhases.includes(6)
  const maximumCompletedId = hasQuizProgress || legacyFinalTrialPassed ? ACADEMY_PHASE_COUNT : ACADEMY_PHASE_COUNT - 1
  const maximumTrialId = legacyFinalTrialPassed ? 6 : hasQuizProgress ? ACADEMY_PHASE_COUNT : ACADEMY_PHASE_COUNT - 1
  const candidates = Array.isArray(record.completedPhases)
    ? [...new Set(record.completedPhases.filter((id): id is number =>
      Number.isInteger(id) && id >= 1 && id <= (legacyFinalTrialPassed ? 6 : ACADEMY_PHASE_COUNT),
    ))].sort((a, b) => a - b)
    : []
  const completedPhases: number[] = []
  for (let id = 1; id <= maximumCompletedId && candidates.includes(id); id += 1) completedPhases.push(id)
  const quizCandidates = rawQuizPassedPhases.filter((id: unknown): id is number =>
    typeof id === 'number' && Number.isInteger(id) && id >= 1 && id <= ACADEMY_PHASE_COUNT,
  )
  const quizPassedPhases: number[] = []
  const completedOrQuizPassed = new Set([...completedPhases, ...quizCandidates])
  for (let id = 1; id <= ACADEMY_PHASE_COUNT && completedOrQuizPassed.has(id); id += 1) quizPassedPhases.push(id)

  const trialAttempts: Record<number, number> = {}
  if (record.trialAttempts && typeof record.trialAttempts === 'object' && !Array.isArray(record.trialAttempts)) {
    for (const [key, count] of Object.entries(record.trialAttempts)) {
      const id = Number(key)
      if (Number.isInteger(id) && id >= 1 && id <= maximumTrialId && typeof count === 'number' && Number.isFinite(count) && count >= 0) {
        trialAttempts[id] = Math.floor(count)
      }
    }
  }
  const trialOutcomes: Record<number, boolean[]> = {}
  if (record.trialOutcomes && typeof record.trialOutcomes === 'object' && !Array.isArray(record.trialOutcomes)) {
    for (const [key, outcomes] of Object.entries(record.trialOutcomes)) {
      const id = Number(key)
      if (Number.isInteger(id) && id >= 1 && id <= maximumTrialId && Array.isArray(outcomes)) {
        trialOutcomes[id] = outcomes.filter((outcome): outcome is boolean => typeof outcome === 'boolean')
      }
    }
  }
  const examAttempts = typeof record.examAttempts === 'number' && Number.isFinite(record.examAttempts) && record.examAttempts >= 0
    ? Math.floor(record.examAttempts)
    : 0
  const examBestScore = typeof record.examBestScore === 'number' && Number.isFinite(record.examBestScore)
    ? Math.max(0, Math.min(10, Math.floor(record.examBestScore)))
    : 0
  return {
    completedPhases,
    quizPassedPhases,
    trialAttempts,
    trialOutcomes,
    examAttempts,
    examBestScore,
    certified: record.certified === true && completedPhases.length === ACADEMY_PHASE_COUNT,
    learnerName: typeof record.learnerName === 'string' ? record.learnerName.slice(0, 80) : '',
  }
}

export function readAcademyProgress(): AcademyProgress {
  try {
    const raw = localStorage.getItem(ACADEMY_PROGRESS_KEY)
    if (!raw) return EMPTY_ACADEMY_PROGRESS
    return normalizeAcademyProgress(JSON.parse(raw) as unknown)
  } catch (error) {
    console.error('Could not load Academy progress.', error)
    throw new Error('Could not load saved Academy progress.')
  }
}

export function saveAcademyProgress(progress: AcademyProgress): void {
  try {
    localStorage.setItem(ACADEMY_PROGRESS_KEY, JSON.stringify(normalizeAcademyProgress(progress)))
  } catch (error) {
    console.error('Could not save Academy progress.', error)
    throw new Error('Could not save Academy progress. Check available browser storage.')
  }
}

export function isAcademyCertified(): boolean {
  return readAcademyProgress().certified
}
