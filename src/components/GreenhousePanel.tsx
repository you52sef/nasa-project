import { GREENHOUSE_CYCLE } from '../game/constants'
import type { GameState } from '../game/model'
import { useGameStore } from '../store/gameStore'
import { useSettingsStore } from '../store/settingsStore'

export function GreenhousePanel({ state }: { state: GameState }) {
  const language = useSettingsStore((store) => store.language)
  const isArabic = language === 'ar'
  const treatRegolith = useGameStore((store) => store.pretreatRegolith)
  const greenhouseOnline = state.buildings.includes('greenhouse') && !(state.offlineBuildings || []).includes('greenhouse')
  const isruOnline = state.buildings.includes('isru') && !(state.offlineBuildings || []).includes('isru')
  return (
    <section className="mb-4 rounded-2xl border border-emerald-200/10 bg-emerald-100/[0.025] p-4" aria-label={isArabic ? 'دفيئة الفضاء' : 'Space greenhouse'}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-200/70">{isArabic ? 'الزراعة الحيوية' : 'ASTRO-BOTANY'}</p>
          <h2 className="mt-1 text-sm font-black text-emerald-50">{isArabic ? 'دورة الدفيئة الفضائية' : 'Space Greenhouse Cycle'}</h2>
          <p className="mt-1 text-[10px] leading-5 text-slate-400">
            {isArabic
              ? `خلال ${GREENHOUSE_CYCLE.growthDays} أيام تشغيل: ${GREENHOUSE_CYCLE.foodKg} كغ غذاء و${GREENHOUSE_CYCLE.oxygenKg} كغ أكسجين؛ تستهلك ${GREENHOUSE_CYCLE.waterLitersPerDay} لتر ماء يوميًا وطاقة التشغيل.`
              : `Over ${GREENHOUSE_CYCLE.growthDays} powered days: ${GREENHOUSE_CYCLE.foodKg} kg food and ${GREENHOUSE_CYCLE.oxygenKg} kg O₂; consumes ${GREENHOUSE_CYCLE.waterLitersPerDay} L water per day plus operating power.`}
          </p>
        </div>
        <span className={`rounded-full border px-2.5 py-1 text-[9px] font-bold ${greenhouseOnline && state.regolithPreTreated ? 'border-emerald-200/20 text-emerald-100' : 'border-amber-200/20 text-amber-100'}`}>
          {greenhouseOnline && state.regolithPreTreated ? (isArabic ? 'دورة جاهزة' : 'CYCLE READY') : (isArabic ? 'مطلوب المعالجة' : 'TREATMENT REQUIRED')}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className={`text-[10px] ${state.regolithPreTreated ? 'text-emerald-100' : 'text-amber-100/80'}`}>
          {state.regolithPreTreated
            ? (isArabic ? '✓ أزيلت فوق الكلورات من الثرى' : '✓ Regolith perchlorates removed')
            : (isArabic ? 'الثرى غير معالج؛ فوق الكلورات سامة' : 'Untreated regolith contains toxic perchlorates')}
        </span>
        {!state.regolithPreTreated ? (
          <button
            type="button"
            onClick={treatRegolith}
            disabled={!isruOnline || state.resources.energy < GREENHOUSE_CYCLE.regolithTreatmentEnergyKwh}
            className="secondary-button !px-3 !py-2 text-[10px] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isArabic ? `معالجة الثرى · ${GREENHOUSE_CYCLE.regolithTreatmentEnergyKwh} kWh` : `Pretreat regolith · ${GREENHOUSE_CYCLE.regolithTreatmentEnergyKwh} kWh`}
          </button>
        ) : null}
        {!isruOnline ? <span className="text-[9px] text-slate-500">{isArabic ? 'تتطلب وحدة ISRU فعّالة' : 'Requires an active ISRU plant'}</span> : null}
      </div>
    </section>
  )
}
