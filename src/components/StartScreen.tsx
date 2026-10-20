import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertTriangle, ArrowLeft, ArrowRight, BookOpen, ChevronDown, Copy, Database, Moon, Radar, Rocket, Shuffle, Volume2, VolumeX } from 'lucide-react'
import ar from '../i18n/ar'
import en from '../i18n/en'
import { useGameStore } from '../store/gameStore'
import { useSettingsStore } from '../store/settingsStore'
import { LanguageSwitch } from './LanguageSwitch'
import { SCENARIOS, type ScenarioId } from '../game/scenarios'
import { CREW_ROLES, getMissionCrewAssignments } from '../game/teamwork'
import { useSound } from '../hooks/useSound'
import { getAllowedCrewSizes, getCrewRoster, localizeCrewRole } from '../game/crewRosters'
import { LearningAcademy } from './LearningAcademy'
import { DataOriginsModal } from './DataOriginsModal'
import type { MissionType } from '../game/model'
import { MISSION_PROFILES } from '../game/missionProfiles'
import { OrbitalTransferVisualizer } from './OrbitalTransferVisualizer'

type SimulationSetupStep =
  | 'destination'
  | 'mission-objective'
  | 'crew-size'
  | 'control-mode'
  | 'specialist-role'
  | 'mission-details'
  | 'difficulty'
  | 'base-name'

const SIMULATION_SETUP_STEPS: readonly SimulationSetupStep[] = [
  'destination',
  'mission-objective',
  'crew-size',
  'control-mode',
  'specialist-role',
  'mission-details',
  'difficulty',
  'base-name',
]

const START_SCREEN_STATE_KEY = 'astra-one-start-screen-v1'

type StartScreenState = {
  introVisible: boolean
  modeChosen: boolean
  missionMode: 'education' | 'simulation'
  setupStep: SimulationSetupStep
  academyOpen: boolean
}

function readStartScreenState(): StartScreenState {
  const defaults: StartScreenState = {
    introVisible: true,
    modeChosen: false,
    missionMode: 'education',
    setupStep: 'destination',
    academyOpen: false,
  }
  try {
    const raw = sessionStorage.getItem(START_SCREEN_STATE_KEY)
    if (!raw) return defaults
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') throw new Error('Invalid saved start-screen state.')
    const value = parsed as Partial<StartScreenState>
    return {
      introVisible: typeof value.introVisible === 'boolean' ? value.introVisible : defaults.introVisible,
      modeChosen: typeof value.modeChosen === 'boolean' ? value.modeChosen : defaults.modeChosen,
      missionMode: value.missionMode === 'simulation' || value.missionMode === 'education' ? value.missionMode : defaults.missionMode,
      setupStep: SIMULATION_SETUP_STEPS.includes(value.setupStep as SimulationSetupStep) ? value.setupStep as SimulationSetupStep : defaults.setupStep,
      academyOpen: typeof value.academyOpen === 'boolean' ? value.academyOpen : defaults.academyOpen,
    }
  } catch (error) {
    console.error('Could not restore Astra One start-screen state.', error)
    return defaults
  }
}

