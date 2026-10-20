import { useState } from 'react'
import { getCrewCondition, getCrewRoleEfficiency, isCrewMemberAvailable, type GameState } from '../game/model'
import { getMissionCrewAssignments } from '../game/teamwork'
import { getMissionSpecialization, localizeCrewRole, localizeCrewSpecialty, type CrewSpecialty } from '../game/crewRosters'
import { useGameStore } from '../store/gameStore'
import { useSettingsStore } from '../store/settingsStore'
import ar from '../i18n/ar'
import en from '../i18n/en'

const SPECIALTY_OPTIONS: readonly CrewSpecialty[] = [
  'command', 'pilot', 'science', 'medical', 'engineering', 'communications',
  'power', 'resources', 'robotics', 'agriculture', 'agriculture-resources',
  'science-medical', 'engineering-science', 'geology-agriculture',
]

export function CrewCouncil({
  state,
  onSelect,
  onReassign,
}: {
  state: GameState
  onSelect: (dutyId: string) => void
  onReassign: (dutyId: string, specialty: CrewSpecialty) => void
}) {
  const language = useSettingsStore((store) => store.language)
  const t = language === 'ar' ? ar : en
  const duties = getMissionCrewAssignments(state.crewSize, state.destination, state.maxDays, state.crewSpecialtyOverrides)
  const activeDuty = duties.find((duty) => duty.id === state.controlledDutyId)
  const isCommander = Boolean(activeDuty && getMissionSpecialization(activeDuty.specialty) === 'command')
  const [pendingSpecialties, setPendingSpecialties] = useState<Record<string, CrewSpecialty>>({})
  const completedByDuty = new Map(state.crewDailyActivities.map((activity) => [activity.dutyId, activity]))

  return (
    <section className="space-y-3 p-3" aria-label={t.teamCouncilTitle}>
      <p className="text-xs leading-5 text-slate-300">
        {t.teamCouncilSummary}
        {isCommander ? <span className="mt-1 block text-cyan-100/75">{t.commandCrewCoordination}</span> : null}
      </p>
      <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {duties.map((duty) => {
          const isSelectedPlayer = duty.id === state.controlledDutyId
          const playerManaged = state.controlMode === 'full'
          const activity = completedByDuty.get(duty.id)
          const dutyTitle = localizeCrewRole(duty.title, language)
          const condition = getCrewCondition(state, duty.id)
          const available = isCrewMemberAvailable(state, duty.id)
          const pendingSpecialty = pendingSpecialties[duty.id] || duty.specialty
          return (
            <li key={duty.id} className={`rounded-xl border px-3 py-2.5 ${isSelectedPlayer ? 'border-cyan-300/25 bg-cyan-400/[0.06]' : 'border-white/[0.07] bg-white/[0.025]'}`}>
              <button
                type="button"
                className="block w-full rounded-lg text-start outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                aria-pressed={isSelectedPlayer}
                onClick={() => onSelect(duty.id)}
              >
                <span className="flex items-start justify-between gap-2">
                  <span className="text-xs font-bold text-slate-100">{dutyTitle}</span>
                  <span className="shrink-0 rounded-full bg-white/[0.06] px-2 py-0.5 text-[9px] text-slate-300">
                    {isSelectedPlayer ? t.crewMemberYou : playerManaged ? t.crewMemberManaged : activity ? t.crewMemberWorked : t.crewMemberAutonomous}
                  </span>
                </span>
                <span className="mt-1.5 block text-[10px] leading-5 text-slate-400">{duty.duty[language]}</span>
                <span className="mt-1 block text-[10px] leading-4 text-cyan-100/75">
                  {activity
                    ? `${t.crewLastAction}: ${t[`action_${activity.action}`]} · ${t[`crewEffect_${activity.effect}`]}`
                    : isSelectedPlayer
                      ? t.crewMemberPlayerPlan
                      : playerManaged
                        ? t.crewMemberManagedPlan
                        : t.crewMemberAutoPlan}
                </span>
                <span className="mt-2 grid grid-cols-2 gap-2 text-[9px] text-slate-400 sm:grid-cols-3">
                  <span>{language === 'ar' ? 'الصحة' : 'Health'} <b className="text-emerald-200">{Math.round(condition.health)}%</b></span>
                  <span>{language === 'ar' ? 'الإرهاق' : 'Fatigue'} <b className="text-amber-200">{Math.round(condition.fatigue)}%</b></span>
                  <span>{language === 'ar' ? 'التوتر' : 'Stress'} <b className="text-rose-200">{Math.round(condition.stress)}%</b></span>
                  <span>{language === 'ar' ? 'المعنويات' : 'Morale'} <b className="text-cyan-200">{Math.round(condition.morale)}%</b></span>
                  <span>{language === 'ar' ? 'كفاءة الدور' : 'Role efficiency'} <b className="text-violet-200">{Math.round(getCrewRoleEfficiency(state, duty.id) * 100)}%</b></span>
                </span>
              </button>
              {isCommander ? (
                <div className="mt-3 flex items-center gap-2">
                  <select
                    aria-label={`${language === 'ar' ? 'تخصص' : 'Specialty'}: ${dutyTitle}`}
                    value={pendingSpecialty}
                    onChange={(event) => {
                      const specialty = SPECIALTY_OPTIONS.find((option) => option === event.target.value)
                      if (specialty) setPendingSpecialties((current) => ({ ...current, [duty.id]: specialty }))
                    }}
                    className="min-w-0 flex-1 rounded-lg border border-cyan-400/20 bg-slate-950/80 px-2 py-1.5 text-[10px] text-slate-100"
                  >
                    {SPECIALTY_OPTIONS.map((specialty) => (
                      <option value={specialty} key={specialty}>{localizeCrewSpecialty(specialty, language)}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-2 py-1.5 text-[9px] font-bold text-cyan-100 transition hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={!available || pendingSpecialty === duty.specialty}
                    onClick={() => onReassign(duty.id, pendingSpecialty)}
                  >
                    {language === 'ar' ? 'إعادة تعيين' : 'Reassign'}
                  </button>
                </div>
              ) : null}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
