export interface MapPoint {
  x: number
  y: number
}

export const BASE_MAP_SITES = {
  habitat: { x: 405, y: 280 },
  battery: { x: 535, y: 225 },
  industrialHub: { x: 300, y: 300 },
  landingPad: { x: 105, y: 385 },
  protectedRidge: { x: 350, y: 220 },
} satisfies Record<string, MapPoint>

export const FACILITY_MAP_SITES: Record<string, MapPoint> = {
  'landing-pad': BASE_MAP_SITES.landingPad,
  'solar-panels': { x: 565, y: 125 },
  battery: BASE_MAP_SITES.battery,
  habitat: BASE_MAP_SITES.habitat,
  airlock: { x: 495, y: 280 },
  suitport: { x: 485, y: 215 },
  'electrostatic-dust-shield': { x: 500, y: 250 },
  'command-center': { x: 405, y: 200 },
  storage: { x: 465, y: 170 },
  communications: { x: 645, y: 300 },
  workshop: { x: 255, y: 265 },
  'pressurized-rover': { x: 515, y: 390 },
  'drilling-tools': { x: 210, y: 330 },
  'mass-spectrometer': { x: 275, y: 350 },
  'robotics-unit': { x: 225, y: 205 },
  'research-lab': { x: 320, y: 365 },
  'medical-bay': { x: 350, y: 220 },
  isru: { x: 145, y: 230 },
  'life-support': { x: 445, y: 365 },
  greenhouse: { x: 520, y: 350 },
  moxie: { x: 180, y: 270 },
  reactor: { x: 665, y: 195 },
  'storm-shelter': BASE_MAP_SITES.protectedRidge,
  'water-recycler': { x: 490, y: 360 },
  expansion: { x: 575, y: 365 },
}

const POWER_FACILITIES = new Set([
  'solar-panels',
  'battery',
  'reactor',
  'command-center',
  'communications',
])
const INDUSTRIAL_FACILITIES = new Set([
  'workshop',
  'pressurized-rover',
  'drilling-tools',
  'mass-spectrometer',
  'robotics-unit',
  'research-lab',
  'isru',
  'moxie',
])

export const MAP_PIXELS_PER_100_METERS = 80

export function getFacilityMapPosition(id: string, index: number): MapPoint {
  const knownPosition = FACILITY_MAP_SITES[id]
  if (knownPosition) return knownPosition

  let stableHash = 0
  for (const character of id) stableHash = (stableHash * 31 + character.charCodeAt(0)) >>> 0
  const angle = (stableHash % 360) * Math.PI / 180
  const radius = 110 + (stableHash % 5) * 12
  const offset = Math.max(0, index) * 9
  return {
    x: Math.max(45, Math.min(755, BASE_MAP_SITES.habitat.x + Math.cos(angle) * radius + offset)),
    y: Math.max(45, Math.min(455, BASE_MAP_SITES.habitat.y + Math.sin(angle) * radius + offset)),
  }
}

export function getFacilityNetworkOrigin(id: string): MapPoint {
  if (POWER_FACILITIES.has(id)) return BASE_MAP_SITES.battery
  if (INDUSTRIAL_FACILITIES.has(id)) return BASE_MAP_SITES.industrialHub
  return BASE_MAP_SITES.habitat
}

export function getMapDistanceMeters(first: MapPoint, second: MapPoint): number {
  return Math.hypot(first.x - second.x, first.y - second.y) * 100 / MAP_PIXELS_PER_100_METERS
}
