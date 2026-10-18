import { create } from 'zustand'
import { TUTORIAL_STEPS, type GameState } from '../game/model'
import { SCENARIOS } from '../game/scenarios'

export type AchievementId =
  | 'first-shifts'
  | 'steady-habitat'
  | 'long-haul'
  | 'mission-complete'
  | 'field-scout'
  | 'research-pioneer'
  | 'trailblazer'
  | 'habitat-architect'
  | 'storm-ready'
  | 'scenario-specialist'
  | 'flight-school'

export interface AchievementDefinition {
  id: AchievementId
  icon: string
  name: { ar: string; en: string }
  description: { ar: string; en: string }
}

export const ACHIEVEMENTS: AchievementDefinition[] = [
  { id: 'first-shifts', icon: '◷', name: { ar: 'بداية موفقة', en: 'First Shifts' }, description: { ar: 'أكمل خمس دورات تشغيلية.', en: 'Complete five operating cycles.' } },
  { id: 'steady-habitat', icon: '⌂', name: { ar: 'قاعدة متوازنة', en: 'Steady Habitat' }, description: { ar: 'أبقِ مؤن القاعدة فوق 80 لثلاث دورات.', en: 'Keep all core supplies above 80 for three cycles.' } },
  { id: 'long-haul', icon: '↗', name: { ar: 'نَفَس طويل', en: 'Long Haul' }, description: { ar: 'اعبر 15 دورة تشغيلية.', en: 'Survive 15 operating cycles.' } },
  { id: 'mission-complete', icon: '✦', name: { ar: 'عودة آمنة', en: 'Safe Return' }, description: { ar: 'أكمل هدف المهمة المحدد.', en: 'Complete your selected mission objective.' } },
  { id: 'field-scout', icon: '⌖', name: { ar: 'كشّاف ميداني', en: 'Field Scout' }, description: { ar: 'أكمل رحلة استكشاف ناجحة.', en: 'Complete a successful expedition.' } },
  { id: 'research-pioneer', icon: '⊹', name: { ar: 'رائد البحث', en: 'Research Pioneer' }, description: { ar: 'اجمع 100 نقطة علمية.', en: 'Earn 100 science points.' } },
  { id: 'trailblazer', icon: '➶', name: { ar: 'رائد دروب', en: 'Trailblazer' }, description: { ar: 'أكمل ثلاث رحلات استكشاف ناجحة.', en: 'Complete three successful expeditions.' } },
  { id: 'habitat-architect', icon: '▦', name: { ar: 'مهندس الموطن', en: 'Habitat Architect' }, description: { ar: 'ابنِ دفيئة ومعيد تدوير المياه.', en: 'Build a greenhouse and a water recycler.' } },
  { id: 'storm-ready', icon: '⛨', name: { ar: 'استعداد للعواصف', en: 'Storm Ready' }, description: { ar: 'جهّز ملجأ العواصف والبطارية.', en: 'Build a storm shelter and a battery.' } },
  { id: 'scenario-specialist', icon: '◎', name: { ar: 'خبير السيناريوهات', en: 'Scenario Specialist' }, description: { ar: 'أكمل سيناريو تحدٍ غير افتراضي.', en: 'Complete a non-standard mission scenario.' } },
  { id: 'flight-school', icon: '⌑', name: { ar: 'خريج الأكاديمية التعليمية', en: 'Learning Academy Graduate' }, description: { ar: 'أكمل خطوات التدريب الخمس.', en: 'Complete all five guided tutorial steps.' } },
]

const STORAGE_KEY = 'little-orbit-achievements-v1'
type UnlockedAchievements = Partial<Record<AchievementId, string>>

interface AchievementState {
  unlocked: UnlockedAchievements
  newUnlocks: AchievementId[]
  checkAchievements: (mission: GameState) => void
  clearNewUnlocks: () => void
}

function readUnlocked(): UnlockedAchievements {
  if (typeof localStorage === 'undefined') return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const data: unknown = JSON.parse(raw)
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid achievement save')
    const validIds = new Set(ACHIEVEMENTS.map((achievement) => achievement.id))
    return Object.fromEntries(
      Object.entries(data).filter(([id, unlockedAt]) =>
        validIds.has(id as AchievementId) && typeof unlockedAt === 'string',
      ),
    )
  } catch (error) {
    console.error('Could not load Astra One achievements.', error)
    return {}
  }
}

function meetsCriteria(mission: GameState): AchievementId[] {
  const ids: AchievementId[] = []
  if (mission.daysSurvived >= 5) ids.push('first-shifts')
  if (mission.resourceStreak >= 3 && !mission.activeEvent) ids.push('steady-habitat')
  if (mission.daysSurvived >= 15) ids.push('long-haul')
  const completedSelectedGoal = mission.missionResult === 'success' &&
    (mission.objective !== 'tutorial' || TUTORIAL_STEPS.every((step) => mission.tutorialSteps.includes(step)))
  if (completedSelectedGoal) ids.push('mission-complete')
  if (mission.successfulExpeditions >= 1) ids.push('field-scout')
  if (mission.science >= 100) ids.push('research-pioneer')
  if (mission.successfulExpeditions >= 3) ids.push('trailblazer')
  if (mission.buildings.includes('greenhouse') && mission.buildings.includes('water-recycler')) ids.push('habitat-architect')
  if (mission.buildings.includes('storm-shelter') && mission.buildings.includes('battery')) ids.push('storm-ready')
  if (mission.missionResult === 'success' && mission.scenario !== 'baseline' && SCENARIOS[mission.scenario]) ids.push('scenario-specialist')
  if (TUTORIAL_STEPS.every((step) => mission.tutorialSteps.includes(step))) ids.push('flight-school')
  return ids
}

export const useAchievementsStore = create<AchievementState>((set, get) => ({
  unlocked: readUnlocked(),
  newUnlocks: [],
  checkAchievements: (mission) => {
    const unlocked = { ...get().unlocked }
    const newlyUnlocked = meetsCriteria(mission).filter((id) => !unlocked[id])
    if (!newlyUnlocked.length) return

    const unlockedAt = new Date().toISOString()
    for (const id of newlyUnlocked) unlocked[id] = unlockedAt
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(unlocked))
    } catch (error) {
      console.error('Could not save Astra One achievements.', error)
    }
    set({ unlocked, newUnlocks: [...get().newUnlocks, ...newlyUnlocked] })
  },
  clearNewUnlocks: () => set({ newUnlocks: [] }),
}))
