import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  ACADEMY_PROGRESS_KEY,
  ACADEMY_PHASE_COUNT,
  EMPTY_ACADEMY_PROGRESS,
  normalizeAcademyProgress,
  readAcademyProgress,
  saveAcademyProgress,
} from './academyProgress'

const stored = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => stored.set(key, value),
    removeItem: (key: string) => stored.delete(key),
  },
})

test('normalizes phase completion to a sequential prefix and discards invalid phase IDs', () => {
  const progress = normalizeAcademyProgress({
    ...EMPTY_ACADEMY_PROGRESS,
    completedPhases: [4, 1, 2, 2, 0, 7, '3'],
  })

  assert.deepEqual(progress.completedPhases, [1, 2])
})

test('bounds scores and only awards the final-trial certificate after every lesson is complete', () => {
  const incomplete = normalizeAcademyProgress({
    completedPhases: [1, 2, 3, 4],
    examBestScore: 10,
    certified: true,
  })
  assert.equal(incomplete.certified, false)

  const complete = normalizeAcademyProgress({
    completedPhases: Array.from({ length: ACADEMY_PHASE_COUNT }, (_, index) => index + 1),
    quizPassedPhases: Array.from({ length: ACADEMY_PHASE_COUNT }, (_, index) => index + 1),
    examBestScore: 0,
    certified: true,
  })
  assert.equal(complete.certified, true)

  const bounded = normalizeAcademyProgress({
    completedPhases: [],
    examBestScore: 100,
  })
  assert.equal(bounded.examBestScore, 10)
  assert.equal(bounded.certified, false)
})

test('normalizes quiz completion to a sequential prefix and migrates completed lessons', () => {
  const progress = normalizeAcademyProgress({
    ...EMPTY_ACADEMY_PROGRESS,
    quizPassedPhases: [1, 3, 5, 9, '2'],
  })
  assert.deepEqual(progress.quizPassedPhases, [1])

  const migrated = normalizeAcademyProgress({
    completedPhases: [1, 2, 3],
  })
  assert.deepEqual(migrated.quizPassedPhases, [1, 2, 3])
})

test('migrates legacy five-phase progress without falsely completing the new capstone', () => {
  const progress = normalizeAcademyProgress({
    completedPhases: [1, 2, 3, 4, 5],
    trialAttempts: { 5: 4 },
    trialOutcomes: { 5: [true, true, true, true] },
    certified: true,
  })

  assert.deepEqual(progress.completedPhases, [1, 2, 3, 4])
  assert.deepEqual(progress.quizPassedPhases, [1, 2, 3, 4])
  assert.deepEqual(progress.trialAttempts, {})
  assert.deepEqual(progress.trialOutcomes, {})
  assert.equal(progress.certified, false)
})

test('preserves certification for legacy learners who passed the previous capstone', () => {
  const progress = normalizeAcademyProgress({
    completedPhases: [1, 2, 3, 4, 5, 6],
    examBestScore: 8,
    certified: true,
  })

  assert.deepEqual(progress.completedPhases, [1, 2, 3, 4, 5])
  assert.deepEqual(progress.quizPassedPhases, [1, 2, 3, 4, 5])
  assert.equal(progress.certified, true)
})

test('sanitizes attempts, trial outcomes and learner name', () => {
  const progress = normalizeAcademyProgress({
    trialAttempts: { 1: 2.9, 2: -1, 7: 4, nope: 5 },
    trialOutcomes: { 1: [true, false, 'bad', 1], 7: [true] },
    examAttempts: 3.8,
    learnerName: `${'A'.repeat(90)}`,
  })

  assert.deepEqual(progress.trialAttempts, { 1: 2 })
  assert.deepEqual(progress.trialOutcomes, { 1: [true, false] })
  assert.equal(progress.examAttempts, 3)
  assert.equal(progress.learnerName.length, 80)
})

test('rejects non-object persisted progress instead of silently treating it as valid', () => {
  assert.throws(() => normalizeAcademyProgress(null), /Invalid academy progress/)
  assert.throws(() => normalizeAcademyProgress([]), /Invalid academy progress/)
})

test('persists and reloads normalized progress using the Academy storage key', () => {
  stored.clear()
  const progress = {
    ...EMPTY_ACADEMY_PROGRESS,
    completedPhases: [1],
    quizPassedPhases: [1],
    trialAttempts: { 1: 1 },
    trialOutcomes: { 1: [true] },
  }

  saveAcademyProgress(progress)

  assert.ok(stored.has(ACADEMY_PROGRESS_KEY))
  assert.deepEqual(readAcademyProgress(), progress)
})
