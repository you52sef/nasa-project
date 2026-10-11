import { useState } from 'react'
import { ArrowDown, ArrowUp, Minus } from 'lucide-react'
import { ACTIVITY_DURATIONS, canPerformActivity, MISSION_DAY_END, type Action, type GameState, type ResourceName } from '../game/model'
import { formatResourceValue, RESOURCE_META, getForecast } from '../game/resources'
import { recommendCrewSupportAction } from '../game/teamwork'
import ar from '../i18n/ar'
import en from '../i18n/en'

export function ForecastTable({ state, language, onPreview }: { state: GameState; language: 'ar' | 'en'; onPreview?: () => void }) {
  const [plannedAction, setPlannedAction] = useState<Action | 'none'>('none')
  const t = language === 'ar' ? ar : en
  const supportAction = state.controlMode === 'specialist'
    ? recommendCrewSupportAction(state)
    : null
  const scheduledPlan = [
    ...state.todayActions,
    ...(supportAction ? [supportAction] : []),
    'rest' as const,
  ]
  const hypotheticalFits = plannedAction === 'none' ||
    (state.hour + ACTIVITY_DURATIONS[plannedAction] <= MISSION_DAY_END &&
      canPerformActivity(state, plannedAction))
  const forecastActions = plannedAction === 'none' || !hypotheticalFits
    ? scheduledPlan
    : [...scheduledPlan, plannedAction]
  const forecast = getForecast(state, forecastActions)
  const actions: { id: Action; label: string }[] = language === 'ar'
    ? [
        { id: 'research', label: 'بحث' },
        { id: 'explore', label: 'استكشاف' },
        { id: 'maintenance', label: 'صيانة' },
        { id: 'rest', label: 'راحة' },
      ]
    : [
        { id: 'research', label: 'Research' },
        { id: 'explore', label: 'Explore' },
        { id: 'maintenance', label: 'Maintenance' },
        { id: 'rest', label: 'Rest' },
      ]
  return (
    <section className="glass-panel p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="panel-title">{t.operationsForecastTitle}</h2>
        <label className="flex items-center gap-2 text-[10px] text-slate-400">
          <span>{t.simulateActionLabel}</span>
          <select
            value={plannedAction}
            onChange={(event) => {
              setPlannedAction(event.target.value as Action | 'none')
              onPreview?.()
            }}
            className="rounded-lg border border-white/10 bg-slate-900 px-2 py-1.5 text-[10px] text-slate-100 outline-none focus:border-sky-200/40"
            aria-label={t.forecastActionLabel}
          >
            <option value="none">{t.noAdditionalAction}</option>
            {actions.map((action) => <option key={action.id} value={action.id}>{action.label}</option>)}
          </select>
        </label>
      </div>
      <p className="mb-4 text-[10px] leading-5 text-slate-500">
        {t.forecastScheduledPrefix} {state.todayActions.length
          ? state.todayActions.map((action) => t[`action_${action}`]).join(' · ')
          : t.noScheduledActivities}
        {supportAction ? ` · ${t.forecastCrewSupportPrefix} ${t[`action_${supportAction}`]}` : ''}
        {plannedAction !== 'none' ? ` · ${t.forecastAddingPrefix} ${t[`action_${plannedAction}`]}${hypotheticalFits ? '' : ` · ${t.forecastActionDoesNotFit}`}` : ''}
      </p>
      <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-4 gap-y-3 text-xs">
        <span className="text-slate-600">{t.resourceColumnLabel}</span>
        <span className="text-end text-slate-600">{t.nowColumnLabel}</span>
        <span className="text-end text-slate-600">{t.nextCycleColumnLabel}</span>
        <span className="text-end text-slate-600">{t.changeColumnLabel}</span>
        {(['energy', 'oxygen', 'water', 'food', 'health'] as ResourceName[]).map((key) => {
          const current = state.resources[key]
          const future = forecast[key]
          const delta = future - current
          const Icon = future > current ? ArrowUp : future < current ? ArrowDown : Minus
          return (
            <div key={key} className="contents">
              <span className="font-medium text-slate-300">{RESOURCE_META[key].icon} {RESOURCE_META[key].label[language]}</span>
              <span className="text-end tabular-nums text-slate-400">{formatResourceValue(key, current, language)}</span>
              <span className={`text-end tabular-nums font-bold ${future <= (key === 'energy' && state.buildings.includes('battery') ? 150 : 100) * .25 ? 'text-rose-300' : 'text-slate-100'}`}>{formatResourceValue(key, future, language)}</span>
              <span className={`flex items-center justify-end gap-1 text-[10px] tabular-nums ${delta > 0 ? 'text-emerald-300' : delta < 0 ? 'text-rose-300' : 'text-slate-600'}`}>
                <Icon size={12} />
                {delta > 0 ? '+' : ''}{formatResourceValue(key, delta, language)}
              </span>
            </div>
          )
        })}
      </div>
      <p className="mt-4 border-t border-white/[0.06] pt-3 text-[10px] text-slate-600">
        {hypotheticalFits ? t.forecastHypothesisNote : t.forecastActionDoesNotFit}
      </p>
    </section>
  )
}
