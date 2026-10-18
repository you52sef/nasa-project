import { useState } from 'react'
import { BUILDINGS } from '../game/buildings'
import { MISSION_OPERATIONS, canStartOperation } from '../game/operations'
import type { GameState } from '../game/model'
import { getMissionCrewAssignments } from '../game/teamwork'
import { useGameStore } from '../store/gameStore'
import { useSettingsStore } from '../store/settingsStore'

export function MissionOperations({ state }: { state: GameState }) {
  const language = useSettingsStore((store) => store.language)
  const isArabic = language === 'ar'
  const startOperation = useGameStore((store) => store.startOperation)
  const advanceOperation = useGameStore((store) => store.advanceOperation)
  const setOperationSiteDistance = useGameStore((store) => store.setOperationSiteDistance)
  const [siteDistance, setSiteDistance] = useState('100')
  const active = state.activeOperation
  const activeDefinition = active
    ? MISSION_OPERATIONS.find((operation) => operation.id === active.id)
    : undefined
  const controlledSpecialty = state.controlMode === 'specialist'
    ? getMissionCrewAssignments(state.crewSize, state.destination, state.maxDays)
      .find((assignment) => assignment.id === state.controlledDutyId)?.specialty
    : undefined
  const availableOperations = MISSION_OPERATIONS.filter((operation) =>
    !controlledSpecialty ||
    operation.requiredCrewSpecialties.some((group) => group.includes(controlledSpecialty)),
  )

  return (
    <section className="mb-4 rounded-2xl border border-cyan-200/10 bg-slate-950/45 p-4 sm:p-5" aria-labelledby="surface-operations-title">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200/70">{isArabic ? 'عمليات ميدانية مستقلة' : 'INDEPENDENT FIELD OPERATIONS'}</p>
          <h2 id="surface-operations-title" className="mt-1 text-base font-black text-white">{isArabic ? 'مركز العمليات السطحية' : 'Surface Operations'}</h2>
          <p className="mt-1 text-[11px] leading-5 text-slate-400">{isArabic ? 'اختر مهمة لدعم حملة القاعدة الحالية؛ لا تستبدل هدف البقاء اليومي.' : 'Launch an operation within the ongoing base campaign; daily survival objectives continue.'}</p>
        </div>
        {active ? (
          <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${active.status === 'active' ? 'border-cyan-200/20 text-cyan-100' : active.status === 'complete' ? 'border-emerald-200/20 text-emerald-200' : 'border-rose-200/20 text-rose-200'}`}>
            {active.status === 'active' ? (isArabic ? 'قيد التنفيذ' : 'IN PROGRESS') : active.status === 'complete' ? (isArabic ? 'مكتملة' : 'COMPLETE') : (isArabic ? 'فشلت' : 'FAILED')}
          </span>
        ) : null}
      </div>

      {active && activeDefinition ? (
        <div className="rounded-xl border border-cyan-200/10 bg-cyan-100/[0.025] p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-cyan-50">{activeDefinition.title[language]}</h3>
            <span className="text-[10px] text-slate-400">
              {active.id === 'science-expedition'
                ? `${isArabic ? 'أكسجين البدلة' : 'Suit O₂'} ${active.suitOxygenPercent}%`
                : ['maintenance', 'construction'].includes(active.id) && active.status === 'active' && active.cyclesRemaining > 0
                  ? `${active.id === 'maintenance' ? (isArabic ? 'دورات إصلاح متبقية' : 'Repair cycles left') : (isArabic ? 'دورات إنشاء متبقية' : 'Build cycles left')} ${active.cyclesRemaining}`
                  : active.partialDamage ? (isArabic ? 'ضرر جزئي' : 'PARTIAL DAMAGE') : ''}
            </span>
          </div>
          <p className="mt-1 text-[10px] text-slate-500">{activeDefinition.crew[language]}</p>
          <ol className="mt-3 grid gap-1.5 sm:grid-cols-2">
            {activeDefinition.steps.map((step, index) => (
              <li key={step.en} className={`rounded-lg px-2.5 py-2 text-[11px] ${index < active.step || active.status === 'complete' ? 'bg-emerald-200/[0.06] text-emerald-100' : index === active.step && active.status === 'active' ? 'bg-cyan-200/[0.08] text-cyan-50' : 'bg-white/[0.02] text-slate-500'}`}>
                <span className="me-1.5 font-mono">{index < active.step || active.status === 'complete' ? '✓' : `${index + 1}.`}</span>{step[language]}
              </li>
            ))}
          </ol>
          {active.id === 'construction' && active.status === 'active' && active.step === 0 ? (
            <label className="mt-3 block text-[11px] text-slate-300">
              {isArabic ? 'المسافة بين الموقع والموئل (وحدات)' : 'Site-to-habitat distance (units)'}
              <input
                type="number"
                min="0"
                step="1"
                value={siteDistance}
                onChange={(event) => {
                  setSiteDistance(event.target.value)
                  setOperationSiteDistance(Number(event.target.value))
                }}
                className="mt-1 block w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white sm:max-w-xs"
                aria-label={isArabic ? 'مسافة موقع الإنشاء عن الموئل' : 'Construction site distance from habitat'}
              />
            </label>
          ) : null}
          {active.status === 'active' ? (
            <button
              type="button"
              onClick={advanceOperation}
              disabled={active.id === 'construction' && active.step === 0 && active.siteDistanceUnits < 100}
              className="primary-button mt-3 !px-3 !py-2 text-xs disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isArabic ? 'تنفيذ الخطوة التالية' : 'Complete current step'}
            </button>
          ) : null}
          <p className="mt-3 text-[10px] leading-5 text-amber-100/70">{activeDefinition.failure[language]}</p>
        </div>
      ) : null}

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {availableOperations.map((operation) => {
          const ready = canStartOperation(state, operation.id)
          const localizedName = operation.title[language]
          const requirements = operation.requiredBuildings
            .map((id) => BUILDINGS[id]?.name[language] || id)
            .join(isArabic ? '، ' : ', ')
          const title = `${operation.crew[language]} · ${isArabic ? 'المرافق المطلوبة' : 'Required facilities'}: ${requirements}`
          return (
            <button
              key={operation.id}
              type="button"
              onClick={() => startOperation(operation.id)}
              disabled={!ready}
              title={title}
              className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3 text-start transition enabled:hover:border-cyan-200/30 enabled:hover:bg-cyan-100/[0.035] disabled:cursor-not-allowed disabled:opacity-45"
            >
              <span className="block text-xs font-bold text-slate-100">{localizedName}</span>
              <span className="mt-1 block text-[10px] leading-5 text-slate-400">{operation.crew[language]} · {requirements}</span>
              {!ready ? <span className="mt-1 block text-[9px] text-amber-100/60">{isArabic ? 'يتطلب طاقماً كافياً ومرافق جاهزة ومتاحة للوجهة' : 'Requires sufficient crew and active facilities for this destination'}</span> : null}
            </button>
          )
        })}
      </div>
    </section>
  )
}
