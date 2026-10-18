import { create } from 'zustand'
import { acknowledgeEveningDebrief as markEveningDebriefAcknowledged, canControlFlight, canSleepAndAdvance, createMissionRunId, MISSION_TYPE_MAX_DAYS, migrateLegacyResourceUnits, pretreatRegolith, recordTutorialStep as applyTutorialStep, resetResourceStreakIfNeeded, resolveAutomaticTransitDecision, resolveTransitDecision, scheduleActivity, setEmergencyLevel as applyEmergencyLevel, sleepAndAdvanceDay as applySleepAndAdvance, snapshotDailyResources, waitUntilBedtime as advanceToBedtime, type Action, type ConstructionProject, type ControlMode, type CrewRole, type Destination, type EmergencyLevel, type GameState, type MissionDifficulty, type MissionMode, type MissionObjective, type MissionType, type TransitChoice, type TutorialStep } from '../game/model'
import type { ScenarioId } from '../game/scenarios'
import {
  buildInState,
  convertLegacyResourceDelta,
  endIfDepleted,
  getEnergyCapacity,
  initialGameState,
  settleAfterEvent,
  toggleBuildingInState,
} from '../game/model'
import { canChooseEventOption, chooseEvent, EVENTS } from '../game/events'
import { getAvailableCrewRoles, getMissionCrewAssignments, respondToCrewRequest } from '../game/teamwork'
import { deleteSave as eraseSave, hasSavedGame, loadGame as readGame, loadMissionSetup, saveGame as writeGame, saveMissionSetup } from '../utils/saveSystem'
import { useAchievementsStore } from './achievementsStore'
import { getAllowedCrewSizes } from '../game/crewRosters'
import { MISSION_PROFILES } from '../game/missionProfiles'
import { advanceOperation, setOperationSiteDistance, startOperation, type OperationId } from '../game/operations'

type MissionState = GameState & {
  savedGameExists: boolean
  startMission: () => void
  newMission: () => void
  replayMission: () => void
  endMission: () => void
  setDestination: (destination: Destination) => void
  setMissionMode: (mode: MissionMode) => void
  setControlMode: (mode: ControlMode) => void
  setControlledRole: (role: CrewRole) => void
  setControlledDuty: (dutyId: string) => void
  setAstronautName: (name: string) => void
  setAstronautDuty: (dutyId: string) => void
  setCrewSize: (size: number) => void
  setBaseName: (name: string) => void
  setMissionLength: (days: number) => void
  setMissionType: (missionType: MissionType) => void
  setDifficulty: (difficulty: MissionDifficulty) => void
  setObjective: (objective: MissionObjective) => void
  setScenario: (scenario: ScenarioId) => void
  setEmergencyLevel: (level: EmergencyLevel) => void
  startOperation: (id: OperationId) => void
  advanceOperation: () => void
  setOperationSiteDistance: (distance: number) => void
  pretreatRegolith: () => void
  setMissionSeed: (seed: number) => void
  randomizeMissionSeed: () => void
  markTutorialStep: (step: TutorialStep) => void
  pauseAndReturnToMain: () => void
  advanceDay: (action: Action) => void
  sleepAndAdvance: () => void
  acknowledgeEveningDebrief: () => void
  sendCrewRequest: (dutyId: string, action: Action, language: 'ar' | 'en') => void
  waitUntilBedtime: () => void
  chooseTransit: (leg: 'outbound' | 'return', choice: TransitChoice) => void
  resolveEvent: (choiceIndex: number) => void
  buildBuilding: (buildingId: string) => void
  toggleBuilding: (buildingId: string) => void
  completeLesson: (id: number) => void
  save: () => void
  load: () => void
  deleteSave: () => void
}

const savedMissionSetup = loadMissionSetup()
const setupDestination = savedMissionSetup.destination || 'moon'
const setupDays = savedMissionSetup.maxDays || 30
const defaultMissionType: MissionType = setupDestination === 'moon'
  ? setupDays > 30 ? 'moon-settlement' : 'moon-exploration'
  : setupDays > 30 ? 'mars-conjunction' : 'mars-opposition'
const setupMissionType = savedMissionSetup.missionType?.startsWith(setupDestination)
  ? savedMissionSetup.missionType
  : defaultMissionType
