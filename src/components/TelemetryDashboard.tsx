import { getEnergyCapacity, getHabitatPressureKpa, getSupplyCapacity, type GameState, type ResourceName } from '../game/model'
import { getCabinEnvironmentAlert } from '../game/environmentEngine'
import { formatResourceValue, RESOURCE_META } from '../game/resources'
import { ENVIRONMENT } from '../game/constants'

export function TelemetryDashboard({ state, language }: { state: GameState; language: 'ar' | 'en' }) {
  const isArabic = language === 'ar'
  const pressure = getHabitatPressureKpa(state)
  const dose = state.radiationExposure
  const environmentAlert = getCabinEnvironmentAlert({
    pressureKpa: state.cabinPressureKpa,
    oxygenPartialPressureKpa: state.cabinOxygenPartialPressureKpa,
    co2PartialPressureKpa: state.cabinCo2PartialPressureKpa,
    temperatureC: state.cabinTemperatureC,
    scrubberHealth: state.scrubberHealth,
    crewStress: state.crewStress,
    crewPulseBpm: state.crewPulseBpm,
    airlockIsolated: state.airlockIsolated,
  })
  const readings: Array<{
    id: string
    icon: string
    label: string
    value: string
    percentage: number
    tone: 'safe' | 'warn' | 'danger'
  }> = (['oxygen', 'water', 'food', 'energy'] as ResourceName[]).map((id) => {
    const resource = state.resources[id]
    const capacity = id === 'energy'
      ? getEnergyCapacity(state)
      : id === 'health'
        ? 100
        : getSupplyCapacity(id, state.crewSize)
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
    id: 'oxygen-partial',
    icon: '◉',
    label: isArabic ? 'ضغط الأكسجين الجزئي' : 'O₂ partial pressure',
    value: `${new Intl.NumberFormat(language, { maximumFractionDigits: 2 }).format(state.cabinOxygenPartialPressureKpa)} kPa`,
    percentage: Math.max(0, Math.min(100, state.cabinOxygenPartialPressureKpa / 21.2 * 100)),
    tone: state.cabinOxygenPartialPressureKpa < 16 ? 'danger' : state.cabinOxygenPartialPressureKpa < 18 ? 'warn' : 'safe',
  }, {
    id: 'co2',
    icon: 'CO₂',
    label: isArabic ? 'ضغط CO₂ الجزئي' : 'CO₂ partial pressure',
    value: `${new Intl.NumberFormat(language, { maximumFractionDigits: 3 }).format(state.cabinCo2PartialPressureKpa)} kPa`,
    percentage: Math.max(0, Math.min(100, state.cabinCo2PartialPressureKpa / 3 * 100)),
    tone: state.cabinCo2PartialPressureKpa >= 1 ? 'danger' : state.cabinCo2PartialPressureKpa >= 0.5 ? 'warn' : 'safe',
  }, {
    id: 'temperature',
    icon: '°',
    label: isArabic ? 'حرارة المقصورة' : 'Cabin temperature',
    value: `${new Intl.NumberFormat(language, { maximumFractionDigits: 1 }).format(state.cabinTemperatureC)} °C`,
    percentage: Math.max(0, Math.min(100, (state.cabinTemperatureC + 20) / 50 * 100)),
    tone: state.cabinTemperatureC < 10 ? 'danger' : state.cabinTemperatureC < 18 ? 'warn' : 'safe',
  }, {
    id: 'scrubber',
    icon: '◌',
    label: isArabic ? 'حالة ممتص CO₂' : 'CO₂ scrubber health',
    value: `${Math.round(state.scrubberHealth)}%`,
    percentage: Math.max(0, Math.min(100, state.scrubberHealth)),
    tone: state.scrubberHealth < 20 ? 'danger' : state.scrubberHealth < 50 ? 'warn' : 'safe',
  }, {
    id: 'stress',
    icon: '♡',
    label: isArabic ? 'إجهاد الطاقم' : 'Crew stress',
    value: `${Math.round(state.crewStress)}%`,
    percentage: Math.max(0, Math.min(100, state.crewStress)),
    tone: state.crewStress >= 80 ? 'danger' : state.crewStress >= 55 ? 'warn' : 'safe',
  }, {
    id: 'pulse',
    icon: '♥',
    label: isArabic ? 'نبض العمل النموذجي' : 'Modeled work pulse',
    value: `${Math.round(state.crewPulseBpm)} bpm`,
    percentage: Math.max(0, Math.min(100, (state.crewPulseBpm - 40) / 160 * 100)),
    tone: state.crewPulseBpm >= 130 ? 'danger' : state.crewPulseBpm >= 100 ? 'warn' : 'safe',
  }, {
    id: 'radiation',
    icon: '☢',
    label: isArabic ? 'الإشعاع التراكمي' : 'Cumulative radiation',
    value: `${new Intl.NumberFormat(language, { maximumFractionDigits: 1 }).format(dose)} mSv`,
    percentage: Math.max(0, Math.min(100, dose / ENVIRONMENT.gameRadiationWarningThresholdMsv * 100)),
    tone: dose >= ENVIRONMENT.gameRadiationWarningThresholdMsv ? 'danger' : dose >= ENVIRONMENT.gameRadiationWarningThresholdMsv * 0.75 ? 'warn' : 'safe',
  })

  return (
    <section className="mb-4 rounded-2xl border border-cyan-100/[0.09] bg-slate-950/55 p-3 sm:p-4" aria-label={isArabic ? 'لوحة القياسات الحيوية' : 'Unified mission telemetry'}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200/70">{isArabic ? 'قياسات حيوية مباشرة' : 'LIVE SYSTEMS TELEMETRY'}</p>
          <h2 className="mt-1 text-sm font-black text-white">{isArabic ? 'لوحة حالة المهمة' : 'Mission Status Dashboard'}</h2>
        </div>
        <span className={`rounded-full border px-2 py-1 text-[9px] font-bold ${environmentAlert === 'nominal' ? 'border-emerald-200/15 text-emerald-100' : 'border-rose-200/20 bg-rose-300/[0.05] text-rose-100'}`}>
          {environmentAlert === 'nominal'
            ? (isArabic ? 'أنظمة المقصورة مستقرة' : 'CABIN SYSTEMS NOMINAL')
            : `${isArabic ? 'تنبيه بيئي' : 'ENVIRONMENT ALERT'} · ${isArabic
              ? ({ co2: 'ثاني أكسيد الكربون', oxygen: 'الأكسجين', pressure: 'الضغط', temperature: 'الحرارة', scrubber: 'المرشح', stress: 'إجهاد الطاقم' }[environmentAlert])
              : environmentAlert.toUpperCase()}`}
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
              aria-valuemin={reading.id === 'temperature' ? -100 : reading.id === 'pulse' ? 40 : 0}
              aria-valuemax={reading.id === 'radiation' ? ENVIRONMENT.gameRadiationWarningThresholdMsv : reading.id === 'pressure' ? 101.3 : reading.id === 'oxygen-partial' ? 21.2 : reading.id === 'co2' ? 3 : reading.id === 'temperature' ? 30 : reading.id === 'pulse' ? 200 : 100}
              aria-valuenow={reading.id === 'radiation' ? Math.min(ENVIRONMENT.gameRadiationWarningThresholdMsv, dose) : reading.id === 'pressure' ? pressure : reading.id === 'oxygen-partial' ? state.cabinOxygenPartialPressureKpa : reading.id === 'co2' ? state.cabinCo2PartialPressureKpa : reading.id === 'temperature' ? state.cabinTemperatureC : reading.id === 'pulse' ? state.crewPulseBpm : Math.round(reading.percentage)}
            >
              <div
                className={`block h-full w-full origin-left rounded-full transition-[transform,background-color] duration-700 ${reading.tone === 'danger' ? 'bg-rose-300' : reading.tone === 'warn' ? 'bg-amber-200' : 'bg-gradient-to-r from-cyan-300 to-emerald-200'}`}
                style={{ transform: `scaleX(${reading.percentage / 100})`, transformOrigin: isArabic ? 'right' : 'left' }}
              />
            </div>
            <p className="mt-1 text-[8px] uppercase tracking-wider text-slate-600">{reading.id === 'radiation' ? isArabic ? 'عتبة تدريبية · ليست حدًا صحيًا' : 'GAME THRESHOLD · NOT A HEALTH LIMIT' : reading.id === 'pressure' ? '101.3 kPa nominal' : isArabic ? 'تقدير تدريبي' : 'MODEL ESTIMATE'}</p>
          </article>
        ))}
      </div>
      <p className="mt-2 text-[9px] leading-4 text-slate-600">{isArabic ? 'الضغط والغازات والنبض والإجهاد تقديرات حتمية تعليمية وليست قراءات حساسات أو نموذجًا معتمدًا للطيران.' : 'Pressure, gases, pulse and stress are deterministic educational estimates, not sensor readings or a flight-qualified model.'}</p>
    </section>
  )
}
