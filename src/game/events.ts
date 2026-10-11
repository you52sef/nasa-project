import { convertLegacyResourceDelta, deterministicRoll, DIFFICULTY_MODIFIERS, type GameState } from './model'
import { SCENARIOS, type ScenarioId } from './scenarios'

export interface EventChoice {
  label: { ar: string; en: string }
  effects: Partial<Record<'energy' | 'oxygen' | 'water' | 'food' | 'health' | 'credits', number>>
  ongoingLeak?: boolean
  rescues?: number
  requiresBuilding?: string
}

export interface EventDefinition {
  id: string
  icon: string
  title: { ar: string; en: string }
  description: { ar: string; en: string }
  choices: EventChoice[]
}

function convertLegacyEventEffects(effects: EventChoice['effects']): EventChoice['effects'] {
  const converted: EventChoice['effects'] = {}
  for (const [resource, amount] of Object.entries(effects)) {
    if (amount === undefined) continue
    switch (resource) {
      case 'energy':
      case 'oxygen':
      case 'water':
      case 'food':
      case 'health':
        converted[resource] = convertLegacyResourceDelta(resource, amount)
        break
      case 'credits':
        converted.credits = amount
        break
    }
  }
  return converted
}

export function canChooseEventOption(state: GameState, choice: EventChoice): boolean {
  return !choice.requiresBuilding || (
    state.buildings.includes(choice.requiresBuilding) &&
    !(state.offlineBuildings || []).includes(choice.requiresBuilding)
  )
}

