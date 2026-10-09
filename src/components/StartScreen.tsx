import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, ArrowLeft, ArrowRight, Moon, Rocket, Shuffle, Volume2, VolumeX } from 'lucide-react'
import ar from '../i18n/ar'
import en from '../i18n/en'
import { useGameStore } from '../store/gameStore'
import { useSettingsStore } from '../store/settingsStore'
import { LanguageSwitch } from './LanguageSwitch'
import { ModelDisclosure } from './ModelDisclosure'
import { SCENARIOS, type ScenarioId } from '../game/scenarios'
import { useSound } from '../hooks/useSound'

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
  const missionSeed = useGameStore((state) => state.missionSeed)
  const setDestination = useGameStore((state) => state.setDestination)
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
  const launchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const launchButtonRef = useRef<HTMLButtonElement>(null)
  const cancelConfirmationRef = useRef<HTMLButtonElement>(null)
  const confirmMissionRef = useRef<HTMLButtonElement>(null)
  const { soundEnabled, toggleSound, playLaunch, playScenario } = useSound()
  const isArabic = language === 'ar'
  const DirectionIcon = isArabic ? ArrowLeft : ArrowRight

  useEffect(() => () => {
    if (launchTimer.current) clearTimeout(launchTimer.current)
  }, [])

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
    playLaunch(scenario)
    launchTimer.current = setTimeout(() => {
      try {
        startMission()
      } catch (error) {
        setLaunching(false)
        setLoadError(error instanceof Error ? error.message : 'Could not start a new mission.')
      }
    }, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 500 : 3400)
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

  return (
    <main className="mission-start relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-8 text-white">
      <div className="orbit-glow pointer-events-none absolute inset-0" />
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
          <div className="relative my-12">
            <div
              className={`mission-planet mission-planet-${destination} mb-8`}
              role="img"
              aria-label={destination === 'moon' ? t.moon : t.mars}
            >
              <span className="planet-surface" />
              <span className="planet-orbit" aria-hidden="true">
                <span className="planet-satellite" />
              </span>
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
            <h2 className="mt-2 text-2xl font-black sm:text-3xl">{t.newMission}</h2>
            <p className="mt-2 text-xs text-slate-500">{maxDays} {t.operatingCyclesUnit} · {t.cycleSinglePlayerNote}</p>
            <p className="mt-3 border-s border-cyan-200/40 bg-white/[0.02] px-3 py-2 text-xs leading-5 text-slate-400">{t.singlePlayerNote}</p>
          </div>

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
              {(['survival', 'science', 'exploration', 'tutorial'] as const).map((goal) => (
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

          <div className="mb-7">
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
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-500">{t.seedDescription}</p>
          </div>

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
      {launching ? (
        <div className="mission-launch-overlay" role="status" aria-live="assertive" dir={isArabic ? 'rtl' : 'ltr'}>
          <div className={`launch-horizon ${destination === 'mars' ? 'launch-horizon-mars' : ''}`} />
          <div className="launch-stars" aria-hidden="true" />
          <div className="launch-caption">
            <span className="eyebrow justify-center">{t.launchSequence}</span>
            <h2>{baseName}</h2>
            <p>{SCENARIOS[scenario].name[language]} · {destination === 'moon' ? t.moon : t.mars}</p>
          </div>
          <div className="launch-vehicle" aria-hidden="true">
            <span className="launch-flame" />
            <Rocket size={64} strokeWidth={1.25} />
          </div>
          <div className="launch-countdown" aria-label={t.launchCountdown} dir="ltr">
            <span>T−03</span><span>T−02</span><span>T−01</span>
          </div>
          <p className="launch-status">{t.launching}</p>
        </div>
      ) : null}
    </main>
  )
}
