import {
  CO2_PER_CREW_DAY,
  ENVIRONMENT,
  OXYGEN_PER_CREW_DAY,
  POWER_SYSTEM,
} from './constants'
import type { Action, Destination, MissionDifficulty } from './model'

export interface CabinEnvironment {
  pressureKpa: number
  oxygenPartialPressureKpa: number
  co2PartialPressureKpa: number
  temperatureC: number
  scrubberHealth: number
  crewStress: number
  crewPulseBpm: number
  airlockIsolated: boolean
}

export interface EnvironmentStepInput extends CabinEnvironment {
  elapsedHours: number
  crewSize: number
  difficulty: MissionDifficulty
  destination: Destination
  day: number
  action: Action | null
  lifeSupportOnline: boolean
  scrubberOnline: boolean
  powered: boolean
  ongoingLeak: boolean
  dustStorm: boolean
  fatigue: number
  morale: number
  shielded: boolean
  transit?: boolean
  qualifiedMaintenance: boolean
}

export interface EnvironmentStepResult extends CabinEnvironment {
  radiationAddedMsv: number
  healthLoss: number
  fatalReason: 'decompression' | 'hypoxia' | 'hypercapnia' | 'hypothermia' | null
  leakRepaired: boolean
}

const KPA_PER_KG_OXYGEN = 0.2177
const CABIN_VOLUME_M3 = 350
const CABIN_TEMPERATURE_TARGET_C = 22
const UNPOWERED_CABIN_TEMPERATURE_C = -13
const DEFAULT_CO2_PARTIAL_PRESSURE_KPA = 0.04
const CO2_WARN_PARTIAL_PRESSURE_KPA = 0.5
const CO2_DANGER_PARTIAL_PRESSURE_KPA = 1
const CO2_FATAL_PARTIAL_PRESSURE_KPA = 3
const OXYGEN_WARN_PARTIAL_PRESSURE_KPA = 16
const OXYGEN_FATAL_PARTIAL_PRESSURE_KPA = 10
const PRESSURE_ISOLATION_KPA = 70
const PRESSURE_FATAL_KPA = 35
const TEMPERATURE_WARN_C = 10
const TEMPERATURE_FATAL_C = 0
const FIXED_STEP_HOURS = 1 / 60
const MAX_ELAPSED_HOURS = 24.65
const CO2_SCRUBBING_EFFICIENCY: Record<MissionDifficulty, number> = {
  easy: 0.94,
  normal: 0.86,
  hard: 0.72,
}

export const INITIAL_CABIN_ENVIRONMENT: CabinEnvironment = {
  pressureKpa: 101.3,
  oxygenPartialPressureKpa: 21.2,
  co2PartialPressureKpa: DEFAULT_CO2_PARTIAL_PRESSURE_KPA,
  temperatureC: CABIN_TEMPERATURE_TARGET_C,
  scrubberHealth: 100,
  crewStress: 12,
  crewPulseBpm: 68,
  airlockIsolated: false,
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.max(min, Math.min(max, value))
}

function workloadStrain(action: Action | null): number {
  if (action === 'explore') return 1
  if (action === 'exercise') return 0.9
  if (action === 'maintenance') return 0.55
  if (action === 'research') return 0.35
  if (action === 'rest') return -0.5
  return 0
}

