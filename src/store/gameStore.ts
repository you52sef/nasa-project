import { create } from 'zustand'
import { canSleepAndAdvance, createMissionRunId, migrateLegacyResourceUnits, pretreatRegolith, recordTutorialStep as applyTutorialStep, resetResourceStreakIfNeeded, resolveTransitDecision, scheduleActivity, setEmergencyLevel as applyEmergencyLevel, sleepAndAdvanceDay as applySleepAndAdvance, waitUntilBedtime as advanceToBedtime, type Action, type ControlMode, type CrewRole, type Destination, type EmergencyLevel, type GameState, type MissionDifficulty, type MissionMode, type MissionObjective, type TransitChoice, type TutorialStep } from '../game/model'
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
import { getAvailableCrewRoles, recommendCrewSupportAction } from '../game/teamwork'
import { deleteSave as eraseSave, hasSavedGame, loadGame as readGame, loadMissionSetup, saveGame as writeGame, saveMissionSetup } from '../utils/saveSystem'
import { useAchievementsStore } from './achievementsStore'
import { getAllowedCrewSizes } from '../game/crewRosters'
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
  setCrewSize: (size: number) => void
  setBaseName: (name: string) => void
  setMissionLength: (days: number) => void
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
const setupDays = savedMissionSetup.maxDays || 10
const setupAllowedCrew = getAllowedCrewSizes(setupDestination, setupDays)
const setupCrewSize = setupAllowedCrew.includes(savedMissionSetup.crewSize || 0)
  ? savedMissionSetup.crewSize!
  : setupAllowedCrew[0]

const startingState: GameState = {
  ...initialGameState(setupDestination, setupCrewSize, '', undefined, {
    missionMode: 'education',
    controlMode: 'full',
    controlledRole: 'commander',
    maxDays: 10,
    difficulty: 'easy',
    objective: 'tutorial',
    scenario: 'baseline',
  }),
  missionMode: 'education',
  ...savedMissionSetup,
  destination: setupDestination,
  crewSize: setupCrewSize,
  started: false,
}

function persistSetup(state: GameState): void {
  saveMissionSetup({
    destination: state.destination,
    crewSize: state.crewSize,
    maxDays: state.maxDays,
    difficulty: state.difficulty,
    objective: state.objective,
    missionSeed: state.missionSeed,
    scenario: state.scenario,
    missionMode: state.missionMode,
    controlMode: state.controlMode,
    controlledRole: state.controlledRole,
  })
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

export const useGameStore = create<MissionState>((set, get) => ({
  ...startingState,
  savedGameExists: initialSaveExists,

  setDestination: (destination) => {
    const state = get()
    const allowed = getAllowedCrewSizes(destination, state.maxDays)
    set({
      destination,
      crewSize: allowed.includes(state.crewSize) ? state.crewSize : allowed[0],
    })
    persistSetup(get())
  },
  setMissionMode: (missionMode) => {
    set({ missionMode })
    persistSetup(get())
  },
  setControlMode: (controlMode) => {
    set({ controlMode })
    persistSetup(get())
  },
  setControlledRole: (controlledRole) => {
    if (!getAvailableCrewRoles(get().crewSize).some((role) => role.id === controlledRole)) return
    set({ controlledRole })
    persistSetup(get())
  },
  setCrewSize: (crewSize) => {
    const state = get()
    if (!getAllowedCrewSizes(state.destination, state.maxDays).includes(crewSize)) return
    const availableRoles = getAvailableCrewRoles(crewSize)
    const currentRole = state.controlledRole
    set({
      crewSize,
      controlledRole: availableRoles.some((role) => role.id === currentRole) ? currentRole : availableRoles[0].id,
    })
    persistSetup(get())
  },
  setBaseName: (baseName) => {
    set({ baseName })
    persistSetup(get())
  },
  setMissionLength: (maxDays) => {
    const state = get()
    const allowed = getAllowedCrewSizes(state.destination, maxDays)
    set({
      maxDays,
      crewSize: allowed.includes(state.crewSize) ? state.crewSize : allowed[0],
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
    const { destination, crewSize, baseName, missionSeed, maxDays, difficulty, objective, scenario, missionMode, controlMode, controlledRole } = get()
    if (!baseName.trim()) throw new Error('اكتب اسم القاعدة قبل بدء المهمة.')
    eraseSave()
    set(initialGameState(destination, crewSize, baseName, missionSeed, { maxDays, difficulty, objective, scenario, missionMode, controlMode, controlledRole }))
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
    const { destination, crewSize, baseName, missionSeed, maxDays, difficulty, objective, scenario, missionMode, controlMode, controlledRole } = get()
    eraseSave()
    set({ ...initialGameState(destination, crewSize, baseName, missionSeed, { maxDays, difficulty, objective, scenario, missionMode, controlMode, controlledRole }), savedGameExists: false })
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
    const hasAssistantManagedCrew = state.controlMode === 'specialist' &&
      getAvailableCrewRoles(state.crewSize).some((role) => role.id !== state.controlledRole)
    let next = applySleepAndAdvance(state, hasAssistantManagedCrew ? recommendCrewSupportAction(state) : undefined)
    if (next.isGameOver) {
      set(next)
      useAchievementsStore.getState().checkAchievements(next)
      get().save()
      return
    }
    const eventId = next.daysSurvived < next.maxDays ? chooseEvent(next) : null
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

  waitUntilBedtime: () => {
    set(advanceToBedtime(get()))
    get().save()
  },

  chooseTransit: (leg, choice) => {
    const next = resolveTransitDecision(get(), leg, choice)
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
      activeEvent: null,
    }
    const streakChecked = resetResourceStreakIfNeeded(withChoice)
    const depletedResource = (['energy', 'health'] as const).find((resource) => resources[resource] <= 0)
    const failureCause = depletedResource
      ? { resource: depletedResource, source: 'event' as const, eventId: active.id, choiceIndex }
      : undefined
    const next = endIfDepleted(settleAfterEvent(streakChecked, failureCause), failureCause)
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
    const availableRoles = getAvailableCrewRoles(crewSize)
    const controlledRole = availableRoles.some((role) => role.id === savedState.controlledRole)
      ? savedState.controlledRole!
      : availableRoles[0].id
    set({
      ...startingState,
      ...savedGameState,
      resources: savedVersion < 4
        ? migrateLegacyResourceUnits(savedState.resources)
        : savedState.resources,
      configVersion: 7,
      paused: false,
      maxDays: isLegacySave ? Math.max(savedState.maxDays || startingState.maxDays, 30) : savedState.maxDays || startingState.maxDays,
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
      controlledRole,
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
