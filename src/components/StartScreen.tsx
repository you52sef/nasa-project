import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, ArrowLeft, ArrowRight, Copy, Moon, Rocket, Shuffle, Volume2, VolumeX } from 'lucide-react'
import ar from '../i18n/ar'
import en from '../i18n/en'
import { useGameStore } from '../store/gameStore'
import { useSettingsStore } from '../store/settingsStore'
import { LanguageSwitch } from './LanguageSwitch'
import { ModelDisclosure } from './ModelDisclosure'
import { SCENARIOS, type ScenarioId } from '../game/scenarios'
import { getAvailableCrewRoles } from '../game/teamwork'
import { EVENTS } from '../game/events'
import { useSound } from '../hooks/useSound'
import { estimateTransfer } from '../game/flightPhysics'

export function StartScreen() {
  const language = useSettingsStore((state) => state.language)
  const t = language === 'ar' ? ar : en
  const destination = useGameStore((state) => state.destination)
  const crewSize = useGameStore((state) => state.crewSize)
  const baseName = useGameStore((state) => state.baseName)
  const maxDays = useGameStore((state) => state.maxDays)
  const difficulty = useGameStore((state) => state.difficulty)
  const objective = useGameStore((state) => state.objective)
  const scenario = useGameStore((state) => state.scenario)
  const missionMode = useGameStore((state) => state.missionMode)
  const controlMode = useGameStore((state) => state.controlMode)
  const controlledRole = useGameStore((state) => state.controlledRole)
  const missionSeed = useGameStore((state) => state.missionSeed)
  const setDestination = useGameStore((state) => state.setDestination)
  const setMissionMode = useGameStore((state) => state.setMissionMode)
  const setControlMode = useGameStore((state) => state.setControlMode)
  const setControlledRole = useGameStore((state) => state.setControlledRole)
  const setCrewSize = useGameStore((state) => state.setCrewSize)
  const setBaseName = useGameStore((state) => state.setBaseName)
  const setMissionLength = useGameStore((state) => state.setMissionLength)
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
  const [confirmNewMission, setConfirmNewMission] = useState(false)
  const [modeChosen, setModeChosen] = useState(false)
  const [seedCopied, setSeedCopied] = useState(false)
  const launchButtonRef = useRef<HTMLButtonElement>(null)
  const cancelConfirmationRef = useRef<HTMLButtonElement>(null)
  const confirmMissionRef = useRef<HTMLButtonElement>(null)
  const { soundEnabled, toggleSound, playLaunch, playScenario } = useSound()
  const isArabic = language === 'ar'
  const DirectionIcon = isArabic ? ArrowLeft : ArrowRight
  const transferEstimate = estimateTransfer(destination === 'moon' ? 'earth-moon' : 'earth-mars')

  const chooseMode = (mode: 'education' | 'simulation') => {
    setMissionMode(mode)
    setModeChosen(true)
    if (mode === 'education') {
      setDestination('moon')
      setCrewSize(2)
      setMissionLength(10)
      setDifficulty('easy')
      setScenario('baseline')
      setObjective('tutorial')
    } else if (objective === 'tutorial') {
      setObjective('survival')
    }
  }

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
    }
  }

  const handleLaunch = () => {
    if (launching) return
    if (!baseName.trim()) {
      setLoadError(t.baseNameRequired)
      return
    }
    if (savedGame) {
      setConfirmNewMission(true)
      return
    }
    beginLaunch()
  }

  const copySeed = async () => {
    try {
      await navigator.clipboard.writeText(String(missionSeed))
      setSeedCopied(true)
      window.setTimeout(() => setSeedCopied(false), 1800)
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not copy the mission seed.')
    }
  }

  return (
    <main className="mission-start relative flex min-h-screen items-center justify-center overflow-hidden px-4 pb-8 pt-24 text-white sm:pt-28" dir={isArabic ? 'rtl' : 'ltr'}>
      <div className="orbit-glow pointer-events-none absolute inset-0" />
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
      <section className="mission-start-card relative z-10 grid w-full max-w-6xl overflow-hidden rounded-[1.25rem] border border-white/10 bg-[#141510] lg:grid-cols-[1fr_0.92fr]">
        <div className="mission-start-copy relative flex min-h-[330px] flex-col justify-between overflow-hidden border-e border-white/[0.06] bg-[#171712] p-7 sm:p-11 lg:min-h-[650px]">
          <div className="relative flex items-center justify-between">
            <span className="eyebrow"><span className="h-1.5 w-1.5 rounded-full bg-emerald-300" /> {t.projectLabel}</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleSound}
                className="icon-button !h-9 !w-9"
                aria-label={soundEnabled ? t.muteSound : t.unmuteSound}
                title={soundEnabled ? t.muteSound : t.unmuteSound}
              >
                {soundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
              </button>
              <LanguageSwitch />
            </div>
          </div>
          <div className="relative my-6 sm:my-8">
            <div className="mission-orbit-scene" role="img" aria-label={`${t.homePlanet} → ${destination === 'moon' ? t.moon : t.mars}`}>
              <svg className="mission-transfer-map" viewBox="0 0 420 210" fill="none" aria-hidden="true">
                <defs>
                  <linearGradient id="transfer-route-gradient" x1="52" y1="155" x2="337" y2="73" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#7CE4DC" stopOpacity=".05" />
                    <stop offset=".52" stopColor="#7CE4DC" stopOpacity=".75" />
                    <stop offset="1" stopColor="#F1C28A" stopOpacity=".28" />
                  </linearGradient>
                  <filter id="transfer-node-glow" x="-100%" y="-100%" width="300%" height="300%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                  </filter>
                </defs>
                <ellipse className="mission-orbit-ring" cx="90" cy="105" rx="60" ry="35" transform="rotate(-27 90 105)" />
                <ellipse className="mission-orbit-ring mission-orbit-ring-target" cx="331" cy="97" rx="78" ry="43" transform="rotate(-27 331 97)" />
                <path className="mission-transfer-trail" d="M52 154C107 32 234 24 336 76" stroke="url(#transfer-route-gradient)" strokeDasharray="4 7" />
                <circle className="mission-orbit-origin" cx="69" cy="142" r="5" />
                <circle className="mission-orbit-ping" cx="69" cy="142" r="5" filter="url(#transfer-node-glow)" />
                <circle className="mission-transfer-craft" r="3.5" fill="#E9FFFF" filter="url(#transfer-node-glow)">
                  <animateMotion dur="8s" repeatCount="indefinite" path="M52 154C107 32 234 24 336 76" />
                </circle>
              </svg>
              <div className="mission-orbit-origin-label" dir="ltr">{t.homePlanet}</div>
              <div
                className={`mission-planet mission-planet-${destination}`}
                role="img"
                aria-label={destination === 'moon' ? t.moon : t.mars}
              >
                <span className="planet-surface" />
                <span className="planet-orbit" aria-hidden="true">
                  <span className="planet-satellite" />
                </span>
              </div>
              <div className="mission-orbit-target-label">{destination === 'moon' ? t.moon : t.mars}</div>
              <div className="mission-orbit-readout" dir="ltr"><span className="mission-live-dot" /> TRANSFER SOLUTION · IDEALIZED</div>
            </div>
            <div className="mission-telemetry-strip" dir={isArabic ? 'rtl' : 'ltr'}>
              <div><span>{t.estimatedTransferTimeLabel}</span><b>{transferEstimate.durationDays.toFixed(1)} {t.days}</b></div>
              <div><span>{t.departureDeltaVLabel}</span><b>{transferEstimate.departureDeltaVKmS.toFixed(2)} km/s</b></div>
              <div><span>{t.requiredPhaseAngleLabel}</span><b>{transferEstimate.phaseAngleDegrees.toFixed(1)}°</b></div>
            </div>
            <p className="mb-3 text-xs font-bold tracking-[0.28em] text-cyan-200/80">ASTRA ONE / 01</p>
            <h1 className="max-w-xl text-5xl font-black leading-[0.98] tracking-tight sm:text-7xl">{t.title}</h1>
            <p className="mt-4 text-lg font-semibold text-sky-100 sm:text-2xl">{t.tagline}</p>
            <p className="mt-4 max-w-lg text-sm leading-7 text-slate-300 sm:text-base">{t.subtitle}</p>
            <p className="mt-5 max-w-lg rounded-xl border border-amber-200/10 bg-amber-100/[0.035] p-3 text-xs leading-6 text-amber-100/70">{t.simulationLimit}</p>
            <ModelDisclosure />
          </div>
          <p className="relative text-xs text-slate-400">{t.footer}</p>
        </div>

        <div className="p-6 sm:p-10 lg:p-12" dir={isArabic ? 'rtl' : 'ltr'}>
          <div className="mb-8">
            <p className="text-xs font-bold tracking-[0.2em] text-cyan-300">{t.flightPlanLabel}</p>
            <h2 className="mt-2 text-2xl font-black sm:text-3xl">{modeChosen ? (missionMode === 'education' ? t.educationSection : t.simulationSection) : t.chooseMode}</h2>
            {modeChosen ? <p className="mt-2 text-xs text-slate-500">{missionMode === 'simulation' ? `${maxDays} ${t.operatingCyclesUnit} · ` : ''}{t.cycleSinglePlayerNote}</p> : null}
            {modeChosen ? <p className="mt-3 border-s border-cyan-200/40 bg-white/[0.02] px-3 py-2 text-xs leading-5 text-slate-400">{t.singlePlayerNote}</p> : null}
          </div>

          {!modeChosen ? (
            <fieldset className="mb-7">
              <legend className="mb-3 text-sm font-bold text-slate-200">{t.chooseMode}</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                {([
                  { id: 'education' as const, title: t.educationSection, description: t.educationDescription, icon: '👩‍🚀', note: t.guidedRecommendation },
                  { id: 'simulation' as const, title: t.simulationSection, description: t.simulationDescription, icon: '🛰️', note: t.simulationRecommendation },
                ]).map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => chooseMode(mode.id)}
                    className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-start text-slate-300 transition hover:border-cyan-200/40 hover:bg-cyan-100/[0.05]"
                  >
                    <span className="text-xl">{mode.icon}</span>
                    <span className="mt-2 block text-sm font-bold">{mode.title}</span>
                    <span className="mt-1 block text-xs leading-5 text-slate-400">{mode.description}</span>
                    <span className="mt-2 block text-[10px] leading-5 text-cyan-100/70">{mode.note}</span>
                  </button>
                ))}
              </div>
            </fieldset>
          ) : (
            <>
          <button type="button" onClick={() => setModeChosen(false)} className="secondary-button mb-5 !px-3 !py-2 text-xs">
            {t.changeMissionMode}
          </button>
          <details className="mb-6 rounded-xl border border-sky-200/15 bg-sky-100/[0.035] p-4">
            <summary className="cursor-pointer text-sm font-bold text-sky-100">{t.howToPlayTitle} · {t.eventGuideTitle}</summary>
            <p className="mt-3 text-xs leading-6 text-slate-300">{t.howToPlaySteps}</p>
            <p className="mt-2 text-xs leading-6 text-slate-400">{t.eventGuideSteps}</p>
            <details className="mt-3 rounded-lg border border-white/[0.07] bg-slate-950/30 p-3">
              <summary className="cursor-pointer text-xs font-bold text-slate-200">{t.eventPlaybookLabel} · {EVENTS.length}</summary>
              <div className="mt-3 space-y-3">
                {EVENTS.map((event) => (
                  <article key={event.id} className="border-s border-amber-200/20 ps-3">
                    <h3 className="text-xs font-bold text-amber-100">{event.icon} {event.title[language]}</h3>
                    <p className="mt-1 text-[11px] leading-5 text-slate-400">{event.description[language]}</p>
                    <ul className="mt-1 space-y-1 text-[11px] leading-5 text-slate-500">
                      {event.choices.map((choice) => <li key={choice.label.en}>• {choice.label[language]}</li>)}
                    </ul>
                  </article>
                ))}
              </div>
            </details>
            <p className="mt-3 text-[11px] leading-5 text-amber-100/70">{t.failureGuide}</p>
          </details>

          {missionMode === 'simulation' ? <>
          <fieldset className="mb-7">
            <legend className="mb-3 text-sm font-bold text-slate-200">{t.controlStyleTitle}</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {(['full', 'specialist'] as const).map((style) => (
                <button
                  key={style}
                  type="button"
                  onClick={() => setControlMode(style)}
                  aria-pressed={controlMode === style}
                  className={`rounded-xl border p-4 text-start transition ${controlMode === style ? 'border-cyan-200/50 bg-cyan-100/[0.07] text-cyan-50' : 'border-white/10 bg-white/[0.02] text-slate-300 hover:bg-white/[0.05]'}`}
                >
                  <span className="block text-sm font-bold">{style === 'full' ? t.fullControlTitle : t.specialistControlTitle}</span>
                  <span className="mt-1 block text-xs leading-5 text-slate-400">{style === 'full' ? t.fullControlDescription : t.specialistControlDescription}</span>
                </button>
              ))}
            </div>
            {controlMode === 'specialist' ? (
              <div className="mt-3 grid grid-cols-2 gap-2">
                {getAvailableCrewRoles(crewSize).map((role) => (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => setControlledRole(role.id)}
                    aria-pressed={controlledRole === role.id}
                    className={`rounded-lg border px-3 py-2 text-start text-xs transition ${controlledRole === role.id ? 'border-violet-200/50 bg-violet-100/[0.07] text-violet-100' : 'border-white/10 bg-white/[0.02] text-slate-400'}`}
                  >
                    {role.icon} {t[role.title]}
                  </button>
                ))}
              </div>
            ) : null}
          </fieldset>

          <fieldset className="mb-7">
            <legend className="mb-3 text-sm font-bold text-slate-200">{t.destination}</legend>
            <div className="grid grid-cols-2 gap-3">
              {(['moon', 'mars'] as const).map((target) => (
                <button
                  key={target}
                  type="button"
                  onClick={() => setDestination(target)}
                  className={`planet-choice ${destination === target ? 'planet-choice-active' : ''}`}
                  aria-pressed={destination === target}
                >
                  <span className="text-3xl">{target === 'moon' ? '🌙' : '🔴'}</span>
                  <span className="mt-2 font-bold">{target === 'moon' ? t.moon : t.mars}</span>
                  <span className="mt-1 text-xs text-slate-400">{target === 'moon' ? '384,400 km' : '225M km avg.'}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="mb-6">
            <legend className="mb-2 text-sm font-bold text-slate-200">{t.scenarioLabel}</legend>
            <div className="grid gap-2">
              {(Object.keys(SCENARIOS) as ScenarioId[]).map((scenarioId) => (
                <button
                  key={scenarioId}
                  type="button"
                  onClick={() => {
                    setScenario(scenarioId)
                    playScenario(scenarioId)
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
          </fieldset>

          <div className="mb-6">
            <label htmlFor="crew-size" className="mb-2 block text-sm font-bold text-slate-200">{t.crew}</label>
            <div className="grid grid-cols-3 gap-2">
              {[2, 3, 4].map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => setCrewSize(size)}
                  className={`rounded-md border px-3 py-3 text-sm font-bold transition ${crewSize === size ? 'border-cyan-200/50 bg-cyan-100/[0.06] text-cyan-100' : 'border-white/10 bg-white/[0.02] text-slate-400 hover:bg-white/[0.05]'}`}
                  aria-pressed={crewSize === size}
                >
                  👩‍🚀 {size}
                </button>
              ))}
            </div>
          </div>

          <fieldset className="mb-6">
            <legend className="mb-2 text-sm font-bold text-slate-200">{t.missionLength}</legend>
            <div className="grid grid-cols-3 gap-2">
              {[10, 30, 60].map((days) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => setMissionLength(days)}
                  className={`rounded-xl border px-3 py-3 text-sm font-bold transition ${maxDays === days ? 'border-cyan-300/60 bg-cyan-300/10 text-cyan-100' : 'border-white/10 bg-white/[0.03] text-slate-400 hover:bg-white/[0.06]'}`}
                  aria-pressed={maxDays === days}
                >
                  {days} {t.operatingCyclesUnit}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="mb-6">
            <legend className="mb-2 text-sm font-bold text-slate-200">{t.difficulty}</legend>
            <div className="grid grid-cols-3 gap-2">
              {(['easy', 'normal', 'hard'] as const).map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setDifficulty(level)}
                  className={`rounded-md border px-2 py-3 text-sm font-bold transition ${difficulty === level ? 'border-cyan-200/50 bg-cyan-100/[0.06] text-cyan-100' : 'border-white/10 bg-white/[0.02] text-slate-400 hover:bg-white/[0.05]'}`}
                  aria-pressed={difficulty === level}
                >
                  {level === 'easy' ? '🟢 ' : level === 'normal' ? '🟡 ' : '🔴 '}{t[level]}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-500">{t.difficultyDescription[difficulty]}</p>
          </fieldset>

          <fieldset className="mb-6">
            <legend className="mb-2 text-sm font-bold text-slate-200">{t.missionObjective}</legend>
            <div className="grid gap-2">
              {(['survival', 'science', 'exploration'] as const).map((goal) => (
                <button
                  key={goal}
                  type="button"
                  onClick={() => setObjective(goal)}
                  className={`flex items-center justify-between gap-3 rounded-md border px-3 py-3 text-start text-sm transition ${objective === goal ? 'border-cyan-200/50 bg-cyan-100/[0.06] text-cyan-100' : 'border-white/10 bg-white/[0.02] text-slate-400 hover:bg-white/[0.05]'}`}
                  aria-pressed={objective === goal}
                >
                  <span className="font-bold">{t[`objective_${goal}`]}</span>
                  <span className="text-[11px] text-slate-500">{t[`objective_${goal}_description`]}</span>
                </button>
              ))}
            </div>
          </fieldset>
          </> : (
            <section className="mb-7 rounded-xl border border-cyan-200/15 bg-cyan-100/[0.035] p-4">
              <p className="text-sm font-bold text-cyan-100">👩‍🚀 {t.educationSection}</p>
              <p className="mt-2 text-xs leading-6 text-slate-300">{t.educationDescription}</p>
              <p className="mt-2 text-xs leading-6 text-slate-400">{t.educationAssistantMapHint}</p>
            </section>
          )}

          <div className="mb-7">
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
          </div>

          {missionMode === 'simulation' ? <div className="mb-7">
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
          </div> : null}

          <button ref={launchButtonRef} type="button" onClick={handleLaunch} className="primary-button w-full" disabled={launching}>
            <Rocket size={18} />
            {t.launch}
            <DirectionIcon size={17} />
          </button>
          {loadError ? <p role="alert" className="mt-3 text-xs text-rose-300">{loadError}</p> : null}

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
            </>
          )}
        </div>
      </section>
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
