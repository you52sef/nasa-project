import { useState } from 'react'
import { ArrowUpRight, Layers3, Power, X } from 'lucide-react'
import type { KeyboardEvent, MouseEvent, PointerEvent } from 'react'
import { BUILDINGS } from '../game/buildings'
import { canToggleBuilding, type Action, type GameState } from '../game/model'
import { useGameStore } from '../store/gameStore'
import { useSettingsStore } from '../store/settingsStore'
import { SCENARIOS } from '../game/scenarios'
import ar from '../i18n/ar'
import en from '../i18n/en'

interface Props {
  state: GameState
  onAction: (action: Action) => void
}

type MapSelection =
  | { kind: 'building'; id: string; index: number }
  | { kind: 'habitat' }
  | { kind: 'rover' }
  | { kind: 'crew'; index: number }
  | { kind: 'site' }

const facilitySites = [
  { x: 335, y: 225 },
  { x: 475, y: 210 },
  { x: 550, y: 270 },
  { x: 475, y: 330 },
  { x: 335, y: 335 },
  { x: 260, y: 280 },
  { x: 405, y: 165 },
  { x: 405, y: 380 },
]

const terrainRidges = [
  'M-30 115 C105 40 190 190 325 105 S560 45 800 130',
  'M-35 145 C100 70 200 220 340 135 S565 75 810 160',
  'M-40 175 C105 100 200 250 350 165 S570 105 820 190',
  'M-45 205 C100 130 210 280 360 195 S580 135 830 220',
  'M-40 245 C80 175 225 320 375 235 S600 175 830 260',
  'M-30 285 C100 220 230 355 390 275 S610 215 830 300',
  'M-25 330 C110 265 250 400 410 320 S620 255 830 345',
  'M-20 375 C140 315 265 440 430 365 S650 300 830 390',
]
const mapStars = [
  { x: 66, y: 72, r: 1.2 }, { x: 178, y: 57, r: 1 }, { x: 291, y: 82, r: 1.4 },
  { x: 416, y: 64, r: 1 }, { x: 532, y: 89, r: 1.2 }, { x: 712, y: 58, r: 1.3 },
  { x: 745, y: 185, r: 1 }, { x: 92, y: 250, r: 1.1 }, { x: 721, y: 360, r: 1.2 },
  { x: 232, y: 424, r: 1 }, { x: 578, y: 446, r: 1.3 }, { x: 650, y: 150, r: .9 },
  { x: 316, y: 459, r: 1 }, { x: 42, y: 382, r: .9 },
]

