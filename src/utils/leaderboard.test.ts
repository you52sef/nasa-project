import assert from 'node:assert/strict'
import { test } from 'node:test'
import { initialGameState } from '../game/model'
import { clearLeaderboard, getLeaderboard, saveScore } from './leaderboard'

const memoryStorage = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (key: string) => memoryStorage.get(key) ?? null,
    setItem: (key: string, value: string) => memoryStorage.set(key, value),
    removeItem: (key: string) => memoryStorage.delete(key),
  },
})

test('stores the five highest-scoring runs and does not duplicate a run ID', () => {
  memoryStorage.clear()
  for (let index = 0; index < 7; index += 1) {
    const state = {
      ...initialGameState('mars', 2, 'Leaderboard test', index),
      runId: `run-${index}`,
      maxDays: 60,
      daysSurvived: index,
      isGameOver: true,
      missionResult: 'evacuation' as const,
    }
    saveScore(state)
  }

  const entries = getLeaderboard()
  assert.equal(entries.length, 5)
  assert.equal(entries[0].runId, 'run-6')
  assert.deepEqual(entries.map((entry) => entry.score), [...entries].map((entry) => entry.score).sort((a, b) => b - a))
  assert.equal(saveScore({
    ...initialGameState('mars', 2, 'Leaderboard test', 6),
    runId: 'run-6',
    isGameOver: true,
    missionResult: 'evacuation',
  }).length, 5)
  assert.equal(getLeaderboard()[0].day, 6)
})

test('clears saved leaderboard results', () => {
  memoryStorage.clear()
  const state = {
    ...initialGameState('moon', 2, 'Leaderboard test'),
    isGameOver: true,
    missionResult: 'success' as const,
    daysSurvived: 30,
  }
  saveScore(state)
  clearLeaderboard()
  assert.deepEqual(getLeaderboard(), [])
})

test('records an early-ended mission distinctly from success and evacuation', () => {
  memoryStorage.clear()
  const state = {
    ...initialGameState('moon', 2, 'Early Return'),
    runId: 'ended-run',
    daysSurvived: 4,
    isGameOver: true,
    missionResult: 'ended' as const,
  }

  saveScore(state)

  assert.equal(getLeaderboard()[0].status, 'ended')
})

test('records an objective-incomplete return as a failure', () => {
  memoryStorage.clear()
  const state = {
    ...initialGameState('mars', 6, 'Incomplete Objective'),
    runId: 'incomplete-run',
    isGameOver: true,
    missionResult: 'failure' as const,
  }

  saveScore(state)

  assert.equal(getLeaderboard()[0].status, 'failure')
})
