import { ArrowDownRight, ArrowUpRight, RadioTower, ShieldAlert } from 'lucide-react'
import type { Action, GameState, ResourceName } from '../game/model'
import { forecastResources } from '../game/model'
import { RESOURCE_META } from '../game/resources'
import arStrings from '../i18n/ar'
import enStrings from '../i18n/en'

const supplies: ResourceName[] = ['energy', 'oxygen', 'water', 'food']
const actions: Action[] = ['maintenance', 'rest', 'research', 'explore']

export function MissionWatch({ state, language }: { state: GameState; language: 'ar' | 'en' }) {
  const ar = language === 'ar'
  const t = ar ? arStrings : enStrings
  const baseline = forecastResources(state)
  const projections = actions.map((action) => ({ action, resources: forecastResources(state, action) }))
  const weakest = supplies.reduce((weakestResource, resource) => {
    return baseline[resource] < baseline[weakestResource] ? resource : weakestResource
  }, supplies[0])
  const projectedValue = baseline[weakest]
  const bestAction = projections.reduce((best, candidate) =>
    candidate.resources[weakest] > best.resources[weakest] ? candidate : best,
  )
  const displayedValue = new Intl.NumberFormat(ar ? 'ar-EG' : 'en-US').format(Math.round(projectedValue))
  const bestActionValue = new Intl.NumberFormat(ar ? 'ar-EG' : 'en-US').format(Math.round(bestAction.resources[weakest]))
  const isCritical = projectedValue <= 20
  const isWatch = projectedValue <= 40
  const actionLabels: Record<Action, string> = {
    maintenance: t.maintenance,
    rest: t.rest,
    research: t.research,
    explore: t.explore,
  }
  const tone = isCritical
    ? 'mission-watch-critical'
    : isWatch
      ? 'mission-watch-warning'
      : 'mission-watch-nominal'

  return (
    <section className={`mission-watch ${tone} mb-4`} aria-live="polite">
      <div className="mission-watch-icon">
        {isCritical || isWatch ? <ShieldAlert size={19} /> : <RadioTower size={19} />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="eyebrow">{t.missionWatchLabel}</p>
          <span className="mission-watch-status">
            {isCritical ? t.criticalStatusLabel : isWatch ? t.watchStatusLabel : t.systemsNominalLabel}
          </span>
        </div>
        <p className="mt-1 text-xs leading-5 text-slate-200">
          {isWatch
            ? (ar
              ? `قد ينخفض ${RESOURCE_META[weakest].label.ar} إلى ${displayedValue} وحدة في الدورة التالية. يتوقع النموذج أن يحافظ إجراء ${actionLabels[bestAction.action]} على ${bestActionValue} وحدة.`
              : `${RESOURCE_META[weakest].label.en} is projected at ${displayedValue} SU next cycle. ${actionLabels[bestAction.action]} is projected to preserve ${bestActionValue} SU.`)
            : (ar
              ? `أقل رصيد متوقع للمؤن الأساسية هو ${RESOURCE_META[weakest].label.ar}: ${displayedValue} وحدة بعد دورة واحدة.`
              : `Lowest projected core supply: ${RESOURCE_META[weakest].label.en} at ${displayedValue} SU after one cycle.`)}
        </p>
        <p className="mt-1 text-[9px] leading-4 text-slate-500">
          {t.trainingCueNote}
        </p>
      </div>
      <div className="hidden shrink-0 border-s border-white/10 ps-4 text-end sm:block">
        <p className="text-[9px] tracking-[.12em] text-slate-500">{t.nextCycleLabel}</p>
        <div className="mt-1 flex items-center justify-end gap-1 font-mono text-sm font-bold tabular-nums">
          {isWatch ? <ArrowDownRight size={15} /> : <ArrowUpRight size={15} />}
          {displayedValue} <span className="text-[9px] font-normal text-slate-500">SU</span>
        </div>
      </div>
    </section>
  )
}