export function BaseView({ state, onAction }: Props) {
  const [selected, setSelected] = useState<MapSelection | null>(null)
  const [systemsOverlay, setSystemsOverlay] = useState(false)
  const language = useSettingsStore((store) => store.language)
  const toggleBuilding = useGameStore((store) => store.toggleBuilding)
  const t = language === 'ar' ? ar : en
  const isMoon = state.destination === 'moon'
  const scenario = state.scenario || 'baseline'
  const arabic = language === 'ar'
  const offlineBuildings = state.offlineBuildings || []
  const select = (selection: MapSelection, extraClass = '') => ({
    role: 'button' as const,
    tabIndex: 0,
    pointerEvents: 'bounding-box' as const,
    className: `cursor-pointer outline-none focus-visible:brightness-125 ${extraClass}`,
    onPointerEnter: (event: PointerEvent<SVGGElement>) => {
      event.stopPropagation()
      setSelected(selection)
    },
    onFocus: () => setSelected(selection),
    onClick: (event: MouseEvent<SVGGElement>) => {
      event.stopPropagation()
      setSelected(selection)
    },
    onKeyDown: (event: KeyboardEvent<SVGGElement>) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        event.stopPropagation()
        setSelected(selection)
      }
    },
  })
  const labels = isMoon
    ? { site: t.siteReferenceMoon, lat: '00°41′ N', lon: '23°26′ E' }
    : { site: t.siteReferenceMars, lat: '18°26′ N', lon: '77°27′ E' }
  const destinationLabel = isMoon ? t.moon : t.mars
  const mappedFacilities = state.buildings.map((id, index) => ({
    id,
    index,
    position: facilitySites[index % facilitySites.length],
    building: BUILDINGS[id],
  })).filter((facility) => facility.building)

  return (
    <section className="glass-panel relative overflow-hidden" aria-label={t.siteMapLabel}>
      <div className={`base-map-surface base-map-${scenario} relative isolate min-h-[390px] overflow-hidden sm:min-h-[500px] ${isMoon ? 'bg-[#555966]' : 'bg-[#714538]'}`}>
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 800 500"
          preserveAspectRatio="xMidYMid slice"
          role="group"
          aria-labelledby="base-map-title base-map-description"
        >
          <title id="base-map-title">{t.siteMapLabel}: {state.baseName}</title>
          <desc id="base-map-description">
            {t.siteMapDescription.replace('{destination}', destinationLabel)}
          </desc>
          <defs>
            <linearGradient id="terrain" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0" stopColor={isMoon ? '#252a34' : '#301f24'} />
              <stop offset=".52" stopColor={isMoon ? '#65616a' : '#91533e'} />
              <stop offset="1" stopColor={isMoon ? '#393943' : '#54353a'} />
            </linearGradient>
            <radialGradient id="site-glow">
              <stop stopColor="#7dd3fc" stopOpacity=".2" />
              <stop offset="1" stopColor="#7dd3fc" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="map-sensor-sweep" x1="0" x2="1" y1="0" y2="0">
              <stop stopColor="#7ce4dc" stopOpacity="0" />
              <stop offset=".5" stopColor="#a6f4ed" stopOpacity=".9" />
              <stop offset="1" stopColor="#7ce4dc" stopOpacity="0" />
            </linearGradient>
            <pattern id="map-grid" width="50" height="50" patternUnits="userSpaceOnUse">
              <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#e2e8f0" strokeOpacity=".09" strokeWidth=".7" />
            </pattern>
            <filter id="shadow" x="-.5" y="-.5" width="2" height="2">
              <feGaussianBlur in="SourceAlpha" stdDeviation="3" />
              <feOffset dy="3" />
              <feComponentTransfer><feFuncA type="linear" slope=".45" /></feComponentTransfer>
              <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          <rect width="800" height="500" fill="url(#terrain)" pointerEvents="none" />
          <rect width="800" height="500" fill="url(#map-grid)" pointerEvents="none" />
          <g className="map-starfield" pointerEvents="none" aria-hidden="true">
            {mapStars.map((star, index) => <circle key={index} cx={star.x} cy={star.y} r={star.r} style={{ animationDelay: `${index % 5 * -.7}s` }} />)}
          </g>
          <rect className="map-sensor-sweep" x="-160" y="0" width="160" height="500" fill="url(#map-sensor-sweep)" pointerEvents="none" />

          {isMoon ? (
            <>
              <g fill="#11151e" fillOpacity=".2" stroke="#d1d5db" strokeOpacity=".17">
                <circle cx="112" cy="160" r="58" strokeWidth="8" />
                <circle cx="676" cy="106" r="38" strokeWidth="6" />
                <circle cx="665" cy="398" r="72" strokeWidth="11" />
                <circle cx="132" cy="413" r="28" strokeWidth="5" />
              </g>
              <g fill="#0b1020" fillOpacity=".26">
                <circle cx="112" cy="160" r="40" />
                <circle cx="676" cy="106" r="25" />
                <circle cx="665" cy="398" r="51" />
                <circle cx="132" cy="413" r="18" />
              </g>
            </>
          ) : (
            <>
              <path d="M0 80 128 42l84 32 66-28 89 52-28 37-115 9-71 45-91-26L0 196Z" fill="#ca7752" fillOpacity=".31" />
              <path d="m800 258-78-26-74 27-54 58 27 62 89 10 90-43Z" fill="#291e25" fillOpacity=".38" />
              <path d="m75 500 62-72 67 23 55 49Z" fill="#b66d4a" fillOpacity=".34" />
              <g fill="none" stroke="#efb48b" strokeOpacity=".24" strokeWidth="2">
                <path d="M-10 114 120 80l110 50 100-25 80 44" />
                <path d="m555 80 86-26 65 34 105-17" />
                <path d="m-5 450 121-53 111 46 72-31" />
              </g>
            </>
          )}

          <g fill="none" stroke={isMoon ? '#e2e8f0' : '#f8c8a8'} strokeOpacity=".2" strokeWidth="1.1">
            {terrainRidges.map((path) => <path key={path} d={path} />)}
          </g>

          <path d="M403 278 C350 266 308 286 263 282 S188 297 140 327 M405 278 C462 265 508 260 559 271 S635 285 689 306 M405 280 C407 329 414 371 400 423" fill="none" stroke="#1b2028" strokeOpacity=".5" strokeWidth="13" strokeLinecap="round" />
          <path d="M403 278 C350 266 308 286 263 282 S188 297 140 327 M405 278 C462 265 508 260 559 271 S635 285 689 306 M405 280 C407 329 414 371 400 423" fill="none" stroke="#d6c8ac" strokeOpacity=".62" strokeWidth="2" strokeDasharray="7 7" />

          <g className="map-scenario-effect" pointerEvents="none" aria-hidden="true">
            {scenario === 'dust-front' ? (
              <g className="map-dust">
                <path d="M-40 184 C170 155 330 208 840 160" fill="none" stroke="#efb48b" strokeOpacity=".38" strokeWidth="14" strokeDasharray="2 25" />
                <path d="M-80 228 C130 202 410 253 870 216" fill="none" stroke="#f1c6a2" strokeOpacity=".25" strokeWidth="8" strokeDasharray="1 19" />
                <path d="M-20 356 C210 322 490 370 820 338" fill="none" stroke="#e69a70" strokeOpacity=".28" strokeWidth="11" strokeDasharray="3 31" />
              </g>
            ) : null}
            {scenario === 'water-rationing' ? (
              <g className="map-water-flow">
                <path d="M405 280 C350 266 308 286 263 282 S188 297 140 327" fill="none" stroke="#67e8f9" strokeOpacity=".6" strokeWidth="4" strokeDasharray="2 12" />
                <circle r="4" fill="#a5f3fc">
                  <animateMotion dur="5s" repeatCount="indefinite" path="M405 280 C350 266 308 286 263 282 S188 297 140 327" />
                </circle>
                <circle r="3" fill="#a5f3fc">
                  <animateMotion dur="5s" begin="-2.5s" repeatCount="indefinite" path="M405 280 C350 266 308 286 263 282 S188 297 140 327" />
                </circle>
              </g>
            ) : null}
            {scenario === 'oxygen-shortage' ? (
              <g className="map-oxygen-alert">
                <circle cx="405" cy="280" r="61" fill="none" stroke="#fb7185" strokeWidth="2" strokeDasharray="5 5" />
                <circle cx="405" cy="280" r="73" fill="none" stroke="#fda4af" strokeOpacity=".75" strokeWidth="1" />
                <text x="405" y="198" textAnchor="middle" fill="#ffe4e6" fontSize="10" fontWeight="700">{t.oxygenReserveLabel}</text>
              </g>
            ) : null}
            {scenario === 'baseline' ? (
              <circle className="map-baseline-scan" cx="405" cy="280" r="40" fill="none" stroke="#a7f3d0" strokeWidth="1.5" />
            ) : null}
          </g>

          <circle className="map-survey-beacon" r="4" fill="#fef3c7" pointerEvents="none" aria-hidden="true">
            <animateMotion dur="17s" repeatCount="indefinite" path="M405 280 C350 266 308 286 263 282 S188 297 140 327 C205 293 315 270 405 280 C462 265 508 260 559 271 S635 285 689 306 C610 277 500 264 405 280 C407 329 414 371 400 423" />
          </circle>

          <ellipse cx="405" cy="280" rx="205" ry="160" fill="url(#site-glow)" pointerEvents="none" />
          <ellipse className="map-orbit-ring" cx="405" cy="280" rx="155" ry="112" fill="none" stroke="#bae6fd" strokeOpacity=".25" strokeDasharray="3 6" pointerEvents="none" />
          <ellipse className="map-orbit-ring map-orbit-ring-far" cx="405" cy="280" rx="190" ry="145" fill="none" stroke="#bae6fd" strokeOpacity=".14" strokeDasharray="2 8" pointerEvents="none" />

          {systemsOverlay ? (
            <g className="map-systems-overlay" pointerEvents="none" aria-hidden="true">
              {mappedFacilities.map(({ id, index, position, building }) => {
                const offline = offlineBuildings.includes(id)
                return (
                  <g key={`network-${id}-${index}`} className={offline ? 'map-network-link map-network-offline' : 'map-network-link'}>
                    <path d={`M405 280 Q${(position.x + 405) / 2} ${(position.y + 280) / 2 - 24} ${position.x} ${position.y}`} />
                    <circle cx={position.x} cy={position.y} r="12" />
                    <text x={position.x} y={position.y - 17} textAnchor="middle">{building.name[language]}</text>
                  </g>
                )
              })}
              <circle className="map-comms-ring" cx="405" cy="280" r="60" />
              <circle className="map-comms-ring map-comms-ring-late" cx="405" cy="280" r="60" />
              <text x="405" y="356" textAnchor="middle">{t.habitatNetworkLabel}</text>
            </g>
          ) : null}

          {state.lastAction === 'explore' ? (
            <g key={`rover-run-${state.day}`} className="map-rover-run" aria-hidden="true">
              <circle className="map-rover-halo" r="8" fill="#fbbf24" fillOpacity=".2" />
              <circle r="3.5" fill={state.lastMessage.includes('نجحت الرحلة') ? '#86efac' : '#fb923c'} stroke="#fff7ed" strokeWidth="1">
                <animateMotion dur="3.2s" repeatCount="1" fill="freeze" path="M493 342 C470 310 446 293 405 280 C330 260 225 278 140 327 C230 304 325 270 405 280" />
              </circle>
            </g>
          ) : null}

          {mappedFacilities.map(({ id, index, position, building }) => {
            const isOffline = offlineBuildings.includes(id)
            return (
            <g
              key={`${id}-${index}`}
              transform={`translate(${position.x} ${position.y})`}
              filter="url(#shadow)"
              {...select({ kind: 'building', id, index })}
              aria-label={`${building.name[language]} · ${isOffline ? t.buildingOfflineLabel : t.buildingOnlineLabel}`}
              opacity={isOffline ? 0.52 : 1}
            >
              <circle r="34" fill="transparent" pointerEvents="all" />
              {selected?.kind === 'building' && selected.index === index ? <circle r="32" fill="none" stroke="#facc15" strokeWidth="2" strokeDasharray="4 3" /> : null}
              <FacilityGlyph id={id} />
              <circle cy="25" r="13" fill="#101722" fillOpacity=".88" stroke={isOffline ? '#fbbf24' : '#bae6fd'} strokeOpacity=".8" />
              <text y="29" textAnchor="middle" fontSize="10" fill="#f8fafc" fontWeight="700">{index + 1}</text>
              <circle className={!isOffline ? 'map-status-light' : undefined} cx="21" cy="-19" r="5" fill={isOffline ? '#fbbf24' : '#34d399'} stroke="#0f172a" strokeWidth="2" />
              <title>{building.name[language]}</title>
            </g>
          )})}

          <g transform="translate(405 280)" filter="url(#shadow)" {...select({ kind: 'habitat' }, 'map-habitat')} aria-label={t.habitatLabel}>
            {selected?.kind === 'habitat' ? <circle r="58" fill="none" stroke="#facc15" strokeWidth="2" strokeDasharray="4 3" /> : null}
            <circle r="43" fill="#0c1520" fillOpacity=".76" stroke="#7dd3fc" strokeOpacity=".72" strokeWidth="2" />
            <path d="M-29 3q0-22 29-28Q29-19 29 3L22 16H-22Z" fill="#8bdaf2" fillOpacity=".42" stroke="#c6f1ff" strokeWidth="1.5" />
            <path d="M-22 3h44M0-24v39" stroke="#c6f1ff" strokeOpacity=".62" />
            <rect x="-7" y="15" width="14" height="13" rx="2" fill="#dbeafe" fillOpacity=".65" />
            <circle r="51" fill="none" stroke="#7dd3fc" strokeOpacity=".45" strokeDasharray="3 5" />
            <title>{t.habitatLabel}</title>
          </g>

          <g transform="translate(493 342) rotate(-24)" filter="url(#shadow)" {...select({ kind: 'rover' })} aria-label={t.roverLabel}>
            <circle r="40" fill="transparent" pointerEvents="all" />
            {selected?.kind === 'rover' ? <circle r="43" fill="none" stroke="#facc15" strokeWidth="2" strokeDasharray="4 3" /> : null}
            <rect x="-17" y="-11" width="34" height="22" rx="6" fill="#d4a85f" stroke="#fff0c2" strokeWidth="1.5" />
            <rect x="-32" y="-8" width="12" height="16" fill="#7dd3fc" fillOpacity=".6" stroke="#dbeafe" />
            <rect x="20" y="-8" width="12" height="16" fill="#7dd3fc" fillOpacity=".6" stroke="#dbeafe" />
            <circle cx="-10" cy="12" r="4" fill="#111827" /><circle cx="10" cy="12" r="4" fill="#111827" />
            <path d="M0-11v-13m0 0 7 4" stroke="#f8fafc" strokeWidth="1.5" />
            <title>{t.roverLabel}</title>
          </g>

          <g transform="translate(405 280)">
            {Array.from({ length: Math.min(state.crewSize, 4) }, (_, index) => {
              const angle = index * Math.PI * 2 / Math.min(state.crewSize, 4)
              const x = Math.cos(angle) * 60
              const y = Math.sin(angle) * 60
              const selection: MapSelection = { kind: 'crew', index }
              return (
                <g key={index} transform={`translate(${x} ${y})`} {...select(selection)} aria-label={t.mapCrewMemberLabel.replace('{number}', String(index + 1))}>
                  <circle r={selected?.kind === 'crew' && selected.index === index ? 10 : 7} fill="transparent" />
                  <circle r="4" fill="#f0abfc" stroke="#fff" strokeWidth="1.3" />
                  <title>{t.mapCrewMemberShortLabel.replace('{number}', String(index + 1))}</title>
                </g>
              )
            })}
          </g>

          <g transform="translate(140 327)" {...select({ kind: 'site' })} aria-label={t.mapScienceSiteLabel}>
            {selected?.kind === 'site' ? <circle r="22" fill="#facc15" fillOpacity=".14" stroke="#facc15" strokeWidth="2" strokeDasharray="3 3" /> : null}
            <path d="M0-9 8 0 0 9-8 0Z" fill="#f0abfc" stroke="#fff" strokeWidth="1.5" />
            <text x="0" y="27" textAnchor="middle" fill="#fff" fontSize="8" fontWeight="700">{t.scienceSiteAbbreviation}</text>
            <title>{t.mapScienceSiteLabel}</title>
          </g>

          <g transform="translate(748 78)">
            <path d="M0 25V0m0 0-7 10m7-10 7 10" fill="none" stroke="#f8fafc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <text y="40" textAnchor="middle" fill="#f8fafc" fillOpacity=".85" fontSize="9" fontWeight="700">N</text>
          </g>

          <g transform="translate(30 445)">
            <path d="M0 0h80m-80-4v8m80-8v8" stroke="#f8fafc" strokeWidth="2" />
            <text x="40" y="-9" textAnchor="middle" fill="#f8fafc" fontSize="9">100 m</text>
          </g>

          <rect x="1" y="1" width="798" height="498" fill="none" stroke="#e2e8f0" strokeOpacity=".14" />
        </svg>

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-slate-950/45 via-transparent to-slate-950/55" />
        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-4 p-4 sm:p-6">
          <div className="max-w-[75%]">
            <p className="eyebrow"><span className="h-1.5 w-1.5 rounded-full bg-emerald-300" /> {t.siteSchematicLabel}</p>
            <h2 className="mt-2 truncate text-lg font-black text-white sm:text-2xl">{state.baseName}</h2>
            <p className="mt-1 text-[9px] font-semibold tracking-[.16em] text-slate-200/70 sm:text-[10px]">
              {labels.site} · {labels.lat} / {labels.lon}
            </p>
            <p className="mt-2 inline-flex items-center gap-2 border border-white/10 bg-slate-950/45 px-2 py-1 text-[9px] font-bold tracking-[.08em] text-amber-100/90 backdrop-blur">
              <span className={`h-1.5 w-1.5 rounded-full ${scenario === 'oxygen-shortage' ? 'bg-rose-300' : scenario === 'water-rationing' ? 'bg-cyan-300' : scenario === 'dust-front' ? 'bg-orange-300' : 'bg-emerald-300'}`} />
              {SCENARIOS[scenario].name[language]}
            </p>
          </div>
          <div className="rounded-xl border border-white/15 bg-slate-950/60 px-3 py-2 text-end text-[10px] font-semibold text-slate-100 shadow-lg backdrop-blur">
            <span className="block">{isMoon ? t.moonSurfaceLabel : t.marsSurfaceLabel}</span>
            <span className="mt-1 block text-[9px] text-emerald-200">● {t.simulatedLinkLabel}</span>
            <button
              type="button"
              className={`map-layer-toggle mt-2 inline-flex items-center gap-1.5 border px-2 py-1 text-[9px] transition ${systemsOverlay ? 'border-cyan-200/30 bg-cyan-200/10 text-cyan-100' : 'border-white/10 text-slate-300 hover:bg-white/10'}`}
              onClick={() => setSystemsOverlay((value) => !value)}
              aria-pressed={systemsOverlay}
            >
              <Layers3 size={12} />
              {systemsOverlay ? t.systemsLayerLabel : t.systemsViewLabel}
            </button>
          </div>
        </div>

        <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
          <div className="flex flex-wrap gap-2">
            <MapBadge icon="🏠" label={t.habitatLabel} />
            <MapBadge icon="🛰" label={t.roverLabel} />
            <MapBadge icon="•" label={t.crewLabel} />
          </div>
          <p className="rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-[10px] font-semibold text-slate-200 backdrop-blur">
            {state.crewSize} {t.crewCountLabel} · {mappedFacilities.length} {t.facilityCountLabel} · {t.cycleCountLabel} {state.day}
          </p>
        </div>
      </div>
      {selected ? (
        <MapObjectInfo
          selection={selected}
          state={state}
          language={language}
          onDismiss={() => setSelected(null)}
          onAction={onAction}
          onToggleBuilding={toggleBuilding}
        />
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] bg-slate-950/70 px-4 py-2.5">
        <p className="text-[10px] text-slate-500">
          {t.mapInteractionHint}
        </p>
        <p className="text-[10px] font-semibold text-slate-400">
          <span className="text-amber-200">◆</span> {state.resources.credits} {t.creditsUnit}
          <span className="mx-2 text-slate-700">|</span>
          <span className="text-sky-200">▰</span> {state.resources.cargo} {t.cargoUnit}
        </p>
      </div>
    </section>
  )
}

