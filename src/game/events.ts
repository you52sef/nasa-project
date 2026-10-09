import { deterministicRoll, DIFFICULTY_MODIFIERS, type GameState } from './model'
import { SCENARIOS } from './scenarios'

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

export function canChooseEventOption(state: GameState, choice: EventChoice): boolean {
  return !choice.requiresBuilding || (
    state.buildings.includes(choice.requiresBuilding) &&
    !(state.offlineBuildings || []).includes(choice.requiresBuilding)
  )
}

export const EVENTS: EventDefinition[] = [
  {
    id: 'water-leak', icon: '💧',
    title: { ar: 'تسرّب ماء', en: 'Water leak' },
    description: { ar: 'تسرّب في أحد الأنابيب يهدد مخزون الماء. قرروا بسرعة قبل أن يتفاقم.', en: 'A pipe leak threatens your water supply. Choose how to respond before it worsens.' },
    choices: [
      { label: { ar: 'إصلاح فوري (-10 طاقة، +10 ماء)', en: 'Repair now (-10 energy, +10 water)' }, effects: { energy: -10, water: 10 }, rescues: 1 },
      { label: { ar: 'تجاهل مؤقتًا (خسارة 5 ماء كل يوم)', en: 'Delay repairs (lose 5 water each day)' }, effects: {}, ongoingLeak: true },
    ],
  },
  {
    id: 'solar-storm', icon: '☀️',
    title: { ar: 'عاصفة شمسية', en: 'Solar storm' },
    description: { ar: 'نشاط شمسي مرتفع يهدد صحة الطاقم والإلكترونيات. الملجأ يخفف أثر الإشعاع.', en: 'High solar activity threatens crew health and electronics. A shelter reduces radiation exposure.' },
    choices: [
      { label: { ar: 'استخدام ملجأ العواصف (-4 طاقة، +4 صحة)', en: 'Use storm shelter (-4 energy, +4 health)' }, effects: { energy: -4, health: 4 }, rescues: 1, requiresBuilding: 'storm-shelter' },
      { label: { ar: 'إيقاف الأنظمة الخارجية (-12 طاقة)', en: 'Shut down exterior systems (-12 energy)' }, effects: { energy: -12, health: -4 } },
    ],
  },
  {
    id: 'low-light', icon: '🌘',
    title: { ar: 'فترة إضاءة منخفضة', en: 'Low-light period' },
    description: { ar: 'الغبار أو الظل يقلل إنتاج الألواح الشمسية. حافظوا على الطاقة المتاحة.', en: 'Dust or shadow reduces solar output. Conserve the power you have.' },
    choices: [
      { label: { ar: 'ترشيد الطاقة (-4 طاقة)', en: 'Conserve energy (-4 energy)' }, effects: { energy: -4 } },
      { label: { ar: 'استخدام بطاريات الطوارئ (-8 طاقة، +3 صحة)', en: 'Use reserve batteries (-8 energy, +3 health)' }, effects: { energy: -8, health: 3 }, rescues: 1 },
    ],
  },
  {
    id: 'crop-failure', icon: '🥀',
    title: { ar: 'مشكلة في المحاصيل', en: 'Crop trouble' },
    description: { ar: 'تأثر جزء من المحاصيل بسبب خلل في الدفيئة. اختاروا طريقة إنقاذ الغذاء.', en: 'A greenhouse fault has damaged some crops. Choose how to protect the food supply.' },
    choices: [
      { label: { ar: 'استهلاك 8 طاقة لإنقاذ المحصول (+12 غذاء)', en: 'Spend 8 energy to save crops (+12 food)' }, effects: { energy: -8, food: 12 }, rescues: 1 },
      { label: { ar: 'استخدام المؤونة (-8 غذاء)', en: 'Use emergency rations (-8 food)' }, effects: { food: -8 } },
    ],
  },
  {
    id: 'pressure-seal', icon: '🫧',
    title: { ar: 'تسرّب في ختم وحدة السكن', en: 'Habitat seal leak' },
    description: { ar: 'انخفض ضغط إحدى الوصلات في الغلاف المضغوط. يجب عزل الجزء المتضرر أو تنفيذ إصلاح سريع.', en: 'Pressure is dropping at a habitat coupling. Isolate the damaged section or make a rapid repair.' },
    choices: [
      { label: { ar: 'عزل الوصلة وإصلاحها (-14 طاقة، -3 أكسجين)', en: 'Isolate and repair the seal (-14 energy, -3 oxygen)' }, effects: { energy: -14, oxygen: -3 }, rescues: 1 },
      { label: { ar: 'إخلاء الوحدة مؤقتًا (-10 صحة)', en: 'Evacuate the module temporarily (-10 health)' }, effects: { health: -10 } },
    ],
  },
  {
    id: 'panel-dust', icon: '🌫️',
    title: { ar: 'تراكم غبار على الألواح', en: 'Dust on the solar array' },
    description: { ar: 'طبقة من الغبار خفّضت كفاءة الألواح. أرسلوا فريق تنظيف أو شغّلوا مولد الطوارئ.', en: 'A layer of dust has reduced array output. Send a cleaning crew or lean on reserve power.' },
    choices: [
      { label: { ar: 'تنظيف الألواح يدويًا (-8 طاقة، +5 صحة)', en: 'Clean the panels by hand (-8 energy, +5 health)' }, effects: { energy: -8, health: 5 }, rescues: 1 },
      { label: { ar: 'تشغيل الطاقة الاحتياطية (-18 طاقة)', en: 'Use reserve power (-18 energy)' }, effects: { energy: -18 } },
    ],
  },
  {
    id: 'comms-blackout', icon: '📡',
    title: { ar: 'انقطاع الاتصال', en: 'Communications blackout' },
    description: { ar: 'تعطلت وصلة الاتصال بعيدة المدى. يمكن إعادة تشغيل المرسل أو إرسال حزمة بيانات مضغوطة.', en: 'The long-range communications link is down. Reboot the transmitter or send a compressed data burst.' },
    choices: [
      { label: { ar: 'إعادة تشغيل المرسل (-12 طاقة)', en: 'Reboot the transmitter (-12 energy)' }, effects: { energy: -12 }, rescues: 1 },
      { label: { ar: 'إرسال حزمة بيانات طارئة (-30 اعتمادًا)', en: 'Send an emergency data burst (-30 credits)' }, effects: { credits: -30 } },
    ],
  },
  {
    id: 'medical-alert', icon: '🩺',
    title: { ar: 'إنذار طبي للطاقم', en: 'Crew medical alert' },
    description: { ar: 'أبلغ أحد أفراد الطاقم عن أعراض إجهاد. يحتاج الفريق إلى وقت وموارد لتقييم الحالة.', en: 'A crew member has reported symptoms of overexertion. The team needs time and supplies to assess them.' },
    choices: [
      { label: { ar: 'تخصيص مؤن للعلاج (+14 صحة، -8 غذاء)', en: 'Set aside medical supplies (+14 health, -8 food)' }, effects: { health: 14, food: -8 }, rescues: 1 },
      { label: { ar: 'استمرار العمليات (-9 صحة)', en: 'Continue operations (-9 health)' }, effects: { health: -9 } },
    ],
  },
  {
    id: 'water-contamination', icon: '🧪',
    title: { ar: 'اشتباه بتلوث المياه', en: 'Water quality alert' },
    description: { ar: 'أظهر فحص أولي تغيرًا في جودة خزان الماء. أوقفوا استخدامه مؤقتًا حتى إتمام المعالجة.', en: 'A preliminary test flagged a change in tank water quality. Treat the supply before normal use resumes.' },
    choices: [
      { label: { ar: 'معالجة الخزان (-14 طاقة، -4 ماء)', en: 'Treat the tank (-14 energy, -4 water)' }, effects: { energy: -14, water: -4 }, rescues: 1 },
      { label: { ar: 'عزل الخزان واستخدام الاحتياطي (-14 ماء)', en: 'Quarantine the tank and use reserves (-14 water)' }, effects: { water: -14 } },
    ],
  },
  {
    id: 'micrometeorite-impact', icon: '☄️',
    title: { ar: 'اصطدام نيزك دقيق', en: 'Micrometeorite impact' },
    description: { ar: 'رصدت الحساسات اصطدامًا صغيرًا قرب المعدات الخارجية. افحصوا الأنظمة أو اعزلوا القطاع المتضرر.', en: 'Sensors detected a small impact near exterior equipment. Inspect the systems or isolate the affected section.' },
    choices: [
      { label: { ar: 'فحص وإصلاح خارجي (-12 طاقة، -4 صحة)', en: 'Inspect and repair outside (-12 energy, -4 health)' }, effects: { energy: -12, health: -4 }, rescues: 1 },
      { label: { ar: 'عزل القطاع المتضرر (-16 طاقة)', en: 'Isolate the affected section (-16 energy)' }, effects: { energy: -16 } },
    ],
  },
  {
    id: 'greenhouse-nutrient', icon: '🌿',
    title: { ar: 'خلل في مغذيات الدفيئة', en: 'Greenhouse nutrient fault' },
    description: { ar: 'تعطلت دورة المغذيات في الدفيئة وبدأ نمو المحاصيل يتباطأ. أعيدوا ضبط الدورة أو اعتمدوا على المؤونة.', en: 'The greenhouse nutrient cycle is out of balance and crop growth is slowing. Recalibrate it or use stored rations.' },
    choices: [
      { label: { ar: 'إعادة ضبط الدورة (-10 طاقة، +10 غذاء)', en: 'Recalibrate the cycle (-10 energy, +10 food)' }, effects: { energy: -10, food: 10 }, rescues: 1 },
      { label: { ar: 'تقنين الغذاء (-6 غذاء)', en: 'Ration food (-6 food)' }, effects: { food: -6 } },
    ],
  },
]

export function chooseEvent(state: GameState): string | null {
  const eventChance = Math.min(
    0.9,
    DIFFICULTY_MODIFIERS[state.difficulty].eventChance *
      SCENARIOS[state.scenario || 'baseline'].eventChanceMultiplier,
  )
  if (deterministicRoll(state.missionSeed, state.day, 2) > eventChance) return null
  const available = EVENTS.filter((event) => event.id !== 'solar-storm' || state.resources.health > 20)
  const eventIndex = Math.floor(deterministicRoll(state.missionSeed, state.day, 3) * available.length)
  return available[eventIndex]?.id || null
}
