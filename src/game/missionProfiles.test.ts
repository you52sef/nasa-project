import assert from 'node:assert/strict'
import test from 'node:test'
import { initialGameState } from './model'
import { getAllowedCrewSizes } from './crewRosters'
import { MISSION_PROFILES } from './missionProfiles'
import { getAstronautDutyProgress } from './teamwork'

test('every mission profile has a supported minimum crew and complete field guidance', () => {
  for (const [missionType, profile] of Object.entries(MISSION_PROFILES)) {
    const destination = missionType.startsWith('moon-') ? 'moon' : 'mars'
    const missionDays = missionType.endsWith('exploration') || missionType.endsWith('opposition') ? 30 : 180
    const allowedCrew = getAllowedCrewSizes(destination, missionDays)

    assert.ok(allowedCrew.some((crewSize) => crewSize >= profile.minimumCrew), `${missionType} must have a supported minimum crew`)
    assert.ok(profile.equipment.length > 0, `${missionType} must list equipment`)
    assert.ok(profile.dailyActivities.length > 0, `${missionType} must list daily surface activities`)
    assert.ok(profile.sources.length > 0, `${missionType} must cite scientific context`)
    assert.ok(profile.sources.every((source) => source.url.startsWith('https://science.nasa.gov/')))
    assert.ok(profile.goal.en.length > 0 && profile.goal.ar.length > 0, `${missionType} must have a localized research goal`)
  }
})

test('NASA-based mission goals select the matching modeled objective', () => {
  assert.equal(MISSION_PROFILES['moon-exploration'].objective, 'science')
  assert.equal(MISSION_PROFILES['moon-settlement'].objective, 'survival')
  assert.equal(MISSION_PROFILES['mars-opposition'].objective, 'exploration')
  assert.equal(MISSION_PROFILES['mars-conjunction'].objective, 'survival')
  assert.match(MISSION_PROFILES['moon-exploration'].goalDescription.en, /core geological samples/)
  assert.match(MISSION_PROFILES['moon-settlement'].goalDescription.en, /Kilopower/)
  assert.match(MISSION_PROFILES['mars-opposition'].goalDescription.en, /perchlorate-rich regolith/)
  assert.match(MISSION_PROFILES['mars-conjunction'].goalDescription.en, /Sabatier/)
})

test('astronaut duty progress reflects completed actions in the current mission day', () => {
  const mission = initialGameState('moon', 3, 'Lunar Base', 12, {
    missionType: 'moon-exploration',
    astronautDutyId: 'commander-1',
  })
  const pending = getAstronautDutyProgress(mission, 'en')
  assert.equal(pending.requiredAction, 'exercise')
  assert.equal(pending.percent, 0)
  assert.equal(getAstronautDutyProgress({ ...mission, todayActions: ['research'] }, 'en').percent, 0)
  const complete = getAstronautDutyProgress({ ...mission, todayActions: ['exercise'] }, 'en')
  assert.equal(complete.percent, 100)
  assert.equal(complete.complete, true)
})

test('final report duty completion uses recorded actions across the mission', () => {
  const mission = initialGameState('moon', 3, 'Lunar Base', 120, {
    missionType: 'moon-exploration',
    astronautDutyId: 'commander-1',
  })
  const completed = getAstronautDutyProgress({
    ...mission,
    todayActions: [],
    actionHistory: ['exercise'],
    crewCommunications: [{
      day: 2,
      dutyId: 'commander-1',
      action: 'exercise',
      decision: 'accepted',
      reason: 'requestAccepted',
    }],
  }, 'en', true)
  assert.equal(completed.percent, 100)
  assert.equal(completed.complete, true)
  assert.equal(getAstronautDutyProgress({
    ...mission,
    todayActions: [],
    crewSupportActionHistory: ['exercise', 'maintenance'],
  }, 'en', true).percent, 0)
})

test('specialist duty checklists only include actions permitted for their responsibility', () => {
  const engineerMission = initialGameState('mars', 6, 'Mars Settlement', 13, {
    missionType: 'mars-conjunction',
    astronautDutyId: 'chief-reactor-power-engineer-1',
  })
  const engineerProgress = getAstronautDutyProgress({ ...engineerMission, todayActions: ['maintenance'] }, 'en')
  assert.deepEqual(engineerProgress.tasks.map((task) => task.action), ['maintenance'])
  assert.equal(engineerProgress.percent, 100)

  const scientistMission = initialGameState('mars', 4, 'Mars Science', 14, {
    missionType: 'mars-opposition',
    astronautDutyId: 'geologist-1',
  })
  const scientistProgress = getAstronautDutyProgress({ ...scientistMission, todayActions: ['explore'] }, 'en')
  assert.deepEqual(scientistProgress.tasks.map((task) => task.action), ['explore'])
  assert.equal(scientistProgress.percent, 100)
})
