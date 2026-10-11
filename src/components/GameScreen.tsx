import { useCallback, useEffect, useRef, useState } from 'react'
import { BookOpen, Home, Save, Settings2, Sparkles, StopCircle, Volume2, VolumeX } from 'lucide-react'
import type { GameState } from '../game/model'
import { canSleepAndAdvance, getObjectiveProgress, getObjectiveTarget, MISSION_BEDTIME } from '../game/model'
import ar from '../i18n/ar'
import en from '../i18n/en'
import { useGameStore } from '../store/gameStore'
import { useSettingsStore } from '../store/settingsStore'
import { ControlPanel } from './ControlPanel'
import { EndScreen } from './EndScreen'
import { EventModal } from './EventModal'
import { FlightSchool } from './FlightSchool'
import { LanguageSwitch } from './LanguageSwitch'
import { BaseView } from './BaseView'
import { BuildingMenu } from './BuildingMenu'
import { ForecastTable } from './ForecastTable'
import { ResourceBar } from './ResourceBar'
import { CrewReadiness } from './CrewReadiness'
import { useSound } from '../hooks/useSound'
import { TutorialGuide } from './TutorialGuide'
import { AchievementsPanel } from './AchievementsPanel'
import { SCENARIOS } from '../game/scenarios'
import { MissionLog } from './MissionLog'
import { LearningCenter } from './LearningCenter'
import { CrewCouncil } from './CrewCouncil'
import { CREW_ROLES } from '../game/teamwork'
import { FlightExperience } from './FlightExperience'
import { formatResourceValue, RESOURCE_META } from '../game/resources'

