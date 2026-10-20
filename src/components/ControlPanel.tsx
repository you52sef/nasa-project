import { Dumbbell, FlaskConical, Hammer, MoveUpRight, ShieldCheck } from 'lucide-react'
import { ACTIVITY_DURATIONS, canScheduleActivity, getCompletedWorkShifts, getRoleIneligibleMessage, isCrewMemberAvailable, type Action, type GameState } from '../game/model'
import { getAllowedSpecialistActions } from '../game/teamwork'
import ar from '../i18n/ar'
import en from '../i18n/en'
import { useSettingsStore } from '../store/settingsStore'

type ActionCopyKey = 'research' | 'researchDesc' | 'explore' | 'exploreDesc' | 'maintenance' | 'maintenanceDesc' | 'exercise' | 'exerciseDesc' | 'rest' | 'restDesc'

const actions: { id: Action; icon: typeof FlaskConical; title: ActionCopyKey; description: ActionCopyKey; tone: string }[] = [
  { id: 'research', icon: FlaskConical, title: 'research', description: 'researchDesc', tone: 'action-sky' },
  { id: 'explore', icon: MoveUpRight, title: 'explore', description: 'exploreDesc', tone: 'action-amber' },
  { id: 'maintenance', icon: Hammer, title: 'maintenance', description: 'maintenanceDesc', tone: 'action-violet' },
  { id: 'exercise', icon: Dumbbell, title: 'exercise', description: 'exerciseDesc', tone: 'action-sky' },
  { id: 'rest', icon: ShieldCheck, title: 'rest', description: 'restDesc', tone: 'action-emerald' },
]

export function ControlPanel({ state, disabled, onAction }: { state: GameState; disabled: boolean; onAction: (action: Action) => void }) {
  const language = useSettingsStore((state) => state.language)
  const t = language === 'ar' ? ar : en
  const isArabic = language === 'ar'
  const remainingHours = Math.max(0, 22 - state.hour)
  const allowedActions = getAllowedSpecialistActions(state)
  return (
    <section className="glass-panel p-4 sm:p-5">
      <div className="mb-4 flex items-end justify-between">
        <div>
          <p className="eyebrow"><span className="h-1.5 w-1.5 rounded-full bg-amber-300" /> {t.chooseStrategyLabel}</p>
          <h2 className="mt-2 text-lg font-black text-white">{t.control}</h2>
        </div>
        <span className="rounded-lg border border-white/[0.08] px-2 py-1 text-[10px] tabular-nums text-slate-400">
          {remainingHours} {t.hoursLeftInShift}
        </span>
      </div>
      <p className="mb-3 text-[10px] font-semibold text-cyan-100/75" aria-live="polite">
        {isArabic ? 'خطة اليوم' : "TODAY'S PLAN"}: {getCompletedWorkShifts(state.todayActions)}/2 {t.dailyWorkRequirement}
        {' · '}
        {state.todayActions.includes('exercise')
          ? isArabic ? '✓ التمرين مكتمل' : '✓ Exercise complete'
          : isArabic ? 'التمرين اليومي مطلوب' : 'Daily exercise still needed'}
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {actions.map(({ id, icon: Icon, title, description, tone }) => {
          const roleMessage = !allowedActions.includes(id)
            ? getRoleIneligibleMessage(state, id, language)
            : ''
          const unavailableMessage = !roleMessage && state.controlledDutyId && !isCrewMemberAvailable(state, state.controlledDutyId)
            ? isArabic ? 'فرد الطاقم غير متاح؛ أدرج الراحة والتعافي أولاً.' : 'Crew member unavailable: schedule rest and recovery first.'
            : ''
          const restrictionMessage = roleMessage || unavailableMessage
          const restrictionId = `crew-action-${id}-restriction`
          return (
            <button
              key={id}
              type="button"
              onClick={() => onAction(id)}
              disabled={disabled || !allowedActions.includes(id) || !canScheduleActivity(state, id)}
              aria-describedby={restrictionMessage ? restrictionId : undefined}
              className={`decision-card ${tone} disabled:cursor-not-allowed disabled:opacity-40`}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.07]"><Icon size={17} /></span>
              <span className="min-w-0 text-start">
                <span className="block text-sm font-bold text-slate-100">{t[title]}</span>
                <span className="mt-1 block text-[10px] leading-relaxed text-slate-500">{t[description]}</span>
                <span className="mt-1 block text-[10px] text-cyan-100/60">{ACTIVITY_DURATIONS[id]} {t.hoursShort}</span>
                {restrictionMessage ? <span id={restrictionId} className="mt-1 block text-[9px] leading-relaxed text-rose-200">{restrictionMessage}</span> : null}
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
