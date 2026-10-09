import { useState } from 'react'
import { BookOpen, Check, CloudSun, Flag, Home, Save, Sparkles, StopCircle, Volume2, VolumeX, Wrench } from 'lucide-react'
import type { GameState } from '../game/model'
import { getObjectiveProgress, getObjectiveTarget } from '../game/model'
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
import { ModelDisclosure } from './ModelDisclosure'
import { TutorialGuide } from './TutorialGuide'
import { AchievementsPanel } from './AchievementsPanel'
import { SCENARIOS } from '../game/scenarios'
import { MissionWatch } from './MissionWatch'
import { MissionLog } from './MissionLog'

export function GameScreen({ state }: { state: GameState }) {
  const language = useSettingsStore((store) => store.language)
  const t = language === 'ar' ? ar : en
  const advanceDay = useGameStore((store) => store.advanceDay)
  const save = useGameStore((store) => store.save)
  const markTutorialStep = useGameStore((store) => store.markTutorialStep)
  const pauseAndReturnToMain = useGameStore((store) => store.pauseAndReturnToMain)
  const endMission = useGameStore((store) => store.endMission)
  const [schoolOpen, setSchoolOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const [confirmReset, setConfirmReset] = useState(false)
  const [confirmEndMission, setConfirmEndMission] = useState(false)
  const newMission = useGameStore((store) => store.newMission)
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
    const previousDay = useGameStore.getState().day
    advanceDay(action)
    const next = useGameStore.getState()
    if (!next.isGameOver && !next.activeEvent && next.day !== previousDay) {
      playSuccess()
    }
  }

  return (
    <main className="mission-game min-h-screen px-3 pb-10 pt-4 text-white sm:px-6 sm:pt-7" dir={isArabic ? 'rtl' : 'ltr'}>
      <div className="mx-auto max-w-7xl">
        <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-sky-100/10 bg-sky-100/[0.06] text-2xl">🚀</div>
            <div className="min-w-0">
              <p className="eyebrow"><span className="h-1.5 w-1.5 rounded-full bg-emerald-300" /> {t.currentMission}</p>
              <h1 className="mt-1 truncate text-lg font-black sm:text-xl">{state.baseName}</h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2 text-xs text-slate-400">
              {state.destination === 'moon' ? '🌙' : '🔴'} {state.destination === 'moon' ? t.moon : t.mars}
            </div>
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2 text-xs text-slate-400">
              {state.difficulty === 'easy' ? '🟢' : state.difficulty === 'normal' ? '🟡' : '🔴'} {t[state.difficulty]}
            </div>
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2 text-xs text-slate-400">
              {SCENARIOS[state.scenario || 'baseline'].icon} {SCENARIOS[state.scenario || 'baseline'].name[language]}
            </div>
            <AchievementsPanel />
            <button type="button" onClick={() => setSchoolOpen(true)} className="secondary-button !px-3 !py-2 text-xs"><BookOpen size={15} /> {t.lessons}</button>
            <button type="button" onClick={handleSave} className="secondary-button !px-3 !py-2 text-xs"><Save size={15} /> {t.save}</button>
            <button type="button" onClick={handlePauseAndReturn} className="secondary-button !px-3 !py-2 text-xs" title={t.pauseAndReturn} aria-label={t.pauseAndReturn}>
              <Home size={15} /> <span className="hidden sm:inline">{t.pauseAndReturn}</span>
            </button>
            <button type="button" onClick={() => setConfirmEndMission(true)} disabled={Boolean(state.activeEvent)} className="secondary-button !px-3 !py-2 text-xs text-amber-100 disabled:cursor-not-allowed disabled:opacity-40" title={t.endMission} aria-label={t.endMission}>
              <StopCircle size={15} /> <span>{t.endMission}</span>
            </button>
            <button
              type="button"
              onClick={toggleSound}
              className="icon-button"
              aria-label={soundEnabled ? t.muteSound : t.unmuteSound}
              title={soundEnabled ? t.muteSound : t.unmuteSound}
            >
              {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </button>
            <LanguageSwitch />
            <button type="button" onClick={() => setConfirmReset(true)} className="icon-button" aria-label={t.startOver}><Flag size={16} /></button>
          </div>
        </header>

        <section className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-sky-200/[0.08] bg-sky-100/[0.025] px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-100/[0.07] text-sky-100"><CloudSun size={18} /></div>
            <div>
              <p className="text-xs font-bold text-slate-200">{t.weather}</p>
              <p className="mt-1 text-[10px] leading-relaxed text-slate-500">{state.destination === 'moon' ? t.moonWeather : t.marsWeather}</p>
            </div>
          </div>
          <div className="hidden text-end sm:block">
            <p className="text-[10px] text-slate-600">{t.crew}</p>
            <p className="mt-1 text-xs font-bold text-slate-200">👩‍🚀 {state.crewSize}</p>
          </div>
        </section>

        <MissionWatch state={state} language={language} />

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
          <BaseView state={state} onAction={handleAction} />
        </div>

        <ResourceBar
          resources={state.resources}
          language={language}
          energyCapacity={state.buildings.includes('battery') && !(state.offlineBuildings || []).includes('battery') ? 150 : 100}
        />
        <div className="mt-4">
          <CrewReadiness state={state} language={language} />
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="flex flex-col gap-4">
            <ForecastTable state={state} language={language} onPreview={() => markTutorialStep('forecast')} />
          </div>
          <div className="flex flex-col gap-4">
            <ControlPanel disabled={Boolean(state.activeEvent)} onAction={handleAction} />
            <BuildingMenu state={state} />
            <div className="glass-panel flex gap-3 p-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-100/[0.07] text-violet-200"><Wrench size={17} /></div>
              <div>
                <p className="text-xs font-bold text-slate-200">{t.base} · {state.buildings.length} {t.floor}</p>
                <p className="mt-1 text-[10px] leading-5 text-slate-500">{state.lastMessage || (language === 'ar' ? 'راقب التوقعات قبل اختيار قرارك اليومي.' : 'Review the forecast before choosing today’s action.')}</p>
              </div>
            </div>
          </div>
        </div>

        <MissionLog state={state} language={language} />

        <footer className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.05] pt-4 text-[10px] text-slate-600">
          <span>{t.missionFooterLabel}</span>
          <span>{state.baseName} · {t.operationCycle} {state.day}/{state.maxDays} · SEED {state.missionSeed.toString(16).padStart(8, '0')}</span>
        </footer>
        <ModelDisclosure />
      </div>

      {notice ? <div role="status" className="fixed bottom-5 start-1/2 z-40 -translate-x-1/2 rounded-xl border border-emerald-200/15 bg-slate-900 px-4 py-3 text-sm text-emerald-100 shadow-2xl">{notice}</div> : null}
      {state.activeEvent ? <EventModal /> : null}
      {schoolOpen ? <FlightSchool onClose={() => setSchoolOpen(false)} /> : null}
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
      {confirmReset ? (
        <div className="modal-backdrop">
          <section role="dialog" aria-modal="true" className="modal-card max-w-sm">
            <h2 className="text-lg font-black">{t.startOver}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">{t.newMissionConfirm}</p>
            <div className="mt-5 flex gap-2">
              <button type="button" onClick={() => setConfirmReset(false)} className="secondary-button flex-1">{t.close}</button>
              <button type="button" onClick={newMission} className="primary-button flex-1">{t.startOver}</button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  )
}
