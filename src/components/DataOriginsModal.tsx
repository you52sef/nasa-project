import { Database, ExternalLink, X } from 'lucide-react'
import { CO2_PER_CREW_DAY, ENVIRONMENT, FOOD_PER_CREW_DAY, OXYGEN_PER_CREW_DAY, POWER_SYSTEM, WATER_PER_CREW_DAY, WATER_RECYCLE_RATE, getCrewDailyRoutine } from '../game/constants'
import { getConstructionDurationHours } from '../game/buildings'
import { SIMULATED_TRANSIT_DAYS } from '../game/flightPhysics'
import { useSettingsStore } from '../store/settingsStore'

const factSources = {
  moon: 'https://science.nasa.gov/moon/facts/',
  mars: 'https://science.nasa.gov/mars/facts/',
  water: 'https://science.nasa.gov/moon/moon-water-and-ices/',
}

export function DataOriginsModal({ onClose }: { onClose: () => void }) {
  const language = useSettingsStore((state) => state.language)
  const ar = language === 'ar'
  const copy = (en: string, arabic: string) => ar ? arabic : en
  const number = (value: number, digits = 2) => new Intl.NumberFormat(language, { maximumFractionDigits: digits }).format(value)
  const metrics = [
    {
      title: copy('Environmental references', 'مراجع البيئة'),
      type: copy('Scientific context · NASA references', 'سياق علمي · مراجع NASA'),
      source: [
        [copy('Moon facts', 'حقائق القمر'), factSources.moon],
        [copy('Mars facts', 'حقائق المريخ'), factSources.mars],
      ] as const,
      items: [
        [copy('Lunar gravity', 'جاذبية القمر'), `${number(ENVIRONMENT.moonGravityEarthG, 3)} g`],
        [copy('Mars gravity', 'جاذبية المريخ'), `${number(ENVIRONMENT.marsGravityEarthG, 2)} g`],
        [copy('Mars surface pressure', 'ضغط سطح المريخ'), `${number(ENVIRONMENT.marsAtmosphericPressureEarthFraction * 100, 1)}% ${copy('of Earth', 'من الأرض')}`],
        [copy('Mars communication delay', 'تأخير اتصال المريخ'), `${ENVIRONMENT.marsCommunicationDelayMinutes.min}–${ENVIRONMENT.marsCommunicationDelayMinutes.max} ${copy('minutes', 'دقيقة')}`],
        [copy('Lunar night', 'الليل القمري'), `~${ENVIRONMENT.lunarNightDays} ${copy('Earth days', 'يومًا أرضيًا')}`],
      ],
    },
    {
      title: copy('Crew supply rates', 'معدلات إمداد الطاقم'),
      type: copy('Game inputs · educational adaptations, not NASA operating requirements', 'مدخلات اللعبة · تكييفات تعليمية وليست متطلبات تشغيلية من NASA'),
      source: [[copy('NASA Moon water context', 'مرجع NASA لماء القمر'), factSources.water]] as const,
      items: [
        [copy('Oxygen per crew member / day', 'الأكسجين لكل فرد / يوم'), `${number(OXYGEN_PER_CREW_DAY)} kg`],
        [copy('Water per crew member / day', 'الماء لكل فرد / يوم'), `${number(WATER_PER_CREW_DAY)} L`],
        [copy('Packaged food per crew member / day', 'الغذاء المعبأ لكل فرد / يوم'), `${number(FOOD_PER_CREW_DAY)} kg`],
        [copy('CO₂ produced per crew member / day', 'ثاني أكسيد الكربون لكل فرد / يوم'), `${number(CO2_PER_CREW_DAY)} kg`],
      ],
    },
    {
      title: copy('ECLSS & power rules', 'قواعد دعم الحياة والطاقة'),
      type: copy('Game balance · simplified flows and short-cycle scaling', 'موازنة اللعبة · تدفقات مبسطة وتحجيم لدورة قصيرة'),
      source: [],
      items: [
        [copy('Water recovery · Easy / Medium / Hard', 'استرداد الماء · سهل / متوسط / صعب'), `${number(WATER_RECYCLE_RATE.easy * 100, 0)}% / ${number(WATER_RECYCLE_RATE.normal * 100, 0)}% / ${number(WATER_RECYCLE_RATE.hard * 100, 0)}%`],
        [copy('Solar nameplate · Moon / Mars', 'قدرة الشمس الاسمية · القمر / المريخ'), `${POWER_SYSTEM.solarOutputKw.moon} / ${POWER_SYSTEM.solarOutputKw.mars} kW`],
        [copy('Fission reactor nameplate', 'قدرة المفاعل الاسمية'), `${POWER_SYSTEM.reactorOutputKw} kW`],
        [copy('Battery storage', 'سعة البطارية'), `${POWER_SYSTEM.batteryCapacityKwh} kWh`],
        [copy('Survival-mode base load', 'حمل وضع النجاة'), `${POWER_SYSTEM.survivalLoadKw} kW`],
        [copy('Habitat operating load', 'حمل تشغيل وحدة السكن'), `${POWER_SYSTEM.operatingLoadsKw.habitat} kW`],
        [copy('ISRU / greenhouse operating load', 'حمل تشغيل وحدة الموارد / الدفيئة'), `${POWER_SYSTEM.operatingLoadsKw.isru} / ${POWER_SYSTEM.operatingLoadsKw.greenhouse} kW`],
        [copy('Energy budget per simulated day', 'ميزانية الطاقة لكل يوم محاكى'), `${number(POWER_SYSTEM.energyBudgetHoursPerCycle * 60, 0)} ${copy('rated minutes', 'دقيقة قدرة اسمية')}`],
      ],
    },
    {
      title: copy('Radiation & routine', 'الإشعاع والروتين'),
      type: copy('Game rules · dose references and scheduled crew activities', 'قواعد اللعبة · مراجع الجرعة وأنشطة الطاقم المجدولة'),
      source: [],
      items: [
        [copy('Simulated transit window · Moon / Mars', 'زمن العبور المحاكى · القمر / المريخ'), `${SIMULATED_TRANSIT_DAYS.moon} / ${SIMULATED_TRANSIT_DAYS.mars} ${copy('days per leg', 'أيام لكل اتجاه')}`],
        [copy('Transit dose', 'جرعة العبور'), `${number(ENVIRONMENT.transitRadiationMsvPerDay)} mSv / day`],
        [copy('Mars surface dose', 'جرعة سطح المريخ'), `${number(ENVIRONMENT.marsSurfaceRadiationMsvPerDay)} mSv / day`],
        [copy('Career-limit reference', 'مرجع حد الجرعة المهنية'), `${ENVIRONMENT.careerRadiationLimitMsv} mSv`],
        [copy('Mandatory exercise', 'التمرين الإلزامي'), `${getCrewDailyRoutine('moon').find((item) => item.id === 'exercise')?.hours} ${copy('hours / day', 'ساعة / يوم')}`],
        [copy('Habitat construction · Moon / Mars', 'بناء وحدة السكن · القمر / المريخ'), `${getConstructionDurationHours('habitat', 'moon')} / ${getConstructionDurationHours('habitat', 'mars')} ${copy('hours', 'ساعة')}`],
        [copy('Solar field / reactor / battery construction', 'بناء الحقل الشمسي / المفاعل / البطارية'), `${getConstructionDurationHours('solar-panels', 'moon')} / ${getConstructionDurationHours('reactor', 'moon')} / ${getConstructionDurationHours('battery', 'moon')} ${copy('hours', 'ساعة')}`],
        [copy('ISRU construction · Moon / Mars', 'بناء وحدة الموارد · القمر / المريخ'), `${getConstructionDurationHours('isru', 'moon')} / ${getConstructionDurationHours('isru', 'mars')} ${copy('hours', 'ساعة')}`],
        [copy('Greenhouse construction', 'بناء الدفيئة'), `${getConstructionDurationHours('greenhouse', 'moon')} ${copy('hours', 'ساعة')}`],
      ],
    },
  ]

  return (
    <div className="modal-backdrop fixed inset-0 z-[110] overflow-y-auto p-3 sm:p-6" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <section role="dialog" aria-modal="true" aria-labelledby="data-origins-title" className="modal-card my-4 max-w-5xl" dir={ar ? 'rtl' : 'ltr'}>
        <header className="flex items-start justify-between gap-4 border-b border-white/[0.08] pb-4">
          <div>
            <p className="eyebrow"><Database size={13} /> {copy('SIMULATION REFERENCE', 'مرجع المحاكاة')}</p>
            <h2 id="data-origins-title" className="mt-2 text-2xl font-black">{copy('Data & NASA Origins', 'البيانات ومصادر NASA')}</h2>
            <p className="mt-2 max-w-3xl text-xs leading-6 text-slate-400">
              {copy('Scientific environment references are separated from game parameters. Resource rates, radiation doses, power-cycle scaling, and construction times are training adaptations; this prototype is not NASA-endorsed or an engineering model.', 'نفصل مراجع البيئة العلمية عن معاملات اللعبة. معدلات الموارد وجرعات الإشعاع وتحجيم الطاقة ومدد البناء تكييفات تدريبية؛ هذا النموذج غير معتمد من NASA وليس نموذجًا هندسيًا.')}
            </p>
          </div>
          <button type="button" onClick={onClose} className="icon-button shrink-0" aria-label={copy('Close data reference', 'إغلاق مرجع البيانات')}><X size={17} /></button>
        </header>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {metrics.map((section) => (
            <article key={section.title} className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4 sm:p-5">
              <h3 className="text-sm font-black text-cyan-100">{section.title}</h3>
              <p className="mt-1 text-[9px] leading-4 text-slate-500">{section.type}</p>
              <dl className="mt-4 space-y-2">
                {section.items.map(([label, value]) => (
                  <div key={label} className="flex items-start justify-between gap-3 border-b border-white/[0.05] pb-2 last:border-0">
                    <dt className="text-[10px] text-slate-400">{label}</dt>
                    <dd className="text-end text-[10px] font-bold tabular-nums text-slate-100">{value}</dd>
                  </div>
                ))}
              </dl>
              {section.source.length ? (
                <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
                  {section.source.map(([label, href]) => (
                    <li key={href}><a className="inline-flex items-center gap-1 text-[10px] text-sky-200 underline decoration-sky-200/30 underline-offset-2 hover:text-white" href={href} target="_blank" rel="noreferrer">{label}<ExternalLink size={10} /></a></li>
                  ))}
                </ul>
              ) : null}
            </article>
          ))}
        </div>
        <p className="mt-4 rounded-xl border border-amber-200/10 bg-amber-200/[0.025] p-3 text-[10px] leading-5 text-amber-100/80">
          {copy('Source note: NASA pages linked here support the environmental context only. The crew consumption, water-recovery percentages, radiation doses, and power loads are explicit scenario inputs supplied for this game and are not presented as NASA-certified life-support specifications.', 'ملاحظة المصدر: تدعم روابط NASA السياق البيئي فقط. استهلاك الطاقم ونسب استرداد الماء وجرعات الإشعاع وأحمال الطاقة مدخلات محددة لهذه اللعبة وليست مواصفات دعم حياة معتمدة من NASA.')}
        </p>
      </section>
    </div>
  )
}
