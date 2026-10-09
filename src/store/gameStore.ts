import { create } from 'zustand'
import { createMissionRunId, recordTutorialStep as applyTutorialStep, resetResourceStreakIfNeeded, type Action, type Destination, type GameState, type MissionDifficulty, type MissionObjective, type TutorialStep } from '../game/model'
import type { ScenarioId } from '../game/scenarios'
import {
  buildInState,
  endIfDepleted,
  finishDay,
  initialGameState,
  settleAfterEvent,
  toggleBuildingInState,
} from '../game/model'
import { canChooseEventOption, chooseEvent, EVENTS } from '../game/events'
import { deleteSave as eraseSave, hasSavedGame, loadGame as readGame, loadMissionSetup, saveGame as writeGame, saveMissionSetup } from '../utils/saveSystem'
import { useAchievementsStore } from './achievementsStore'

type MissionState = GameState & {
  savedGameExists: boolean
  startMission: () => void
  newMission: () => void
  replayMission: () => void
  endMission: () => void
  setDestination: (destination: Destination) => void
  setCrewSize: (size: number) => void
  setBaseName: (name: string) => void
  setMissionLength: (days: number) => void
  setDifficulty: (difficulty: MissionDifficulty) => void
  setObjective: (objective: MissionObjective) => void
  setScenario: (scenario: ScenarioId) => void
  setMissionSeed: (seed: number) => void
  randomizeMissionSeed: () => void
  markTutorialStep: (step: TutorialStep) => void
  pauseAndReturnToMain: () => void
  advanceDay: (action: Action) => void
  resolveEvent: (choiceIndex: number) => void
  buildBuilding: (buildingId: string) => void
  toggleBuilding: (buildingId: string) => void
  completeLesson: (id: number, preCorrect: boolean) => void
  save: () => void
  load: () => void
  deleteSave: () => void
}

const startingState: GameState = {
  ...initialGameState('moon', 2, ''),
  ...loadMissionSetup(),
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
  })
}

function applyEventConsequences(state: GameState, eventId: string): GameState {
  const next = { ...state, resources: { ...state.resources } }
  if (eventId === 'water-leak') next.resources.water = Math.max(0, next.resources.water - 20)
  if (eventId === 'solar-storm') {
    const shelterOnline = state.buildings.includes('storm-shelter') && !(state.offlineBuildings || []).includes('storm-shelter')
    next.resources.health = Math.max(0, next.resources.health - (shelterOnline ? 2 : 14))
    next.radiationExposure = Math.min(100, state.radiationExposure + (shelterOnline ? 8 : 24))
    if (shelterOnline) next.lastMessage = 'حماكم ملجأ العواصف من معظم الإشعاع.'
  }
  if (eventId === 'low-light') next.resources.energy = Math.max(0, next.resources.energy - 8)
  if (eventId === 'crop-failure') next.resources.food = Math.max(0, next.resources.food - 10)
  return resetResourceStreakIfNeeded(next)
}

const initialSaveExists = hasSavedGame()

