import type { Destination, MissionDifficulty } from './model'

export const OXYGEN_PER_CREW_DAY = 0.84
export const WATER_PER_CREW_DAY = 3.8
export const FOOD_PER_CREW_DAY = 2.39
export const CO2_PER_CREW_DAY = 1

export const WATER_RECYCLE_RATE: Record<MissionDifficulty, number> = {
  easy: 0.98,
  normal: 0.94,
  hard: 0.9,
}

export const ENVIRONMENT = {
  moonGravityEarthG: 0.165,
  marsGravityEarthG: 0.38,
  marsAtmosphericPressureEarthFraction: 0.006,
  marsCommunicationDelayMinutes: { min: 3, max: 22 },
  lunarNightDays: 14,
  lunarNightTemperatureCelsius: -173,
  marsSolarStormLossFraction: { min: 0.8, max: 0.95 },
  marsSolarStormDays: { min: 3, max: 5 },
  transitRadiationMsvPerDay: 1.84,
  marsSurfaceRadiationMsvPerDay: 0.64,
  careerRadiationLimitMsv: 600,
} as const

export const CREW_DAILY_ROUTINE = [
  { id: 'morning', label: { en: 'Morning preparation & briefing', ar: 'الاستعداد والإحاطة الصباحية' }, hours: 1.5 },
  { id: 'exercise', label: { en: 'Resistance + cardio + equipment setup', ar: 'تمارين المقاومة والقلب وتجهيز المعدات' }, hours: 2.5 },
  { id: 'shift-1', label: { en: 'Work block — Shift 1', ar: 'كتلة العمل — الوردية الأولى' }, hours: 3.5 },
  { id: 'lunch', label: { en: 'Lunch & rest', ar: 'الغداء والراحة' }, hours: 1 },
  { id: 'shift-2', label: { en: 'Work block — Shift 2', ar: 'كتلة العمل — الوردية الثانية' }, hours: 3.5 },
  { id: 'evaluation', label: { en: 'Evening evaluation & health check', ar: 'التقييم المسائي والفحص الصحي' }, hours: 1 },
  { id: 'personal', label: { en: 'Dinner, personal time & family communications', ar: 'العشاء والوقت الشخصي والتواصل مع العائلة' }, hours: 2.5 },
  { id: 'emergency-buffer', label: { en: 'Emergency buffer', ar: 'وقت احتياطي للطوارئ' }, hours: 0.5 },
  { id: 'sleep', label: { en: 'Sleep', ar: 'النوم' }, hours: 8 },
] as const

export const MARS_SOL_EXTRA_HOURS = 39 / 60

export function getCrewDailyRoutine(destination: Destination) {
  return CREW_DAILY_ROUTINE.map((item) => ({
    ...item,
    hours: item.hours + (destination === 'mars' && item.id === 'personal' ? MARS_SOL_EXTRA_HOURS : 0),
  }))
}

export function getCrewSolDurationHours(destination: Destination): number {
  return 24 + (destination === 'mars' ? MARS_SOL_EXTRA_HOURS : 0)
}

export const POWER_SYSTEM = {
  solarOutputKw: { moon: 15, mars: 7 } satisfies Record<Destination, number>,
  solarHoursPerCycle: { moon: 1, mars: 1 } satisfies Record<Destination, number>,
  // Educational balance layer: each modeled day accounts for 90 seconds of rated power.
  energyBudgetHoursPerCycle: 0.025,
  reactorOutputKw: 25,
  batteryCapacityKwh: 200,
  survivalLoadKw: 27,
  operatingLoadsKw: {
    'command-center': 6,
    communications: 3,
    habitat: 15,
    airlock: 2,
    storage: 1,
    workshop: 4,
    'pressurized-rover': 1,
    'mass-spectrometer': 1,
    'robotics-unit': 2,
    'research-lab': 4,
    'medical-bay': 3,
    isru: 6,
    greenhouse: 7,
    moxie: 6,
    reactor: 2,
    'water-recycler': 2,
    'electrostatic-dust-shield': 1,
    'life-support': 2,
    'storm-shelter': 1,
    suitport: 0.5,
    expansion: 2,
  },
  survivalLoadsKw: {
    habitat: 15,
    command: 6,
    communications: 3,
    airlock: 2,
    storage: 1,
  },
  productiveBuildings: ['workshop', 'research-lab', 'medical-bay', 'isru', 'greenhouse', 'moxie', 'electrostatic-dust-shield'],
  automaticLoadShedBuildings: ['workshop', 'research-lab', 'robotics-unit', 'mass-spectrometer', 'pressurized-rover'],
  automaticLoadShedEnterEnergyFraction: 0.2,
  automaticLoadShedRecoverEnergyFraction: 0.5,
  automaticLoadShedEnterResourceAmount: 15,
  automaticLoadShedRecoverResourceAmount: 35,
} as const

export const GREENHOUSE_CYCLE = {
  growthDays: 4,
  waterLitersPerDay: 1.5,
  foodKg: 20,
  oxygenKg: 3,
  regolithTreatmentEnergyKwh: 2,
} as const

export const ISRU_DAILY_OUTPUT = {
  waterLiters: 4,
  oxygenKg: 0.84,
} as const

export const HABITAT_PRESSURE_KPA = {
  nominal: 101.3,
  leakEstimate: 75,
} as const

export function getSurvivalBatteryRuntimeHours(): number {
  return POWER_SYSTEM.batteryCapacityKwh / POWER_SYSTEM.survivalLoadKw
}