const LEGACY_EVENTS: EventDefinition[] = [
  {
    id: 'water-leak', icon: '💧',
    title: { ar: 'تسرّب ماء', en: 'Water leak' },
    description: { ar: 'تسرّب في أحد الأنابيب يهدد مخزون الماء. قرروا بسرعة قبل أن يتفاقم.', en: 'A pipe leak threatens your water supply. Choose how to respond before it worsens.' },
    choices: [
      { label: { ar: 'إصلاح فوري للتسرّب', en: 'Repair the leak now' }, effects: { energy: -10, water: 10 }, rescues: 1 },
      { label: { ar: 'تأجيل الإصلاح مع استمرار التسرّب', en: 'Delay repairs and leave the leak active' }, effects: {}, ongoingLeak: true },
    ],
  },
  {
    id: 'solar-storm', icon: '☀️',
    title: { ar: 'عاصفة شمسية', en: 'Solar storm' },
    description: { ar: 'نشاط شمسي مرتفع يهدد صحة الطاقم والإلكترونيات. الملجأ يخفف أثر الإشعاع.', en: 'High solar activity threatens crew health and electronics. A shelter reduces radiation exposure.' },
    choices: [
      { label: { ar: 'احتمِ في ملجأ العواصف', en: 'Shelter the crew from the storm' }, effects: { energy: -4, health: 4 }, rescues: 1, requiresBuilding: 'storm-shelter' },
      { label: { ar: 'أوقف الأنظمة الخارجية', en: 'Shut down exterior systems' }, effects: { energy: -12, health: -4 } },
    ],
  },
  {
    id: 'low-light', icon: '🌘',
    title: { ar: 'فترة إضاءة منخفضة', en: 'Low-light period' },
    description: { ar: 'الغبار أو الظل يقلل إنتاج الألواح الشمسية. حافظوا على الطاقة المتاحة.', en: 'Dust or shadow reduces solar output. Conserve the power you have.' },
    choices: [
      { label: { ar: 'رشّد استهلاك الطاقة', en: 'Conserve energy' }, effects: { energy: -4 } },
      { label: { ar: 'استخدم بطاريات الطوارئ', en: 'Use reserve batteries' }, effects: { energy: -8, health: 3 }, rescues: 1 },
    ],
  },
  {
    id: 'crop-failure', icon: '🥀',
    title: { ar: 'مشكلة في المحاصيل', en: 'Crop trouble' },
    description: { ar: 'تأثر جزء من المحاصيل بسبب خلل في الدفيئة. اختاروا طريقة إنقاذ الغذاء.', en: 'A greenhouse fault has damaged some crops. Choose how to protect the food supply.' },
    choices: [
      { label: { ar: 'استخدم الطاقة لإنقاذ المحصول', en: 'Spend power to save the crop' }, effects: { energy: -8, food: 12 }, rescues: 1 },
      { label: { ar: 'استخدم المؤونة الاحتياطية', en: 'Use emergency rations' }, effects: { food: -8 } },
    ],
  },
  {
    id: 'pressure-seal', icon: '🫧',
    title: { ar: 'تسرّب في ختم وحدة السكن', en: 'Habitat seal leak' },
    description: { ar: 'انخفض ضغط إحدى الوصلات في الغلاف المضغوط. يجب عزل الجزء المتضرر أو تنفيذ إصلاح سريع.', en: 'Pressure is dropping at a habitat coupling. Isolate the damaged section or make a rapid repair.' },
    choices: [
      { label: { ar: 'اعزل الوصلة وأصلح الختم', en: 'Isolate the coupling and repair the seal' }, effects: { energy: -14, oxygen: -3 }, rescues: 1 },
      { label: { ar: 'أخلِ الوحدة مؤقتًا', en: 'Evacuate the module temporarily' }, effects: { health: -10 } },
    ],
  },
  {
    id: 'panel-dust', icon: '🌫️',
    title: { ar: 'تراكم غبار على الألواح', en: 'Dust on the solar array' },
    description: { ar: 'طبقة من الغبار خفّضت كفاءة الألواح. أرسلوا فريق تنظيف أو شغّلوا مولد الطوارئ.', en: 'A layer of dust has reduced array output. Send a cleaning crew or lean on reserve power.' },
    choices: [
      { label: { ar: 'نظّف الألواح يدويًا', en: 'Clean the panels by hand' }, effects: { energy: -8, health: 5 }, rescues: 1 },
      { label: { ar: 'شغّل مصدر الطاقة الاحتياطي', en: 'Use reserve power' }, effects: { energy: -18 } },
    ],
  },
  {
    id: 'comms-blackout', icon: '📡',
    title: { ar: 'انقطاع الاتصال', en: 'Communications blackout' },
    description: { ar: 'تعطلت وصلة الاتصال بعيدة المدى. يمكن إعادة تشغيل المرسل أو إرسال حزمة بيانات مضغوطة.', en: 'The long-range communications link is down. Reboot the transmitter or send a compressed data burst.' },
    choices: [
      { label: { ar: 'أعد تشغيل المرسل', en: 'Reboot the transmitter' }, effects: { energy: -12 }, rescues: 1 },
      { label: { ar: 'أرسل حزمة بيانات طارئة', en: 'Send an emergency data burst' }, effects: { credits: -30 } },
    ],
  },
  {
    id: 'medical-alert', icon: '🩺',
    title: { ar: 'إنذار طبي للطاقم', en: 'Crew medical alert' },
    description: { ar: 'أبلغ أحد أفراد الطاقم عن أعراض إجهاد. يحتاج الفريق إلى وقت وموارد لتقييم الحالة.', en: 'A crew member has reported symptoms of overexertion. The team needs time and supplies to assess them.' },
    choices: [
      { label: { ar: 'خصّص مؤنًا للعلاج', en: 'Set aside medical supplies for treatment' }, effects: { health: 14, food: -8 }, rescues: 1 },
      { label: { ar: 'واصل العمليات كالمعتاد', en: 'Continue operations as planned' }, effects: { health: -9 } },
    ],
  },
  {
    id: 'water-contamination', icon: '🧪',
    title: { ar: 'اشتباه بتلوث المياه', en: 'Water quality alert' },
    description: { ar: 'أظهر فحص أولي تغيرًا في جودة خزان الماء. أوقفوا استخدامه مؤقتًا حتى إتمام المعالجة.', en: 'A preliminary test flagged a change in tank water quality. Treat the supply before normal use resumes.' },
    choices: [
      { label: { ar: 'عالج الخزان', en: 'Treat the tank' }, effects: { energy: -14, water: -4 }, rescues: 1 },
      { label: { ar: 'اعزل الخزان واستخدم الاحتياطي', en: 'Quarantine the tank and use reserve water' }, effects: { water: -14 } },
    ],
  },
  {
    id: 'micrometeorite-impact', icon: '☄️',
    title: { ar: 'اصطدام نيزك دقيق', en: 'Micrometeorite impact' },
    description: { ar: 'رصدت الحساسات اصطدامًا صغيرًا قرب المعدات الخارجية. افحصوا الأنظمة أو اعزلوا القطاع المتضرر.', en: 'Sensors detected a small impact near exterior equipment. Inspect the systems or isolate the affected section.' },
    choices: [
      { label: { ar: 'افحص الضرر وأصلحه من الخارج', en: 'Inspect and repair the damage outside' }, effects: { energy: -12, health: -4 }, rescues: 1 },
      { label: { ar: 'اعزل القطاع المتضرر', en: 'Isolate the affected section' }, effects: { energy: -16 } },
    ],
  },
  {
    id: 'greenhouse-nutrient', icon: '🌿',
    title: { ar: 'خلل في مغذيات الدفيئة', en: 'Greenhouse nutrient fault' },
    description: { ar: 'تعطلت دورة المغذيات في الدفيئة وبدأ نمو المحاصيل يتباطأ. أعيدوا ضبط الدورة أو اعتمدوا على المؤونة.', en: 'The greenhouse nutrient cycle is out of balance and crop growth is slowing. Recalibrate it or use stored rations.' },
    choices: [
      { label: { ar: 'أعد ضبط دورة المغذيات', en: 'Recalibrate the nutrient cycle' }, effects: { energy: -10, food: 10 }, rescues: 1 },
      { label: { ar: 'رشّد استهلاك الغذاء', en: 'Ration food' }, effects: { food: -6 } },
    ],
  },
]

