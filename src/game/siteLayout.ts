export interface MapPoint {
  x: number
  y: number
}

export const BASE_MAP_SITES = {
  habitat: { x: 405, y: 280 },
  battery: { x: 650, y: 240 },
  industrialHub: { x: 220, y: 330 },
  landingPad: { x: 55, y: 440 },
  protectedRidge: { x: 335, y: 155 },
  rover: { x: 720, y: 420 },
} satisfies Record<string, MapPoint>

export const MAP_PIXELS_PER_100_METERS = 80
export const MIN_MAP_BUILDING_CLEARANCE_PIXELS = 80

const FACILITY_IDS = [
  'landing-pad',
  'solar-panels',
  'battery',
  'habitat',
  'airlock',
  'suitport',
  'electrostatic-dust-shield',
  'command-center',
  'storage',
  'communications',
  'workshop',
  'pressurized-rover',
  'drilling-tools',
  'mass-spectrometer',
  'robotics-unit',
  'research-lab',
  'medical-bay',
  'isru',
  'life-support',
  'greenhouse',
  'moxie',
  'reactor',
  'storm-shelter',
  'water-recycler',
  'expansion',
] as const

const POWER_FACILITIES = ['solar-panels', 'command-center', 'communications', 'reactor']
const INDUSTRIAL_FACILITIES = [
  'workshop',
  'pressurized-rover',
  'drilling-tools',
  'mass-spectrometer',
  'robotics-unit',
  'research-lab',
  'isru',
  'moxie',
]
const GRID_SITES: MapPoint[] = [60, 155, 250, 345, 440].flatMap((y) =>
  [55, 200, 345, 490, 635, 770].map((x) => ({ x, y })),
)

function isClearOf(point: MapPoint, reserved: readonly MapPoint[]): boolean {
  return reserved.every((site) =>
    Math.hypot(point.x - site.x, point.y - site.y) >= MIN_MAP_BUILDING_CLEARANCE_PIXELS,
  )
}

const sites = new Map<string, MapPoint>([
  ['landing-pad', BASE_MAP_SITES.landingPad],
  ['battery', BASE_MAP_SITES.battery],
  ['storm-shelter', BASE_MAP_SITES.protectedRidge],
  ['solar-panels', { x: 665, y: 90 }],
  ['reactor', { x: 755, y: 175 }],
  ['command-center', { x: 495, y: 280 }],
  ['communications', { x: 500, y: 380 }],
  ['greenhouse', { x: 405, y: 380 }],
  ['medical-bay', { x: 315, y: 280 }],
  ['isru', { x: 225, y: 380 }],
])
const reservedSites = [
  BASE_MAP_SITES.habitat,
  BASE_MAP_SITES.battery,
  BASE_MAP_SITES.protectedRidge,
  BASE_MAP_SITES.landingPad,
  BASE_MAP_SITES.rover,
]
const assignedGridSites: MapPoint[] = []
for (const [id, point] of sites) {
  if (id !== 'landing-pad' && id !== 'battery' && id !== 'storm-shelter') {
    assignedGridSites.push(point)
  }
}

function assignFacilities(ids: readonly string[], allowedSite: (site: MapPoint) => boolean): void {
  for (const id of ids) {
    const site = GRID_SITES.find((candidate) =>
      allowedSite(candidate) &&
      !assignedGridSites.includes(candidate) &&
      isClearOf(candidate, [...reservedSites, ...assignedGridSites]),
    )
    if (!site) throw new Error(`No collision-free map site is available for ${id}.`)
    sites.set(id, site)
    assignedGridSites.push(site)
  }
}

assignFacilities(POWER_FACILITIES.filter((id) => !sites.has(id)), (site) => site.x >= 490)
assignFacilities(INDUSTRIAL_FACILITIES.filter((id) => !sites.has(id)), (site) => site.x <= 345)
assignFacilities(
  FACILITY_IDS.filter((id) =>
    id !== 'habitat' && !sites.has(id) && !POWER_FACILITIES.includes(id) && !INDUSTRIAL_FACILITIES.includes(id),
  ),
  () => true,
)

export const FACILITY_MAP_SITES: Record<string, MapPoint> = Object.fromEntries(
  FACILITY_IDS.map((id) => {
    const site = id === 'habitat' ? BASE_MAP_SITES.habitat : sites.get(id)
    if (!site) throw new Error(`Map site is missing for ${id}.`)
    return [id, site]
  }),
)

export function getFacilityMapPosition(id: string): MapPoint {
  const site = FACILITY_MAP_SITES[id]
  if (!site) throw new RangeError(`Unknown facility map site: ${id}.`)
  return site
}

export function getFacilityNetworkOrigin(id: string): MapPoint {
  if (POWER_FACILITIES.includes(id)) return BASE_MAP_SITES.battery
  if (INDUSTRIAL_FACILITIES.includes(id)) return BASE_MAP_SITES.industrialHub
  return BASE_MAP_SITES.habitat
}

export function getMapDistanceMeters(first: MapPoint, second: MapPoint): number {
  return Math.hypot(first.x - second.x, first.y - second.y) * 100 / MAP_PIXELS_PER_100_METERS
}
