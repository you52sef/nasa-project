import { useState } from 'react'
import { Check, ChevronDown, ChevronUp, Construction } from 'lucide-react'
import { BUILDING_PHASES, BUILDINGS, getConstructionDurationHours } from '../game/buildings'
import { POWER_SYSTEM } from '../game/constants'
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
  const project = state.constructionProject

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

      {project ? (
        <div className="border-t border-amber-200/[0.09] bg-amber-100/[0.025] px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[10px]">
            <span className="font-bold text-amber-100">
              {t.constructionInProgress}: {BUILDINGS[project.buildingId]?.name[language] || project.buildingId}
            </span>
            <span className="text-amber-100/70">{project.hoursRemaining} / {project.totalHours} {language === 'ar' ? 'ساعة متبقية' : 'hours remaining'}</span>
          </div>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.08]">
            <div className="h-full bg-amber-200 transition-all" style={{ width: `${(project.totalHours - project.hoursRemaining) / project.totalHours * 100}%` }} />
          </div>
        </div>
      ) : null}

      {open ? (
        <div className="grid gap-2 border-t border-white/[0.06] p-3 sm:grid-cols-2">
          {Object.values(BUILDINGS).map((building) => {
            const owned = state.buildings.includes(building.id)
            const inProgress = project?.buildingId === building.id
            const offline = (state.offlineBuildings || []).includes(building.id)
            const destinationUnavailable = Boolean(building.destination && building.destination !== state.destination)
            const earlierPhasesComplete = BUILDING_PHASES
              .filter((phase) => phase.phase < building.phase)
              .every((phase) => phase.buildings.every((id) => state.buildings.includes(id)))
            const canAfford = canBuild(state, building.id)
            const production = Object.entries(building.production || {})
              .filter(([, amount]) => amount)
              .map(([key, amount]) => key === 'energy'
                ? `⚡ ${building.id === 'reactor'
                  ? POWER_SYSTEM.reactorOutputKw
                  : state.destination === 'moon' ? POWER_SYSTEM.solarOutputKw.moon : POWER_SYSTEM.solarOutputKw.mars} kW`
                : `${key === 'oxygen' ? '💨' : key === 'water' ? '💧' : '🌱'} +${amount}`)
              .join(' · ')
            const operatingLoad = POWER_SYSTEM.operatingLoadsKw[building.id as keyof typeof POWER_SYSTEM.operatingLoadsKw]
            return (
              <article key={building.id} className={`rounded-xl border p-3 transition ${owned ? 'border-emerald-300/15 bg-emerald-200/[0.025]' : inProgress ? 'border-amber-300/20 bg-amber-200/[0.035]' : 'border-white/[0.07] bg-white/[0.02]'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex gap-2.5">
                    <span className="text-2xl">{building.icon}</span>
                    <div>
                      <h3 className="text-xs font-bold text-slate-100">{building.name[language]} <span className="text-[9px] font-medium text-slate-500">{language === 'ar' ? `المرحلة ${building.phase}` : `Phase ${building.phase}`}</span></h3>
                      <p className="mt-1 text-[10px] leading-relaxed text-slate-500">{building.description[language]}</p>
                    </div>
                  </div>
                  {owned ? <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[9px] font-bold ${offline ? 'bg-amber-300/10 text-amber-200' : 'bg-emerald-300/10 text-emerald-200'}`}><Check size={11} /> {offline ? t.facilityOfflineShort : t.facilityOnlineShort}</span> : inProgress ? <span className="shrink-0 rounded-full bg-amber-300/10 px-2 py-1 text-[9px] font-bold text-amber-100">{t.constructionInProgress} · {project.hoursRemaining}h</span> : null}
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[9px] leading-5 text-slate-500">
                    {t.cost} <b className="text-amber-200">{building.cost} ◈</b> · {t.cargo} <b className="text-sky-200">{building.cargo}</b> · {t.area} <b className="text-slate-300">{building.area}</b>
                    {building.energyCost ? <> · ⚡ {building.energyCost}</> : null}
                    {operatingLoad ? <span className="block text-amber-100/80">{language === 'ar' ? 'حمل التشغيل' : 'Operating load'}: {operatingLoad} kW</span> : null}
                    {building.storage?.energy ? <span className="block text-sky-100/80">{language === 'ar' ? 'سعة البطارية' : 'Battery capacity'}: {building.storage.energy} kWh</span> : null}
                    <span className="block text-slate-400">{language === 'ar' ? 'مدة البناء' : 'Build time'}: {getConstructionDurationHours(building.id, state.destination)} {language === 'ar' ? 'ساعة' : 'hours'}</span>
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
                      disabled={inProgress || !canAfford}
                      onClick={() => buildBuilding(building.id)}
                      className="rounded-lg bg-sky-300/10 px-2.5 py-1.5 text-[10px] font-bold text-sky-100 transition hover:bg-sky-300/20 disabled:cursor-not-allowed disabled:opacity-35"
                      title={inProgress
                        ? t.constructionInProgress
                        : destinationUnavailable
                        ? t.unavailable
                        : !earlierPhasesComplete
                          ? (language === 'ar' ? 'أكمل جميع مرافق المراحل السابقة أولًا.' : 'Complete all facilities in earlier phases first.')
                          : !canAfford
                            ? t.insufficient
                            : undefined}
                    >
                      {inProgress
                        ? t.constructionInProgress
                        : destinationUnavailable
                        ? t.unavailable
                        : !earlierPhasesComplete
                          ? (language === 'ar' ? 'مقفل' : 'Locked')
                          : !canAfford
                            ? t.insufficient
                            : t.startConstruction}
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