function MapObjectInfo({
  selection,
  state,
  language,
  onDismiss,
  onAction,
  onToggleBuilding,
}: {
  selection: MapSelection
  state: GameState
  language: 'ar' | 'en'
  onDismiss: () => void
  onAction: (action: Action) => void
  onToggleBuilding: (buildingId: string) => void
}) {
  const arabic = language === 'ar'
  const t = language === 'ar' ? ar : en
  const building = selection.kind === 'building' ? BUILDINGS[selection.id] : undefined
  const offline = building && (state.offlineBuildings || []).includes(building.id)
  const name = building?.name[language] ?? (
    selection.kind === 'habitat' ? t.habitatModuleLabel
      : selection.kind === 'rover' ? t.surfaceRoverLabel
        : selection.kind === 'crew' ? t.mapCrewMemberLabel.replace('{number}', String(selection.index + 1))
          : t.mapScienceSiteLabel
  )
  const description = building?.description[language] ?? (
    selection.kind === 'habitat'
      ? t.habitatMapInfo
      : selection.kind === 'rover'
        ? t.roverMapInfo
        : selection.kind === 'crew'
          ? t.crewMapInfo
          : t.siteMapInfo
  )
  const production = building
    ? Object.entries(building.production)
      .filter(([, amount]) => amount)
      .map(([resource, amount]) => `${resourceLabel(resource, language)} +${amount}`)
      .join(' · ')
    : ''
  const actionDisabled = Boolean(state.activeEvent || state.isGameOver)

  return (
    <aside className="border-t border-sky-200/10 bg-slate-950/85 p-3.5 sm:p-4" aria-live="polite">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[9px] font-bold tracking-[.16em] text-sky-200">{t.selectedObject}</p>
          <h3 className="mt-1 truncate text-sm font-black text-white">{building?.icon || (selection.kind === 'rover' ? '🛰️' : selection.kind === 'crew' ? '🧑‍🚀' : selection.kind === 'site' ? '🔬' : '🏠')} {name}</h3>
        </div>
        <button type="button" onClick={onDismiss} className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white" aria-label={t.close}><X size={15} /></button>
      </div>
      <p className="mt-2 text-[10px] leading-5 text-slate-300">{description}</p>
      {building ? (
        <>
          <p className="mt-2 text-[9px] leading-4 text-slate-500">
            {production ? `${t.dailyOutput}: ${production}` : t.storageSupportFacilityNote}
            {Object.keys(building.consumption).length ? ` · ${t.usesOperatingResourcesLabel}` : ''}
          </p>
          <p className={`mt-2 text-[9px] font-bold ${offline ? 'text-amber-200' : 'text-emerald-200'}`}>
            ● {offline ? t.facilityOffline : t.facilityOnline}
          </p>
        </>
      ) : null}
      <div className="mt-3 flex gap-2">
        {building ? (
          <button
            type="button"
            onClick={() => onToggleBuilding(building.id)}
            className="secondary-button min-h-9 flex-1 !px-2 !py-2 text-[10px]"
            disabled={actionDisabled || !canToggleBuilding(state, building.id)}
            title={!canToggleBuilding(state, building.id) ? t.offlineOxygenWarning : undefined}
          >
            <Power size={13} /> {offline ? t.bringOnline : t.takeOffline}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onAction(selection.kind === 'habitat' || selection.kind === 'crew' ? 'rest' : 'explore')}
            className="primary-button min-h-9 flex-1 !px-2 !py-2 text-[10px]"
            disabled={actionDisabled}
          >
            <ArrowUpRight size={14} />
            {selection.kind === 'habitat' || selection.kind === 'crew'
              ? t.assignRecovery
              : t.dispatchRover}
          </button>
        )}
      </div>
      {state.activeEvent ? <p className="mt-2 text-[9px] text-amber-200">{t.resolveEmergencyFirst}</p> : null}
    </aside>
  )
}

