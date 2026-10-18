import { useEffect, useRef, useState } from 'react'
import { ArrowUpRight, Layers3, Power, X } from 'lucide-react'
import type { KeyboardEvent, MouseEvent } from 'react'
import { BUILDINGS } from '../game/buildings'
import { canPerformActivity, canToggleBuilding, type Action, type GameState } from '../game/model'
import { useGameStore } from '../store/gameStore'
import { useSettingsStore } from '../store/settingsStore'
import { SCENARIOS } from '../game/scenarios'
import { EVENTS } from '../game/events'
import { getAccessibleMissionPanels } from '../game/teamwork'
import { BASE_MAP_SITES, getFacilityMapPosition, getFacilityNetworkOrigin } from '../game/siteLayout'
import ar from '../i18n/ar'
import en from '../i18n/en'

interface Props {
  state: GameState
  onAction: (action: Action) => void
  className?: string
}

type MapSelection =
  | { kind: 'building'; id: string; index: number }
  | { kind: 'habitat' }
  | { kind: 'rover' }
  | { kind: 'crew'; index: number }
  | { kind: 'site' }

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

export function BaseView({ state, onAction, className = '' }: Props) {
  const [selected, setSelected] = useState<MapSelection | null>(null)
  const [systemsOverlay, setSystemsOverlay] = useState(false)
  const [eventCue, setEventCue] = useState<string | null>(null)
  const eventCueTimer = useRef<number | null>(null)
  const language = useSettingsStore((store) => store.language)
  const toggleBuilding = useGameStore((store) => store.toggleBuilding)
  const t = language === 'ar' ? ar : en
  const isMoon = state.destination === 'moon'
  const panels = getAccessibleMissionPanels(state)
  const canManageInfrastructure = panels.includes('infrastructure')
  const canViewSystems = panels.includes('systems')
  const scenario = state.scenario || 'baseline'
  const weatherAffected = scenario === 'dust-front' || Boolean(
    state.activeEvent && ['solar-storm', 'low-light', 'panel-dust'].includes(state.activeEvent.id),
  )
  const arabic = language === 'ar'
  const offlineBuildings = state.offlineBuildings || []
  const mapPeriod = state.hour < 8 ? 'dawn' : state.hour >= 20 ? 'night' : state.hour >= 17 ? 'dusk' : 'day'
  const daylightProgress = Math.max(0, Math.min(1, (state.hour - 6) / 14))
  const celestialTop = 36 - Math.sin(daylightProgress * Math.PI) * 23
  const mapEvent = eventCue ? EVENTS.find((event) => event.id === eventCue) : undefined

  useEffect(() => {
    if (!state.activeEvent?.id) return
    setEventCue(state.activeEvent.id)
    if (eventCueTimer.current !== null) window.clearTimeout(eventCueTimer.current)
    eventCueTimer.current = window.setTimeout(() => {
      setEventCue(null)
      eventCueTimer.current = null
    }, 7_000)
    return () => {
      if (eventCueTimer.current !== null) window.clearTimeout(eventCueTimer.current)
    }
  }, [state.activeEvent?.id])

  useEffect(() => () => {
    if (eventCueTimer.current !== null) window.clearTimeout(eventCueTimer.current)
  }, [])

  useEffect(() => {
    if (!selected) return
    const dismissOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') dismissSelected()
    }
    document.addEventListener('keydown', dismissOnEscape)
    return () => document.removeEventListener('keydown', dismissOnEscape)
  }, [selected])

  const dismissSelected = () => {
    setSelected(null)
  }

  const select = (selection: MapSelection, extraClass = '') => ({
    role: 'button' as const,
    tabIndex: 0,
    pointerEvents: 'bounding-box' as const,
    className: `cursor-pointer outline-none focus-visible:brightness-125 ${extraClass}`,
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
  const mappedFacilities = state.buildings.filter((id) => BUILDINGS[id] && id !== 'habitat').map((id, index) => ({
    id,
    index,
    position: getFacilityMapPosition(id),
    building: BUILDINGS[id],
  }))

  return (
    <section className={`glass-panel relative flex min-h-0 flex-col overflow-hidden ${className}`} aria-label={t.siteMapLabel}>
      <div className={`base-map-surface base-map-${scenario} base-map-period-${mapPeriod} relative isolate ${className ? 'min-h-0 flex-1' : 'min-h-[390px] sm:min-h-[500px]'} overflow-hidden ${isMoon ? 'bg-[#555966]' : 'bg-[#714538]'}`}>
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

          <circle
            cx={BASE_MAP_SITES.habitat.x}
            cy={BASE_MAP_SITES.habitat.y}
            r="80"
            fill="none"
            stroke="#fbbf24"
            strokeOpacity=".35"
            strokeWidth="1.5"
            strokeDasharray="5 6"
            pointerEvents="none"
          />
          <text x={BASE_MAP_SITES.habitat.x} y={BASE_MAP_SITES.habitat.y - 86} textAnchor="middle" fill="#fde68a" fillOpacity=".9" fontSize="8" fontWeight="700" pointerEvents="none">
            {t.landingPadSafetyZone}
          </text>
          <circle cx={BASE_MAP_SITES.protectedRidge.x} cy={BASE_MAP_SITES.protectedRidge.y} r="49" fill="#38bdf8" fillOpacity=".035" stroke="#7dd3fc" strokeOpacity=".38" strokeDasharray="3 5" pointerEvents="none" />
          <text x={BASE_MAP_SITES.protectedRidge.x} y={BASE_MAP_SITES.protectedRidge.y - 53} textAnchor="middle" fill="#bae6fd" fillOpacity=".9" fontSize="8" fontWeight="700" pointerEvents="none">
            {t.protectedRidgeLabel}
          </text>

          <path d="M405 280 C365 276 344 280 315 280 S270 335 225 380 M405 280 C445 267 465 272 495 280 S498 335 500 380 M405 280 C407 325 406 350 405 380" fill="none" stroke="#1b2028" strokeOpacity=".5" strokeWidth="13" strokeLinecap="round" />
          <path d="M405 280 C365 276 344 280 315 280 S270 335 225 380 M405 280 C445 267 465 272 495 280 S498 335 500 380 M405 280 C407 325 406 350 405 380" fill="none" stroke="#d6c8ac" strokeOpacity=".62" strokeWidth="2" strokeDasharray="7 7" />

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
            {scenario === 'oxygen-shortage' || scenario === 'habitat-leak' ? (
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
                const origin = getFacilityNetworkOrigin(id)
                return (
                  <g key={`network-${id}-${index}`} className={offline ? 'map-network-link map-network-offline' : 'map-network-link'}>
                    <path d={`M${origin.x} ${origin.y} Q${(position.x + origin.x) / 2} ${(position.y + origin.y) / 2 - 18} ${position.x} ${position.y}`} />
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
              <circle cy="24" r="10" fill="#101722" fillOpacity=".92" stroke={isOffline ? '#fbbf24' : '#bae6fd'} strokeOpacity=".8" />
              <text y="27" textAnchor="middle" fontSize="8" fill="#f8fafc" fontWeight="700">{index + 1}</text>
              <circle className={!isOffline ? 'map-status-light' : undefined} cx="19" cy="-17" r="4" fill={isOffline ? '#fbbf24' : '#34d399'} stroke="#0f172a" strokeWidth="1.5" />
              <title>{building.name[language]}</title>
            </g>
          )})}

          {state.constructionProject ? (() => {
            const project = state.constructionProject
            const building = BUILDINGS[project.buildingId]
            const position = getFacilityMapPosition(project.buildingId)
            return (
              <g transform={`translate(${position.x} ${position.y})`} pointerEvents="none" aria-hidden="true">
                <circle r="36" fill="#f59e0b" fillOpacity=".08" stroke="#fcd34d" strokeWidth="2" strokeDasharray="5 4" />
                <path d="M-20 15V-8h40v23M-27-8h54M-12-8v23M0-8v23M12-8v23M-21 15h42" fill="none" stroke="#fde68a" strokeWidth="2" />
                <path d="M0-9v-22h18m-6 0 6 6m-6-6 6-6" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" />
                <rect x="-25" y="19" width="50" height="25" rx="5" fill="#101722" stroke="#fcd34d" />
                <text y="29" textAnchor="middle" fill="#fef3c7" fontSize="8" fontWeight="700">{project.hoursRemaining}h</text>
                <text y="39" textAnchor="middle" fill="#fcd34d" fontSize="5" fontWeight="700">{t.constructionInProgress}</text>
                <title>{building?.name[language] || project.buildingId}: {t.constructionInProgress}</title>
              </g>
            )
          })() : null}

          <g transform={`translate(${BASE_MAP_SITES.habitat.x} ${BASE_MAP_SITES.habitat.y})`} filter="url(#shadow)" {...select({ kind: 'habitat' }, 'map-habitat')} aria-label={t.habitatLabel}>
            {selected?.kind === 'habitat' ? <circle r="58" fill="none" stroke="#facc15" strokeWidth="2" strokeDasharray="4 3" /> : null}
            <path d="M-43 18V-2a43 43 0 0 1 86 0v20Z" fill="#72bad1" fillOpacity=".3" stroke="#e0f2fe" strokeWidth="2" />
            <path d="M-31 18V-1a31 31 0 0 1 62 0v19M-21 18V-1a21 21 0 0 1 42 0v19M-43 4h86M-37-15 37 12M37-15-37 12M0-45V18" fill="none" stroke="#c6f1ff" strokeOpacity=".7" strokeWidth="1.2" />
            <path d="M-43 18h86l-7 11h-72Z" fill="#cbd5e1" stroke="#f8fafc" strokeWidth="1.5" />
            <rect x="-6" y="5" width="12" height="13" rx="2" fill="#f8fafc" fillOpacity=".7" />
            <circle cx="-25" cy="-4" r="3" fill="#bbf7d0" className="map-status-light" />
            <circle cx="25" cy="-4" r="3" fill="#bbf7d0" className="map-status-light" />
            <path d="M-11-28h22v7h-22z" fill="#2563eb" stroke="#dbeafe" strokeWidth=".8" />
            <text y="-23" textAnchor="middle" fill="white" fontSize="5" fontWeight="900">A1</text>
            <circle r="51" fill="none" stroke="#7dd3fc" strokeOpacity=".45" strokeDasharray="3 5" />
            <title>{t.habitatLabel}</title>
          </g>

          <g key={`rover-${state.daysSurvived}`} transform={`translate(${BASE_MAP_SITES.rover.x} ${BASE_MAP_SITES.rover.y}) rotate(-24)`} filter="url(#shadow)" {...select({ kind: 'rover' })} aria-label={t.roverLabel}>
            <circle r="40" fill="transparent" pointerEvents="all" />
            {selected?.kind === 'rover' ? <circle r="43" fill="none" stroke="#facc15" strokeWidth="2" strokeDasharray="4 3" /> : null}
            {state.lastAction === 'explore' ? <animateMotion dur="8.5s" repeatCount="1" fill="freeze" path="M0 0 C-28 -50 -66 -73 -115 -110 C-190 -130 -295 -112 -380 -63 C-290 -86 -195 -120 -115 -110 C-75 -80 -35 -40 0 0" /> : null}
            <circle className="map-rover-halo" r="27" fill="none" stroke="#fbbf24" strokeOpacity=".45" strokeDasharray="3 5" pointerEvents="none" />
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

        <div className={`pointer-events-none absolute inset-0 bg-gradient-to-b from-slate-950/45 via-transparent to-slate-950/55 ${mapPeriod === 'dawn' ? 'map-dawn-glow' : mapPeriod === 'dusk' ? 'map-sunset-glow' : mapPeriod === 'night' ? 'map-night-glow' : ''} ${weatherAffected ? 'map-dust-storm' : ''}`} />
        <div className="map-celestial-track" aria-hidden="true">
          <span className={`map-celestial map-celestial-${mapPeriod}`} style={{ left: `${8 + daylightProgress * 84}%`, top: `${celestialTop}%` }}>
            {mapPeriod === 'night' ? '☾' : '☼'}
          </span>
        </div>
        {mapEvent ? (
          <div className={`map-event-cue map-event-${mapEvent.id}`} aria-hidden="true">
            <span className="map-event-cue-pulse" />
            <span className="map-event-cue-icon">{mapEvent.icon}</span>
            <span>{mapEvent.title[language]}</span>
          </div>
        ) : null}
        <div className="absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-4 p-4 sm:p-6">
          <div className="max-w-[75%]">
            <p className="eyebrow"><span className="h-1.5 w-1.5 rounded-full bg-emerald-300" /> {t.siteSchematicLabel}</p>
            <h2 className="mt-2 truncate text-lg font-black text-white sm:text-2xl">{state.baseName}</h2>
            <p className="mt-1 text-[9px] font-semibold tracking-[.16em] text-slate-200/70 sm:text-[10px]">
              {labels.site} · {labels.lat} / {labels.lon}
            </p>
            <p className="mt-2 inline-flex items-center gap-2 border border-white/10 bg-slate-950/45 px-2 py-1 text-[9px] font-bold tracking-[.08em] text-amber-100/90 backdrop-blur">
              <span className={`h-1.5 w-1.5 rounded-full ${scenario === 'oxygen-shortage' || scenario === 'habitat-leak' ? 'bg-rose-300' : scenario === 'water-rationing' ? 'bg-cyan-300' : scenario === 'dust-front' || scenario === 'solar-flare' ? 'bg-orange-300' : 'bg-emerald-300'}`} />
              {SCENARIOS[scenario].name[language]}
            </p>
          </div>
          <div className="rounded-xl border border-white/15 bg-slate-950/60 px-3 py-2 text-end text-[10px] font-semibold text-slate-100 shadow-lg backdrop-blur">
            <span className="block">{isMoon ? t.moonSurfaceLabel : t.marsSurfaceLabel}</span>
            <span className="mt-1 block text-[9px] text-emerald-200">● {t.simulatedLinkLabel}</span>
            {canViewSystems ? <button
              type="button"
              className={`map-layer-toggle mt-2 inline-flex items-center gap-1.5 border px-2 py-1 text-[9px] transition ${systemsOverlay ? 'border-cyan-200/30 bg-cyan-200/10 text-cyan-100' : 'border-white/10 text-slate-300 hover:bg-white/10'}`}
              onClick={() => setSystemsOverlay((value) => !value)}
              aria-pressed={systemsOverlay}
            >
              <Layers3 size={12} />
              {systemsOverlay ? t.systemsLayerLabel : t.systemsViewLabel}
            </button> : null}
          </div>
        </div>

        <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
          <div className="flex flex-wrap gap-2">
            <MapBadge icon="🏠" label={t.habitatLabel} />
            <MapBadge icon="🛰" label={t.roverLabel} />
            <MapBadge icon="•" label={t.crewLabel} />
          </div>
          <p className="rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-[10px] font-semibold text-slate-200 backdrop-blur">
          {state.crewSize} {t.crewCountLabel} · {mappedFacilities.length + Number(state.buildings.includes('habitat'))} {t.facilityCountLabel} · {t.cycleCountLabel} {state.day}
          </p>
        </div>
      </div>
      {selected ? (
        <div
          className="map-object-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) dismissSelected()
          }}
        >
          <MapObjectInfo
            selection={selected}
            state={state}
            language={language}
            onDismiss={dismissSelected}
            onAction={onAction}
            onToggleBuilding={toggleBuilding}
            canManageInfrastructure={canManageInfrastructure}
          />
        </div>
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
  canManageInfrastructure,
}: {
  selection: MapSelection
  state: GameState
  language: 'ar' | 'en'
  onDismiss: () => void
  onAction: (action: Action) => void
  onToggleBuilding: (buildingId: string) => void
  canManageInfrastructure: boolean
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
    <section className="map-object-dialog border border-sky-200/20 bg-slate-950/95 p-3.5 shadow-2xl sm:p-4" role="dialog" aria-modal="true" aria-labelledby="map-object-title" aria-live="polite">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[9px] font-bold tracking-[.16em] text-sky-200">{t.selectedObject}</p>
          <h3 id="map-object-title" className="mt-1 truncate text-sm font-black text-white">{building?.icon || (selection.kind === 'rover' ? '🛰️' : selection.kind === 'crew' ? '🧑‍🚀' : selection.kind === 'site' ? '🔬' : '🏠')} {name}</h3>
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
        {building && canManageInfrastructure ? (
          <button
            type="button"
            onClick={() => onToggleBuilding(building.id)}
            className="secondary-button min-h-9 flex-1 !px-2 !py-2 text-[10px]"
            disabled={actionDisabled || !canToggleBuilding(state, building.id)}
            title={!canToggleBuilding(state, building.id) ? t.offlineOxygenWarning : undefined}
          >
            <Power size={13} /> {offline ? t.bringOnline : t.takeOffline}
          </button>
        ) : !building && canPerformActivity(state, selection.kind === 'habitat' || selection.kind === 'crew' ? 'rest' : 'explore') ? (
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
        ) : null}
      </div>
      {state.activeEvent ? <p className="mt-2 text-[9px] text-amber-200">{t.resolveEmergencyFirst}</p> : null}
    </section>
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
    return <g fill="#123e68" stroke="#bfdbfe" strokeWidth="1.4"><path d="m-25-11 18-7 17 5-18 8Zm4 21 18-7 17 5-18 8Zm21-21 18-7 17 5-18 8Zm4 21 18-7 17 5-18 8Z" /><path d="m-7-18 4 19m13-14 4 19m13-26 4 19m-35 2 4 19m13-14 4 19m13-26 4 19" fill="none" stroke="#7dd3fc" strokeWidth=".65" /></g>
  }
  if (id === 'reactor') {
    return <g stroke="#bfdbfe" strokeWidth="1.5"><path d="M-13 17V-22q13-10 26 0v39Z" fill="#34485e" /><path d="M-19 17h38v5h-38ZM-10-19v34m20-34v34M-16-5h32M-16 7h32" fill="none" stroke="#94a3b8" strokeWidth="2.5" /><circle className="map-reactor-core" r="5" fill="#60a5fa" stroke="#dbeafe" /><path d="M0-32v10m-5-10h10" stroke="#60a5fa" strokeWidth="2" /></g>
  }
  if (id === 'battery') {
    return <g stroke="#fef3c7" strokeWidth="1.5"><path d="M-19-13h38v28h-38z" fill="#81754a" /><path d="M-7-18h14v5H-7z" fill="#d6c681" /><path d="M-10-6h6v13h-6zm14 0h6v13H4z" fill="#fde68a" stroke="#fef3c7" /><path d="M-16 18h32" fill="none" stroke="#fbbf24" /></g>
  }
  if (id === 'command-center' || id === 'communications') {
    return <g stroke="#dbeafe" strokeWidth="1.5"><path d="M-19-8h38v22h-38z" fill="#526b83" /><path d="M-13-3h9v10h-9zm17 0h9v10h-9z" fill="#67e8f9" fillOpacity=".55" /><path d="M0-8v-13m0 0 12-7m-12 7-10-5" fill="none" /><g className="map-radar-dish"><path d="M0-21q15-13 25-3-8 11-25 3Z" fill="#93c5fd" stroke="#dbeafe" /><path d="m0-21 17-2" /></g><circle cx="0" cy="-21" r="2" fill="#f8fafc" /></g>
  }
  if (id === 'greenhouse') {
    return <g stroke="#d1fae5" strokeWidth="1.4"><path d="M-23 12v-7a23 19 0 0 1 46 0v7Z" fill="#4f9c78" fillOpacity=".56" /><path d="M-23 6h46M-13-5 0 12 13-5M0-6v18" fill="none" /><path d="M-15 10q-2-12 4-13m-2 7q8-8 11-3m0 9Q-1-4 6-8m-5 13q7-8 12-5" fill="none" stroke="#86efac" strokeWidth="2" /><circle cx="-9" cy="-4" r="2" fill="#bbf7d0" className="map-status-light" /><circle cx="8" cy="-7" r="2" fill="#bbf7d0" className="map-status-light" /></g>
  }
  if (id === 'medical-bay') {
    return <g stroke="#f8fafc" strokeWidth="1.6"><rect x="-19" y="-14" width="38" height="28" rx="3" fill="#dbeafe" /><rect x="-11" y="-9" width="9" height="8" fill="#fff" /><rect x="2" y="-9" width="9" height="8" fill="#fff" /><path d="M-4-3h8v5h5v8H4v5h-8v-5h-5V2h5Z" fill="#fb7185" stroke="#ffe4e6" /></g>
  }
  if (id === 'landing-pad') {
    return <g fill="none" strokeWidth="1.5"><circle r="20" stroke="#facc15" strokeDasharray="4 3" /><circle r="14" stroke="#7dd3fc" strokeOpacity=".9" /><path d="M-9-5h18v11h-18zM-13 11h26M0-14v6m-4-3h8" fill="#475569" stroke="#e2e8f0" /><path d="M-20 0h5m30 0h5M0-25v5m0 30v5" stroke="#facc15" strokeWidth="2" /></g>
  }
  if (id === 'isru' || id === 'moxie' || id === 'water-recycler') {
    return <g stroke="#bae6fd" strokeWidth="1.5"><path d="M-18-13h36v27h-36z" fill="#397b8d" /><path d="M-13-7h10v14h-10zm18 0h9v14h-9z" fill="#0f2633" stroke="#67e8f9" /><path d="M-18-16v-5h7v8m29-4v6h-8m-20 18q-7 2-7 8m31-7q7-1 8 6" fill="none" stroke="#67e8f9" strokeWidth="2" /><circle r="3" fill="#a5f3fc" /></g>
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