const setupTypeDays = MISSION_TYPE_MAX_DAYS[setupMissionType]

function resolveMissionCrewSize(destination: Destination, missionType: MissionType, requestedCrewSize: number): number {
  const allowed = getAllowedCrewSizes(destination, MISSION_TYPE_MAX_DAYS[missionType])
  const minimumCrew = MISSION_PROFILES[missionType].minimumCrew
  if (allowed.includes(requestedCrewSize) && requestedCrewSize >= minimumCrew) return requestedCrewSize
  const crewSize = allowed.find((size) => size >= minimumCrew)
  if (crewSize === undefined) throw new Error(`No crew roster meets the minimum crew requirement for ${missionType}.`)
  return crewSize
}

const setupCrewSize = resolveMissionCrewSize(setupDestination, setupMissionType, savedMissionSetup.crewSize || 0)
const setupRoles = getAvailableCrewRoles(setupCrewSize, setupDestination, setupTypeDays)
const setupControlledRole = setupRoles.some((role) => role.id === savedMissionSetup.controlledRole)
  ? savedMissionSetup.controlledRole!
  : setupRoles[0].id
const setupDuties = getMissionCrewAssignments(setupCrewSize, setupDestination, setupTypeDays)
const setupControlledDuty = setupDuties.some((duty) => duty.id === savedMissionSetup.controlledDutyId)
  ? savedMissionSetup.controlledDutyId!
  : setupDuties.find((duty) => duty.controlRole === setupControlledRole)?.id || setupDuties[0].id
const setupAstronautDuty = setupDuties.some((duty) => duty.id === savedMissionSetup.astronautDutyId)
  ? savedMissionSetup.astronautDutyId!
  : setupControlledDuty

const startingState: GameState = {
  ...initialGameState(setupDestination, setupCrewSize, '', undefined, {
    missionMode: 'education',
    controlMode: 'full',
    controlledRole: 'commander',
    maxDays: 30,
    difficulty: 'easy',
    objective: 'tutorial',
    scenario: 'baseline',
  }),
  missionMode: 'education',
  ...savedMissionSetup,
  destination: setupDestination,
  missionType: setupMissionType,
  objective: savedMissionSetup.missionMode === 'education'
    ? savedMissionSetup.objective || 'tutorial'
    : MISSION_PROFILES[setupMissionType].objective,
  maxDays: setupDays,
  crewSize: setupCrewSize,
  astronautName: savedMissionSetup.astronautName || '',
  astronautDutyId: setupAstronautDuty,
  controlledRole: setupControlledRole,
  controlledDutyId: setupControlledDuty,
  started: false,
}

function persistSetup(state: GameState): void {
  saveMissionSetup({
    destination: state.destination,
    crewSize: state.crewSize,
    maxDays: state.maxDays,
    missionType: state.missionType,
    difficulty: state.difficulty,
    objective: state.objective,
    missionSeed: state.missionSeed,
    scenario: state.scenario,
    missionMode: state.missionMode,
    controlMode: state.controlMode,
    controlledRole: state.controlledRole,
    controlledDutyId: state.controlledDutyId,
    astronautName: state.astronautName,
    astronautDutyId: state.astronautDutyId,
  })
}

function resolveCrewDuty(crewSize: number, destination: Destination, maxDays: number, dutyId: string, role: CrewRole) {
  const duties = getMissionCrewAssignments(crewSize, destination, maxDays)
  const selected = duties.find((duty) => duty.id === dutyId) ||
    duties.find((duty) => duty.controlRole === role) ||
    duties[0]
  if (!selected) throw new Error(`No crew duties are configured for ${destination}, ${maxDays} days, crew size ${crewSize}.`)
  return selected
}