export function advanceCabinEnvironment(input: EnvironmentStepInput): EnvironmentStepResult {
  const result: EnvironmentStepResult = {
    pressureKpa: clamp(input.pressureKpa, 0, 101.3),
    oxygenPartialPressureKpa: clamp(input.oxygenPartialPressureKpa, 0, 30),
    co2PartialPressureKpa: clamp(input.co2PartialPressureKpa, 0, 10),
    temperatureC: clamp(input.temperatureC, -100, 60),
    scrubberHealth: clamp(input.scrubberHealth, 0, 100),
    crewStress: clamp(input.crewStress, 0, 100),
    crewPulseBpm: clamp(input.crewPulseBpm, 40, 200),
    airlockIsolated: input.airlockIsolated,
    radiationAddedMsv: 0,
    healthLoss: 0,
    fatalReason: null,
    leakRepaired: false,
  }
  if (!Number.isFinite(input.elapsedHours) || input.elapsedHours <= 0 || input.crewSize <= 0) return result
  if (input.elapsedHours > MAX_ELAPSED_HOURS) {
    throw new RangeError(`Cabin environment step cannot exceed ${MAX_ELAPSED_HOURS} hours.`)
  }

  const difficulty = input.difficulty
  const baseScrubRate = CO2_SCRUBBING_EFFICIENCY[difficulty]
  const workload = workloadStrain(input.action)
  const stepRatio = input.elapsedHours / FIXED_STEP_HOURS
  const nearestStepCount = Math.round(stepRatio)
  const stepCount = nearestStepCount > 0 && Math.abs(stepRatio - nearestStepCount) < 1e-10
    ? nearestStepCount
    : Math.ceil(stepRatio)
  let leakRepairHoursRemaining = input.ongoingLeak && input.action === 'maintenance' && input.qualifiedMaintenance
    ? 1
    : Number.POSITIVE_INFINITY
  for (let step = 0; step < stepCount && result.fatalReason === null; step += 1) {
    const hours = step === stepCount - 1
      ? input.elapsedHours - FIXED_STEP_HOURS * (stepCount - 1)
      : FIXED_STEP_HOURS

    const stressLoad =
      (input.fatigue / 100) * 0.12 +
      ((100 - input.morale) / 100) * 0.1 +
      (result.crewStress / 100) * 0.08 +
      (input.ongoingLeak ? 0.14 : 0) +
      (result.pressureKpa < 80 ? 0.12 : 0) +
      (result.oxygenPartialPressureKpa < OXYGEN_WARN_PARTIAL_PRESSURE_KPA ? 0.12 : 0) +
      (result.temperatureC < TEMPERATURE_WARN_C ? 0.08 : 0)
    const strain = clamp(workload + stressLoad, -0.5, 2)
    result.crewPulseBpm = clamp(68 + strain * 42 + result.crewStress * 0.34, 40, 190)

    const thermalTarget = input.destination === 'moon' && input.day % 30 >= 15 ? 18 : CABIN_TEMPERATURE_TARGET_C
    if (input.powered && input.lifeSupportOnline) {
      result.temperatureC += (thermalTarget - result.temperatureC) * Math.min(1, hours * 0.8)
    } else {
      result.temperatureC += (UNPOWERED_CABIN_TEMPERATURE_C - result.temperatureC) * Math.min(1, hours * 0.05)
    }

    const temperatureDemand = clamp(1 + Math.max(0, 18 - result.temperatureC) * 0.012, 0.8, 1.35)
    const metabolismFactor = clamp(
      1 + result.crewStress * 0.0015 + Math.max(0, result.crewPulseBpm - 68) * 0.0012 +
        Math.max(0, input.fatigue - 60) * 0.001,
      0.8,
      1.5,
    )
    const solLengthHours = input.destination === 'mars' ? 24.65 : 24
    const radiationDayHours = input.transit ? 24 : solLengthHours
    const co2Kg = CO2_PER_CREW_DAY * input.crewSize * metabolismFactor * temperatureDemand * hours / solLengthHours
    const co2PressureRise = co2Kg * 0.008314462618 * (result.temperatureC + 273.15) /
      (0.04401 * CABIN_VOLUME_M3)
    const scrubberFactor = input.scrubberOnline && input.powered ? result.scrubberHealth / 100 : 0
    const scrubFraction = clamp(baseScrubRate * scrubberFactor, 0, 0.995)
    const scrubbedPressure = result.co2PartialPressureKpa * (1 - Math.exp(-scrubFraction * hours * 0.08))
    result.co2PartialPressureKpa = clamp(result.co2PartialPressureKpa + co2PressureRise - scrubbedPressure, 0, 10)
    if (input.scrubberOnline && input.powered) {
      result.scrubberHealth = clamp(result.scrubberHealth - co2Kg * 0.15, 0, 100)
    }

    const oxygenUsedKg = OXYGEN_PER_CREW_DAY * input.crewSize * metabolismFactor * temperatureDemand * hours / solLengthHours
    const oxygenProducedKg = input.lifeSupportOnline && input.powered
      ? 1.8 * hours / solLengthHours
      : 0
    const oxygenPressureChange = (oxygenProducedKg - oxygenUsedKg) * KPA_PER_KG_OXYGEN
    result.oxygenPartialPressureKpa = clamp(result.oxygenPartialPressureKpa + oxygenPressureChange, 0, 30)

    const leakActive = input.ongoingLeak && leakRepairHoursRemaining > 0
    if (leakActive) {
      const isolationFactor = result.airlockIsolated ? 0.2 : 1
      const leakFraction = Math.min(0.08 * hours * isolationFactor, 0.99)
      result.pressureKpa = clamp(result.pressureKpa * (1 - leakFraction), 0, 101.3)
      result.oxygenPartialPressureKpa = clamp(result.oxygenPartialPressureKpa * (1 - leakFraction), 0, 30)
      result.co2PartialPressureKpa = clamp(result.co2PartialPressureKpa * (1 - leakFraction), 0, 10)
      leakRepairHoursRemaining -= hours
      if (leakRepairHoursRemaining <= 0) result.leakRepaired = true
    } else if (input.lifeSupportOnline && input.powered) {
      result.pressureKpa = clamp(result.pressureKpa + Math.min(0.015 * hours, 101.3 - result.pressureKpa), 0, 101.3)
    }

    if (result.pressureKpa <= PRESSURE_ISOLATION_KPA) result.airlockIsolated = true
    if (result.pressureKpa > PRESSURE_ISOLATION_KPA + 5 && !input.ongoingLeak) result.airlockIsolated = false
    if (result.co2PartialPressureKpa >= CO2_WARN_PARTIAL_PRESSURE_KPA) {
      result.healthLoss += Math.max(0, result.co2PartialPressureKpa - CO2_WARN_PARTIAL_PRESSURE_KPA) * hours * 0.2
    }
    if (result.temperatureC < TEMPERATURE_WARN_C) {
      result.healthLoss += (TEMPERATURE_WARN_C - result.temperatureC) * hours * 0.015
    }
    if (input.transit) {
      result.radiationAddedMsv += ENVIRONMENT.transitRadiationMsvPerDay * hours / radiationDayHours
    } else if (input.destination === 'mars') {
      const radiationFactor = input.shielded ? 0.25 : 1
      const stormFactor = input.dustStorm ? 1.5 : 1
      result.radiationAddedMsv += ENVIRONMENT.marsSurfaceRadiationMsvPerDay * radiationFactor * stormFactor * hours / solLengthHours
    } else {
      result.radiationAddedMsv += 1.4 * (input.shielded ? 0.25 : 1) * hours / solLengthHours
    }

    const stressDelta =
      (leakActive ? 3.5 : 0) +
      (result.pressureKpa < 80 ? 1.2 : 0) +
      (result.co2PartialPressureKpa > CO2_WARN_PARTIAL_PRESSURE_KPA ? 1.5 : 0) +
      (result.oxygenPartialPressureKpa < OXYGEN_WARN_PARTIAL_PRESSURE_KPA ? 2 : 0) +
      (result.temperatureC < TEMPERATURE_WARN_C ? 1 : 0) +
      Math.max(0, input.fatigue - 65) * 0.006 +
      Math.max(0, 45 - input.morale) * 0.005 +
      workload * 0.7
    result.crewStress = clamp(result.crewStress + stressDelta * hours - (input.action === 'rest' ? hours * 1.5 : 0), 0, 100)

    if (result.pressureKpa <= PRESSURE_FATAL_KPA) result.fatalReason = 'decompression'
    else if (result.oxygenPartialPressureKpa <= OXYGEN_FATAL_PARTIAL_PRESSURE_KPA) result.fatalReason = 'hypoxia'
    else if (result.co2PartialPressureKpa >= CO2_FATAL_PARTIAL_PRESSURE_KPA) result.fatalReason = 'hypercapnia'
    else if (result.temperatureC <= TEMPERATURE_FATAL_C && !input.powered) result.fatalReason = 'hypothermia'
  }

  result.healthLoss = clamp(result.healthLoss, 0, 100)
  if (!Number.isFinite(result.radiationAddedMsv)) result.radiationAddedMsv = 0
  return result
}