export const EVENTS: EventDefinition[] = LEGACY_EVENTS.map((event) => ({
  ...event,
  choices: event.choices.map((choice) => ({
    ...choice,
    effects: convertLegacyEventEffects(choice.effects),
  })),
}))

const scenarioEventPriorities: Partial<Record<ScenarioId, readonly string[]>> = {
  'solar-flare': ['solar-storm', 'low-light', 'panel-dust'],
  'habitat-leak': ['pressure-seal', 'water-leak', 'comms-blackout'],
  'greenhouse-fault': ['crop-failure', 'greenhouse-nutrient', 'water-contamination'],
}

export function chooseEvent(state: GameState): string | null {
  const eventChance = Math.min(
    0.9,
    DIFFICULTY_MODIFIERS[state.difficulty].eventChance *
      SCENARIOS[state.scenario || 'baseline'].eventChanceMultiplier,
  )
  if (deterministicRoll(state.missionSeed, state.day, 2) > eventChance) return null
  const currentMonth = Math.floor((state.day - 1) / 30)
  const eventHistory = state.eventHistory || []
  const available = EVENTS.filter((event) => {
    if (event.id === 'solar-storm' && state.resources.health <= 20) return false
    const pastOccurrences = eventHistory
      .filter((entry) => entry.eventId === event.id)
      .map((entry) => entry.day ?? state.day)
    const repeatedThisMonth = pastOccurrences.some((day) => Math.floor((day - 1) / 30) === currentMonth)
    const repeatedRecently = pastOccurrences.some((day) => state.day - day < 7)
    return !repeatedThisMonth && !repeatedRecently
  })
  if (!available.length) return null
  const priorityIds = scenarioEventPriorities[state.scenario || 'baseline'] || []
  const weightedAvailable = available.flatMap((event) =>
    priorityIds.includes(event.id) ? [event, event] : [event],
  )
  const eventIndex = Math.floor(deterministicRoll(state.missionSeed, state.day, 3) * weightedAvailable.length)
  return weightedAvailable[eventIndex]?.id || null
}
