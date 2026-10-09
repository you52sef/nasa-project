import type { Action, GameState, ResourceName, Resources } from './model'
import { forecastResources } from './model'

export const RESOURCE_META: Record<ResourceName, { icon: string; label: { ar: string; en: string } }> = {
  energy: { icon: '⚡', label: { ar: 'طاقة', en: 'Energy' } },
  oxygen: { icon: '💨', label: { ar: 'أكسجين', en: 'Oxygen' } },
  water: { icon: '💧', label: { ar: 'ماء', en: 'Water' } },
  food: { icon: '🌱', label: { ar: 'غذاء', en: 'Food' } },
  health: { icon: '❤️', label: { ar: 'صحة الطاقم', en: 'Crew health' } },
}

export function getForecast(state: GameState, action: Action | null = null): Resources {
  return forecastResources(state, action)
}
