import { getEnergyCapacity, getHabitatPressureKpa, type GameState, type ResourceName } from '../game/model'
import { formatResourceValue, RESOURCE_META } from '../game/resources'

export function TelemetryDashboard({ state, language }: { state: GameState; language: 'ar' | 'en' }) {
  const isArabic = language === 'ar'
  const pressure = getHabitatPressureKpa(state)
  const dose = state.radiationExposure
  const readings: Array<{
    id: string
    icon: string
    label: string
    value: string
    percentage: number
    tone: 'safe' | 'warn' | 'danger'
  }> = (['oxygen', 'water', 'food', 'energy'] as ResourceName[]).map((id) => {
    const resource = state.resources[id]
    const capacity = id === 'energy' ? getEnergyCapacity(state) : 100
    return {
      id,
      icon: RESOURCE_META[id].icon,
      label: RESOURCE_META[id].label[language],
      value: formatResourceValue(id, resource, language),
      percentage: Math.max(0, Math.min(100, resource / capacity * 100)),
      tone: resource <= capacity * 0.15 ? 'danger' : resource <= capacity * 0.3 ? 'warn' : 'safe',
    }
  })
  readings.push({
    id: 'pressure',
    icon: '◉',
    label: isArabic ? 'ضغط المقصورة' : 'Cabin pressure',
    value: `${new Intl.NumberFormat(language, { maximumFractionDigits: 1 }).format(pressure)} kPa`,
    percentage: Math.max(0, Math.min(100, pressure / 101.3 * 100)),
    tone: pressure < 80 ? 'danger' : pressure < 95 ? 'warn' : 'safe',
  }, {
    id: 'radiation',
    icon: '☢',
    label: isArabic ? 'الإشعاع التراكمي' : 'Cumulative radiation',
    value: `${new Intl.NumberFormat(language, { maximumFractionDigits: 1 }).format(dose)} mSv`,
    percentage: Math.max(0, Math.min(100, dose / 600 * 100)),
    tone: dose >= 600 ? 'danger' : dose >= 450 ? 'warn' : 'safe',
  })

  return (
    <section className="mb-4 rounded-2xl border border-cyan-100/[0.09] bg-slate-950/55 p-3 sm:p-4" aria-label={isArabic ? 'لوحة القياسات الحيوية' : 'Unified mission telemetry'}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200/70">{isArabic ? 'قياسات حيوية مباشرة' : 'LIVE SYSTEMS TELEMETRY'}</p>
          <h2 className="mt-1 text-sm font-black text-white">{isArabic ? 'لوحة حالة المهمة' : 'Mission Status Dashboard'}</h2>
        </div>
        <span className={`rounded-full border px-2 py-1 text-[9px] font-bold ${state.ongoingLeak ? 'border-rose-200/20 bg-rose-300/[0.05] text-rose-100' : 'border-emerald-200/15 text-emerald-100'}`}>
          {state.ongoingLeak ? (isArabic ? 'تسرب ضغط' : 'PRESSURE LEAK') : (isArabic ? 'أنظمة المقصورة مستقرة' : 'CABIN SYSTEMS NOMINAL')}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        {readings.map((reading) => (
          <article key={reading.id} className="rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-2.5">
            <div className="flex items-center justify-between gap-1">
              <span className="truncate text-[10px] font-semibold text-slate-400"><span className="me-1">{reading.icon}</span>{reading.label}</span>
              <span className={`shrink-0 text-[10px] font-black tabular-nums ${reading.tone === 'danger' ? 'text-rose-200' : reading.tone === 'warn' ? 'text-amber-100' : 'text-slate-100'}`}>{reading.value}</span>
            </div>
            <div
              className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.07]"
              role="meter"
              aria-label={`${reading.label} ${reading.value}`}
              aria-valuemin={0}
              aria-valuemax={reading.id === 'radiation' ? 600 : reading.id === 'pressure' ? 101.3 : 100}
              aria-valuenow={reading.id === 'radiation' ? Math.min(600, dose) : reading.id === 'pressure' ? pressure : Math.round(reading.percentage)}
            >
              <div
                className={`h-full rounded-full transition-[width,background-color] duration-700 ${reading.tone === 'danger' ? 'bg-rose-300' : reading.tone === 'warn' ? 'bg-amber-200' : 'bg-gradient-to-r from-cyan-300 to-emerald-200'}`}
                style={{ width: `${reading.percentage}%` }}
              />
            </div>
            <p className="mt-1 text-[8px] uppercase tracking-wider text-slate-600">{reading.id === 'radiation' ? '600 mSv reference' : reading.id === 'pressure' ? '101.3 kPa nominal' : isArabic ? 'تقدير تدريبي' : 'LIVE ESTIMATE'}</p>
          </article>
        ))}
      </div>
      <p className="mt-2 text-[9px] leading-4 text-slate-600">{isArabic ? 'ضغط المقصورة التقديري نموذج توضيحي؛ وليس قراءة حساس حقيقية.' : 'Cabin pressure is an illustrative game estimate, not a real sensor reading.'}</p>
    </section>
  )
}
