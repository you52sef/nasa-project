import assert from 'node:assert/strict'
import test from 'node:test'
import { estimateTransfer } from './flightPhysics'

test('estimates an ideal Earth-to-Moon transfer from low Earth orbit', () => {
  const estimate = estimateTransfer('earth-moon')
  const returnEstimate = estimateTransfer('moon-earth')

  assert.equal(estimate.model, 'earth-centered-two-body')
  assert.ok(Math.abs(estimate.durationDays - 4.98) < 0.1)
  assert.ok(Math.abs(estimate.departureDeltaVKmS - 3.14) < 0.1)
  assert.ok(Math.abs(estimate.arrivalRelativeSpeedKmS - 0.83) < 0.1)
  assert.ok(estimate.phaseAngleDegrees > 110 && estimate.phaseAngleDegrees < 120)
  assert.equal(returnEstimate.durationDays, estimate.durationDays)
  assert.ok(Math.abs(returnEstimate.departureDeltaVKmS - estimate.arrivalRelativeSpeedKmS) < 0.001)
  assert.ok(Math.abs(returnEstimate.arrivalRelativeSpeedKmS - estimate.departureDeltaVKmS) < 0.001)
})

test('estimates reciprocal ideal heliocentric Hohmann transfers', () => {
  const outbound = estimateTransfer('earth-mars')
  const inbound = estimateTransfer('mars-earth')

  assert.equal(outbound.model, 'heliocentric-hohmann')
  assert.ok(Math.abs(outbound.durationDays - 259) < 1)
  assert.equal(inbound.durationDays, outbound.durationDays)
  assert.ok(outbound.phaseAngleDegrees > 40 && outbound.phaseAngleDegrees < 50)
  assert.ok(inbound.phaseAngleDegrees < -70 && inbound.phaseAngleDegrees > -80)
  assert.ok(outbound.departureDeltaVKmS > 2.5 && outbound.departureDeltaVKmS < 3.5)
})
