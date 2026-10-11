import { useEffect, useRef, useState } from 'react'
import { Gauge, Rocket, Satellite, ShieldCheck, Zap } from 'lucide-react'
import type { GameState, TransitChoice } from '../game/model'
import { estimateTransfer, type OrbitalRoute } from '../game/flightPhysics'
import { useSettingsStore } from '../store/settingsStore'
import ar from '../i18n/ar'
import en from '../i18n/en'

type FlightPhase = 'preflight' | 'launch' | 'cruise' | 'landing'
type FlightSpeed = 1 | 2 | 4

export function FlightExperience({
  state,
  leg,
  onArrive,
}: {
  state: GameState
  leg: 'outbound' | 'return'
  onArrive: (leg: 'outbound' | 'return', choice: TransitChoice) => void
}) {
  const language = useSettingsStore((store) => store.language)
  const t = language === 'ar' ? ar : en
  const [profile, setProfile] = useState<TransitChoice | null>(null)
  const [speed, setSpeed] = useState<FlightSpeed>(1)
  const [phase, setPhase] = useState<FlightPhase>('preflight')
  const [progress, setProgress] = useState(0)
  const progressRef = useRef(0)
  const isArabic = language === 'ar'
  const surfaceDestination = state.destination === 'moon' ? t.moon : t.mars
  const destination = leg === 'outbound' ? surfaceDestination : t.homePlanet
  const origin = leg === 'outbound' ? t.homePlanet : surfaceDestination
  const arrival = leg === 'outbound' ? surfaceDestination : t.homePlanet
  const route: OrbitalRoute = state.destination === 'moon'
    ? leg === 'outbound' ? 'earth-moon' : 'moon-earth'
    : leg === 'outbound' ? 'earth-mars' : 'mars-earth'
  const transfer = estimateTransfer(route)
  const durationLabel = `${transfer.durationDays.toFixed(1)} ${t.days}`
  const elapsedDays = transfer.durationDays * progress / 100
  const remainingDays = Math.max(0, transfer.durationDays - elapsedDays)

  useEffect(() => {
    if (phase !== 'launch') return
    const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 350 : 3_600
    const timer = window.setTimeout(() => setPhase('cruise'), duration)
    return () => window.clearTimeout(timer)
  }, [phase])

  useEffect(() => {
    if (phase !== 'cruise') return
    const travelDuration = 30_000
    let lastTimestamp = 0
    let elapsed = progressRef.current / 100 * travelDuration
    let frame = 0
    const updateProgress = (timestamp: number) => {
      if (lastTimestamp) elapsed += (timestamp - lastTimestamp) * speed
      lastTimestamp = timestamp
      progressRef.current = Math.min(100, elapsed / travelDuration * 100)
      setProgress(progressRef.current)
      if (progressRef.current >= 100) {
        setPhase('landing')
        return
      }
      frame = window.requestAnimationFrame(updateProgress)
    }
    frame = window.requestAnimationFrame(updateProgress)
    return () => window.cancelAnimationFrame(frame)
  }, [phase, speed])

  useEffect(() => {
    if (phase !== 'landing' || !profile) return
    const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 350 : 3_200
    const timer = window.setTimeout(() => onArrive(leg, profile), duration)
    return () => window.clearTimeout(timer)
  }, [leg, onArrive, phase, profile])

  const beginFlight = () => {
    if (!profile || phase !== 'preflight') return
    setPhase('launch')
  }

  const title = phase === 'landing'
    ? t.landingTitle
    : phase === 'launch'
      ? t.launchingTitle
      : phase === 'cruise'
        ? leg === 'outbound' ? t.outboundDecisionTitle : t.returnDecisionTitle
        : t.flightDetailsTitle
  const flightStages = [t.flightStagePlan, t.flightStageLaunch, t.flightStageTransit, t.flightStageLanding]
  const activeStage = phase === 'preflight' ? 0 : phase === 'launch' ? 1 : phase === 'cruise' ? 2 : 3
  const planetScale = phase === 'launch'
    ? 0.82
    : phase === 'landing'
      ? 1.65
      : phase === 'cruise'
        ? 0.82 + progress / 100 * 0.83
        : 1
  const starDriftDuration = phase === 'launch'
    ? '3.6s'
    : phase === 'landing'
      ? '3.2s'
      : phase === 'cruise'
        ? `${12 / speed}s`
        : '24s'
  const vehiclePosition = phase === 'cruise'
    ? { right: `${50 - progress * 0.06}%`, bottom: `${75 - progress * 0.45}%` }
    : undefined
  const description = phase === 'landing'
    ? t.landingDescription.replace('{destination}', destination)
    : phase === 'launch'
      ? t.launchingDescription.replace('{destination}', destination)
      : phase === 'cruise'
        ? t.flightInProgress
        : t.flightDetailsDescription.replace('{destination}', destination)

  return (
    <main className="flight-page" dir={isArabic ? 'rtl' : 'ltr'}>
      <div className="flight-page-stars" aria-hidden="true" />
      <div className="flight-page-content">
        <header className="flight-page-header">
          <div className="flight-page-heading">
            <p className="eyebrow"><Satellite size={14} /> {t.transitWindowLabel}</p>
            <h1>{title}</h1>
            <p>{description}</p>
          </div>
          <span className={`spacecraft-cockpit-status flight-status-${phase}`} dir="ltr">
            {phase === 'preflight'
              ? 'FLIGHT PLAN · READY'
              : phase === 'launch'
                ? 'LAUNCH · IGNITION'
                : phase === 'cruise'
                  ? `FLIGHT · ${Math.round(progress)}%`
                  : 'LANDING · FINAL'}
          </span>
        </header>

        <ol className="flight-stage-track" aria-label={t.flightStagesLabel}>
          {flightStages.map((stage, index) => (
            <li key={stage} className={index < activeStage ? 'flight-stage-complete' : index === activeStage ? 'flight-stage-active' : ''} aria-current={index === activeStage ? 'step' : undefined}>
              <span className="flight-stage-marker" aria-hidden="true">{index < activeStage ? '✓' : `0${index + 1}`}</span>
              <span>{stage}</span>
            </li>
          ))}
        </ol>

        <section className="flight-mission-summary" aria-label={t.flightDetailsTitle}>
          <div><span>{t.flightLegLabel}</span><b>{t[leg]}</b></div>
          <div><span>{t.flightDestinationLabel}</span><b>{destination}</b></div>
          <div><span>{t.flightDayLabel}</span><b>{state.day} / {state.maxDays}</b></div>
          <div><span>{t.estimatedTransferTimeLabel}</span><b>{durationLabel}</b></div>
          <div><span>{t.flightProfileLabel}</span><b>{profile ? profile === 'conservative' ? t.transitConservative : t.transitEfficient : t.flightProfilePending}</b></div>
        </section>

        <section className="flight-physics-note" aria-label={t.transferEstimateTitle}>
          <div className="flight-physics-data">
            <p><span>{t.transferModelLabel}</span><b>{transfer.model === 'earth-centered-two-body' ? t.earthMoonTransferModel : t.heliocentricTransferModel}</b></p>
            <p><span>{t.departureDeltaVLabel}</span><b>{transfer.departureDeltaVKmS.toFixed(2)} km/s</b></p>
            <p><span>{t.requiredPhaseAngleLabel}</span><b>{transfer.phaseAngleDegrees.toFixed(1)}°</b></p>
          </div>
          <p className="flight-physics-disclaimer">{t.transferEstimateDisclaimer}</p>
        </section>

        <div className="flight-page-layout">
          <section className="spacecraft-cabin">
            <div className={`spacecraft-viewport spacecraft-viewport-${leg === 'return' ? 'earth' : state.destination} spacecraft-phase-${phase}`} role="img" aria-label={`${title} · ${destination}`}>
              <div className="spacecraft-viewport-stars" style={{ animationDuration: starDriftDuration }} />
              <div className="spacecraft-viewport-planet" style={{ transform: `scale(${planetScale})` }} />
              <div className="spacecraft-viewport-horizon" />
              <div className="spacecraft-viewport-route" dir="ltr">
                <span>{origin}</span><span aria-hidden="true">→</span><span>{arrival}</span>
              </div>
              <div className="spacecraft-viewport-reticle" aria-hidden="true"><span /><span /></div>
              <div className="spacecraft-viewport-readout" dir="ltr">NAV · {leg === 'outbound' ? 'OUTBOUND' : 'EARTH RETURN'} · {String(state.day).padStart(2, '0')}</div>
              {phase === 'cruise' ? <div className="spacecraft-flight-time" dir="ltr">T+ {elapsedDays.toFixed(1)} d · {t.flightDaysRemaining} {remainingDays.toFixed(1)} d</div> : null}
              <div className="spacecraft-viewport-vehicle" style={vehiclePosition} aria-hidden="true"><Rocket size={36} /></div>
              {phase === 'launch' ? <div className="flight-launch-plume" aria-hidden="true" /> : null}
              <div className="flight-progress-track" role="progressbar" aria-label={t.flightProgressLabel} aria-valuemin={0} aria-valuemax={100} aria-valuenow={phase === 'landing' ? 100 : Math.round(progress)}><span style={{ width: `${phase === 'landing' ? 100 : progress}%` }} /></div>
              {phase === 'landing' ? <div className="docking-beacon" aria-hidden="true"><span /><span /><span /></div> : null}
              {phase === 'launch' ? <div className="flight-launch-countdown" aria-label={t.launchCountdown} dir="ltr"><span>T−03</span><span>T−02</span><span>T−01</span></div> : null}
              {phase === 'launch' || phase === 'landing' ? <p className="flight-scene-caption" role="status" aria-live="polite">{phase === 'launch' ? t.launchingTitle : t.landingTitle}</p> : null}
            </div>
            <div className="spacecraft-cabin-readouts" aria-label={t.cabinSystemsLabel}>
              <div><span>{t.cabinPressureLabel}</span><b>98%</b></div>
              <div><span>{t.cabinOxygenLabel}</span><b>{state.resources.oxygen.toFixed(1)} kg</b></div>
              <div><span>{t.navigationStatusLabel}</span><b>{phase === 'landing' ? t.dockingStatus : t.navigationStatus}</b></div>
            </div>
          </section>

          <aside className="spacecraft-flight-controls">
            <p className="spacecraft-commander-label">✦ {t.commanderPilotingLabel}</p>
            <p className="mt-2 text-xs leading-6 text-slate-400">{phase === 'preflight' ? t.chooseFlightProfile : phase === 'cruise' ? t.flightInProgress : description}</p>
            {phase === 'cruise' ? <p className="mt-2 text-[11px] font-bold text-cyan-100">{t.estimatedTransferTimeLabel}: {durationLabel} · {t.flightDaysRemaining} {remainingDays.toFixed(1)} {t.days}</p> : null}
            <div className="mt-4">
              <p className="mb-2 flex items-center gap-2 text-xs font-bold text-slate-300"><Gauge size={14} /> {t.flightSpeedLabel}</p>
              <div className="grid grid-cols-3 gap-2">
                {([1, 2, 4] as const).map((value) => (
                  <button key={value} type="button" onClick={() => setSpeed(value)} aria-pressed={speed === value} disabled={phase === 'launch' || phase === 'landing'} className={`flight-speed-button ${speed === value ? 'flight-speed-active' : ''}`}>
                    {value}×
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-5 grid gap-2">
              {(['conservative', 'efficient'] as const).map((choice) => (
                <button key={choice} type="button" onClick={() => setProfile(choice)} disabled={phase !== 'preflight'} aria-pressed={profile === choice} className={`decision-card action-sky text-start disabled:cursor-default ${profile === choice ? 'flight-profile-selected' : ''}`}>
                  <span className="text-lg" aria-hidden="true">{choice === 'conservative' ? <ShieldCheck size={19} /> : <Zap size={19} />}</span>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-slate-100">{choice === 'conservative' ? t.transitConservative : t.transitEfficient}</span>
                    <span className="mt-1 block text-[11px] leading-5 text-slate-400">{choice === 'conservative' ? t.transitConservativeDescription : t.transitEfficientDescription}</span>
                  </span>
                </button>
              ))}
            </div>
            {phase === 'preflight' ? (
              <button type="button" onClick={beginFlight} disabled={!profile} className="primary-button mt-5 w-full justify-center disabled:cursor-not-allowed disabled:opacity-40">
                <Rocket size={17} /> {t.beginFlightButton}
              </button>
            ) : null}
          </aside>
        </div>
      </div>
    </main>
  )
}