export function GameScreen({ state }: { state: GameState }) {
  const language = useSettingsStore((store) => store.language)
  const t = language === 'ar' ? ar : en
  const advanceDay = useGameStore((store) => store.advanceDay)
  const sleepAndAdvance = useGameStore((store) => store.sleepAndAdvance)
  const waitUntilBedtime = useGameStore((store) => store.waitUntilBedtime)
  const chooseTransit = useGameStore((store) => store.chooseTransit)
  const save = useGameStore((store) => store.save)
  const markTutorialStep = useGameStore((store) => store.markTutorialStep)
  const pauseAndReturnToMain = useGameStore((store) => store.pauseAndReturnToMain)
  const endMission = useGameStore((store) => store.endMission)
  const [schoolOpen, setSchoolOpen] = useState(false)
  const [assistantOpen, setAssistantOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const [confirmEndMission, setConfirmEndMission] = useState(false)
  const [sleeping, setSleeping] = useState(false)
  const sleepTimer = useRef<number | null>(null)
  const sleepInProgress = useRef(false)
  const { soundEnabled, toggleSound, playSuccess } = useSound()
  const isArabic = language === 'ar'
  const objectiveTitle = state.objective === 'survival'
    ? t.objective_survival
    : state.objective === 'science'
      ? t.objective_science
      : state.objective === 'exploration'
        ? t.objective_exploration
        : t.objective_tutorial
  const objectiveProgress = getObjectiveProgress(state)
  const objectiveTarget = getObjectiveTarget(state)
  const objectiveProgressPercent = Math.min(100, objectiveProgress / objectiveTarget * 100)
  const activeRole = CREW_ROLES.find((role) => role.id === state.controlledRole)
  const energyCapacity = state.buildings.includes('battery') && !(state.offlineBuildings || []).includes('battery') ? 150 : 100
  const criticalResources = (['energy', 'oxygen', 'water', 'food', 'health'] as const)
    .filter((resource) => state.resources[resource] <= (resource === 'energy' ? energyCapacity : 100) * 0.25)

  if (state.isGameOver) return <EndScreen state={state} />

  const handleSave = () => {
    try {
      save()
      setNotice(isArabic ? 'تم حفظ المهمة على هذا الجهاز.' : 'Mission saved on this device.')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Save failed.')
    }
    window.setTimeout(() => setNotice(''), 4500)
  }

  const handlePauseAndReturn = () => {
    try {
      pauseAndReturnToMain()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : t.pauseSaveFailed)
      window.setTimeout(() => setNotice(''), 4500)
    }
  }

  const handleEndMission = () => {
    try {
      endMission()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : t.pauseSaveFailed)
      window.setTimeout(() => setNotice(''), 4500)
    }
  }

  const handleAction = (action: Parameters<typeof advanceDay>[0]) => {
    advanceDay(action)
  }
  const handleSleep = () => {
    if (sleepInProgress.current || !canSleepAndAdvance(useGameStore.getState())) return
    sleepInProgress.current = true
    setSleeping(true)
    const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 350 : 3_800
    sleepTimer.current = window.setTimeout(() => {
      try {
        const before = useGameStore.getState()
        if (canSleepAndAdvance(before)) {
          sleepAndAdvance()
          const next = useGameStore.getState()
          if (!next.isGameOver && !next.activeEvent && next.day !== before.day) playSuccess()
        }
      } finally {
        sleepInProgress.current = false
        setSleeping(false)
        sleepTimer.current = null
      }
    }, duration)
  }
  useEffect(() => () => {
    if (sleepTimer.current !== null) window.clearTimeout(sleepTimer.current)
    sleepInProgress.current = false
  }, [])
  const hasTransitDecision = state.transitDecisions.some((decision) => decision.leg === state.missionPhase)
  const needsTransitDecision = (state.missionPhase === 'outbound' || state.missionPhase === 'return') && !hasTransitDecision
  const transitLeg = state.missionPhase === 'outbound' ? 'outbound' : 'return'
  const handleTransitArrival = useCallback((leg: 'outbound' | 'return', choice: Parameters<typeof chooseTransit>[1]) => {
    chooseTransit(leg, choice)
  }, [chooseTransit])
  const clock = `${String(state.hour).padStart(2, '0')}:00`
  const timeOfDay = state.hour < 8 ? 'dawn' : state.hour >= 20 ? 'night' : state.hour >= 17 ? 'dusk' : 'day'

  if (needsTransitDecision) {
    return <FlightExperience state={state} leg={transitLeg} onArrive={handleTransitArrival} />
  }

  return (
    <main className={`mission-game mission-light-${timeOfDay} min-h-screen px-3 pb-10 pt-4 text-white sm:px-6 sm:pt-7`} dir={isArabic ? 'rtl' : 'ltr'}>
      <div className="mx-auto max-w-7xl">
        <header className="mission-header mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-sky-100/10 bg-sky-100/[0.06] text-2xl">🚀</div>
            <div className="min-w-0">
              <p className="eyebrow"><span className="h-1.5 w-1.5 rounded-full bg-emerald-300" /> {t.currentMission}</p>
              <h1 className="mt-1 truncate text-lg font-black sm:text-xl">{state.baseName}</h1>
              <p className="mt-1 text-[10px] text-slate-500">{state.destination === 'moon' ? '🌙' : '🔴'} {state.destination === 'moon' ? t.moon : t.mars} · 🚀 {t[state.missionPhase]}</p>
            </div>
          </div>
          <details className="mission-menu">
            <summary><Settings2 size={15} /> {t.missionMenuLabel}</summary>
            <div className="mission-menu-panel">
              <p className="mission-menu-metadata">
                {state.missionMode === 'education' ? t.educationSection : t.simulationSection}
                {' · '}{state.controlMode === 'specialist' && activeRole ? `${activeRole.icon} ${t[activeRole.title]}` : t.fullControlTitle}
                {' · '}{state.difficulty === 'easy' ? '🟢' : state.difficulty === 'normal' ? '🟡' : '🔴'} {t[state.difficulty]}
                {' · '}{SCENARIOS[state.scenario || 'baseline'].icon} {SCENARIOS[state.scenario || 'baseline'].name[language]}
              </p>
              <div className="mission-menu-actions">
                <AchievementsPanel />
                <button type="button" onClick={() => setSchoolOpen(true)} className="secondary-button !px-3 !py-2 text-xs"><BookOpen size={15} /> {t.lessons}</button>
                <button type="button" onClick={handleSave} className="secondary-button !px-3 !py-2 text-xs"><Save size={15} /> {t.save}</button>
                <button type="button" onClick={handlePauseAndReturn} className="secondary-button !px-3 !py-2 text-xs" aria-label={t.pauseAndReturn}><Home size={15} /> {t.pauseAndReturn}</button>
                <button type="button" onClick={() => setConfirmEndMission(true)} disabled={Boolean(state.activeEvent)} className="secondary-button !px-3 !py-2 text-xs text-amber-100 disabled:cursor-not-allowed disabled:opacity-40" aria-label={t.endMission}>
                  <StopCircle size={15} /> {t.endMission}
                </button>
                <button type="button" onClick={toggleSound} className="secondary-button !px-3 !py-2 text-xs">
                  {soundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}{soundEnabled ? t.muteSound : t.unmuteSound}
                </button>
                <LanguageSwitch />
              </div>
            </div>
          </details>
        </header>

        <section className="mb-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center rounded-2xl border border-cyan-200/[0.12] bg-cyan-100/[0.025] px-4 py-3" aria-label={t.dailyScheduleTitle}>
          <div>
            <p className="text-xs font-bold text-cyan-100">{t.dailyScheduleTitle} · {t.operationCycle} {state.day}</p>
            <p className="mt-1 text-[11px] text-slate-400">
              {t.currentTimeLabel}: <b className="text-white" dir="ltr">{clock}</b> · {t.scheduledActivitiesLabel}: {state.todayActions.length}
              {state.todayActions.length ? ` · ${state.todayActions.map((action) => t[`action_${action}`]).join(' · ')}` : ''}
            </p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
              <div className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-violet-300 transition-all duration-700" style={{ width: `${Math.min(100, (state.hour - 6) / 16 * 100)}%` }} />
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            {state.hour < MISSION_BEDTIME ? (
              <button type="button" onClick={waitUntilBedtime} disabled={needsTransitDecision} className="secondary-button !px-4 !py-2 text-xs disabled:cursor-not-allowed disabled:opacity-40">
                {t.waitUntilBedtime}
              </button>
            ) : null}
            <button type="button" onClick={handleSleep} disabled={sleeping || !canSleepAndAdvance(state)} className="primary-button !px-4 !py-2 text-xs disabled:cursor-not-allowed disabled:opacity-40">
              🌙 {t.sleepAndNextDay}
            </button>
          </div>
          {state.lastMessage ? <p role="status" className="text-[10px] leading-5 text-cyan-100/75 sm:col-span-2">{state.lastMessage}</p> : null}
        </section>
        {criticalResources.length ? (
          <section className="resource-attention mb-4" role="status" aria-live="polite">
            <div>
              <p className="text-xs font-black text-rose-100">{t.resourceAttentionTitle}</p>
              <p className="mt-1 text-[10px] leading-5 text-rose-100/70">{t.resourceAttentionDescription}</p>
            </div>
            <ul className="flex flex-wrap gap-2">
              {criticalResources.map((resource) => (
                <li key={resource} className="rounded-lg border border-rose-200/15 bg-rose-950/30 px-2.5 py-1.5 text-[11px] font-bold text-rose-100">
                  {resource === 'energy' ? '⚡' : resource === 'oxygen' ? '💨' : resource === 'water' ? '💧' : resource === 'food' ? '🌱' : '❤️'}
                  {' '}{RESOURCE_META[resource].label[language]} · {formatResourceValue(resource, state.resources[resource], language)}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        <details className="mission-detail-disclosure mb-3">
          <summary>{t.teamCouncilTitle} <span>{t.teamCouncilSummary}</span></summary>
          <CrewCouncil state={state} />
        </details>

        <section className="mb-4 grid gap-3 lg:grid-cols-[1fr_1fr_auto] lg:items-center">
          <div className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.025] px-4 py-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100/[0.07] text-orange-200"><span className="font-black">{String(state.day).padStart(2, '0')}</span></div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-bold text-slate-100">{t.operationCycle} {state.day} <span className="font-medium text-slate-500">{t.of} {state.maxDays}</span></p>
                <p className="text-[10px] text-slate-600">{Math.round(state.daysSurvived / state.maxDays * 100)}%</p>
              </div>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.07]">
                <div className="h-full rounded-full bg-gradient-to-r from-orange-300 to-sky-300 transition-all" style={{ width: `${Math.max(0, state.daysSurvived / state.maxDays * 100)}%` }} />
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-violet-200/[0.08] bg-violet-100/[0.025] px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-xs font-bold text-violet-100">{objectiveTitle}</p>
              <p className="text-[10px] text-slate-500">{t.objectiveProgress}</p>
            </div>
            <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500">
              <span>{Math.min(objectiveProgress, objectiveTarget)} / {objectiveTarget}</span>
              <span>{Math.round(objectiveProgressPercent)}%</span>
            </div>
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/[0.07]">
              <div className="h-full rounded-full bg-violet-300 transition-all" style={{ width: `${objectiveProgressPercent}%` }} />
            </div>
          </div>
          <div className="flex items-center justify-center gap-2 rounded-2xl border border-white/[0.07] bg-white/[0.025] px-4 py-3">
            <Sparkles size={15} className="text-amber-200" />
            <span className="text-xs text-slate-400">{t.scienceLabel}</span>
            <b className="text-sm text-white">{state.science}</b>
          </div>
        </section>

        {state.objective === 'tutorial' ? <TutorialGuide completed={state.tutorialSteps} language={language} /> : null}

        <div className="mb-4">
          <BaseView state={state} onAction={handleAction} onOpenAssistant={() => setAssistantOpen(true)} />
        </div>

        <ResourceBar
          resources={state.resources}
          language={language}
          energyCapacity={energyCapacity}
        />
        <details className="mission-detail-disclosure mt-3">
          <summary>{t.crewReadinessLabel} <span>{state.fatigue >= 75 || state.morale <= 25 ? t.restRecommendedLabel : t.crewReadyLabel}</span></summary>
          <div className="mt-3"><CrewReadiness state={state} language={language} /></div>
        </details>

        <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="flex flex-col gap-4">
            <ForecastTable state={state} language={language} onPreview={() => markTutorialStep('forecast')} />
          </div>
          <div className="flex flex-col gap-4">
            <ControlPanel state={state} disabled={Boolean(state.activeEvent) || needsTransitDecision} onAction={handleAction} />
            <BuildingMenu state={state} />
          </div>
        </div>

        <MissionLog state={state} language={language} />

        <footer className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.05] pt-4 text-[10px] text-slate-600">
          <span>{t.missionFooterLabel}</span>
          <span>{state.baseName} · {t.operationCycle} {state.day}/{state.maxDays} · SEED {state.missionSeed.toString(16).padStart(8, '0')}</span>
        </footer>
      </div>

      {notice ? <div role="status" className="fixed bottom-5 start-1/2 z-40 -translate-x-1/2 rounded-xl border border-emerald-200/15 bg-slate-900 px-4 py-3 text-sm text-emerald-100 shadow-2xl">{notice}</div> : null}
      {sleeping ? (
        <div className="sleep-sequence" role="status" aria-live="assertive" dir={isArabic ? 'rtl' : 'ltr'}>
          <p className="eyebrow">{t.crewRestCycle}</p>
          <div className="sleep-habitat" aria-hidden="true">
            <div className="sleep-habitat-module">
              <span className="sleep-habitat-window sleep-habitat-window-one" />
              <span className="sleep-habitat-window sleep-habitat-window-two" />
              <span className="sleep-habitat-status" />
            </div>
            <div className="sleep-habitat-horizon" />
          </div>
          <p className="sleep-sequence-caption">{t.sleepSequenceCaption}</p>
          <div className="sleep-sequence-stars" aria-hidden="true">✦　·　✧　·　✦</div>
        </div>
      ) : null}
      {state.activeEvent ? <EventModal /> : null}
      {schoolOpen ? <FlightSchool onClose={() => setSchoolOpen(false)} /> : null}
      {assistantOpen ? (
        <LearningCenter
          mission={state}
          assistantVariant={state.missionMode === 'education' ? 'astronaut' : 'robot'}
          onClose={() => setAssistantOpen(false)}
        />
      ) : null}
      {confirmEndMission ? (
        <div className="modal-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setConfirmEndMission(false)
        }}>
          <section role="dialog" aria-modal="true" aria-labelledby="end-mission-title" className="modal-card max-w-sm" dir={isArabic ? 'rtl' : 'ltr'}>
            <h2 id="end-mission-title" className="text-lg font-black">{t.endMission}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">{t.endMissionConfirm}</p>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row">
              <button type="button" onClick={() => setConfirmEndMission(false)} className="secondary-button flex-1">{t.close}</button>
              <button type="button" onClick={handleEndMission} className="primary-button flex-1"><StopCircle size={16} />{t.endMission}</button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  )
}
