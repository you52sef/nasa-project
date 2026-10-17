import { Activity, HeartPulse } from 'lucide-react'
import type { GameState } from '../game/model'
import { forecastRadiationExposure, getExplorationRisk } from '../game/model'
import ar from '../i18n/ar'
import en from '../i18n/en'

export function CrewReadiness({ state, language }: { state: GameState; language: 'ar' | 'en' }) {
  const arabic = language === 'ar'
  const t = arabic ? ar : en
  const risk = Math.round(getExplorationRisk(state) * 100)
  const nextRadiation = forecastRadiationExposure(state)
  const radiationPercent = Math.min(100, nextRadiation / 600 * 100)
  const status = state.fatigue >= 75 || state.morale <= 30
    ? t.restRecommendedLabel
    : t.crewReadyLabel

  return (
    <section className="glass-panel p-4 sm:p-5" aria-label={arabic ? 'جاهزية الطاقم' : 'Crew readiness'}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="eyebrow"><Activity size={13} /> {arabic ? 'حالة الطاقم' : 'CREW STATUS'}</p>
          <h2 className="mt-2 text-sm font-black text-white">{t.crewReadinessLabel}</h2>
        </div>
        <p className={`text-end text-[10px] font-semibold ${risk >= 55 ? 'text-amber-200' : 'text-emerald-200'}`}>{status}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ReadinessMeter
          label={arabic ? 'الإرهاق' : 'Fatigue'}
          value={state.fatigue}
          icon="🪫"
          language={language}
          inverted
        />
        <ReadinessMeter
          label={arabic ? 'المعنويات' : 'Morale'}
          value={state.morale}
          icon="🧑‍🚀"
          language={language}
        />
        <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-3">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-slate-300">☢️ {t.cumulativeRadiationLabel}</span>
            <b className={nextRadiation >= 600 ? 'text-rose-200' : nextRadiation >= 400 ? 'text-amber-200' : 'text-slate-100'}>{nextRadiation.toFixed(1)} mSv / 600</b>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.07]">
            <div className={`h-full rounded-full transition-[width] ${nextRadiation >= 600 ? 'bg-rose-400' : nextRadiation >= 400 ? 'bg-amber-300' : 'bg-sky-300'}`} style={{ width: `${radiationPercent}%` }} />
          </div>
          <p className="mt-2 text-[10px] leading-relaxed text-slate-500">
            {t.radiationTrainingNote}
          </p>
        </div>
        <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-3">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-slate-300"><HeartPulse size={14} className="me-1.5 inline text-rose-200" />{t.evaRiskLabel}</span>
            <b className={risk >= 55 ? 'text-amber-200' : 'text-slate-100'}>{risk}%</b>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.07]">
            <div className={`h-full rounded-full transition-[width] ${risk >= 55 ? 'bg-amber-400' : 'bg-sky-300'}`} style={{ width: `${risk}%` }} />
          </div>
          <p className="mt-2 text-[10px] leading-relaxed text-slate-500">
            {t.evaRiskNote}
          </p>
        </div>
      </div>
    </section>
  )
}

function ReadinessMeter({
  label,
  value,
  icon,
  language,
  inverted = false,
}: {
  label: string
  value: number
  icon: string
  language: 'ar' | 'en'
  inverted?: boolean
}) {
  const level = inverted ? 100 - value : value
  const tone = level < 35 ? 'bg-rose-400' : level < 65 ? 'bg-amber-300' : 'bg-emerald-300'
  return (
    <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-3">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="font-semibold text-slate-300">{icon} {label}</span>
        <b className="text-slate-100">{Math.round(value)}%</b>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.07]">
        <div className={`h-full rounded-full transition-[width] ${tone}`} style={{ width: `${Math.max(0, Math.min(100, level))}%` }} />
      </div>
      <p className="mt-2 text-[10px] text-slate-600">{language === 'ar' ? ar.saveEstimateLabel : en.saveEstimateLabel}</p>
    </div>
  )
}
