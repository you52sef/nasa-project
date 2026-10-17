import { useState } from 'react'
import { Check, ChevronDown, ChevronUp, Construction } from 'lucide-react'
import { BUILDING_PHASES, BUILDINGS } from '../game/buildings'
import { canBuild, canToggleBuilding, type GameState } from '../game/model'
import ar from '../i18n/ar'
import en from '../i18n/en'
import { useGameStore } from '../store/gameStore'
import { useSettingsStore } from '../store/settingsStore'

export function BuildingMenu({ state }: { state: GameState }) {
  const [open, setOpen] = useState(false)
  const language = useSettingsStore((store) => store.language)
  const t = language === 'ar' ? ar : en
  const buildBuilding = useGameStore((store) => store.buildBuilding)
  const toggleBuilding = useGameStore((store) => store.toggleBuilding)

  return (
    <section className="glass-panel overflow-hidden">
      <button type="button" onClick={() => setOpen((value) => !value)} className="flex w-full items-center justify-between gap-3 p-4 text-start sm:p-5" aria-expanded={open}>
        <span className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-200/[0.08] text-amber-200"><Construction size={19} /></span>
          <span>
            <span className="block text-sm font-bold text-slate-100">{t.build}</span>
            <span className="mt-1 block text-[10px] text-slate-500">{state.buildings.length} {t.floor} · {state.resources.credits} {t.credits}</span>
          </span>
        </span>
        {open ? <ChevronUp size={17} className="text-slate-500" /> : <ChevronDown size={17} className="text-slate-500" />}
      </button>

      {open ? (
        <div className="grid gap-2 border-t border-white/[0.06] p-3 sm:grid-cols-2">
          {Object.values(BUILDINGS).map((building) => {
            const owned = state.buildings.includes(building.id)
            const offline = (state.offlineBuildings || []).includes(building.id)
            const destinationUnavailable = Boolean(building.destination && building.destination !== state.destination)
            const earlierPhasesComplete = BUILDING_PHASES
              .filter((phase) => phase.phase < building.phase)
              .every((phase) => phase.buildings.every((id) => state.buildings.includes(id)))
            const canAfford = canBuild(state, building.id)
            const production = Object.entries(building.production || {})
              .filter(([, amount]) => amount)
              .map(([key, amount]) => `${key === 'energy' ? '⚡' : key === 'oxygen' ? '💨' : key === 'water' ? '💧' : '🌱'} +${amount}`)
              .join(' · ')
            return (
              <article key={building.id} className={`rounded-xl border p-3 transition ${owned ? 'border-emerald-300/15 bg-emerald-200/[0.025]' : 'border-white/[0.07] bg-white/[0.02]'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex gap-2.5">
                    <span className="text-2xl">{building.icon}</span>
                    <div>
                      <h3 className="text-xs font-bold text-slate-100">{building.name[language]} <span className="text-[9px] font-medium text-slate-500">{language === 'ar' ? `المرحلة ${building.phase}` : `Phase ${building.phase}`}</span></h3>
                      <p className="mt-1 text-[10px] leading-relaxed text-slate-500">{building.description[language]}</p>
                    </div>
                  </div>
                  {owned ? <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[9px] font-bold ${offline ? 'bg-amber-300/10 text-amber-200' : 'bg-emerald-300/10 text-emerald-200'}`}><Check size={11} /> {offline ? t.facilityOfflineShort : t.facilityOnlineShort}</span> : null}
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[9px] leading-5 text-slate-500">
                    {t.cost} <b className="text-amber-200">{building.cost} ◈</b> · {t.cargo} <b className="text-sky-200">{building.cargo}</b> · {t.area} <b className="text-slate-300">{building.area}</b>
                    {building.energyCost ? <> · ⚡ {building.energyCost}</> : null}
                    {production ? <span className="block text-emerald-200/80">{production} / {language === 'ar' ? 'يوم' : 'day'}</span> : null}
                  </span>
                  {owned ? (
                    <button
                      type="button"
                      disabled={!canToggleBuilding(state, building.id)}
                      onClick={() => toggleBuilding(building.id)}
                      className="rounded-lg bg-white/[0.06] px-2.5 py-1.5 text-[10px] font-bold text-slate-200 transition hover:bg-white/[0.12] disabled:cursor-not-allowed disabled:opacity-35"
                      title={!canToggleBuilding(state, building.id) ? t.offlineOxygenWarning : undefined}
                    >
                      {offline ? t.bringOnline : t.takeOffline}
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={!canAfford}
                      onClick={() => buildBuilding(building.id)}
                      className="rounded-lg bg-sky-300/10 px-2.5 py-1.5 text-[10px] font-bold text-sky-100 transition hover:bg-sky-300/20 disabled:cursor-not-allowed disabled:opacity-35"
                      title={destinationUnavailable
                        ? t.unavailable
                        : !earlierPhasesComplete
                          ? (language === 'ar' ? 'أكمل جميع مرافق المراحل السابقة أولًا.' : 'Complete all facilities in earlier phases first.')
                          : !canAfford
                            ? t.insufficient
                            : undefined}
                    >
                      {destinationUnavailable
                        ? t.unavailable
                        : !earlierPhasesComplete
                          ? (language === 'ar' ? 'مقفل' : 'Locked')
                          : !canAfford
                            ? t.insufficient
                            : t.buildNow}
                    </button>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      ) : null}
    </section>
  )
}
