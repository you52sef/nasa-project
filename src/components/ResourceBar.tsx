import type { ResourceName, Resources } from '../game/model'
import { formatResourceValue, RESOURCE_META } from '../game/resources'

interface Props {
  resources: Resources
  language: 'ar' | 'en'
  energyCapacity: number
}

export function ResourceBar({ resources, language, energyCapacity }: Props) {
  return (
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5" aria-label={language === 'ar' ? 'حالة الموارد' : 'Resource status'}>
      {Object.entries(RESOURCE_META).map(([id, meta]) => {
        const resource = id as ResourceName
        const value = resources[resource]
        const capacity = id === 'energy' ? energyCapacity : 100
        const tone = value <= capacity * 0.25 ? 'resource-danger' : value <= capacity * 0.5 ? 'resource-warn' : 'resource-safe'
        const reading = id === 'health'
          ? formatResourceValue(resource, value, language)
          : id === 'energy'
            ? `${formatResourceValue(resource, value, language)} / ${capacity} kWh`
            : formatResourceValue(resource, value, language)
        return (
          <article key={id} className="glass-panel min-w-0 p-3 sm:p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="truncate text-xs font-semibold text-slate-300 sm:text-sm">
                <span className="me-1.5">{meta.icon}</span>{meta.label[language]}
              </span>
              <span className={`tabular-nums text-sm font-black ${value <= capacity * 0.25 ? 'text-rose-300' : 'text-slate-100'}`}>{reading}</span>
            </div>
            <div
              className="h-2 overflow-hidden rounded-full bg-white/[0.07]"
              role="meter"
              aria-label={`${meta.label[language]} · ${reading}`}
              aria-valuemin={0}
              aria-valuemax={capacity}
              aria-valuenow={Math.round(value)}
            >
              <div className={`resource-fill h-full rounded-full transition-[width] duration-700 ${tone}`} style={{ width: `${Math.max(0, Math.min(100, value / capacity * 100))}%` }} />
            </div>
            <p className="mt-2 text-[10px] text-slate-600">{language === 'ar' ? 'قيمة تقديرية تعليمية' : 'EDUCATIONAL ESTIMATE'}</p>
          </article>
        )
      })}
    </section>
  )
}