function resourceLabel(resource: string, language: 'ar' | 'en'): string {
  const labels: Record<string, { ar: string; en: string }> = {
    energy: { ar: 'طاقة', en: 'energy' },
    oxygen: { ar: 'أكسجين', en: 'oxygen' },
    water: { ar: 'ماء', en: 'water' },
    food: { ar: 'غذاء', en: 'food' },
    health: { ar: 'صحة', en: 'health' },
  }
  return labels[resource]?.[language] ?? resource
}

function FacilityGlyph({ id }: { id: string }) {
  if (id === 'solar-panels') {
    return <g fill="#256b89" stroke="#c1f1ff" strokeWidth="1.5"><path d="m-22 0 17-9 14 4-17 9Zm24-5 17-9 14 4-17 9Z" /><path d="m-7-5 3 7m10-11 3 7m6-7 3 7m-22 1 3 7m10-11 3 7m6-7 3 7" fill="none" strokeWidth=".7" /></g>
  }
  if (id === 'battery' || id === 'reactor') {
    return <g stroke="#fef3c7" strokeWidth="1.5"><path d="M-18-13h36v27h-36z" fill="#81754a" /><path d="M-7-17h14v4H-7z" fill="#d6c681" /><path d="M-3-8v9h6v-9" fill="none" /></g>
  }
  if (id === 'greenhouse') {
    return <g stroke="#d1fae5" strokeWidth="1.5"><path d="M-18 12v-15q18-23 36 0v15Z" fill="#4f9c78" fillOpacity=".68" /><path d="M0-12v24m-12-12h24" fill="none" /></g>
  }
  if (id === 'life-support' || id === 'moxie') {
    return <g stroke="#dbeafe" strokeWidth="1.5"><path d="M-16-13h32v27h-32z" fill="#49718a" /><path d="M-8-8v17m8-17v17m8-17v17" strokeOpacity=".6" /></g>
  }
  if (id === 'water-recycler') {
    return <g stroke="#bae6fd" strokeWidth="1.5"><path d="M-16-12h32v25h-32z" fill="#397b8d" /><path d="M0-7c-7 8-7 12 0 14 7-2 7-6 0-14Z" fill="#a5f3fc" /></g>
  }
  if (id === 'storm-shelter') {
    return <g stroke="#e2e8f0" strokeWidth="1.5"><path d="m0-17 17 7v12q-4 9-17 15Q-13 11-17 2v-12Z" fill="#536779" /><path d="m-7 0 5 5 10-12" fill="none" /></g>
  }
  return <g stroke="#e2e8f0" strokeWidth="1.5"><rect x="-16" y="-13" width="32" height="26" rx="7" fill="#64748b" /></g>
}

function MapBadge({ icon, label }: { icon: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-slate-950/65 px-2.5 py-1.5 text-[9px] font-semibold text-slate-200 backdrop-blur">
      <span className="text-sky-200">{icon}</span>{label}
    </span>
  )
}
