import { Activity, AlertTriangle, BatteryCharging, Radiation, Shield, Zap } from 'lucide-react'
import { CREW_DAILY_ROUTINE, ENVIRONMENT, POWER_SYSTEM, getCrewDailyRoutine, getCrewSolDurationHours, getSurvivalBatteryRuntimeHours } from '../game/constants'
import { getCrewDailyEclssBalance, getPowerLoadKw, getSolarOutputKw, hasRegolithDustMitigation, isLunarNight, type EmergencyLevel, type GameState } from '../game/model'
import { useGameStore } from '../store/gameStore'
import { useSettingsStore } from '../store/settingsStore'

const EMERGENCY_RESPONSES: Record<Exclude<EmergencyLevel, 0>, { en: string; ar: string }> = {
  1: { en: 'Solar storm — shelter the crew', ar: 'عاصفة شمسية — احتموا في الملجأ' },
  2: { en: 'Pressure leak — seal section & don suits', ar: 'تسرّب ضغط — اعزلوا القسم وارتدوا البدلات' },
  3: { en: 'Power failure — switch to backup grid', ar: 'عطل طاقة — انتقلوا إلى شبكة الاحتياط' },
  4: { en: 'Medical emergency — report to clinic', ar: 'طارئ طبي — توجهوا إلى العيادة' },
}

