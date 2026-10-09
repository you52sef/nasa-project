import { Download, RotateCcw, Telescope } from 'lucide-react'
import { Volume2, VolumeX } from 'lucide-react'
import { useEffect, useState } from 'react'
import { BUILDINGS } from '../game/buildings'
import { RESOURCE_META } from '../game/resources'
import { calculateMissionScore, getObjectiveProgress, getObjectiveTarget, isObjectiveComplete } from '../game/model'
import type { GameState } from '../game/model'
import ar from '../i18n/ar'
import en from '../i18n/en'
import { downloadMissionReport } from '../utils/exportReport'
import { useGameStore } from '../store/gameStore'
import { useSettingsStore } from '../store/settingsStore'
import { useSound } from '../hooks/useSound'
import { Leaderboard } from './Leaderboard'
import { AchievementsPanel } from './AchievementsPanel'

export function EndScreen({ state }: { state: GameState }) {
  const language = useSettingsStore((store) => store.language)
  const t = language === 'ar' ? ar : en
  const newMission = useGameStore((store) => store.newMission)
  const replayMission = useGameStore((store) => store.replayMission)
  const success = state.missionResult === 'success'
  const endedEarly = state.missionResult === 'ended'
  const objectiveTitle = state.objective === 'survival'
    ? t.objective_survival
    : state.objective === 'science'
      ? t.objective_science
      : state.objective === 'exploration'
        ? t.objective_exploration
        : t.objective_tutorial
  const objectiveProgress = getObjectiveProgress(state)
  const objectiveTarget = getObjectiveTarget(state)
  const objectiveComplete = isObjectiveComplete(state)
  const [reportError, setReportError] = useState('')
  const [exportingReport, setExportingReport] = useState(false)
  const { soundEnabled, toggleSound, playClick, playWin, playLose } = useSound()
  useEffect(() => {
    if (success) playWin()
    else if (endedEarly) playClick()
    else playLose()
  }, [endedEarly, playClick, playLose, playWin, success])
  const handleDownloadReport = async () => {
    setReportError('')
    setExportingReport(true)
    try {
      await downloadMissionReport(state, language)
    } catch (error) {
      setReportError(error instanceof Error ? error.message : t.reportError)
    } finally {
      setExportingReport(false)
    }
  }
  return (
    <main className="mission-debrief flex min-h-screen items-center justify-center px-4 py-10 text-white">
      <section className="mission-debrief-card w-full max-w-3xl overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/75 shadow-2xl">
        <div className={`relative overflow-hidden border-b border-white/10 p-8 sm:p-12 ${success ? 'bg-[#172019]' : endedEarly ? 'bg-[#201d14]' : 'bg-[#211717]'}`}>
          <p className="eyebrow"><Telescope size={13} /> {t.missionDebriefLabel}</p>
          <button
            type="button"
            onClick={toggleSound}
            className="absolute end-6 top-6 rounded-lg border border-white/10 bg-black/20 p-2 text-slate-200"
            aria-label={soundEnabled ? t.muteSound : t.unmuteSound}
            title={soundEnabled ? t.muteSound : t.unmuteSound}
          >
            {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
          <div className={`mission-result-emblem mt-7 text-6xl ${success ? 'mission-result-success' : 'mission-result-failure'}`} aria-hidden="true">{success ? '🌍' : endedEarly ? '🏁' : '🛟'}</div>
          <h1 className="mt-4 text-3xl font-black sm:text-5xl">{success ? t.resultWin : endedEarly ? t.resultEnded : t.resultLose}</h1>
          <p className="mt-3 max-w-xl text-sm leading-7 text-slate-300">{state.lastMessage || (endedEarly ? t.endedMissionNote : '')}</p>
          <p className="mt-3 text-xs text-slate-500">{state.baseName} · {state.destination === 'moon' ? t.moon : t.mars} · {state.crewSize} {t.crewSize} · SEED {state.missionSeed.toString(16).padStart(8, '0')}</p>
          <div className="mt-4"><AchievementsPanel /></div>
        </div>
        <div className="p-6 sm:p-10">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label={t.daysSurvived} value={`${state.daysSurvived}/${state.maxDays}`} icon="◷" />
            <Stat label={t.science} value={state.science} icon="🔬" />
            <Stat label={t.rescues} value={state.totalRescues} icon="🛡️" />
            <Stat label={t.lessonsProgress} value={`${state.lessonsCompleted.length}/6`} icon="📚" />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat label={t.score} value={`${calculateMissionScore(state)}/100`} icon="🏅" />
            <Stat label={t.successfulExpeditions} value={state.successfulExpeditions} icon="🛰️" />
            <Stat label={t.fatigue} value={`${Math.round(state.fatigue)}%`} icon="🪫" />
            <Stat label={t.morale} value={`${Math.round(state.morale)}%`} icon="🧑‍🚀" />
            <Stat label={t.radiationExposure} value={`${Math.round(state.radiationExposure)}/100`} icon="☢️" />
          </div>
          <div className="mt-4 rounded-2xl border border-violet-200/10 bg-violet-100/[0.035] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-bold">{t.missionObjective}: {objectiveTitle}</h2>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${objectiveComplete ? 'bg-emerald-300/10 text-emerald-200' : 'bg-amber-300/10 text-amber-200'}`}>
                {objectiveComplete ? t.objectiveComplete : t.objectiveIncomplete}
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-400">{Math.min(objectiveProgress, objectiveTarget)} / {objectiveTarget} · {t.scoreNote}</p>
          </div>
          <Leaderboard state={state} language={language} />
          <div className="mt-6 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
            <h2 className="text-sm font-bold">{t.leftover}</h2>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
              {(['energy', 'oxygen', 'water', 'food', 'health'] as const).map((key) => (
                <p key={key} className="rounded-lg bg-slate-950/40 p-2 text-xs text-slate-400">{RESOURCE_META[key].label[language]} <b className="float-end text-white">{Math.round(state.resources[key])}{key === 'health' ? '%' : ' SU'}</b></p>
              ))}
              <p className="rounded-lg bg-slate-950/40 p-2 text-xs text-slate-400">{t.credits} <b className="float-end text-white">{state.resources.credits}</b></p>
            </div>
          </div>
          <div className="mt-4 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
            <h2 className="text-sm font-bold">{t.buildings} · {state.buildings.length}</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {state.buildings.map((id, index) => <span key={`${id}-${index}`} className="rounded-lg bg-slate-950/50 px-2.5 py-1.5 text-xs text-slate-300">{BUILDINGS[id]?.icon} {BUILDINGS[id]?.name[language] || id}</span>)}
            </div>
          </div>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button type="button" onClick={() => { void handleDownloadReport() }} disabled={exportingReport} className="primary-button flex-1 disabled:cursor-wait disabled:opacity-60"><Download size={17} /> {t.report}</button>
            <button type="button" onClick={() => { playClick(); replayMission() }} className="secondary-button flex-1"><RotateCcw size={16} /> {t.replayScenario}</button>
            <button type="button" onClick={() => { playClick(); newMission() }} className="secondary-button flex-1"><RotateCcw size={16} /> {t.startOver}</button>
          </div>
          {reportError ? <p role="alert" className="mt-3 text-sm text-rose-300">{reportError}</p> : null}
        </div>
      </section>
    </main>
  )
}

function Stat({ label, value, icon }: { label: string; value: string | number; icon: string }) {
  return <div className="mission-stat rounded-xl border border-white/[0.06] bg-white/[0.025] p-3"><span className="text-xl">{icon}</span><p className="mt-2 text-lg font-black tabular-nums">{value}</p><p className="mt-1 text-[10px] leading-4 text-slate-500">{label}</p></div>
}
