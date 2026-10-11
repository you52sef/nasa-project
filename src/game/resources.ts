import type { Action, GameState, ResourceName, Resources } from './model'
import { forecastResources } from './model'

export const RESOURCE_META: Record<ResourceName, { icon: string; unit: string; label: { ar: string; en: string } }> = {
  energy: { icon: '⚡', unit: 'kWh', label: { ar: 'طاقة', en: 'Energy' } },
  oxygen: { icon: '💨', unit: 'kg', label: { ar: 'أكسجين', en: 'Oxygen' } },
  water: { icon: '💧', unit: 'L', label: { ar: 'ماء', en: 'Water' } },
  food: { icon: '🌱', unit: 'kg', label: { ar: 'غذاء', en: 'Food' } },
  health: { icon: '❤️', unit: '%', label: { ar: 'صحة الطاقم', en: 'Crew health' } },
}

export function formatResourceValue(resource: ResourceName, value: number, language: 'ar' | 'en'): string {
  const amount = new Intl.NumberFormat(language, { maximumFractionDigits: resource === 'health' ? 0 : 1 }).format(value)
  return resource === 'health' ? `${amount}%` : `${amount} ${RESOURCE_META[resource].unit}`
}

export function getForecast(
  state: GameState,
  action: Action | readonly Action[] | null = null,
): Resources {
  return forecastResources(state, action)
}