function applyEventConsequences(state: GameState, eventId: string): GameState {
  const next = { ...state, resources: { ...state.resources } }
  if (eventId === 'water-leak') next.resources.water = Math.max(0, next.resources.water - convertLegacyResourceDelta('water', 20))
  if (eventId === 'solar-storm') {
    const shelterOnline = state.buildings.includes('storm-shelter') && !(state.offlineBuildings || []).includes('storm-shelter')
    next.resources.health = Math.max(0, next.resources.health - (shelterOnline ? 2 : 14))
    next.radiationExposure = state.radiationExposure + (shelterOnline ? 8 : 24)
    if (next.radiationExposure >= 600) next.permanentRadiationDamageWarning = true
    if (shelterOnline) next.lastMessage = 'حماكم ملجأ العواصف من معظم الإشعاع.'
  }
  if (eventId === 'low-light') next.resources.energy = Math.max(0, next.resources.energy - 8)
  if (eventId === 'crop-failure') next.resources.food = Math.max(0, next.resources.food - convertLegacyResourceDelta('food', 10))
  return resetResourceStreakIfNeeded(next)
}

const initialSaveExists = hasSavedGame()

function normalizeConstructionProject(value: unknown): ConstructionProject | null {
  if (value === null || value === undefined) return null
  if (typeof value !== 'object') throw new Error('Invalid construction project in saved mission.')
  const project = value as Record<string, unknown>
  if (typeof project.buildingId !== 'string') throw new Error('Invalid construction project in saved mission.')
  const legacyTotal = typeof project.totalDays === 'number' ? project.totalDays * 24 : null
  const legacyRemaining = typeof project.daysRemaining === 'number' ? project.daysRemaining * 24 : null
  const totalHours = typeof project.totalHours === 'number' ? project.totalHours : legacyTotal
  const hoursRemaining = typeof project.hoursRemaining === 'number' ? project.hoursRemaining : legacyRemaining
  if (
    typeof totalHours !== 'number' || !Number.isFinite(totalHours) || totalHours <= 0 ||
    typeof hoursRemaining !== 'number' || !Number.isFinite(hoursRemaining) || hoursRemaining <= 0 ||
    hoursRemaining > totalHours
  ) {
    throw new Error('Invalid construction timer in saved mission.')
  }
  return { buildingId: project.buildingId, totalHours, hoursRemaining }
}

