import { useState } from 'react'
import { ArrowDown, ArrowUp, Minus } from 'lucide-react'
import type { Action } from '../game/model'
import type { GameState, ResourceName } from '../game/model'
import { RESOURCE_META, getForecast } from '../game/resources'
import ar from '../i18n/ar'
import en from '../i18n/en'

export function ForecastTable({ state, language, onPreview }: { state: GameState; language: 'ar' | 'en'; onPreview?: () => void }) {
  const [plannedAction, setPlannedAction] = useState<Action>('maintenance')
  const t = language === 'ar' ? ar : en
  const forecast = getForecast(state, plannedAction)
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
              setPlannedAction(event.target.value as Action)
              onPreview?.()
            }}
            className="rounded-lg border border-white/10 bg-slate-900 px-2 py-1.5 text-[10px] text-slate-100 outline-none focus:border-sky-200/40"
            aria-label={t.forecastActionLabel}
          >
            {actions.map((action) => <option key={action.id} value={action.id}>{action.label}</option>)}
          </select>
        </label>
      </div>
      <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-4 gap-y-3 text-xs">
        <span className="text-slate-600">{t.resourceColumnLabel}</span>
        <span className="text-end text-slate-600">{t.nowColumnLabel}</span>
        <span className="text-end text-slate-600">{t.nextCycleColumnLabel}</span>
        <span />
        {(['energy', 'oxygen', 'water', 'food', 'health'] as ResourceName[]).map((key) => {
          const current = Math.round(state.resources[key])
          const future = Math.round(forecast[key])
          const Icon = future > current ? ArrowUp : future < current ? ArrowDown : Minus
          return (
            <div key={key} className="contents">
              <span className="font-medium text-slate-300">{RESOURCE_META[key].icon} {RESOURCE_META[key].label[language]}</span>
              <span className="text-end tabular-nums text-slate-400">{current}{key === 'health' ? '%' : ' SU'}</span>
              <span className={`text-end tabular-nums font-bold ${future < 25 ? 'text-rose-300' : 'text-slate-100'}`}>{future}{key === 'health' ? '%' : ' SU'}</span>
              <Icon size={14} className={`justify-self-end ${future > current ? 'text-emerald-300' : future < current ? 'text-rose-300' : 'text-slate-600'}`} />
            </div>
          )
        })}
      </div>
      <p className="mt-4 border-t border-white/[0.06] pt-3 text-[10px] text-slate-600">
        {t.forecastHypothesisNote}
      </p>
    </section>
  )
}
