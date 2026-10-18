import type { GameState } from '../game/model'
import { getMissionCrewAssignments } from '../game/teamwork'
import { localizeCrewRole } from '../game/crewRosters'
import { useSettingsStore } from '../store/settingsStore'
import ar from '../i18n/ar'
import en from '../i18n/en'
import { CrewCommLink } from './CrewCommLink'

export function CrewCouncil({ state }: { state: GameState }) {
  const language = useSettingsStore((store) => store.language)
  const t = language === 'ar' ? ar : en
  const duties = getMissionCrewAssignments(state.crewSize, state.destination, state.maxDays)
  const completedByDuty = new Map(state.crewDailyActivities.map((activity) => [activity.dutyId, activity]))

  return (
    <section className="space-y-3 p-3" aria-label={t.teamCouncilTitle}>
      <p className="text-xs leading-5 text-slate-300">{t.teamCouncilSummary}</p>
      <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {duties.map((duty) => {
          const isSelectedPlayer = state.controlMode === 'specialist' && duty.id === state.controlledDutyId
          const playerManaged = state.controlMode === 'full'
          const activity = completedByDuty.get(duty.id)
          const dutyTitle = localizeCrewRole(duty.title, language)
          return (
            <li key={duty.id} className={`rounded-xl border px-3 py-2.5 ${isSelectedPlayer ? 'border-cyan-300/25 bg-cyan-400/[0.06]' : 'border-white/[0.07] bg-white/[0.025]'}`}>
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-xs font-bold text-slate-100">{dutyTitle}</h3>
                <span className="shrink-0 rounded-full bg-white/[0.06] px-2 py-0.5 text-[9px] text-slate-300">
                  {isSelectedPlayer ? t.crewMemberYou : playerManaged ? t.crewMemberManaged : activity ? t.crewMemberWorked : t.crewMemberAutonomous}
                </span>
              </div>
              <p className="mt-1.5 text-[10px] leading-5 text-slate-400">{duty.duty[language]}</p>
              <p className="mt-1 text-[10px] leading-4 text-cyan-100/75">
                {activity
                  ? `${t.crewLastAction}: ${t[`action_${activity.action}`]} · ${t[`crewEffect_${activity.effect}`]}`
                  : isSelectedPlayer
                    ? t.crewMemberPlayerPlan
                    : playerManaged
                      ? t.crewMemberManagedPlan
                      : t.crewMemberAutoPlan}
              </p>
            </li>
          )
        })}
      </ul>
      {state.controlMode === 'full' ? <CrewCommLink state={state} /> : null}
    </section>
  )
}
