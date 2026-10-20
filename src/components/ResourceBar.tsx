import { memo } from 'react'
import type { ResourceName, Resources } from '../game/model'
import { getSupplyCapacity } from '../game/model'
import { RESOURCE_META, formatResourceValue } from '../game/resources'

interface Props {
  resources: Resources
  language: 'ar' | 'en'
  energyCapacity: number
  crewSize: number
}

const GAUGE_CIRCUMFERENCE = 188.5

export const ResourceBar = memo(function ResourceBar({ resources, language, energyCapacity, crewSize }: Props) {
  const resourceReadings = (Object.entries(RESOURCE_META) as [ResourceName, typeof RESOURCE_META[ResourceName]][])
    .map(([resource, meta]) => {
      const value = resources[resource]
      const capacity = resource === 'energy'
        ? energyCapacity
        : resource === 'health'
          ? 100
          : getSupplyCapacity(resource, crewSize)
      const percentage = Math.max(0, Math.min(100, value / capacity * 100))
      const tone = percentage <= 25 ? 'danger' : percentage <= 50 ? 'warning' : 'safe'
      const reading = resource === 'energy'
        ? `${formatResourceValue(resource, value, language)} / ${capacity} kWh`
        : formatResourceValue(resource, value, language)
      return { id: resource, label: meta.label[language], icon: meta.icon, value, capacity, percentage, tone, reading }
    })
  const modeledDailyCo2 = crewSize
  const co2Reading = new Intl.NumberFormat(language, { maximumFractionDigits: 1 }).format(modeledDailyCo2)

  return (
    <section className="resource-gauge-grid" aria-label={language === 'ar' ? 'حالة الموارد' : 'Resource status'}>
      {resourceReadings.map((resource) => (
        <article key={resource.id} className={`resource-gauge-card is-${resource.tone}`}>
          <div className="resource-gauge-visual" aria-hidden="true">
            <svg viewBox="0 0 72 72">
              <defs>
                <linearGradient id={`resource-gauge-${resource.id}`} x1="0" x2="1" y1="1" y2="0">
                  <stop offset="0" stopColor="#35cfca" />
                  <stop offset="1" stopColor="#63aaff" />
                </linearGradient>
              </defs>
              <circle className="resource-gauge-track" cx="36" cy="36" r="30" />
              <circle
                className="resource-gauge-value"
                cx="36"
                cy="36"
                r="30"
                stroke={`url(#resource-gauge-${resource.id})`}
                strokeDasharray={GAUGE_CIRCUMFERENCE}
                strokeDashoffset={GAUGE_CIRCUMFERENCE * (1 - resource.percentage / 100)}
              />
            </svg>
            <span className="resource-gauge-icon">{resource.icon}</span>
          </div>
          <div className="resource-gauge-copy">
            <p>{resource.label}</p>
            <strong dir="ltr">{resource.reading}</strong>
            <small>{language === 'ar' ? 'احتياطي حالي' : `${Math.round(resource.percentage)}% reserve`}</small>
          </div>
          <div
            className="sr-only"
            role="meter"
            aria-label={`${resource.label} · ${resource.reading}`}
            aria-valuemin={0}
            aria-valuemax={resource.capacity}
            aria-valuenow={Math.round(resource.value)}
          />
        </article>
      ))}
      <article className="resource-gauge-card is-co2" aria-label={language === 'ar' ? 'تقدير إنتاج ثاني أكسيد الكربون اليومي' : 'Estimated daily carbon dioxide generation'}>
        <div className="resource-gauge-visual" aria-hidden="true">
          <svg viewBox="0 0 72 72">
            <circle className="resource-gauge-track" cx="36" cy="36" r="30" />
            <circle className="resource-gauge-value" cx="36" cy="36" r="30" strokeDasharray={GAUGE_CIRCUMFERENCE} strokeDashoffset="0" />
          </svg>
          <span className="resource-gauge-co2">CO₂</span>
        </div>
        <div className="resource-gauge-copy">
          <p>{language === 'ar' ? 'إنتاج CO₂ / يوم' : 'CO₂ generation / day'}</p>
          <strong dir="ltr">{co2Reading} kg</strong>
          <small>{language === 'ar' ? 'تقدير نموذجي · ليس قياسًا للجو' : 'Model estimate · not an atmosphere sensor'}</small>
        </div>
      </article>
    </section>
  )
})