export function getCabinEnvironmentAlert(environment: CabinEnvironment): 'nominal' | 'co2' | 'oxygen' | 'pressure' | 'temperature' | 'scrubber' | 'stress' {
  if (environment.pressureKpa < PRESSURE_ISOLATION_KPA) return 'pressure'
  if (environment.oxygenPartialPressureKpa < OXYGEN_WARN_PARTIAL_PRESSURE_KPA) return 'oxygen'
  if (environment.co2PartialPressureKpa >= CO2_DANGER_PARTIAL_PRESSURE_KPA) return 'co2'
  if (environment.scrubberHealth < 20) return 'scrubber'
  if (environment.temperatureC < TEMPERATURE_WARN_C) return 'temperature'
  if (environment.crewStress >= 90) return 'stress'
  return 'nominal'
}

export function getCabinEnvironmentThresholds() {
  return {
    co2WarnKpa: CO2_WARN_PARTIAL_PRESSURE_KPA,
    co2FatalKpa: CO2_FATAL_PARTIAL_PRESSURE_KPA,
    oxygenWarnKpa: OXYGEN_WARN_PARTIAL_PRESSURE_KPA,
    pressureIsolationKpa: PRESSURE_ISOLATION_KPA,
    pressureFatalKpa: PRESSURE_FATAL_KPA,
    temperatureWarnC: TEMPERATURE_WARN_C,
    temperatureFatalC: TEMPERATURE_FATAL_C,
    cabinVolumeM3: CABIN_VOLUME_M3,
  } as const
}

export function getEmergencyLoadSheddingState(batteryPercent: number, enabledBuildings: readonly string[]) {
  const shedsLoad = Number.isFinite(batteryPercent) && batteryPercent <= 15
  const offlineBuildings = shedsLoad
    ? POWER_SYSTEM.automaticLoadShedBuildings.filter((building) => enabledBuildings.includes(building))
    : []
  return { shedsLoad, offlineBuildings }
}
