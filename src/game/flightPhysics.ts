export type OrbitalRoute = 'earth-moon' | 'moon-earth' | 'earth-mars' | 'mars-earth'

export const SIMULATED_TRANSIT_DAYS = { moon: 2, mars: 6 } as const

export interface TransferEstimate {
  route: OrbitalRoute
  durationDays: number
  departureDeltaVKmS: number
  arrivalRelativeSpeedKmS: number
  phaseAngleDegrees: number
  model: 'earth-centered-two-body' | 'heliocentric-hohmann'
}

const SECONDS_PER_DAY = 86_400
const ASTRONOMICAL_UNIT_KM = 149_597_870.7
const EARTH_ORBIT_KM = ASTRONOMICAL_UNIT_KM
const MARS_ORBIT_KM = 1.523679 * ASTRONOMICAL_UNIT_KM
const EARTH_MOON_ORBIT_KM = 384_400
const EARTH_PARKING_ORBIT_KM = 6_571
const SUN_GRAVITATIONAL_PARAMETER = 1.32712440018e11
const EARTH_GRAVITATIONAL_PARAMETER = 398_600.4418

function normalizeDegrees(angle: number): number {
  return ((angle + 180) % 360 + 360) % 360 - 180
}

function calculateHohmannTransfer(
  originRadiusKm: number,
  targetRadiusKm: number,
  centralBodyMu: number,
): Omit<TransferEstimate, 'route' | 'model'> {
  const transferSemiMajorAxisKm = (originRadiusKm + targetRadiusKm) / 2
  const durationSeconds = Math.PI * Math.sqrt(
    transferSemiMajorAxisKm ** 3 / centralBodyMu,
  )
  const originCircularVelocity = Math.sqrt(centralBodyMu / originRadiusKm)
  const targetCircularVelocity = Math.sqrt(centralBodyMu / targetRadiusKm)
  const transferOriginVelocity = Math.sqrt(
    centralBodyMu * (2 / originRadiusKm - 1 / transferSemiMajorAxisKm),
  )
  const transferTargetVelocity = Math.sqrt(
    centralBodyMu * (2 / targetRadiusKm - 1 / transferSemiMajorAxisKm),
  )
  const targetMeanMotion = Math.sqrt(centralBodyMu / targetRadiusKm ** 3)
  const phaseAngleRadians = Math.PI - targetMeanMotion * durationSeconds

  return {
    durationDays: durationSeconds / SECONDS_PER_DAY,
    departureDeltaVKmS: Math.abs(transferOriginVelocity - originCircularVelocity),
    arrivalRelativeSpeedKmS: Math.abs(transferTargetVelocity - targetCircularVelocity),
    phaseAngleDegrees: normalizeDegrees(phaseAngleRadians * 180 / Math.PI),
  }
}

export function estimateTransfer(route: OrbitalRoute): TransferEstimate {
  if (route === 'earth-moon' || route === 'moon-earth') {
    return {
      route,
      model: 'earth-centered-two-body',
      ...calculateHohmannTransfer(
        route === 'earth-moon' ? EARTH_PARKING_ORBIT_KM : EARTH_MOON_ORBIT_KM,
        route === 'earth-moon' ? EARTH_MOON_ORBIT_KM : EARTH_PARKING_ORBIT_KM,
        EARTH_GRAVITATIONAL_PARAMETER,
      ),
    }
  }

  const originRadius = route === 'earth-mars' ? EARTH_ORBIT_KM : MARS_ORBIT_KM
  const targetRadius = route === 'earth-mars' ? MARS_ORBIT_KM : EARTH_ORBIT_KM
  return {
    route,
    model: 'heliocentric-hohmann',
    ...calculateHohmannTransfer(
      originRadius,
      targetRadius,
      SUN_GRAVITATIONAL_PARAMETER,
    ),
  }
}
