import assert from 'node:assert/strict'
import test from 'node:test'
import { BUILDINGS } from './buildings'
import {
  BASE_MAP_SITES,
  FACILITY_MAP_SITES,
  getFacilityMapPosition,
  getFacilityNetworkOrigin,
  getMapDistanceMeters,
} from './siteLayout'

test('base facility locations are stable and grouped by function', () => {
  for (const id of Object.keys(BUILDINGS)) {
    assert.deepEqual(getFacilityMapPosition(id, 4), getFacilityMapPosition(id, 1), `${id} changed with build order`)
  }
  assert.ok(getFacilityMapPosition('solar-panels', 0).x > BASE_MAP_SITES.habitat.x)
  assert.ok(getFacilityMapPosition('isru', 0).x < BASE_MAP_SITES.habitat.x)
  assert.deepEqual(getFacilityNetworkOrigin('solar-panels'), BASE_MAP_SITES.battery)
  assert.deepEqual(getFacilityNetworkOrigin('isru'), BASE_MAP_SITES.industrialHub)
  assert.equal(Object.keys(FACILITY_MAP_SITES).length, Object.keys(BUILDINGS).length)
})

test('mapped landing pad clears the 100 m habitat setback', () => {
  assert.ok(getMapDistanceMeters(BASE_MAP_SITES.habitat, BASE_MAP_SITES.landingPad) >= 100)
})
