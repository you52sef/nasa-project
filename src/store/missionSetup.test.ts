import assert from 'node:assert/strict'
import test from 'node:test'

test('selecting a mission automatically assigns and enforces its minimum crew', async () => {
  const values = new Map<string, string>()
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    },
  })
  const { useGameStore } = await import('./gameStore')

  useGameStore.getState().setMissionType('moon-settlement')
  assert.equal(useGameStore.getState().crewSize, 6)
  assert.equal(useGameStore.getState().objective, 'survival')
  useGameStore.getState().setCrewSize(4)
  assert.equal(useGameStore.getState().crewSize, 6)

  useGameStore.getState().setDestination('mars')
  assert.equal(useGameStore.getState().missionType, 'mars-opposition')
  assert.equal(useGameStore.getState().crewSize, 4)
  useGameStore.getState().setMissionType('mars-conjunction')
  assert.equal(useGameStore.getState().crewSize, 6)
  assert.equal(useGameStore.getState().objective, 'survival')
  useGameStore.getState().setControlledRole('biologist')
  assert.equal(useGameStore.getState().controlledRole, 'biologist')
  assert.equal(useGameStore.getState().astronautDutyId, useGameStore.getState().controlledDutyId)
  useGameStore.getState().setAstronautName('Commander Test')
  useGameStore.getState().setAstronautDuty('space-agriculture-scientist-1')
  assert.equal(useGameStore.getState().astronautName, 'Commander Test')
  assert.equal(useGameStore.getState().astronautDutyId, 'space-agriculture-scientist-1')
  useGameStore.getState().setAstronautDuty('not-a-crew-duty')
  assert.notEqual(useGameStore.getState().astronautDutyId, 'not-a-crew-duty')
})