export function SurvivalSystems({ state }: { state: GameState }) {
  const language = useSettingsStore((store) => store.language)
  const setEmergencyLevel = useGameStore((store) => store.setEmergencyLevel)
  const arabic = language === 'ar'
  const eclss = getCrewDailyEclssBalance(
    state.crewSize,
    state.difficulty,
    state.buildings.includes('water-recycler') && !(state.offlineBuildings || []).includes('water-recycler'),
    state.buildings.includes('life-support') && !(state.offlineBuildings || []).includes('life-support'),
    state.destination,
  )
  const lunarNight = state.destination === 'moon' && isLunarNight(state.day)
  const dayRoutine = getCrewDailyRoutine(state.destination)
  const powerLoad = getPowerLoadKw(state)
  const solarOutput = getSolarOutputKw(state.destination)

  return (
    <details className="mission-detail-disclosure mb-4">
      <summary>
        {arabic ? 'أنظمة البقاء وجدول الطاقم' : 'Life support & crew routine'}
        <span>
          {state.survivalMode
            ? `${arabic ? 'وضع النجاة' : 'SURVIVAL MODE'} · ${POWER_SYSTEM.survivalLoadKw} kW`
            : `${arabic ? 'حمل الطاقة' : 'POWER LOAD'} · ${powerLoad} kW`}
        </span>
      </summary>
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <section className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
          <h3 className="flex items-center gap-2 text-xs font-black text-cyan-100"><Activity size={14} />{arabic ? 'روتين اليوم' : 'DAILY CREW ROUTINE'}</h3>
          <p className="mt-1 text-[10px] text-slate-500">
            {arabic ? 'مدة اليوم' : 'Sol length'}: {getCrewSolDurationHours(state.destination).toFixed(2)} {arabic ? 'ساعة' : 'hours'}
            {state.destination === 'mars' ? ' · 24 h 39 min' : ''}
          </p>
          <ol className="mt-3 grid gap-1.5 sm:grid-cols-2">
            {dayRoutine.map((item) => (
              <li key={item.id} className="flex justify-between gap-2 rounded-lg bg-black/15 px-2.5 py-1.5 text-[10px] text-slate-300">
                <span>{item.label[language]}</span>
                <b className="shrink-0 text-cyan-100">{item.hours.toFixed(item.hours % 1 ? 1 : 0)} h</b>
              </li>
            ))}
          </ol>
          <p className="mt-2 text-[9px] leading-4 text-slate-500">
            {arabic ? 'النوم في أسرّة عادية على السطح؛ يُقيّد الطاقم بأكياس النوم في انعدام الجاذبية.' : 'Normal beds on the surface; crew are restrained in sleeping bags in microgravity.'}
          </p>
          <span className="sr-only">{CREW_DAILY_ROUTINE.length} routine blocks</span>
        </section>

        <section className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
          <h3 className="flex items-center gap-2 text-xs font-black text-emerald-100"><Shield size={14} />{arabic ? 'دعم الحياة والبيئة' : 'ECLSS & ENVIRONMENT'}</h3>
          <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
            <SystemValue label={arabic ? 'أكسجين / فرد / يوم' : 'Oxygen / crew / day'} value={`${eclss.oxygenConsumedKg.toFixed(2)} kg`} />
            <SystemValue label={arabic ? 'ماء / فرد / يوم' : 'Water / crew / day'} value={`${eclss.waterConsumedLiters.toFixed(2)} L`} />
            <SystemValue label={arabic ? 'غذاء / فرد / يوم' : 'Food / crew / day'} value={`${eclss.foodConsumedKg.toFixed(2)} kg`} />
            <SystemValue label={arabic ? 'CO₂ / فرد / يوم' : 'CO₂ / crew / day'} value={`${eclss.co2ProducedKg / state.crewSize} kg`} />
            <SystemValue label={arabic ? 'الماء المستعاد' : 'Water recovered'} value={`${Math.round(eclss.totalWaterRecoveredLiters / Math.max(eclss.waterConsumedLiters, 1) * 100)}%`} />
            <SystemValue label={arabic ? 'إشعاع تراكمي' : 'Cumulative radiation'} value={`${state.radiationExposure.toFixed(1)} mSv`} />
          </div>
          {state.permanentRadiationDamageWarning ? (
            <p role="alert" className="mt-2 flex items-center gap-1.5 text-[10px] font-bold text-rose-200"><Radiation size={13} />{arabic ? 'تحذير: تجاوز حد المهنة المرجعي 600 mSv.' : 'Warning: cumulative dose reached the 600 mSv career-limit reference.'}</p>
          ) : null}
          {state.oxygenEmergencyHoursRemaining !== null ? (
            <p role="alert" className="mt-2 flex items-center gap-1.5 text-[10px] font-bold text-rose-200"><AlertTriangle size={13} />{arabic ? `نفد الأكسجين — ${state.oxygenEmergencyHoursRemaining} ساعة حتى فقدان الطاقم.` : `Oxygen depleted — ${state.oxygenEmergencyHoursRemaining} game hours until crew loss.`}</p>
          ) : null}
          {lunarNight ? <p className="mt-2 text-[10px] text-sky-100">🌑 {arabic ? `ليل قمري (~${ENVIRONMENT.lunarNightDays} يومًا): لا طاقة شمسية، ${ENVIRONMENT.lunarNightTemperatureCelsius}°C.` : `Lunar night (~${ENVIRONMENT.lunarNightDays} days): zero solar power, ${ENVIRONMENT.lunarNightTemperatureCelsius}°C.`}</p> : null}
          {state.destination === 'moon' ? <p className={`mt-2 text-[10px] ${hasRegolithDustMitigation(state) ? 'text-emerald-100' : 'text-amber-100'}`}>{hasRegolithDustMitigation(state) ? '✓ ' : '⚠️ '}{arabic ? 'تقليل غبار الثرى يتطلب منفذ بدلة ودرع EDS نشطين.' : 'Regolith dust mitigation requires an installed suitport and an online EDS.'}</p> : null}
          {state.dustStormDaysRemaining > 0 ? <p className="mt-2 text-[10px] text-amber-100">🌫️ {arabic ? `عاصفة غبار: ${state.dustStormDaysRemaining} أيام، انخفاض الطاقة الشمسية ${Math.round(state.dustStormSolarLossFraction * 100)}٪.` : `Dust storm: ${state.dustStormDaysRemaining} days, solar output down ${Math.round(state.dustStormSolarLossFraction * 100)}%.`}</p> : null}
          <p className="mt-2 text-[9px] leading-4 text-slate-500">
            {arabic ? 'معدلات تعليمية مبسطة؛ تفاعل ساباتيه يعيد نظريًا 0.818 L ماء لكل kg من CO₂.' : 'Simplified educational rates; Sabatier stoichiometry yields about 0.818 L water per kg CO₂.'}
          </p>
        </section>
      </div>

      <section className="mt-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-xs font-black text-amber-100"><Zap size={14} />{arabic ? 'الطاقة والاستجابة للطوارئ' : 'POWER & EMERGENCY RESPONSE'}</h3>
            <p className="mt-1 text-[10px] text-slate-500">
              {arabic
                ? `الشمس: ${solarOutput} kW · المفاعل: 25 kW ثابت · البطارية: 200 kWh (نحو ${getSurvivalBatteryRuntimeHours().toFixed(1)} ساعة عند حمل النجاة ${POWER_SYSTEM.survivalLoadKw} kW).`
                : `Solar: ${solarOutput} kW · reactor: 25 kW constant · battery: 200 kWh (about ${getSurvivalBatteryRuntimeHours().toFixed(1)} h at ${POWER_SYSTEM.survivalLoadKw} kW survival load).`}
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {([1, 2, 3, 4] as const).map((level) => (
              <button
                key={level}
                type="button"
                aria-pressed={state.emergencyLevel === level}
                onClick={() => setEmergencyLevel(state.emergencyLevel === level ? 0 : level)}
                className={`rounded-lg border px-2 py-1.5 text-[9px] font-bold ${state.emergencyLevel === level ? 'border-amber-200/30 bg-amber-100/10 text-amber-100' : 'border-white/10 bg-white/[0.03] text-slate-300'}`}
              >
                {arabic ? `مستوى ${level}` : `Level ${level}`}
              </button>
            ))}
          </div>
        </div>
        <p className="mt-2 text-[10px] text-slate-400">
          {state.emergencyLevel ? EMERGENCY_RESPONSES[state.emergencyLevel][language] : (arabic ? 'لا توجد استجابة طوارئ نشطة.' : 'No emergency response active.')}
        </p>
        {state.survivalMode ? <p className="mt-1 flex items-center gap-1.5 text-[10px] font-bold text-amber-100"><BatteryCharging size={13} />{arabic ? 'أُوقفت المباني الإنتاجية؛ تعمل أحمال الموئل والقيادة والاتصالات وغرفة الضغط والتخزين فقط.' : 'Productive facilities are shut down; habitat, command, communications, airlock and storage loads remain.'}</p> : null}
      </section>
    </details>
  )
}

function SystemValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-black/15 px-2.5 py-2">
      <p className="text-slate-500">{label}</p>
      <p className="mt-1 font-bold text-slate-100">{value}</p>
    </div>
  )
}