export const useGameStore = create<MissionState>((set, get) => ({
  ...startingState,
  savedGameExists: initialSaveExists,

  setDestination: (destination) => {
    const state = get()
    const missionType: MissionType = destination === 'moon'
      ? state.missionType === 'moon-settlement' ? 'moon-settlement' : 'moon-exploration'
      : state.missionType === 'mars-conjunction' ? 'mars-conjunction' : 'mars-opposition'
    const maxDays = MISSION_TYPE_MAX_DAYS[missionType]
    const crewSize = resolveMissionCrewSize(destination, missionType, state.crewSize)
    const currentDuty = resolveCrewDuty(crewSize, destination, maxDays, state.controlledDutyId, state.controlledRole)
    set({
      destination,
      missionType,
      maxDays,
      crewSize,
      objective: MISSION_PROFILES[missionType].objective,
      astronautDutyId: resolveCrewDuty(crewSize, destination, maxDays, state.astronautDutyId, state.controlledRole).id,
      controlledRole: currentDuty.controlRole,
      controlledDutyId: currentDuty.id,
    })
    persistSetup(get())
  },
  setMissionMode: (missionMode) => {
    set({ missionMode })
    persistSetup(get())
  },
  setControlMode: (controlMode) => {
    const state = get()
    const availableRoles = getAvailableCrewRoles(state.crewSize, state.destination, state.maxDays)
    set({
      controlMode,
      controlledRole: availableRoles.some((role) => role.id === state.controlledRole)
        ? state.controlledRole
        : availableRoles[0].id,
    })
    persistSetup(get())
  },
  setControlledRole: (controlledRole) => {
    const state = get()
    const duty = getMissionCrewAssignments(state.crewSize, state.destination, state.maxDays)
      .find((option) => option.controlRole === controlledRole)
    if (!duty) return
    set({ controlledRole: duty.controlRole, controlledDutyId: duty.id, astronautDutyId: duty.id })
    persistSetup(get())
  },
  setControlledDuty: (dutyId) => {
    const state = get()
    const duty = getMissionCrewAssignments(state.crewSize, state.destination, state.maxDays)
      .find((option) => option.id === dutyId)
    if (!duty) return
    set({ controlledRole: duty.controlRole, controlledDutyId: duty.id, astronautDutyId: duty.id })
    persistSetup(get())
  },
  setAstronautName: (astronautName) => {
    set({ astronautName: astronautName.slice(0, 40) })
    persistSetup(get())
  },
  setAstronautDuty: (astronautDutyId) => {
    const duties = getMissionCrewAssignments(get().crewSize, get().destination, get().maxDays)
    if (!duties.some((duty) => duty.id === astronautDutyId)) return
    set({ astronautDutyId })
    persistSetup(get())
  },
  setCrewSize: (crewSize) => {
    const state = get()
    if (
      !getAllowedCrewSizes(state.destination, state.maxDays).includes(crewSize) ||
      crewSize < MISSION_PROFILES[state.missionType].minimumCrew
    ) return
    const currentDuty = resolveCrewDuty(crewSize, state.destination, state.maxDays, state.controlledDutyId, state.controlledRole)
    set({
      crewSize,
      astronautDutyId: resolveCrewDuty(crewSize, state.destination, state.maxDays, state.astronautDutyId, state.controlledRole).id,
      controlledRole: currentDuty.controlRole,
      controlledDutyId: currentDuty.id,
    })
    persistSetup(get())
  },
  setBaseName: (baseName) => {
    set({ baseName })
    persistSetup(get())
  },
  setMissionLength: (maxDays) => {
    const state = get()
    const missionType: MissionType = state.destination === 'moon'
      ? maxDays > 30 ? 'moon-settlement' : 'moon-exploration'
      : maxDays > 30 ? 'mars-conjunction' : 'mars-opposition'
    const missionLimit = MISSION_TYPE_MAX_DAYS[missionType]
    const selectedDays = maxDays === 10 || maxDays === 60 ? maxDays : missionLimit
    const crewSize = resolveMissionCrewSize(state.destination, missionType, state.crewSize)
    const currentDuty = resolveCrewDuty(crewSize, state.destination, missionLimit, state.controlledDutyId, state.controlledRole)
    set({
      maxDays: selectedDays,
      missionType,
      objective: MISSION_PROFILES[missionType].objective,
      crewSize,
      astronautDutyId: resolveCrewDuty(crewSize, state.destination, missionLimit, state.astronautDutyId, state.controlledRole).id,
      controlledRole: currentDuty.controlRole,
      controlledDutyId: currentDuty.id,
    })
    persistSetup(get())
  },
  setMissionType: (missionType) => {
    const state = get()
    if (!missionType.startsWith(state.destination)) return
    const maxDays = MISSION_TYPE_MAX_DAYS[missionType]
    const crewSize = resolveMissionCrewSize(state.destination, missionType, state.crewSize)
    const currentDuty = resolveCrewDuty(crewSize, state.destination, maxDays, state.controlledDutyId, state.controlledRole)
    set({
      missionType,
      maxDays,
      objective: MISSION_PROFILES[missionType].objective,
      crewSize,
      astronautDutyId: resolveCrewDuty(crewSize, state.destination, maxDays, state.astronautDutyId, state.controlledRole).id,
      controlledRole: currentDuty.controlRole,
      controlledDutyId: currentDuty.id,
    })
    persistSetup(get())
  },
  setDifficulty: (difficulty) => {
    set({ difficulty })
    persistSetup(get())
  },
  setObjective: (objective) => {
    set({ objective })
    persistSetup(get())
  },
  setScenario: (scenario) => {
    set({ scenario })
    persistSetup(get())
  },
  setEmergencyLevel: (level) => {
    const next = applyEmergencyLevel(get(), level)
    set(next)
    if (next.started) get().save()
  },
  startOperation: (id) => {
    set(startOperation(get(), id))
    get().save()
  },
  advanceOperation: () => {
    set(advanceOperation(get()))
    get().save()
  },
  setOperationSiteDistance: (distance) => {
    set(setOperationSiteDistance(get(), distance))
    get().save()
  },
  pretreatRegolith: () => {
    set(pretreatRegolith(get()))
    get().save()
  },
  setMissionSeed: (missionSeed) => {
    set({ missionSeed: Math.max(0, Math.min(0xffff_ffff, Math.floor(missionSeed))) })
    persistSetup(get())
  },
  randomizeMissionSeed: () => {
    const missionSeed = typeof crypto !== 'undefined' && 'getRandomValues' in crypto
      ? crypto.getRandomValues(new Uint32Array(1))[0]
      : Math.floor(Math.random() * 0x1_0000_0000)
    set({ missionSeed })
    persistSetup(get())
  },
  markTutorialStep: (step) => {
    const next = applyTutorialStep(get(), step)
    set(next)
    if (next.started) get().save()
    useAchievementsStore.getState().checkAchievements(next)
  },
  pauseAndReturnToMain: () => {
    const pausedState: GameState = { ...get(), started: false, paused: true }
    writeGame(pausedState)
    set({ ...pausedState, savedGameExists: true })
  },

  startMission: () => {
    const { destination, crewSize, baseName, missionSeed, maxDays, missionType, difficulty, objective, scenario, missionMode, controlMode, controlledRole, controlledDutyId, astronautName, astronautDutyId } = get()
    if (!baseName.trim()) throw new Error('اكتب اسم القاعدة قبل بدء المهمة.')
    eraseSave()
    set(initialGameState(destination, crewSize, baseName, missionSeed, { maxDays, missionType, difficulty, objective, scenario, missionMode, controlMode, controlledRole, controlledDutyId, astronautName, astronautDutyId }))
    set({ savedGameExists: false })
    get().save()
    persistSetup(get())
  },

  newMission: () => {
    eraseSave()
    set({
      ...initialGameState('moon', 2, '', undefined, {
        missionMode: 'education',
        maxDays: 10,
        difficulty: 'easy',
        objective: 'tutorial',
        scenario: 'baseline',
      }),
      started: false,
      savedGameExists: false,
    })
    persistSetup(get())
  },
  replayMission: () => {
    const { destination, crewSize, baseName, missionSeed, maxDays, missionType, difficulty, objective, scenario, missionMode, controlMode, controlledRole, controlledDutyId, astronautName, astronautDutyId } = get()
    eraseSave()
    set({ ...initialGameState(destination, crewSize, baseName, missionSeed, { maxDays, missionType, difficulty, objective, scenario, missionMode, controlMode, controlledRole, controlledDutyId, astronautName, astronautDutyId }), savedGameExists: false })
    persistSetup(get())
  },
  endMission: () => {
    const state = get()
    if (!state.started || state.isGameOver || state.activeEvent) return
    eraseSave()
    const endedState: GameState = {
      ...state,
      isGameOver: true,
      missionResult: 'ended',
      lastMessage: '',
    }
    set({ ...endedState, savedGameExists: false })
    useAchievementsStore.getState().checkAchievements(endedState)
  },

  advanceDay: (action) => {
    const state = get()
    if (state.isGameOver || state.paused || state.activeEvent || !state.started) return
    set(scheduleActivity(state, action))
    get().save()
  },

  sleepAndAdvance: () => {
    const state = get()
    if (!canSleepAndAdvance(state)) return
    let next = applySleepAndAdvance(state)
    if (next.isGameOver) {
      set(next)
      useAchievementsStore.getState().checkAchievements(next)
      get().save()
      return
    }
    const eventId = next.missionPhase === 'surface' && next.daysSurvived < next.maxDays ? chooseEvent(next) : null
    if (eventId) {
      next = applyEventConsequences(next, eventId)
      next.day = state.day
      next.activeEvent = { id: eventId }
      set(next)
      useAchievementsStore.getState().checkAchievements(next)
      get().save()
      return
    }
    set(next)
    useAchievementsStore.getState().checkAchievements(next)
    get().save()
  },

  acknowledgeEveningDebrief: () => {
    const state = get()
    const next = markEveningDebriefAcknowledged(state)
    if (next === state) return
    set(next)
    get().save()
  },

  sendCrewRequest: (dutyId, action, language) => {
    const state = get()
    const next = respondToCrewRequest(state, dutyId, action, language)
    if (next === state) return
    set(next)
    get().save()
  },

  waitUntilBedtime: () => {
    set(advanceToBedtime(get()))
    get().save()
  },

  chooseTransit: (leg, choice) => {
    const state = get()
    const next = canControlFlight(state)
      ? resolveTransitDecision(state, leg, choice)
      : resolveAutomaticTransitDecision(state, leg)
    set(next)
    get().save()
    if (next.isGameOver) useAchievementsStore.getState().checkAchievements(next)
  },

  resolveEvent: (choiceIndex) => {
    const state = get()
    const active = state.activeEvent
    if (!active || state.paused || !state.started) return
    const definition = EVENTS.find((event) => event.id === active.id)
    const choice = definition?.choices[choiceIndex]
    if (!choice) return
    if (!canChooseEventOption(state, choice)) return
    const resources = { ...state.resources }
    for (const [key, delta] of Object.entries(choice.effects)) {
      const resource = key as keyof typeof resources
      const cap = resource === 'energy'
        ? getEnergyCapacity(state)
        : resource === 'credits' || resource === 'cargo'
          ? Number.MAX_SAFE_INTEGER
          : 100
      resources[resource] = Math.max(0, Math.min(cap, resources[resource] + delta))
    }
    const withChoice: GameState = {
      ...state,
      resources,
      ongoingLeak: choice.ongoingLeak ?? (active.id === 'water-leak' ? false : state.ongoingLeak),
      totalRescues: state.totalRescues + (choice.rescues || 0),
      eventHistory: [...state.eventHistory, { eventId: active.id, choiceIndex, day: state.day }],
      log: [...state.log, `اليوم ${state.day}: ${definition?.title.ar || active.id}`],
      dailyReports: state.dailyReports.map((report) => report.day === state.day
        ? {
            ...report,
            resourcesAtEnd: snapshotDailyResources(resources),
            events: [...report.events, `${definition?.title.en || active.id}: ${choice.label.en}`],
          }
        : report),
      activeEvent: null,
    }
    const streakChecked = resetResourceStreakIfNeeded(withChoice)
    const depletedResource = (['energy', 'health'] as const).find((resource) => resources[resource] <= 0)
    const failureCause = depletedResource
      ? { resource: depletedResource, source: 'event' as const, eventId: active.id, choiceIndex }
      : undefined
    const settled = settleAfterEvent(streakChecked, failureCause)
    const next = endIfDepleted(settled, failureCause)
    set(next)
    useAchievementsStore.getState().checkAchievements(next)
    get().save()
  },

  buildBuilding: (buildingId) => {
    const next = buildInState(get(), buildingId)
    set(next)
    get().save()
    useAchievementsStore.getState().checkAchievements(next)
  },
  toggleBuilding: (buildingId) => {
    set(toggleBuildingInState(get(), buildingId))
    get().save()
  },

  completeLesson: (id) => {
    const lessonsCompleted = get().lessonsCompleted.includes(id)
      ? get().lessonsCompleted
      : [...get().lessonsCompleted, id]
    const lessonResults = {
      ...get().lessonResults,
      [id]: { preCorrect: null, postCorrect: true },
    }
    set({ lessonsCompleted, lessonResults })
    writeGame(get())
    set({ savedGameExists: true })
  },

  save: () => {
    writeGame(get())
    set({ savedGameExists: true })
  },
  load: () => {
    const saved = readGame()
    if (!saved) return
    const savedState = saved.state
    const constructionProject = normalizeConstructionProject(savedState.constructionProject)
    const legacyCrewSupportHistory = 'assistantActionHistory' in savedState && Array.isArray(savedState.assistantActionHistory)
      ? savedState.assistantActionHistory.filter((action): action is Action =>
        action === 'research' || action === 'explore' || action === 'maintenance' || action === 'exercise' || action === 'rest')
      : []
    const { assistantActionHistory: _legacyActionHistory, ...savedGameState } = savedState as GameState & {
      assistantActionHistory?: unknown
    }
    const isLegacySave = !savedState.configVersion
    const savedVersion = savedState.configVersion || 0
    const crewSize = savedState.crewSize || startingState.crewSize
    const missionDestination = savedState.destination || startingState.destination
    const missionDays = savedState.maxDays || startingState.maxDays
    const missionType: MissionType = savedState.missionType ||
      (missionDestination === 'moon'
        ? missionDays > 30 ? 'moon-settlement' : 'moon-exploration'
        : missionDays > 30 ? 'mars-conjunction' : 'mars-opposition')
    const availableRoles = getAvailableCrewRoles(crewSize, missionDestination, missionDays)
    const savedControlledRole = availableRoles.some((role) => role.id === savedState.controlledRole)
      ? savedState.controlledRole!
      : availableRoles[0].id
    const controlledDuty = resolveCrewDuty(
      crewSize,
      missionDestination,
      missionDays,
      savedState.controlledDutyId || '',
      savedControlledRole,
    )
    const astronautDuty = resolveCrewDuty(
      crewSize,
      missionDestination,
      missionDays,
      savedState.astronautDutyId || controlledDuty.id,
      savedControlledRole,
    )
    set({
      ...startingState,
      ...savedGameState,
      resources: savedVersion < 4
        ? migrateLegacyResourceUnits(savedState.resources)
        : savedState.resources,
      configVersion: 9,
      paused: false,
      maxDays: isLegacySave ? Math.max(savedState.maxDays || startingState.maxDays, 30) : savedState.maxDays || startingState.maxDays,
      missionType,
      difficulty: savedState.difficulty || 'normal',
      objective: savedState.missionMode === 'education'
        ? savedState.objective || 'tutorial'
        : savedState.objective === 'tutorial' || !savedState.objective
          ? 'survival'
          : savedState.objective,
      scenario: savedState.scenario || 'baseline',
      missionMode: savedState.missionMode || 'simulation',
      controlMode: savedState.controlMode || 'full',
      crewSize,
      controlledRole: controlledDuty.controlRole,
      controlledDutyId: controlledDuty.id,
      astronautName: savedState.astronautName || '',
      astronautDutyId: astronautDuty.id,
      missionPhase: savedState.missionPhase || (savedState.daysSurvived
        ? savedState.daysSurvived >= (savedState.maxDays || startingState.maxDays) - 2 ? 'return' : 'surface'
        : 'outbound'),
      transitDecisions: savedState.transitDecisions || (savedState.daysSurvived
        ? [{ leg: 'outbound' as const, choice: 'conservative' as const }]
        : []),
      hour: savedState.hour ?? 6,
      todayActions: savedState.todayActions || [],
      resourceStreak: savedState.resourceStreak || 0,
      tutorialSteps: savedState.tutorialSteps || [],
      successfulExpeditions: savedState.successfulExpeditions || 0,
      runId: savedState.runId || createMissionRunId(),
      fatigue: savedState.fatigue ?? startingState.fatigue,
      morale: savedState.morale ?? startingState.morale,
      radiationExposure: savedState.radiationExposure ?? 0,
      permanentRadiationDamageWarning: savedState.permanentRadiationDamageWarning ??
        (savedState.radiationExposure ?? 0) >= 600,
      activeOperation: savedState.activeOperation ?? null,
      constructionProject,
      dailyResourceStart: savedState.dailyResourceStart ?? snapshotDailyResources(savedState.resources),
      dailyReports: savedState.dailyReports ?? [],
      constructionEventsToday: savedState.constructionEventsToday ?? [],
      regolithPreTreated: savedState.regolithPreTreated ?? false,
      oxygenEmergencyHoursRemaining: savedState.oxygenEmergencyHoursRemaining ?? null,
      survivalMode: savedState.survivalMode ?? false,
      survivalModeOfflineBuildings: savedState.survivalModeOfflineBuildings ?? [],
      autoShedBuildings: savedState.autoShedBuildings ?? [],
      emergencyLevel: savedState.emergencyLevel ?? 0,
      dustStormDaysRemaining: savedState.dustStormDaysRemaining ?? 0,
      dustStormSolarLossFraction: savedState.dustStormSolarLossFraction ?? 0,
      missionSeed: savedState.missionSeed ?? Math.floor(Math.random() * 0x1_0000_0000),
      offlineBuildings: savedState.offlineBuildings ?? [],
      started: true,
      activeEvent: savedState.activeEvent ?? null,
      actionHistory: savedState.actionHistory ?? [],
      crewSupportActionHistory: savedState.crewSupportActionHistory ?? legacyCrewSupportHistory,
      crewCommunications: savedState.crewCommunications ?? [],
      eventHistory: savedState.eventHistory ?? [],
      failureCause: savedState.failureCause ?? null,
      savedGameExists: true,
    })
    useAchievementsStore.getState().checkAchievements(get())
  },
  deleteSave: () => {
    eraseSave()
    set({ savedGameExists: false })
  },
}))
