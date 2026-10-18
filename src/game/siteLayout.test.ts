import assert from 'node:assert/strict'
import test from 'node:test'
import { BUILDINGS } from './buildings'
import {
  BASE_MAP_SITES,
  FACILITY_MAP_SITES,
  getFacilityMapPosition,
  getFacilityNetworkOrigin,
  getMapDistanceMeters,
  MIN_MAP_BUILDING_CLEARANCE_PIXELS,
  type MapPoint,
} from './siteLayout'

test('base facility locations are stable and grouped by function', () => {
  for (const id of Object.keys(BUILDINGS)) {
    assert.deepEqual(getFacilityMapPosition(id), FACILITY_MAP_SITES[id], `${id} has no stable mapped site`)
  }
  assert.ok(getFacilityMapPosition('solar-panels').x > BASE_MAP_SITES.habitat.x)
  assert.ok(getFacilityMapPosition('isru').x < BASE_MAP_SITES.habitat.x)
  assert.deepEqual(getFacilityNetworkOrigin('solar-panels'), BASE_MAP_SITES.battery)
  assert.deepEqual(getFacilityNetworkOrigin('isru'), BASE_MAP_SITES.industrialHub)
  assert.equal(Object.keys(FACILITY_MAP_SITES).length, Object.keys(BUILDINGS).length)
})

test('mapped landing pad clears the 100 m habitat setback', () => {
  assert.ok(getMapDistanceMeters(BASE_MAP_SITES.habitat, getFacilityMapPosition('landing-pad')) >= 100)
})

test('maps power infrastructure at the outer edge and keeps crew facilities near the habitat', () => {
  const habitat = BASE_MAP_SITES.habitat
  const pixelsFromHabitat = (id: string) => {
    const point = getFacilityMapPosition(id)
    return Math.hypot(point.x - habitat.x, point.y - habitat.y)
  }

  assert.ok(getFacilityMapPosition('reactor').x > 700)
  assert.ok(Math.hypot(
    getFacilityMapPosition('reactor').x - getFacilityMapPosition('solar-panels').x,
    getFacilityMapPosition('reactor').y - getFacilityMapPosition('solar-panels').y,
  ) < 160)
  assert.ok(pixelsFromHabitat('command-center') < 120)
  assert.ok(pixelsFromHabitat('greenhouse') < 120)
  assert.ok(pixelsFromHabitat('medical-bay') < 120)
  assert.ok(Math.hypot(
    getFacilityMapPosition('isru').x - BASE_MAP_SITES.industrialHub.x,
    getFacilityMapPosition('isru').y - BASE_MAP_SITES.industrialHub.y,
  ) < 100)
})

test('facility markers, habitat, and rover do not overlap', () => {
  const points: Array<[string, MapPoint]> = Object.keys(BUILDINGS)
    .filter((id) => id !== 'habitat')
    .map((id) => [id, getFacilityMapPosition(id)])
  points.push(['habitat', BASE_MAP_SITES.habitat], ['rover', BASE_MAP_SITES.rover])

  for (let first = 0; first < points.length; first += 1) {
    for (let second = first + 1; second < points.length; second += 1) {
      const [firstId, firstPoint] = points[first]
      const [secondId, secondPoint] = points[second]
      const distance = Math.hypot(firstPoint.x - secondPoint.x, firstPoint.y - secondPoint.y)
      assert.ok(
        distance >= MIN_MAP_BUILDING_CLEARANCE_PIXELS,
        `${firstId} and ${secondId} overlap (${distance.toFixed(1)} px apart)`,
      )
    }
  }
})

test('unknown facilities fail explicitly instead of receiving a potentially overlapping fallback', () => {
  assert.throws(() => getFacilityMapPosition('unknown-building'), /Unknown facility map site/)
})
