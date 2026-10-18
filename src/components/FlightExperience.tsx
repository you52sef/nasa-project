import { useEffect, useRef, useState } from 'react'
import { Activity, ChevronDown, Gauge, Rocket, Zap } from 'lucide-react'
import { canControlFlight, deterministicRoll, type GameState, type TransitChoice } from '../game/model'
import { SIMULATED_TRANSIT_DAYS } from '../game/flightPhysics'
import { useSettingsStore } from '../store/settingsStore'
import ar from '../i18n/ar'
import en from '../i18n/en'
import { AstronautProfileHud } from './AstronautProfileHud'

type FlightPhase = 'preflight' | 'launch' | 'cruise' | 'landing'
type FlightSpeed = 1 | 2 | 4
type FlightMenu = 'speed' | 'performance' | null

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
  const isArabic = language === 'ar'
  const canPilot = canControlFlight(state)
  const [profile, setProfile] = useState<TransitChoice | null>(canPilot ? null : 'conservative')
  const [speed, setSpeed] = useState<FlightSpeed>(1)
  const [phase, setPhase] = useState<FlightPhase>('preflight')
  const [progress, setProgress] = useState(0)
  const [openMenu, setOpenMenu] = useState<FlightMenu>(null)
  const [countdownIndex, setCountdownIndex] = useState(0)
  const [transitNotice, setTransitNotice] = useState('')
  const progressRef = useRef(0)
  const transitDayRef = useRef(0)
  const noticeTimerRef = useRef<number | null>(null)
  const simulatedDurationDays = SIMULATED_TRANSIT_DAYS[state.destination]
  const elapsedDays = simulatedDurationDays * progress / 100
  const remainingDays = Math.max(0, simulatedDurationDays - elapsedDays)
  const transitDay = Math.floor(elapsedDays)
  const totalDistanceKm = state.destination === 'moon' ? 384_400 : 225_000_000
  const distanceTravelledKm = Math.round(totalDistanceKm * progress / 100)
  const distanceRemainingKm = Math.max(0, totalDistanceKm - distanceTravelledKm)
  const formatDistance = (value: number) => new Intl.NumberFormat(isArabic ? 'ar-EG' : 'en-US', {
    maximumFractionDigits: 0,
  }).format(value)
  const surfaceDestination = state.destination === 'moon' ? t.moon : t.mars
  const destination = leg === 'outbound' ? surfaceDestination : t.homePlanet
  const origin = leg === 'outbound' ? t.homePlanet : surfaceDestination
  const arrival = leg === 'outbound' ? surfaceDestination : t.homePlanet
  const title = phase === 'landing'
    ? t.landingTitle
    : phase === 'launch'
      ? t.launchingTitle
      : leg === 'outbound' ? t.outboundDecisionTitle : t.returnDecisionTitle
  const planetScale = phase === 'launch'
    ? 0.82
    : phase === 'landing'
      ? 1.65
      : phase === 'cruise'
        ? 0.82 + progress / 100 * 0.83
        : 1
  const starDriftDuration = phase === 'launch'
    ? '5.5s'
    : phase === 'landing'
      ? '5.5s'
      : phase === 'cruise'
        ? `${12 / speed}s`
        : '24s'

  useEffect(() => {
    if (!canPilot && phase === 'preflight') setPhase('launch')
  }, [canPilot, phase])

  useEffect(() => {
    if (phase !== 'launch' && phase !== 'landing') return
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reducedMotion) {
      setCountdownIndex(5)
      const timer = window.setTimeout(() => {
        if (phase === 'launch') setPhase('cruise')
      }, 350)
      return () => window.clearTimeout(timer)
    }
    setCountdownIndex(0)
    const countdown = window.setInterval(() => {
      setCountdownIndex((index) => Math.min(5, index + 1))
    }, 1_000)
    const transition = window.setTimeout(() => {
      if (phase === 'launch') setPhase('cruise')
    }, 5_500)
    return () => {
      window.clearInterval(countdown)
      window.clearTimeout(transition)
    }
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
    if (phase !== 'cruise' || transitDay <= transitDayRef.current) return
    transitDayRef.current = transitDay
    const notices = isArabic
      ? ['تصحيح خفيف للمسار اكتمل بنجاح.', 'اكتمل تمرين الطاقم اليومي وفحص الحالة الصحية.', 'فحص أنظمة دعم الحياة وتنقية ثاني أكسيد الكربون مكتمل.', 'تحديث اتصال قصير مع مركز التحكم الأرضي.']
      : ['Minor course correction completed.', 'Crew exercise and daily health checks completed.', 'Life-support and CO₂ scrubber checks are nominal.', 'Short status update received from mission control.']
    const noticeIndex = Math.floor(deterministicRoll(state.missionSeed, state.day + transitDay, 171) * notices.length)
    setTransitNotice(notices[noticeIndex])
  }, [isArabic, phase, state.day, state.missionSeed, transitDay])

  useEffect(() => {
    if (!transitNotice) return
    if (noticeTimerRef.current !== null) window.clearTimeout(noticeTimerRef.current)
    noticeTimerRef.current = window.setTimeout(() => {
      setTransitNotice('')
      noticeTimerRef.current = null
    }, 5_000)
    return () => {
      if (noticeTimerRef.current !== null) window.clearTimeout(noticeTimerRef.current)
      noticeTimerRef.current = null
    }
  }, [transitNotice])

  useEffect(() => {
    if (phase !== 'landing' || !profile) return
    const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 350 : 5_500
    const timer = window.setTimeout(() => onArrive(leg, profile), duration)
    return () => window.clearTimeout(timer)
  }, [leg, onArrive, phase, profile])

  const beginFlight = () => {
    if (!canPilot || !profile || phase !== 'preflight') return
    setOpenMenu(null)
    setPhase('launch')
  }

  const selectPerformance = (choice: TransitChoice) => {
    setProfile(choice)
    setOpenMenu(null)
  }

  return (
    <main className="flight-page" dir={isArabic ? 'rtl' : 'ltr'}>
      <section
        className={`flight-fullscreen-space spacecraft-viewport spacecraft-viewport-${leg === 'return' ? 'earth' : state.destination} spacecraft-phase-${phase}${phase === 'landing' && leg === 'outbound' ? ' spacecraft-surface-transition' : ''}`}
        aria-label={`${title} · ${destination}`}
      >
        <div className="spacecraft-viewport-stars" style={{ animationDuration: starDriftDuration }} />
        <div className="spacecraft-viewport-planet" style={{ transform: `scale(${planetScale})` }} />
        <div className="spacecraft-viewport-horizon" />
        {phase === 'launch' || phase === 'landing' ? (
          <>
            <div className={`flight-transition-vehicle flight-transition-${phase}`} aria-hidden="true">
              <Rocket size={52} strokeWidth={1.6} />
              <span className={`flight-thruster flight-thruster-${state.destination}`} />
            </div>
            <div className={`flight-engine-plume flight-engine-plume-${phase} flight-engine-plume-${state.destination}`} aria-hidden="true" />
            {phase === 'landing' && state.destination === 'mars' ? <div className="flight-atmosphere-glow" aria-hidden="true" /> : null}
            {phase === 'launch' ? <div className="flight-liftoff-shake" aria-hidden="true" /> : null}
          </>
        ) : null}

        <div className="flight-scene-hud" dir="ltr">
          <span>{leg === 'outbound' ? 'OUTBOUND' : 'EARTH RETURN'}</span>
          <span>{title}</span>
          <span>{origin} <b aria-hidden="true">→</b> {arrival}</span>
        </div>

        <AstronautProfileHud state={state} language={language} flight />

        <section className="flight-day-counter" aria-label={t.flightDayLabel}>
          <span className="flight-hud-label">{isArabic ? 'أيام العبور' : 'TRANSIT DAYS'}</span>
          <strong dir="ltr">{elapsedDays.toFixed(1)} <span>/ {simulatedDurationDays}</span></strong>
          <span className="flight-day-mission">
            {isArabic ? 'يوم المهمة' : 'MISSION DAY'} <b dir="ltr">{state.day} / {state.maxDays}</b>
          </span>
          <span className="flight-distance-readout">
            {t.flightDistanceLabel} <b dir="ltr">{formatDistance(distanceRemainingKm)} / {formatDistance(totalDistanceKm)} km</b>
          </span>
          <span className="flight-day-remaining">{t.flightDaysRemaining} <b>{remainingDays.toFixed(1)} {t.days}</b></span>
        </section>

        {canPilot ? (
          <>
            <div className="flight-side-control flight-speed-control">
              <button
                type="button"
                className="flight-round-button"
                aria-label={t.flightSpeedLabel}
                aria-expanded={openMenu === 'speed'}
                onClick={() => setOpenMenu(openMenu === 'speed' ? null : 'speed')}
              >
                <Gauge size={24} />
                <span>{speed}×</span>
              </button>
              <span className="flight-control-caption">{t.flightSpeedLabel}</span>
              {openMenu === 'speed' ? (
                <div className="flight-control-menu" role="group" aria-label={t.flightSpeedLabel}>
                  {([1, 2, 4] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => {
                        setSpeed(value)
                        setOpenMenu(null)
                      }}
                      aria-pressed={speed === value}
                    >
                      {value}×
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="flight-side-control flight-performance-control">
              <button
                type="button"
                className="flight-round-button"
                aria-label={isArabic ? 'أداء الرحلة' : 'Flight profile'}
                aria-expanded={openMenu === 'performance'}
                disabled={phase !== 'preflight'}
                onClick={() => {
                  if (phase === 'preflight') setOpenMenu(openMenu === 'performance' ? null : 'performance')
                }}
              >
                <Activity size={24} />
              </button>
              <span className="flight-control-caption">{isArabic ? 'أداء الرحلة' : 'Performance'}</span>
              {openMenu === 'performance' ? (
                <div className="flight-control-menu flight-performance-menu" role="group" aria-label={isArabic ? 'أداء الرحلة' : 'Flight profile'}>
                  {(['conservative', 'efficient'] as const).map((choice) => (
                    <button
                      key={choice}
                      type="button"
                      onClick={() => selectPerformance(choice)}
                      aria-pressed={profile === choice}
                    >
                      <Zap size={15} />
                      <span>
                        <b>{choice === 'conservative' ? t.transitConservative : t.transitEfficient}</b>
                        <small>{choice === 'conservative' ? t.transitConservativeDescription : t.transitEfficientDescription}</small>
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </>
        ) : null}

        {canPilot && phase === 'preflight' && profile ? (
          <button type="button" className="flight-launch-button" onClick={beginFlight}>
            <Rocket size={17} /> {t.beginFlightButton}
          </button>
        ) : null}

        {phase === 'launch' || phase === 'landing' ? (
          <p className={`flight-scene-caption${phase === 'launch' ? ' flight-countdown-caption' : ''}`} role="status" aria-live="polite">
            {phase === 'launch'
              ? countdownIndex < 5
                ? `${isArabic ? 'الإقلاع خلال' : 'LIFTOFF IN'} ${5 - countdownIndex}`
                : (isArabic ? 'انطلاق!' : 'LIFTOFF!')
              : countdownIndex < 5
                ? `${t.landingCountdown} ${5 - countdownIndex}`
                : t.landingTitle}
          </p>
        ) : null}

        {transitNotice && phase === 'cruise' ? (
          <p className="flight-transit-notice" role="status" aria-live="polite">
            <span aria-hidden="true">✦</span> {transitNotice}
          </p>
        ) : null}
        <div className="flight-progress-hud">
          <div className="flight-progress-heading">
            <span>{t.flightProgressLabel}</span>
            <strong dir="ltr">{Math.round(phase === 'landing' ? 100 : progress)}%</strong>
          </div>
          <div
            className="flight-progress-track"
            role="progressbar"
            aria-label={t.flightProgressLabel}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={phase === 'landing' ? 100 : Math.round(progress)}
          >
            <span style={{ width: `${phase === 'landing' ? 100 : progress}%` }} />
          </div>
        </div>
      </section>
    </main>
  )
}