export const useGameStore = create<MissionState>((set, get) => ({
  ...startingState,
  savedGameExists: initialSaveExists,

  setDestination: (destination) => {
    set({ destination })
    persistSetup(get())
  },
  setCrewSize: (crewSize) => {
    set({ crewSize })
    persistSetup(get())
  },
  setBaseName: (baseName) => {
    set({ baseName })
    persistSetup(get())
  },
  setMissionLength: (maxDays) => {
    set({ maxDays })
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
  setMissionSeed: (missionSeed) => {
    set({ missionSeed: Math.max(0, Math.min(0xffff_ffff, Math.floor(missionSeed))) })
    persistSetup(get())
  },
  randomizeMissionSeed: () => {
    set({ missionSeed: Math.floor(Math.random() * 0x1_0000_0000) })
    persistSetup(get())
  },
  markTutorialStep: (step) => {
    const next = applyTutorialStep(get(), step)
    set(next)
    useAchievementsStore.getState().checkAchievements(next)
  },
  pauseAndReturnToMain: () => {
    const pausedState: GameState = { ...get(), started: false, paused: true }
    writeGame(pausedState)
    set({ ...pausedState, savedGameExists: true })
  },

  startMission: () => {
    const { destination, crewSize, baseName, missionSeed, maxDays, difficulty, objective, scenario } = get()
    if (!baseName.trim()) throw new Error('اكتب اسم القاعدة قبل بدء المهمة.')
    eraseSave()
    set(initialGameState(destination, crewSize, baseName, missionSeed, { maxDays, difficulty, objective, scenario }))
    set({ savedGameExists: false })
    persistSetup(get())
  },

  newMission: () => {
    eraseSave()
    set({ ...initialGameState('moon', 2, ''), started: false, savedGameExists: false })
    persistSetup(get())
  },
  replayMission: () => {
    const { destination, crewSize, baseName, missionSeed, maxDays, difficulty, objective, scenario } = get()
    eraseSave()
    set({ ...initialGameState(destination, crewSize, baseName, missionSeed, { maxDays, difficulty, objective, scenario }), savedGameExists: false })
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
    let next = finishDay(state, action)
    if (next.isGameOver) {
      set(next)
      useAchievementsStore.getState().checkAchievements(next)
      return
    }
    const eventId = chooseEvent(next)
    if (eventId) {
      next = applyEventConsequences(next, eventId)
      next.day = state.day
      next.activeEvent = { id: eventId }
      set(next)
      useAchievementsStore.getState().checkAchievements(next)
      return
    }
    set(next)
    useAchievementsStore.getState().checkAchievements(next)
    if (next.daysSurvived > 0 && next.daysSurvived % 3 === 0) get().save()
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
      const cap = resource === 'energy' && state.buildings.includes('battery') && !(state.offlineBuildings || []).includes('battery')
        ? 150
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
      log: [...state.log, `اليوم ${state.day}: ${definition?.title.ar || active.id}`],
      activeEvent: null,
    }
    const streakChecked = resetResourceStreakIfNeeded(withChoice)
    const next = endIfDepleted(settleAfterEvent(streakChecked))
    set(next)
    useAchievementsStore.getState().checkAchievements(next)
    if (!next.isGameOver && next.daysSurvived > 0 && next.daysSurvived % 3 === 0) get().save()
  },

  buildBuilding: (buildingId) => {
    const next = buildInState(get(), buildingId)
    set(next)
    useAchievementsStore.getState().checkAchievements(next)
  },
  toggleBuilding: (buildingId) => {
    set(toggleBuildingInState(get(), buildingId))
  },

  completeLesson: (id, preCorrect) => {
    const lessonsCompleted = get().lessonsCompleted.includes(id)
      ? get().lessonsCompleted
      : [...get().lessonsCompleted, id]
    const lessonResults = {
      ...get().lessonResults,
      [id]: { preCorrect, postCorrect: true },
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
    const isLegacySave = !savedState.configVersion
    set({
      ...startingState,
      ...savedState,
      configVersion: 2,
      paused: false,
      maxDays: isLegacySave ? Math.max(savedState.maxDays || startingState.maxDays, 30) : savedState.maxDays || startingState.maxDays,
      difficulty: savedState.difficulty || 'normal',
      objective: savedState.objective || 'survival',
      scenario: savedState.scenario || 'baseline',
      resourceStreak: savedState.resourceStreak || 0,
      tutorialSteps: savedState.tutorialSteps || [],
      successfulExpeditions: savedState.successfulExpeditions || 0,
      runId: savedState.runId || createMissionRunId(),
      fatigue: savedState.fatigue ?? startingState.fatigue,
      morale: savedState.morale ?? startingState.morale,
      radiationExposure: savedState.radiationExposure ?? 0,
      missionSeed: savedState.missionSeed ?? Math.floor(Math.random() * 0x1_0000_0000),
      offlineBuildings: savedState.offlineBuildings ?? [],
      started: true,
      activeEvent: savedState.activeEvent ?? null,
      savedGameExists: true,
    })
    useAchievementsStore.getState().checkAchievements(get())
  },
  deleteSave: () => {
    eraseSave()
    set({ savedGameExists: false })
  },
}))
