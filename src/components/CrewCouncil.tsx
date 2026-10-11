import type { GameState } from '../game/model'
import { getAvailableCrewRoles, recommendDailyAction, recommendSpecialistActivity } from '../game/teamwork'
import ar from '../i18n/ar'
import en from '../i18n/en'
import { useSettingsStore } from '../store/settingsStore'

export function CrewCouncil({ state }: { state: GameState }) {
  const language = useSettingsStore((store) => store.language)
  const t = language === 'ar' ? ar : en
  const recommendation = state.controlMode === 'specialist'
    ? recommendSpecialistActivity(state)
    : recommendDailyAction(state)

  return (
    <section className="mb-4 rounded-2xl border border-cyan-100/10 bg-cyan-100/[0.025] p-4" aria-labelledby="crew-council-title">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id="crew-council-title" className="text-sm font-black text-cyan-50">{t.teamCouncilTitle}</h2>
          <p className="mt-1 text-[10px] leading-5 text-slate-500">{state.controlMode === 'specialist' ? t.teamSpecialistDescription : t.teamDecisionDescription}</p>
        </div>
        <div className="rounded-lg border border-cyan-100/10 bg-slate-950/40 px-3 py-2 text-xs text-cyan-100">
          {t.teamDecisionLabel}: <b>{t[`action_${recommendation}`]}</b>
        </div>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {getAvailableCrewRoles(state.crewSize).map((role) => (
          <article key={role.title} className="rounded-xl border border-white/[0.06] bg-slate-950/35 p-3">
            <h3 className="text-xs font-bold text-slate-200">{role.icon} {t[role.title]}</h3>
            <p className="mt-1 text-[10px] leading-5 text-slate-500">{t[role.focus]}</p>
            {role.id === 'power-engineer' ? <p className="mt-2 text-[10px] leading-5 text-cyan-100/80">{state.resources.energy <= 30 ? t.teamEnergyAdvice : t.teamEnergySteady}</p> : null}
            {role.id === 'biologist' ? <p className="mt-2 text-[10px] leading-5 text-emerald-100/80">{state.resources.food <= 30 ? t.teamFoodAdvice : state.fatigue >= 65 ? t.teamRestAdvice : t.teamCrewSteady}</p> : null}
            {role.id === 'water-officer' ? <p className="mt-2 text-[10px] leading-5 text-sky-100/80">{state.resources.water <= 30 ? t.teamWaterAdvice : t.teamWaterSteady}</p> : null}
            {role.id === 'commander' ? <p className="mt-2 text-[10px] leading-5 text-violet-100/80">{state.fatigue >= 65 || state.resources.health <= 50 ? t.teamRestAdvice : t.teamCrewSteady}</p> : null}
          </article>
        ))}
      </div>
    </section>
  )
}
