export type ScenarioId = 'baseline' | 'dust-front' | 'water-rationing' | 'oxygen-shortage'

export interface ScenarioDefinition {
  id: ScenarioId
  icon: string
  name: { ar: string; en: string }
  description: { ar: string; en: string }
  startingResources: Partial<Record<'energy' | 'oxygen' | 'water' | 'food' | 'health', number>>
  solarOutput: number
  waterUseMultiplier: number
  eventChanceMultiplier: number
}

export const SCENARIOS: Record<ScenarioId, ScenarioDefinition> = {
  baseline: {
    id: 'baseline',
    icon: '◉',
    name: { ar: 'خط الأساس', en: 'Baseline operations' },
    description: { ar: 'ابدأ بمخزون متوازن وتعلّم إيقاع تشغيل القاعدة.', en: 'Start with balanced stores and learn the rhythm of base operations.' },
    startingResources: {},
    solarOutput: 18,
    waterUseMultiplier: 1,
    eventChanceMultiplier: 1,
  },
  'dust-front': {
    id: 'dust-front',
    icon: '〰',
    name: { ar: 'جبهة غبار', en: 'Dust front' },
    description: { ar: 'طاقة بداية أقل وإنتاج شمسي أضعف مع أحداث أكثر.', en: 'Lower starting power, reduced solar output, and more events.' },
    startingResources: { energy: 62 },
    solarOutput: 12,
    waterUseMultiplier: 1,
    eventChanceMultiplier: 1.2,
  },
  'water-rationing': {
    id: 'water-rationing',
    icon: '◌',
    name: { ar: 'تقنين المياه', en: 'Water rationing' },
    description: { ar: 'مخزون ماء محدود واستهلاك أعلى للمياه.', en: 'Start with less water and face increased water use.' },
    startingResources: { water: 58 },
    solarOutput: 18,
    waterUseMultiplier: 1.35,
    eventChanceMultiplier: 1,
  },
  'oxygen-shortage': {
    id: 'oxygen-shortage',
    icon: '△',
    name: { ar: 'نقص الأكسجين', en: 'Oxygen shortage' },
    description: { ar: 'ابدأ بمخزون أكسجين منخفض وأحداث تشغيلية أكثر.', en: 'Begin with a low oxygen reserve and more operational events.' },
    startingResources: { oxygen: 58 },
    solarOutput: 18,
    waterUseMultiplier: 1,
    eventChanceMultiplier: 1.1,
  },
}
