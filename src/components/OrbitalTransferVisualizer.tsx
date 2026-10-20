import { memo, useMemo } from 'react'
import { estimateTransfer } from '../game/flightPhysics'
import type { Destination } from '../game/model'
import ar from '../i18n/ar'
import en from '../i18n/en'
import { useSettingsStore } from '../store/settingsStore'

export const OrbitalTransferVisualizer = memo(function OrbitalTransferVisualizer({
  destination,
  onDestinationChange,
}: {
  destination: Destination
  onDestinationChange: (destination: Destination) => void
}) {
  const language = useSettingsStore((state) => state.language)
  const t = language === 'ar' ? ar : en
  const transfer = useMemo(
    () => estimateTransfer(destination === 'moon' ? 'earth-moon' : 'earth-mars'),
    [destination],
  )
  const numberFormat = useMemo(
    () => new Intl.NumberFormat(language === 'ar' ? 'ar-EG' : 'en-US', { maximumFractionDigits: 1 }),
    [language],
  )
  const time = numberFormat.format(transfer.durationDays)
  const otherDestination = destination === 'moon' ? 'mars' : 'moon'

  return (
    <section className={`orbit-visualizer orbit-destination-${destination}`} aria-label={t.orbitVisualizerLabel}>
      <div className="orbit-visualizer-scene" aria-label={`${destination === 'moon' ? t.earthMoonTransferModel : t.heliocentricTransferModel} · ${destination === 'moon' ? t.moon : t.mars}`}>
        <div className="orbit-scene-grid" aria-hidden="true" />
        <svg className="orbit-transfer-svg" viewBox="0 0 640 320" role="img" aria-label={t.orbitTransferPath}>
          <ellipse className="orbit-guide" cx="137" cy="224" rx="75" ry="39" transform="rotate(-22 137 224)" />
          <ellipse className="orbit-guide orbit-guide-target" cx={destination === 'moon' ? 514 : 518} cy={destination === 'moon' ? 106 : 91} rx={destination === 'moon' ? 53 : 70} ry={destination === 'moon' ? 29 : 36} transform="rotate(-24 518 100)" />
          <path className="orbit-transfer-halo orbit-path-moon" d="M 142 228 C 214 48, 421 34, 512 108" />
          <path className="orbit-transfer-halo orbit-path-mars" d="M 142 228 C 238 26, 439 15, 518 91" />
          <path id="setup-orbit-transfer-moon" className="orbit-transfer-path orbit-path-moon" d="M 142 228 C 214 48, 421 34, 512 108" />
          <path id="setup-orbit-transfer-mars" className="orbit-transfer-path orbit-path-mars" d="M 142 228 C 238 26, 439 15, 518 91" />
          <circle className="orbit-departure-pulse" cx="142" cy="228" r="8" />
          <circle className="orbit-departure-core" cx="142" cy="228" r="3.2" />
        </svg>
        <button
          type="button"
          className="orbit-body orbit-earth"
          onClick={() => onDestinationChange('moon')}
          aria-label={`${t.destination}: ${t.moon}`}
          aria-pressed={destination === 'moon'}
        >
          <span className="orbit-earth-sphere" />
          <span className="orbit-body-label">{t.homePlanet}</span>
        </button>
        <button
          type="button"
          className="orbit-body orbit-target"
          onClick={() => onDestinationChange(otherDestination)}
          aria-label={language === 'ar'
            ? `تبديل الوجهة إلى ${otherDestination === 'moon' ? t.moon : t.mars}`
            : `Switch destination to ${otherDestination === 'moon' ? t.moon : t.mars}`}
        >
          <span className={`orbit-target-sphere orbit-target-sphere-${destination}`} />
          <span className="orbit-body-label">{destination === 'moon' ? t.moon : t.mars}</span>
        </button>
        <span className="orbit-scene-readout"><span className="mission-live-dot" />{t.transferEstimateTitle}</span>
      </div>
      <div className="orbit-telemetry-grid">
        <div className="orbit-telemetry-card">
          <span>{t.estimatedTransferTimeLabel}</span>
          <strong>{time} <small>{t.days}</small></strong>
        </div>
        <div className="orbit-telemetry-card">
          <span>{t.departureDeltaVLabel}</span>
          <strong>{numberFormat.format(transfer.departureDeltaVKmS)} <small>km/s</small></strong>
        </div>
        <div className="orbit-telemetry-card">
          <span>{t.requiredPhaseAngleLabel}</span>
          <strong>{numberFormat.format(transfer.phaseAngleDegrees)}<small>°</small></strong>
        </div>
      </div>
      <p className="orbit-environment-readout">{destination === 'moon'
        ? (language === 'ar' ? '0.165 g · شبه فراغ · وصلة قريبة من الأرض' : '0.165 g · near vacuum · near-Earth link')
        : (language === 'ar' ? '0.38 g · ضغط 0.6٪ · تأخير اتصال 3–22 دقيقة' : '0.38 g · 0.6% pressure · 3–22 min communication delay')}</p>
      <p className="orbit-visualizer-disclaimer">{t.transferEstimateDisclaimer}</p>
    </section>
  )
})