export function StartScreen() {
  const language = useSettingsStore((state) => state.language)
  const t = language === 'ar' ? ar : en
  const destination = useGameStore((state) => state.destination)
  const crewSize = useGameStore((state) => state.crewSize)
  const astronautName = useGameStore((state) => state.astronautName)
  const astronautDutyId = useGameStore((state) => state.astronautDutyId)
  const baseName = useGameStore((state) => state.baseName)
  const maxDays = useGameStore((state) => state.maxDays)
  const difficulty = useGameStore((state) => state.difficulty)
  const objective = useGameStore((state) => state.objective)
  const scenario = useGameStore((state) => state.scenario)
  const missionMode = useGameStore((state) => state.missionMode)
  const missionType = useGameStore((state) => state.missionType)
  const controlMode = useGameStore((state) => state.controlMode)
  const controlledDutyId = useGameStore((state) => state.controlledDutyId)
  const missionSeed = useGameStore((state) => state.missionSeed)
  const setDestination = useGameStore((state) => state.setDestination)
  const setMissionMode = useGameStore((state) => state.setMissionMode)
  const setControlMode = useGameStore((state) => state.setControlMode)
  const setControlledDuty = useGameStore((state) => state.setControlledDuty)
  const setCrewSize = useGameStore((state) => state.setCrewSize)
  const setAstronautName = useGameStore((state) => state.setAstronautName)
  const setBaseName = useGameStore((state) => state.setBaseName)
  const setMissionLength = useGameStore((state) => state.setMissionLength)
  const setMissionType = useGameStore((state) => state.setMissionType)
  const setDifficulty = useGameStore((state) => state.setDifficulty)
  const setObjective = useGameStore((state) => state.setObjective)
  const setScenario = useGameStore((state) => state.setScenario)
  const setMissionSeed = useGameStore((state) => state.setMissionSeed)
  const randomizeMissionSeed = useGameStore((state) => state.randomizeMissionSeed)
  const startMission = useGameStore((state) => state.startMission)
  const load = useGameStore((state) => state.load)
  const savedGame = useGameStore((state) => state.savedGameExists)
  const [loadError, setLoadError] = useState('')
  const [launching, setLaunching] = useState(false)
  const [restoredView] = useState(readStartScreenState)
  const [introVisible, setIntroVisible] = useState(restoredView.introVisible)
  const [introExiting, setIntroExiting] = useState(false)
  const [confirmNewMission, setConfirmNewMission] = useState(false)
  const [modeChosen, setModeChosen] = useState(restoredView.modeChosen)
  const [setupStep, setSetupStep] = useState<SimulationSetupStep>(restoredView.setupStep)
  const [academyOpen, setAcademyOpen] = useState(restoredView.academyOpen)
  const [dataOriginsOpen, setDataOriginsOpen] = useState(false)
  const [missionPlanExpanded, setMissionPlanExpanded] = useState(false)
  const [seedCopied, setSeedCopied] = useState(false)
  const launchButtonRef = useRef<HTMLButtonElement>(null)
  const missionPlanDetailsRef = useRef<HTMLDivElement>(null)
  const seedCopyTimerRef = useRef<number | null>(null)
  const cancelConfirmationRef = useRef<HTMLButtonElement>(null)
  const confirmMissionRef = useRef<HTMLButtonElement>(null)
  const { soundEnabled, toggleSound, playLaunch, playScenario } = useSound()
  const isArabic = language === 'ar'
  const DirectionIcon = isArabic ? ArrowLeft : ArrowRight
  const missionProfile = MISSION_PROFILES[missionType]
  const missionObjectiveChoices: MissionType[] = destination === 'moon'
    ? ['moon-exploration', 'moon-settlement']
    : ['mars-opposition', 'mars-conjunction']
  const allowedCrewSizes = getAllowedCrewSizes(destination, maxDays)
    .filter((size) => size >= missionProfile.minimumCrew)
  const crewRoster = getCrewRoster(destination, maxDays, crewSize)
  const crewDuties = getMissionCrewAssignments(crewSize, destination, maxDays)
  const visibleSetupSteps = SIMULATION_SETUP_STEPS.filter((step) =>
    step !== 'specialist-role' || controlMode === 'specialist',
  )
  const setupLabels: Record<SimulationSetupStep, string> = {
    destination: t.destination,
    'mission-objective': t.missionObjective,
    'crew-size': t.crew,
    'control-mode': t.controlStyleTitle,
    'specialist-role': isArabic ? 'دور الطاقم' : 'Crew role',
    'mission-details': t.scenarioLabel,
    difficulty: t.difficulty,
    'base-name': t.baseName,
  }
  const setupProgressLabels: Record<SimulationSetupStep, string> = {
    destination: isArabic ? 'الوجهة' : 'Destination',
    'mission-objective': isArabic ? 'الهدف' : 'Objective',
    'crew-size': isArabic ? 'الطاقم' : 'Crew',
    'control-mode': isArabic ? 'التحكم' : 'Control',
    'specialist-role': isArabic ? 'الدور' : 'Role',
    'mission-details': isArabic ? 'السيناريو' : 'Scenario',
    difficulty: isArabic ? 'الصعوبة' : 'Difficulty',
    'base-name': isArabic ? 'القاعدة' : 'Base',
  }
  const setupStepComplete: Record<SimulationSetupStep, boolean> = {
    destination: destination === 'moon' || destination === 'mars',
    'mission-objective': missionObjectiveChoices.includes(missionType),
    'crew-size': allowedCrewSizes.includes(crewSize) && crewSize >= missionProfile.minimumCrew,
    'control-mode': controlMode === 'specialist' || controlMode === 'full',
    'specialist-role': crewDuties.some((duty) => duty.id === controlledDutyId),
    'mission-details': Boolean(SCENARIOS[scenario]) && missionType.startsWith(destination),
    difficulty: difficulty === 'easy' || difficulty === 'normal' || difficulty === 'hard',
    'base-name': baseName.trim().length > 0,
  }
  const isFormValid = baseName.trim().length > 0
  const currentStepIndex = visibleSetupSteps.indexOf(setupStep)
  const activeSetupStep = currentStepIndex >= 0 ? setupStep : 'control-mode'
  const activeStepIndex = visibleSetupSteps.indexOf(activeSetupStep)
  const handleDestinationChange = useCallback((target: typeof destination) => {
    setDestination(target)
    if (activeSetupStep === 'destination') setSetupStep('mission-objective')
  }, [activeSetupStep, setDestination])

  useEffect(() => {
    if (activeSetupStep !== setupStep) setSetupStep(activeSetupStep)
  }, [activeSetupStep, setupStep])

  useEffect(() => {
    if (missionPlanDetailsRef.current) missionPlanDetailsRef.current.inert = !missionPlanExpanded
  }, [missionPlanExpanded])

  useEffect(() => () => {
    if (seedCopyTimerRef.current !== null) window.clearTimeout(seedCopyTimerRef.current)
  }, [])

  useEffect(() => {
    try {
      sessionStorage.setItem(START_SCREEN_STATE_KEY, JSON.stringify({
        introVisible,
        modeChosen,
        missionMode,
        setupStep,
        academyOpen,
      } satisfies StartScreenState))
    } catch (error) {
      console.error('Could not save Astra One start-screen state.', error)
    }
  }, [academyOpen, introVisible, missionMode, modeChosen, setupStep])

  useEffect(() => {
    if (!introExiting) return
    const transitionDuration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 850
    const timeout = window.setTimeout(() => {
      setIntroVisible(false)
      setIntroExiting(false)
    }, transitionDuration)
    return () => window.clearTimeout(timeout)
  }, [introExiting])

  const chooseMode = (mode: 'education' | 'simulation') => {
    window.scrollTo({ top: 0 })
    setMissionMode(mode)
    setModeChosen(true)
    if (mode === 'education') {
      setDestination('moon')
      setCrewSize(2)
      setMissionLength(10)
      setDifficulty('easy')
      setScenario('baseline')
      setObjective('tutorial')
      setAcademyOpen(true)
    } else {
      setSetupStep('destination')
      if (objective === 'tutorial') setObjective('survival')
      if (maxDays !== 30 && maxDays !== 180) setMissionLength(30)
    }
  }

  const navigateSetup = (step: SimulationSetupStep) => {
    const targetIndex = visibleSetupSteps.indexOf(step)
    if (targetIndex < 0 || targetIndex > activeStepIndex) return
    if (targetIndex < activeStepIndex && !setupStepComplete[step]) return
    setSetupStep(step)
  }

  const advanceSetupStep = (step: SimulationSetupStep) => {
    if (activeSetupStep !== step || !setupStepComplete[step]) return
    const stepIndex = visibleSetupSteps.indexOf(step)
    const nextStep = visibleSetupSteps[stepIndex + 1]
    if (nextStep) setSetupStep(nextStep)
  }

  const advanceAfterChoice = (step: SimulationSetupStep, nextStep?: SimulationSetupStep) => {
    if (activeSetupStep !== step) return
    if (nextStep) {
      setSetupStep(nextStep)
      return
    }
    advanceSetupStep(step)
  }

  const renderNextStep = (step: SimulationSetupStep) => (
    <button
      type="button"
      className="setup-next-button"
      disabled={!setupStepComplete[step]}
      onClick={() => advanceSetupStep(step)}
    >
      <span>{isArabic ? 'الخطوة التالية' : 'Next Step'}</span>
      <DirectionIcon size={16} aria-hidden="true" />
    </button>
  )

  useEffect(() => {
    if (!confirmNewMission) return
    cancelConfirmationRef.current?.focus()
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setConfirmNewMission(false)
      if (event.key === 'Tab' && event.shiftKey && document.activeElement === cancelConfirmationRef.current) {
        event.preventDefault()
        confirmMissionRef.current?.focus()
      } else if (event.key === 'Tab' && !event.shiftKey && document.activeElement === confirmMissionRef.current) {
        event.preventDefault()
        cancelConfirmationRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      launchButtonRef.current?.focus()
    }
  }, [confirmNewMission])

  if (introVisible) {
    return (
      <main className={`mission-start mission-start-home mission-intro relative flex min-h-screen items-center justify-center overflow-hidden px-4 text-white${introExiting ? ' is-leaving' : ''}`} dir={isArabic ? 'rtl' : 'ltr'}>
        <div className="mission-intro-stars" aria-hidden="true" />
        <section className="mission-intro-panel">
          <div className="mission-intro-logo" aria-hidden="true">
            <Rocket size={25} strokeWidth={1.5} />
          </div>
          <p className="mission-intro-eyebrow">{isArabic ? 'مركز تدريب المهمات الفضائية' : 'SPACE MISSION TRAINING PROGRAM'}</p>
          <button
            type="button"
            className="mission-intro-start"
            onClick={() => {
              try {
                sessionStorage.setItem(START_SCREEN_STATE_KEY, JSON.stringify({
                  introVisible: false,
                  modeChosen: false,
                  missionMode,
                  setupStep,
                  academyOpen: false,
                } satisfies StartScreenState))
              } catch (error) {
                console.error('Could not save Astra One start-screen state.', error)
              }
              setIntroExiting(true)
            }}
            disabled={introExiting}
          >
            <span>{t.startNow}</span>
            <DirectionIcon size={17} aria-hidden="true" />
          </button>
          <span className="mission-intro-orbit-mark" aria-hidden="true" />
        </section>
      </main>
    )
  }

  const beginLaunch = () => {
    if (launching) return
    setConfirmNewMission(false)
    setLoadError('')
    setLaunching(true)
    try {
      playLaunch(scenario)
      startMission()
    } catch (error) {
      setLaunching(false)
      setLoadError(error instanceof Error ? error.message : 'Could not start a new mission.')
      setAcademyOpen(false)
    }
  }

  const handleLaunch = () => {
    if (launching) return
    if (!baseName.trim()) {
      setLoadError(t.baseNameRequired)
      setAcademyOpen(false)
      return
    }
    if (savedGame) {
      setConfirmNewMission(true)
      setAcademyOpen(false)
      return
    }
    beginLaunch()
  }

  const copySeed = async () => {
    try {
      await navigator.clipboard.writeText(String(missionSeed))
      setSeedCopied(true)
      if (seedCopyTimerRef.current !== null) window.clearTimeout(seedCopyTimerRef.current)
      seedCopyTimerRef.current = window.setTimeout(() => {
        setSeedCopied(false)
        seedCopyTimerRef.current = null
      }, 1800)
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not copy the mission seed.')
    }
  }

  if (academyOpen) {
    return <LearningAcademy onClose={() => {
      setAcademyOpen(false)
      setModeChosen(false)
    }} onLaunch={handleLaunch} />
  }

  return (
    <main className={`mission-start relative flex min-h-screen items-center justify-center overflow-hidden px-4 pb-8 pt-24 text-white sm:pt-28${modeChosen && missionMode === 'simulation' ? ' mission-setup-console' : modeChosen ? '' : ' mission-start-home'}`} dir={isArabic ? 'rtl' : 'ltr'}>
      <div className="orbit-glow pointer-events-none absolute inset-0" />
      <div className="mission-start-utilities fixed top-6 right-6 z-50 flex items-center gap-3" dir="ltr" aria-label={isArabic ? 'أدوات الصفحة' : 'Page utilities'}>
        <button
          type="button"
          onClick={() => setDataOriginsOpen(true)}
          className="mission-utility-button"
          aria-label={t.dataOriginsLabel}
          title={t.dataOriginsLabel}
        >
          <Database size={17} />
        </button>
        <button
          type="button"
          onClick={toggleSound}
          className="mission-utility-button"
          aria-label={soundEnabled ? t.muteSound : t.unmuteSound}
          title={soundEnabled ? t.muteSound : t.unmuteSound}
        >
          {soundEnabled ? <Volume2 size={17} /> : <VolumeX size={17} />}
        </button>
        <LanguageSwitch />
      </div>
      {modeChosen ? (
        <nav className="mission-page-back-nav" aria-label={isArabic ? 'التنقل' : 'Page navigation'}>
          <button
            type="button"
            onClick={() => setModeChosen(false)}
            className="mission-back-mode"
            aria-label={t.changeMissionMode}
          >
            <DirectionIcon size={16} aria-hidden="true" />
            <span>{t.changeMissionMode}</span>
          </button>
        </nav>
      ) : null}
      <header className="astra-command-header">
        <div className="flex min-w-0 items-center gap-3">
          <div className="astra-insignia" aria-hidden="true"><span>A</span></div>
          <div className="min-w-0">
            <p className="astra-brand-name">ASTRA ONE · MISSION CONTROL</p>
            <p className="astra-brand-subtitle">{t.trainingSimulatorLabel}</p>
          </div>
        </div>
        <div className="astra-header-status" dir="ltr">
          <span className="astra-status-indicator" />
          {isArabic ? 'النظام جاهز · اختر المهمة' : 'SYSTEM READY · SELECT MISSION'}
        </div>
      </header>
      <section className={`mission-start-card relative z-10 grid w-full max-w-6xl lg:grid-cols-[1fr_0.92fr]${modeChosen ? ' overflow-hidden rounded-[1.25rem] border border-white/10 bg-[#141510]' : ''}`}>
        <div className="mission-start-options p-6 sm:p-10 lg:p-12" dir={isArabic ? 'rtl' : 'ltr'}>
          {modeChosen ? <div className="mission-setup-heading mb-8">
            <p className="mission-setup-eyebrow">{missionMode === 'simulation' ? (isArabic ? 'وحدة التحكم · فحص ما قبل الرحلة' : 'MISSION COMMAND · PREFLIGHT CONSOLE') : t.flightPlanLabel}</p>
            <h2 className="mt-2 text-2xl font-black sm:text-3xl">{missionMode === 'education' ? t.educationSection : (isArabic ? 'تكوين المهمة' : 'Mission Configuration')}</h2>
            {missionMode === 'simulation' ? <p className="mt-2 text-xs leading-5 text-slate-400">{isArabic ? 'تحقق من الوجهة والطاقم وملف المهمة قبل بدء التسلسل.' : 'Verify the destination, crew, and mission profile before starting the launch sequence.'}</p> : null}
            <p className="mt-2 text-xs text-slate-500">
              {missionMode === 'simulation'
                ? `${destination === 'moon'
                  ? maxDays <= 30
                    ? (isArabic ? 'استكشاف قمري قصير' : 'Lunar exploration')
                    : (isArabic ? 'قاعدة قمرية طويلة الأمد' : 'Long-duration lunar base')
                  : maxDays <= 30
                    ? (isArabic ? 'رحلة معارضة إلى المريخ' : 'Mars opposition mission')
                    : (isArabic ? 'رحلة اقتران إلى المريخ' : 'Mars conjunction mission')} · ${maxDays} ${isArabic ? 'يومًا' : 'days'} · `
                : ''}{t.cycleSinglePlayerNote}
            </p>
            <p className="mt-3 border-s border-cyan-200/40 bg-white/[0.02] px-3 py-2 text-xs leading-5 text-slate-400">{t.singlePlayerNote}</p>
          </div> : null}

          {!modeChosen ? (
            <fieldset className="mb-7">
              <legend className="mb-3 text-sm font-bold text-slate-200">{t.chooseMode}</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                {([
                  { id: 'education' as const, title: t.trainingModulesLabel, description: t.educationDescription, icon: BookOpen, cta: t.learnExploreCta, note: t.guidedRecommendation },
                  { id: 'simulation' as const, title: t.realTimeSimulationLabel, description: t.simulationDescription, icon: Radar, cta: t.startRealMissionCta, note: t.simulationRecommendation },
                ]).map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => chooseMode(mode.id)}
                    className={`mission-mode-card mission-mode-card-${mode.id} flex h-full flex-col items-center justify-between gap-4 p-6`}
                  >
                    <span className="mission-mode-icon"><mode.icon size={25} strokeWidth={1.6} /></span>
                    <span className="mission-mode-title">{mode.title}</span>
                    <span className="mission-mode-description">{mode.description}</span>
                    <span className="mission-mode-note">{mode.note}</span>
                    <span className="mission-mode-cta">{mode.cta}<DirectionIcon size={15} /></span>
                  </button>
                ))}
              </div>
            </fieldset>
          ) : (
            <>
          {missionMode === 'simulation' ? <>
          <div className="mission-setup-workspace" dir={isArabic ? 'rtl' : 'ltr'}>
            <aside className="setup-orbit-preview" aria-label={isArabic ? 'معاينة مسار الرحلة' : 'Orbital transfer preview'}>
              <div className="setup-orbit-preview-heading">
                <span className="mission-live-dot" aria-hidden="true" />
                <div>
                  <p>{isArabic ? 'معاينة المسار' : 'MISSION TRAJECTORY'}</p>
                  <strong>{destination === 'moon' ? t.moon : t.mars}</strong>
                </div>
              </div>
              <OrbitalTransferVisualizer destination={destination} onDestinationChange={handleDestinationChange} />
            </aside>
            <section className="mission-setup-controls" aria-label={isArabic ? 'خيارات إعداد المهمة' : 'Mission setup options'}>
              <nav className="mission-setup-progress" aria-label={isArabic ? 'خطوات إعداد المهمة' : 'Mission setup steps'}>
                {visibleSetupSteps.map((step, index) => (
                  <button
                    type="button"
                    key={step}
                    className={`mission-setup-progress-step${index % 2 === 0 ? ' is-label-top' : ' is-label-bottom'}${setupStepComplete[step] ? ' is-complete' : ' is-pending'}${activeSetupStep === step ? ' is-current' : ''}`}
                    aria-label={`${index + 1}. ${setupLabels[step]}: ${setupStepComplete[step] ? (isArabic ? 'مكتمل' : 'complete') : (isArabic ? 'قيد الانتظار' : 'pending')}`}
                    aria-current={activeSetupStep === step ? 'step' : undefined}
                    disabled={index > activeStepIndex || (index < activeStepIndex && !setupStepComplete[step])}
                    onClick={() => navigateSetup(step)}
                  >
                    <span className="mission-setup-progress-label">
                      <span>{index + 1}.</span> {setupProgressLabels[step]}
                    </span>
                    <span className="mission-setup-progress-node" aria-hidden="true" />
                  </button>
                ))}
              </nav>
              <div className="mission-setup-track" dir={isArabic ? 'rtl' : 'ltr'}>
          <fieldset id="setup-destination" className="mission-setup-card" hidden={activeSetupStep !== 'destination'}>
            <legend className="mb-3 text-sm font-bold text-slate-200">{t.destination}</legend>
            <div className="setup-destination-choices" role="group" aria-label={t.destination}>
              {([
                {
                  id: 'moon' as const,
                  name: t.moon,
                  description: isArabic ? 'ميدان الاختبار التكتيكي' : 'Tactical Proving Ground',
                },
                {
                  id: 'mars' as const,
                  name: t.mars,
                  description: isArabic ? 'الأفق الرئيسي' : 'Primary Horizon',
                },
              ]).map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={`setup-destination-choice${destination === option.id ? ' is-selected' : ''}`}
                  onClick={() => {
                    handleDestinationChange(option.id)
                    advanceAfterChoice('destination', 'mission-objective')
                  }}
                  aria-pressed={destination === option.id}
                >
                  <span className={`setup-planet-preview setup-planet-${option.id}`} aria-hidden="true" />
                  <span className="setup-destination-choice-copy">
                    <strong>{option.name}</strong>
                    <span>{option.description}</span>
                  </span>
                </button>
              ))}
            </div>
            {renderNextStep('destination')}
          </fieldset>

          <fieldset id="setup-mission-objective" className="mission-setup-card" hidden={activeSetupStep !== 'mission-objective'}>
            <legend className="mb-2 text-sm font-bold text-slate-200">{t.missionObjective}</legend>
            <div className="grid grid-cols-2 gap-2">
              {missionObjectiveChoices.map((profileId) => {
                const profile = MISSION_PROFILES[profileId]
                return (
                <button
                  key={profileId}
                  type="button"
                  onClick={() => {
                    setMissionType(profileId)
                    setObjective(profile.objective)
                    advanceAfterChoice('mission-objective', 'crew-size')
                  }}
                  className={`rounded-xl border px-3 py-3 text-start text-sm font-bold transition ${missionType === profileId ? 'border-cyan-300/60 bg-cyan-300/10 text-cyan-100' : 'border-white/10 bg-white/[0.03] text-slate-400 hover:bg-white/[0.06]'}`}
                  aria-pressed={missionType === profileId}
                >
                  <span className="block">{profile.goal[language]}</span>
                  <span className="mt-1 block text-[10px] font-normal leading-5 text-slate-400">{profile.goalDescription[language]}</span>
                </button>
                )
              })}
            </div>
            <p className="mt-2 text-[10px] leading-5 text-slate-500">{t.missionTypeDurationNote}</p>
            <section className="mission-plan-card mt-4 rounded-xl border border-cyan-200/15 bg-cyan-100/[0.035]">
              <button
                type="button"
                className="mission-plan-toggle"
                aria-expanded={missionPlanExpanded}
                aria-controls="mission-field-plan-details"
                onClick={() => setMissionPlanExpanded((expanded) => !expanded)}
              >
                <span>
                  <span className="block text-[10px] font-black uppercase tracking-wider text-cyan-100">{t.missionRequirements}</span>
                  <span className="mt-1 block text-xs font-bold text-slate-200">{missionProfile.goal[language]}</span>
                </span>
                <span className="mission-plan-toggle-label">
                  {missionPlanExpanded ? t.hideMissionDetails : t.showMissionDetails}
                  <ChevronDown size={15} aria-hidden="true" />
                </span>
              </button>
              <div
                ref={missionPlanDetailsRef}
                id="mission-field-plan-details"
                className={`mission-plan-disclosure${missionPlanExpanded ? ' is-expanded' : ''}`}
                aria-hidden={!missionPlanExpanded}
              >
                <div className="mission-plan-disclosure-inner">
                  <div className="border-t border-cyan-200/10 p-4">
                    <p className="text-[11px] leading-5 text-slate-300">
                      {t.minimumCrew}: {missionProfile.minimumCrew} {t.crew}
                    </p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div>
                        <h4 className="text-[11px] font-bold text-slate-200">{t.requiredEquipment}</h4>
                        <ul className="mt-1 space-y-1 text-[10px] leading-5 text-slate-400">
                          {missionProfile.equipment.map((item) => <li key={item.en}>• {item[language]}</li>)}
                        </ul>
                      </div>
                      <div>
                        <h4 className="text-[11px] font-bold text-slate-200">{t.dailySurfaceActivities}</h4>
                        <ul className="mt-1 space-y-1 text-[10px] leading-5 text-slate-400">
                          {missionProfile.dailyActivities.map((item) => <li key={item.en}>• {item[language]}</li>)}
                        </ul>
                      </div>
                    </div>
                    <p className="mt-3 text-[10px] leading-5 text-slate-500">{t.missionProfileDisclaimer}</p>
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                      {missionProfile.sources.map((source) => (
                        <a key={source.url} href={source.url} target="_blank" rel="noreferrer" className="text-[10px] text-sky-200 underline decoration-sky-200/30 underline-offset-2 hover:text-white">
                          {source.label[language]}
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </section>
            {renderNextStep('mission-objective')}
          </fieldset>

          <div id="setup-crew-size" className="mission-setup-card" hidden={activeSetupStep !== 'crew-size'}>
            <label htmlFor="crew-size" className="mb-2 block text-sm font-bold text-slate-200">{t.crew}</label>
            <div className="mission-crew-slider-card">
              <div className="flex items-end justify-between gap-3">
                <span className="text-xs text-slate-400">{isArabic ? 'حجم الطاقم' : 'CREW COMPLEMENT'}</span>
                <strong>{crewSize} <span>{t.crew}</span></strong>
              </div>
              <input
                id="crew-size"
                type="range"
                min={0}
                max={Math.max(0, allowedCrewSizes.length - 1)}
                step={1}
                value={Math.max(0, allowedCrewSizes.indexOf(crewSize))}
                aria-valuetext={`${crewSize} ${t.crew}`}
                aria-label={t.crew}
                disabled={allowedCrewSizes.length < 2}
                onChange={(event) => {
                  const nextSize = allowedCrewSizes[Number(event.currentTarget.value)]
                  if (nextSize !== undefined) {
                    setCrewSize(nextSize)
                    advanceAfterChoice('crew-size', 'control-mode')
                  }
                }}
              />
              <div className="flex justify-between text-[10px] text-slate-500" aria-hidden="true">
                {allowedCrewSizes.map((size) => <span key={size}>{size}</span>)}
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {allowedCrewSizes.map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => {
                    setCrewSize(size)
                    advanceAfterChoice('crew-size', 'control-mode')
                  }}
                  className={`rounded-md border px-3 py-3 text-sm font-bold transition ${crewSize === size ? 'border-cyan-200/50 bg-cyan-100/[0.06] text-cyan-100' : 'border-white/10 bg-white/[0.02] text-slate-400 hover:bg-white/[0.05]'}`}
                  aria-pressed={crewSize === size}
                >
                  👩‍🚀 {size}
                </button>
              ))}
            </div>
            {crewRoster ? (
              <div className="mt-3 rounded-xl border border-cyan-200/10 bg-cyan-100/[0.03] p-3" aria-live="polite">
                <p className="text-[10px] font-black uppercase tracking-wider text-cyan-100">{crewRoster.label} · {crewRoster.crewSize} {t.crew}</p>
                <ul className="mt-2 grid gap-1 text-[11px] text-slate-300 sm:grid-cols-2">
                  {crewRoster.assignments.map((assignment) => (
                    <li key={assignment.title}>{assignment.count > 1 ? `${assignment.count} × ` : ''}{localizeCrewRole(assignment.title, language)}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {renderNextStep('crew-size')}
          </div>

          <fieldset id="setup-control-mode" className="mission-setup-card" hidden={activeSetupStep !== 'control-mode'}>
            <legend className="mb-3 text-sm font-bold text-slate-200">{t.controlStyleTitle}</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {(['full', 'specialist'] as const).map((style) => (
                <button
                  key={style}
                  type="button"
                  onClick={() => {
                    setControlMode(style)
                    advanceAfterChoice('control-mode', style === 'specialist' ? 'specialist-role' : 'mission-details')
                  }}
                  aria-pressed={controlMode === style}
                  className={`rounded-xl border p-4 text-start transition disabled:cursor-not-allowed disabled:opacity-50 ${controlMode === style ? 'border-cyan-200/50 bg-cyan-100/[0.07] text-cyan-50' : 'border-white/10 bg-white/[0.02] text-slate-300 hover:bg-white/[0.05]'}`}
                >
                  <span className="block text-sm font-bold">{style === 'full' ? (isArabic ? 'الساحة الكاملة · تحكم كامل بالطاقم' : 'Full Sandbox · Full Crew Control') : t.specialistControlTitle}</span>
                  <span className="mt-1 block text-xs leading-5 text-slate-400">{style === 'full' ? t.fullControlDescription : t.specialistControlDescription}</span>
                </button>
              ))}
            </div>
            {renderNextStep('control-mode')}
          </fieldset>

          {controlMode === 'specialist' ? <fieldset id="setup-specialist-role" className="mission-setup-card" hidden={activeSetupStep !== 'specialist-role'}>
            <legend className="mb-3 text-sm font-bold text-slate-200">{isArabic ? 'اختر دورك في الطاقم' : 'Choose your crew role'}</legend>
            {crewDuties.filter((duty) => duty.specialty === 'command').length > 1 ? (
              <p className="mb-3 rounded-lg border border-cyan-200/15 bg-cyan-100/[0.035] px-3 py-2 text-xs leading-5 text-cyan-100/80">
                {isArabic
                  ? 'يتضمن تشكيل الطاقم قائدًا ومساعد قائد. اختر الدور الذي تريد التحكم به.'
                  : 'This crew roster has a Commander and Co-Commander. Choose which role you want to control.'}
              </p>
            ) : null}
            <div className="grid grid-cols-2 gap-2">
              {crewDuties.map((duty) => {
                const role = CREW_ROLES.find((candidate) => candidate.id === duty.controlRole)
                if (!role) throw new Error(`Missing control profile for crew duty "${duty.id}".`)
                return (
                  <button
                    key={duty.id}
                    type="button"
                    onClick={() => {
                      setControlledDuty(duty.id)
                      advanceAfterChoice('specialist-role', 'mission-details')
                    }}
                    aria-pressed={controlledDutyId === duty.id}
                    className={`rounded-lg border px-3 py-3 text-start transition ${controlledDutyId === duty.id ? 'border-violet-200/50 bg-violet-100/[0.07] text-violet-100' : 'border-white/10 bg-white/[0.02] text-slate-400'}`}
                  >
                    <span className="block text-sm font-bold">{role.icon} {localizeCrewRole(duty.title, language)}</span>
                    <span className="mt-1 block text-[11px] leading-5 text-slate-400">
                      {language === 'ar' ? duty.duty.ar : duty.duty.en}
                    </span>
                  </button>
                )
              })}
            </div>
            {renderNextStep('specialist-role')}
          </fieldset> : null}

          <fieldset id="setup-mission-details" className="mission-setup-card" hidden={activeSetupStep !== 'mission-details'}>
            <legend className="mb-2 text-sm font-bold text-slate-200">{t.scenarioLabel}</legend>
            <div className="grid gap-2">
              {(Object.keys(SCENARIOS) as ScenarioId[]).map((scenarioId) => (
                <button
                  key={scenarioId}
                  type="button"
                  onClick={() => {
                    setScenario(scenarioId)
                    playScenario(scenarioId)
                    advanceAfterChoice('mission-details', 'difficulty')
                  }}
                  className={`scenario-choice flex items-start gap-3 border px-3 py-3 text-start transition ${scenario === scenarioId ? 'scenario-choice-active border-cyan-200/50 bg-cyan-100/[0.06] text-cyan-50' : 'border-white/10 bg-white/[0.02] text-slate-400 hover:border-white/20'}`}
                  aria-pressed={scenario === scenarioId}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center border border-current/20 font-mono text-lg">{SCENARIOS[scenarioId].icon}</span>
                  <span>
                    <span className="block text-sm font-bold">{SCENARIOS[scenarioId].name[language]}</span>
                    <span className="mt-1 block text-[11px] leading-5 text-slate-500">{SCENARIOS[scenarioId].description[language]}</span>
                  </span>
                </button>
              ))}
            </div>
            <div className="mt-5">
              <p className="mb-2 text-sm font-bold text-slate-200">{t.missionObjective}: {missionProfile.goal[language]}</p>
              <p className="text-xs leading-5 text-slate-400">{missionProfile.goalDescription[language]}</p>
            </div>
            {renderNextStep('mission-details')}
          </fieldset>

          <fieldset id="setup-difficulty" className="mission-setup-card" hidden={activeSetupStep !== 'difficulty'}>
            <legend className="mb-2 text-sm font-bold text-slate-200">{t.difficulty}</legend>
            <div className="grid grid-cols-3 gap-2">
              {(['easy', 'normal', 'hard'] as const).map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => {
                    setDifficulty(level)
                    advanceAfterChoice('difficulty', 'base-name')
                  }}
                  className={`rounded-md border px-2 py-3 text-sm font-bold transition ${difficulty === level ? 'border-cyan-200/50 bg-cyan-100/[0.06] text-cyan-100' : 'border-white/10 bg-white/[0.02] text-slate-400 hover:bg-white/[0.05]'}`}
                  aria-pressed={difficulty === level}
                >
                  <span className={`setup-difficulty-indicator is-${level}`} aria-hidden="true" />
                  {t[level]}
                  <small className="setup-difficulty-recovery">{level === 'easy' ? '98%' : level === 'normal' ? '94%' : '90%'} {isArabic ? 'استرداد ماء' : 'water recovery'}</small>
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-500">{t.difficultyDescription[difficulty]}</p>
            {renderNextStep('difficulty')}
          </fieldset>

          <section id="setup-base-name" className="mission-setup-card" hidden={activeSetupStep !== 'base-name'}>
          <div className="mission-base-form-scroll">
          <fieldset className="mb-5 rounded-xl border border-cyan-200/15 bg-cyan-100/[0.035] p-4">
            <legend className="px-2 text-sm font-bold text-cyan-100">{t.astronautProfileTitle}</legend>
            <label className="block text-[11px] font-bold text-slate-200" htmlFor="astronaut-name">
              {t.astronautName}
              <input
                id="astronaut-name"
                value={astronautName}
                onChange={(event) => setAstronautName(event.target.value)}
                maxLength={40}
                autoComplete="name"
                placeholder={t.astronautNamePlaceholder}
                className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm font-normal text-white placeholder:text-slate-600"
              />
            </label>
            <p className="mt-2 text-[10px] text-slate-400">
              {t.astronautDuty}: {localizeCrewRole(crewDuties.find((duty) => duty.id === astronautDutyId)?.title || crewDuties[0]?.title || t.astronautDefaultName, language)}
            </p>
          </fieldset>
          <label htmlFor="base-name" className="mb-2 block text-sm font-bold text-slate-200">
            {t.baseName} <span className="font-normal text-cyan-200">*</span>
          </label>
          <input
            id="base-name"
            value={baseName}
            onChange={(event) => {
              setBaseName(event.target.value)
              if (event.target.value.trim()) setLoadError('')
            }}
            maxLength={32}
            placeholder={t.basePlaceholder}
            required
            aria-invalid={Boolean(loadError && !baseName.trim())}
            className="w-full rounded-md border border-white/10 bg-[#0b1725] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-200/50 focus:ring-2 focus:ring-cyan-200/10"
          />
          {!isFormValid && !loadError ? <p className="mt-2 text-xs text-amber-200">{t.baseNameRequired}</p> : null}
          <div className="mt-6">
            <label htmlFor="mission-seed" className="mb-2 block text-sm font-bold text-slate-200">{t.scenarioSeed}</label>
            <div className="flex gap-2">
              <input
                id="mission-seed"
                type="number"
                min={0}
                max={4294967295}
                step={1}
                value={missionSeed}
                onChange={(event) => {
                  const value = event.currentTarget.valueAsNumber
                  if (Number.isFinite(value)) setMissionSeed(value)
                }}
                className="min-w-0 flex-1 rounded-md border border-white/10 bg-[#0b1725] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-200/50 focus:ring-2 focus:ring-cyan-200/10"
              />
              <button type="button" onClick={randomizeMissionSeed} className="secondary-button !px-3" aria-label={t.randomizeSeed} title={t.randomizeSeed}>
                <Shuffle size={16} />
              </button>
              <button type="button" onClick={() => void copySeed()} className="secondary-button !px-3" aria-label={seedCopied ? t.seedCopied : t.copySeed} title={seedCopied ? t.seedCopied : t.copySeed}>
                <Copy size={16} />
              </button>
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-500">{seedCopied ? t.seedCopied : t.seedDescription}</p>
          </div>
          {savedGame ? (
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200/15 bg-amber-100/[0.04] p-4">
              <div>
                <p className="text-sm font-bold text-amber-100">{t.saved}</p>
                <p className="mt-1 text-xs text-slate-400">{t.pausedMissionDescription}</p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => {
                  try {
                    setLoadError('')
                    load()
                  } catch (error) {
                    setLoadError(error instanceof Error ? error.message : 'Load failed.')
                  }
                }} className="secondary-button">{t.resumeMission}</button>
              </div>
            </div>
          ) : null}
          </div>
          <footer className="mission-launch-footer">
          {loadError ? <p role="alert" className="mb-2 text-xs text-rose-300">{loadError}</p> : null}
          <button ref={launchButtonRef} type="button" onClick={handleLaunch} className="primary-button mission-initialize-button w-full" disabled={!isFormValid || launching}>
            <Rocket size={18} />
            {launching ? (isArabic ? 'جارٍ تهيئة الإطلاق…' : 'INITIALIZING LAUNCH…') : (isArabic ? 'تهيئة إطلاق المهمة' : 'INITIALIZE MISSION LAUNCH')}
            <DirectionIcon size={17} />
          </button>
          </footer>
          </section>
          </div>
            </section>
          </div>
          </> : (
            <section className="mx-auto w-full max-w-2xl rounded-xl border border-cyan-200/15 bg-cyan-100/[0.035] p-5">
              <p className="text-sm font-bold text-cyan-100">👩‍🚀 {t.educationSection}</p>
              <p className="mt-2 text-xs leading-6 text-slate-300">{t.educationDescription}</p>
              <label className="mt-5 block text-[11px] font-bold text-slate-200" htmlFor="astronaut-name">
                {t.astronautName}
                <input
                  id="astronaut-name"
                  value={astronautName}
                  onChange={(event) => setAstronautName(event.target.value)}
                  maxLength={40}
                  autoComplete="name"
                  placeholder={t.astronautNamePlaceholder}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm font-normal text-white placeholder:text-slate-600"
                />
              </label>
              <label htmlFor="base-name" className="mt-4 block text-[11px] font-bold text-slate-200">
                {t.baseName} <span className="font-normal text-cyan-200">*</span>
                <input
                  id="base-name"
                  value={baseName}
                  onChange={(event) => {
                    setBaseName(event.target.value)
                    if (event.target.value.trim()) setLoadError('')
                  }}
                  maxLength={32}
                  placeholder={t.basePlaceholder}
                  required
                  aria-invalid={Boolean(loadError && !baseName.trim())}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm font-normal text-white placeholder:text-slate-600"
                />
              </label>
              <button ref={launchButtonRef} type="button" onClick={handleLaunch} className="primary-button mission-initialize-button mt-5 w-full" disabled={launching}>
                <Rocket size={18} />
                {launching ? (isArabic ? 'جارٍ تهيئة الإطلاق…' : 'INITIALIZING LAUNCH…') : t.launch}
                <DirectionIcon size={17} />
              </button>
              {loadError ? <p role="alert" className="mt-3 text-xs text-rose-300">{loadError}</p> : null}
            </section>
          )}

            </>
          )}
        </div>
      </section>
      {dataOriginsOpen ? <DataOriginsModal onClose={() => setDataOriginsOpen(false)} /> : null}
      <div className="absolute bottom-4 flex items-center gap-2 text-[10px] font-medium tracking-[0.24em] text-slate-600">
        <Moon size={12} /> {t.trainingSimulatorLabel}
      </div>
      {confirmNewMission ? (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setConfirmNewMission(false)
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-mission-title"
            aria-describedby="new-mission-description"
            className="modal-card max-w-md"
            dir={isArabic ? 'rtl' : 'ltr'}
          >
            <div className="flex items-start gap-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-amber-200/20 bg-amber-100/[0.07] text-amber-200">
                <AlertTriangle size={20} aria-hidden="true" />
              </span>
              <div>
                <p className="eyebrow text-amber-200/80">{t.projectLabel}</p>
                <h2 id="new-mission-title" className="mt-2 text-xl font-black text-white">{t.newMission}</h2>
                <p id="new-mission-description" className="mt-2 text-sm leading-6 text-slate-300">{t.newMissionConfirm}</p>
              </div>
            </div>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                ref={cancelConfirmationRef}
                type="button"
                onClick={() => setConfirmNewMission(false)}
                className="secondary-button min-h-11 px-5"
              >
                {t.close}
              </button>
              <button ref={confirmMissionRef} type="button" onClick={beginLaunch} className="primary-button min-h-11 px-5">
                <Rocket size={16} aria-hidden="true" />
                {t.startOver}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  )
}
