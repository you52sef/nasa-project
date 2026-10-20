import { useEffect, useState } from 'react'
import { BUILDINGS } from '../game/buildings'
import { MISSION_OPERATIONS, canControlOperation, getOperationReadiness } from '../game/operations'
import type { GameState } from '../game/model'
import { useGameStore } from '../store/gameStore'
import { useSettingsStore } from '../store/settingsStore'

export function MissionOperations({ state }: { state: GameState }) {
  const language = useSettingsStore((store) => store.language)
  const isArabic = language === 'ar'
  const startOperation = useGameStore((store) => store.startOperation)
  const setOperationSiteDistance = useGameStore((store) => store.setOperationSiteDistance)
  const [siteDistance, setSiteDistance] = useState('100')
  const [stepProgress, setStepProgress] = useState(0)
  const active = state.activeOperation
  const activeDefinition = active
    ? MISSION_OPERATIONS.find((operation) => operation.id === active.id)
    : undefined
  const availableOperations = MISSION_OPERATIONS.filter((operation) =>
    canControlOperation(state, operation.id),
  )
  const canManageActiveOperation = Boolean(active && canControlOperation(state, active.id))
  const activeStepCount = activeDefinition?.steps.length ?? 1
  const waitingForBuildCycle = active?.id === 'construction' && active.step === 2 && active.cyclesRemaining > 0
  const waitingForSite = active?.id === 'construction' && active.step === 0 && active.siteDistanceUnits < 100

  useEffect(() => {
    if (!active || active.status !== 'active' || state.activeEvent || state.paused || state.isGameOver || waitingForBuildCycle || waitingForSite) {
      setStepProgress(0)
      return
    }
    const stepDurationMs = 6_000
    const startedAt = Date.now()
    let finished = false
    const timer = window.setInterval(() => {
      const elapsed = Math.min(stepDurationMs, Date.now() - startedAt)
      setStepProgress(elapsed / stepDurationMs * 100)
      if (elapsed >= stepDurationMs && !finished) {
        finished = true
        window.clearInterval(timer)
      }
    }, 100)
    return () => window.clearInterval(timer)
  }, [active?.id, active?.step, active?.status, active?.cyclesRemaining, active?.siteDistanceUnits, state.activeEvent, state.paused, state.isGameOver, waitingForBuildCycle, waitingForSite])

  if (availableOperations.length === 0 && !canManageActiveOperation) return null

  return (
    <section className="mb-4 min-w-0 rounded-2xl border border-cyan-200/10 bg-slate-950/45 p-3 sm:p-4" aria-labelledby="surface-operations-title">
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

      {active && activeDefinition && canManageActiveOperation ? (
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
            <div className="mt-3" role="status" aria-live="polite">
              <div className="mb-1.5 flex items-center justify-between gap-2 text-[10px]">
                <span className={waitingForBuildCycle || waitingForSite ? 'text-amber-100' : 'text-cyan-100'}>
                  {waitingForBuildCycle
                    ? (isArabic ? `بانتظار دورة تشغيل · ${active.cyclesRemaining} متبقية` : `Awaiting mission cycle · ${active.cyclesRemaining} remaining`)
                    : waitingForSite
                      ? (isArabic ? 'حدّد موقعاً يبعد ١٠٠ وحدة على الأقل' : 'Select a site at least 100 units away')
                      : (isArabic ? 'تقدم العملية المباشر' : 'LIVE OPERATION PROGRESS')}
                </span>
                <b className="tabular-nums text-slate-200">
                  {waitingForBuildCycle || waitingForSite ? '—' : `${Math.round(((active.step + stepProgress / 100) / activeStepCount) * 100)}%`}
                </b>
              </div>
              <div
                className="h-2 overflow-hidden rounded-full bg-white/[0.07]"
                role="progressbar"
                aria-label={isArabic ? 'تقدم العملية' : 'Operation progress'}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(((active.step + stepProgress / 100) / activeStepCount) * 100)}
              >
                <div
                  className="block h-full w-full origin-left rounded-full bg-gradient-to-r from-cyan-400 to-emerald-300 transition-transform duration-100"
                  style={{ transform: `scaleX(${((active.step + stepProgress / 100) / activeStepCount)})`, transformOrigin: isArabic ? 'right' : 'left' }}
                />
              </div>
              <p className="mt-1.5 text-[9px] text-slate-500">
                {isArabic ? 'تُسجّل القياسات الحية عند تقدم كل مرحلة في سجل العمليات.' : 'Live telemetry is added to the operations ticker as each step advances.'}
              </p>
            </div>
          ) : null}
          <p className="mt-3 text-[10px] leading-5 text-amber-100/70">{activeDefinition.failure[language]}</p>
        </div>
      ) : null}

      {availableOperations.length ? <div className="mt-3 grid min-w-0 gap-2 sm:grid-cols-2">
        {availableOperations.map((operation) => {
          const readiness = getOperationReadiness(state, operation.id)
          const ready = readiness.ready
          const localizedName = operation.title[language]
          const requirements = operation.requiredBuildings
            .map((id) => BUILDINGS[id]?.name[language] || id)
            .join(isArabic ? '، ' : ', ')
          const title = `${operation.crew[language]} · ${isArabic ? 'المرافق المطلوبة' : 'Required facilities'}: ${requirements}`
          return (
            <button
              key={operation.id}
              type="button"
              onClick={() => {
                startOperation(operation.id)
                if (operation.id === 'construction') setOperationSiteDistance(Number(siteDistance))
              }}
              disabled={!ready}
              title={title}
              className={`rounded-xl border p-3 text-start transition disabled:cursor-not-allowed ${ready ? 'border-emerald-300/30 bg-emerald-200/[0.06] enabled:hover:border-emerald-200/50 enabled:hover:bg-emerald-100/[0.1]' : 'border-white/[0.07] bg-white/[0.025] opacity-55'}`}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-100">{localizedName}</span>
                <span className={`shrink-0 text-[9px] font-black uppercase tracking-wide ${ready ? 'text-emerald-200' : 'text-amber-100/65'}`}>
                  {ready ? (isArabic ? 'جاهز للإطلاق' : 'READY TO LAUNCH') : (isArabic ? 'غير جاهز' : 'NOT READY')}
                </span>
              </span>
              <span className="mt-1 block text-[10px] leading-5 text-slate-400">{operation.crew[language]} · {requirements}</span>
              {!ready ? <span className="mt-1 block text-[9px] text-amber-100/60">
                {readiness.blocker === 'facility'
                  ? (isArabic ? 'المرافق المطلوبة غير مكتملة أو غير متصلة.' : 'Required facilities are missing or offline.')
                  : readiness.blocker === 'crew'
                    ? (isArabic ? 'يلزم توافر عدد وتخصصات الطاقم المطلوبة.' : 'Required crew count or specialties are unavailable.')
                    : readiness.blocker === 'busy'
                      ? (isArabic ? 'أكمل العملية النشطة أولاً.' : 'Complete the active operation first.')
                      : readiness.blocker === 'cargo'
                        ? (isArabic ? 'شحنة قطع الغيار غير كافية.' : 'Insufficient spare-parts cargo.')
                        : readiness.blocker === 'role'
                          ? (isArabic ? 'الدور المحدد لا يملك صلاحية بدء هذه العملية.' : 'Your assigned role cannot launch this operation.')
                          : readiness.blocker === 'destination'
                            ? (isArabic ? 'هذه العملية غير متاحة على الوجهة الحالية.' : 'This operation is unavailable at this destination.')
                            : (isArabic ? 'تُتاح العملية على السطح فقط.' : 'Operations launch only from the surface phase.')}
              </span> : null}
            </button>
          )
        })}
      </div> : null}
    </section>
  )
}
