import { useState } from 'react'
import { Activity, ChevronDown, ChevronUp } from 'lucide-react'
import type { GameState } from '../game/model'
import { EVENTS } from '../game/events'
import arStrings from '../i18n/ar'
import enStrings from '../i18n/en'

const actionLabels: Record<string, { ar: string; en: string }> = {
  research: { ar: 'بحث علمي', en: 'Research conducted' },
  explore: { ar: 'رحلة استكشافية', en: 'Expedition launched' },
  maintenance: { ar: 'صيانة الأنظمة', en: 'Systems maintenance' },
  rest: { ar: 'راحة الطاقم', en: 'Crew rest' },
}

export function MissionLog({ state, language }: { state: GameState; language: 'ar' | 'en' }) {
  const [expanded, setExpanded] = useState(false)
  const ar = language === 'ar'
  const t = ar ? arStrings : enStrings
  const entries = [...state.log].reverse()
  const updateCount = new Intl.NumberFormat(ar ? 'ar-EG' : 'en-US').format(entries.length)
  const visible = expanded ? entries : entries.slice(0, 5)

  return (
    <section className="mission-log glass-panel mt-4 overflow-hidden">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-start sm:px-5"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        aria-controls="mission-log-entries"
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center border border-emerald-200/10 bg-emerald-100/[0.05] text-emerald-200"><Activity size={16} /></span>
          <span>
            <span className="eyebrow">{t.operationsLogLabel}</span>
            <span className="mt-1 block text-xs font-bold text-slate-200">{updateCount} {t.missionUpdatesLabel}</span>
          </span>
        </span>
        <span className="flex items-center gap-2 text-[10px] text-slate-500">
          {expanded ? t.collapseLogLabel : t.viewLogLabel}
          {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </span>
      </button>
      {expanded ? (
        <ol id="mission-log-entries" className="mission-log-list border-t border-white/[0.06] px-4 py-2 sm:px-5">
          {visible.length ? visible.map((entry, index) => {
            const match = /^اليوم (\d+): (.*)$/.exec(entry)
            const day = match?.[1] ?? ''
            const detail = match?.[2] ?? entry
            const action = actionLabels[detail]
            const event = EVENTS.find((item) => item.title.ar === detail)
            const label = action?.[language] ?? event?.title[language] ?? detail
            const icon = event?.icon ?? (action ? '◈' : '·')
            return (
              <li key={`${entry}-${index}`} className="mission-log-entry">
                <span className="mission-log-icon" aria-hidden="true">{icon}</span>
                <span className="min-w-0 flex-1 truncate text-xs text-slate-300">{label}</span>
                <span className="shrink-0 font-mono text-[9px] text-slate-600">{t.cycleLabel} {day}</span>
              </li>
            )
          }) : (
            <li className="py-5 text-center text-xs text-slate-500">{t.emptyMissionLogLabel}</li>
          )}
        </ol>
      ) : null}
    </section>
  )
}
