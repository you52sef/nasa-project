import { GREENHOUSE_CYCLE, ISRU_DAILY_OUTPUT, POWER_SYSTEM } from './constants'

const dailyPowerUse = (id: keyof typeof POWER_SYSTEM.operatingLoadsKw) =>
  POWER_SYSTEM.operatingLoadsKw[id] * POWER_SYSTEM.energyBudgetHoursPerCycle

export interface BuildingDefinition {
  id: string
  icon: string
  name: { ar: string; en: string }
  description: { ar: string; en: string }
  phase: 1 | 2 | 3 | 4
  cost: number
  cargo: number
  energyCost: number
  area: number
  production: Partial<Record<'energy' | 'oxygen' | 'water' | 'food' | 'health', number>>
  consumption: Partial<Record<'energy' | 'oxygen' | 'water' | 'food', number>>
  storage?: Partial<Record<'energy' | 'oxygen' | 'water' | 'food', number>>
  destination?: 'moon' | 'mars'
}

const CONSTRUCTION_HOURS: Record<string, { moon: number; mars: number }> = {
  habitat: { moon: 24, mars: 48 },
  'solar-panels': { moon: 3, mars: 3 },
  reactor: { moon: 8, mars: 8 },
  battery: { moon: 4, mars: 4 },
  isru: { moon: 28, mars: 36 },
  greenhouse: { moon: 18, mars: 18 },
}

export const BUILDINGS: Record<string, BuildingDefinition> = {
  'landing-pad': {
    id: 'landing-pad', icon: '🛬', name: { ar: 'منصة هبوط', en: 'Landing pad' },
    description: { ar: 'منطقة هبوط محددة وآمنة للمركبات.', en: 'A designated safe landing zone for arriving vehicles.' },
    phase: 1, cost: 35, cargo: 5, energyCost: 0, area: 2, production: {}, consumption: {},
  },
  'solar-panels': {
    id: 'solar-panels', icon: '☀️', name: { ar: 'ألواح شمسية', en: 'Solar panels' },
    description: { ar: 'قدرة اسمية 15 kW على القمر و7 kW على المريخ؛ تتوقف أثناء الليل القمري الطويل.', en: '15 kW nameplate output on the Moon and 7 kW on Mars; lunar-night generation is zero.' },
    phase: 1, cost: 50, cargo: 10, energyCost: 0, area: 2, production: { energy: 15 }, consumption: {},
  },
  battery: {
    id: 'battery', icon: '🔋', name: { ar: 'بنك بطاريات', en: 'Battery bank' },
    description: { ar: 'سعة تخزين اسمية 200 kWh؛ تكفي نحو 7.4 ساعات عند حمل النجاة 27 kW.', en: 'Nominal 200 kWh storage; about 7.4 hours at the 27 kW survival load.' },
    phase: 1, cost: 40, cargo: 8, energyCost: 0, area: 1, production: {}, consumption: {}, storage: { energy: POWER_SYSTEM.batteryCapacityKwh },
  },
  habitat: {
    id: 'habitat', icon: '🏠', name: { ar: 'وحدة السكن', en: 'Habitat' },
    description: { ar: 'موئل مضغوط لحماية الطاقم؛ حمل التشغيل النموذجي 15 kW.', en: 'Pressurized crew quarters; modeled operating load is 15 kW.' },
    phase: 1, cost: 75, cargo: 14, energyCost: 0, area: 5, production: {}, consumption: {},
  },
  airlock: {
    id: 'airlock', icon: '🚪', name: { ar: 'غرفة معادلة الضغط', en: 'Airlock' },
    description: { ar: 'تدعم الانتقال الآمن بين الموئل والسطح.', en: 'Supports safe transitions between the habitat and the surface.' },
    phase: 1, cost: 45, cargo: 9, energyCost: 0, area: 2, production: {}, consumption: {},
  },
  suitport: {
    id: 'suitport', icon: '🧑‍🚀', name: { ar: 'منفذ البدلة', en: 'Suitport' },
    description: { ar: 'يسمح بتخزين البدلات خارج الموئل للحد من دخول غبار الثرى.', en: 'Stores suits outside the habitat to limit regolith dust transfer indoors.' },
    phase: 1, cost: 55, cargo: 10, energyCost: 0, area: 2, production: {}, consumption: {},
  },
  'electrostatic-dust-shield': {
    id: 'electrostatic-dust-shield', icon: '✨', name: { ar: 'درع غبار كهروستاتيكي', en: 'Electrostatic dust shield (EDS)' },
    description: { ar: 'نظام نشط لإزالة غبار الثرى من البدلات والمعدات؛ يعمل مع منفذ البدلة.', en: 'An active system for removing regolith dust from suits and equipment; used with a suitport.' },
    phase: 3, cost: 75, cargo: 13, energyCost: 3, area: 2, production: {}, consumption: { energy: dailyPowerUse('electrostatic-dust-shield') },
  },
  'command-center': {
    id: 'command-center', icon: '🖥️', name: { ar: 'مركز القيادة', en: 'Command center' },
    description: { ar: 'إدارة عمليات القاعدة ومراقبة الأنظمة.', en: 'Coordinates base operations and monitors systems.' },
    phase: 2, cost: 70, cargo: 12, energyCost: 0, area: 3, production: {}, consumption: {},
  },
  storage: {
    id: 'storage', icon: '📦', name: { ar: 'مخزن محمي', en: 'Protected storage' },
    description: { ar: 'يحمي المؤن والمعدات من البيئة السطحية.', en: 'Protects supplies and equipment from the surface environment.' },
    phase: 2, cost: 45, cargo: 10, energyCost: 0, area: 3, production: {}, consumption: {},
  },
  communications: {
    id: 'communications', icon: '📡', name: { ar: 'اتصالات بعيدة المدى', en: 'Communications' },
    description: { ar: 'وصلة اتصالات؛ تأخير المريخ يتراوح بين 3 و22 دقيقة.', en: 'Long-range link; Mars communications have a 3–22 minute delay.' },
    phase: 2, cost: 65, cargo: 10, energyCost: 0, area: 2, production: {}, consumption: {},
  },
  workshop: {
    id: 'workshop', icon: '🔧', name: { ar: 'ورشة الصيانة', en: 'Workshop' },
    description: { ar: 'تدعم إصلاح المعدات وإنتاج قطع الغيار.', en: 'Supports equipment repairs and spare-part fabrication.' },
    phase: 3, cost: 80, cargo: 15, energyCost: 4, area: 4, production: {}, consumption: { energy: dailyPowerUse('workshop') },
  },
  'pressurized-rover': {
    id: 'pressurized-rover', icon: '🚙', name: { ar: 'عربة جوالة مضغوطة', en: 'Pressurized rover' },
    description: { ar: 'عربة مضغوطة للاستكشاف ونقل الطاقم إلى المواقع البعيدة.', en: 'A pressurized vehicle for exploration and crew transport to remote sites.' },
    phase: 3, cost: 110, cargo: 20, energyCost: 3, area: 4, production: {}, consumption: { energy: dailyPowerUse('pressurized-rover') },
  },
  'drilling-tools': {
    id: 'drilling-tools', icon: '🛠️', name: { ar: 'أدوات الحفر', en: 'Drilling tools' },
    description: { ar: 'أدوات لجمع عينات سطحية وعميقة.', en: 'Tools for collecting surface and subsurface samples.' },
    phase: 3, cost: 45, cargo: 8, energyCost: 0, area: 1, production: {}, consumption: {},
  },
  'mass-spectrometer': {
    id: 'mass-spectrometer', icon: '⚗️', name: { ar: 'مطياف الكتلة', en: 'Mass spectrometer' },
    description: { ar: 'محلل عينات لتحديد تركيبها الكيميائي.', en: 'A sample analyzer for identifying chemical composition.' },
    phase: 3, cost: 75, cargo: 12, energyCost: 2, area: 2, production: {}, consumption: { energy: dailyPowerUse('mass-spectrometer') },
  },
  'robotics-unit': {
    id: 'robotics-unit', icon: '🤖', name: { ar: 'وحدة الروبوتات', en: 'Robotics unit' },
    description: { ar: 'روبوتات لدعم الإنشاءات الميدانية والتشغيل عن بعد.', en: 'Robotics support for field construction and remote operations.' },
    phase: 3, cost: 85, cargo: 15, energyCost: 3, area: 3, production: {}, consumption: { energy: dailyPowerUse('robotics-unit') },
  },
  'research-lab': {
    id: 'research-lab', icon: '🔬', name: { ar: 'مختبر الأبحاث', en: 'Research lab' },
    description: { ar: 'مساحة مخصصة للتجارب العلمية.', en: 'A dedicated facility for scientific investigations.' },
    phase: 3, cost: 85, cargo: 16, energyCost: 4, area: 4, production: {}, consumption: { energy: dailyPowerUse('research-lab') },
  },
  'medical-bay': {
    id: 'medical-bay', icon: '🩺', name: { ar: 'العيادة', en: 'Medical clinic' },
    description: { ar: 'تتيح تقييم الحالات الطبية والاستجابة لها.', en: 'Enables crew medical assessment and treatment.' },
    phase: 3, cost: 90, cargo: 16, energyCost: 3, area: 3, production: {}, consumption: { energy: dailyPowerUse('medical-bay') },
  },
  isru: {
    id: 'isru', icon: '🪨', name: { ar: 'استخدام الموارد المحلية', en: 'ISRU plant' },
    description: { ar: `وحدة معالجة بقدرة 35 kW؛ تنتج ${ISRU_DAILY_OUTPUT.waterLiters} لتر ماء و${ISRU_DAILY_OUTPUT.oxygenKg} كغ أكسجين يوميًا في النموذج.`, en: `A 35 kW local-resource processor producing ${ISRU_DAILY_OUTPUT.waterLiters} L water and ${ISRU_DAILY_OUTPUT.oxygenKg} kg oxygen per modeled day.` },
    phase: 3, cost: 100, cargo: 18, energyCost: 5, area: 4, production: { water: ISRU_DAILY_OUTPUT.waterLiters, oxygen: ISRU_DAILY_OUTPUT.oxygenKg }, consumption: { energy: dailyPowerUse('isru') },
  },
  'life-support': {
    id: 'life-support', icon: '🫁', name: { ar: 'دعم الحياة', en: 'Life support' },
    description: { ar: 'ينتج نحو 1.8 kg أكسجين يوميًا بالتحليل الكهربائي ويعالج ثاني أكسيد الكربون بتفاعل ساباتيه.', en: 'Produces about 1.8 kg of oxygen daily by electrolysis and processes carbon dioxide through the Sabatier reaction.' },
    phase: 1, cost: 75, cargo: 14, energyCost: 5, area: 3, production: { oxygen: 1.8 }, consumption: { energy: dailyPowerUse('life-support') },
  },
  greenhouse: {
    id: 'greenhouse', icon: '🌱', name: { ar: 'دفيئة زراعية', en: 'Greenhouse' },
    description: { ar: `حملها 20 kW؛ تنتج ${GREENHOUSE_CYCLE.foodKg} كغ غذاء و${GREENHOUSE_CYCLE.oxygenKg} كغ أكسجين خلال ${GREENHOUSE_CYCLE.growthDays} أيام تشغيل.`, en: `20 kW operating load; produces ${GREENHOUSE_CYCLE.foodKg} kg food and ${GREENHOUSE_CYCLE.oxygenKg} kg oxygen over ${GREENHOUSE_CYCLE.growthDays} powered days.` },
    phase: 4, cost: 90, cargo: 18, energyCost: 7, area: 4, production: {}, consumption: { energy: dailyPowerUse('greenhouse'), water: GREENHOUSE_CYCLE.waterLitersPerDay },
  },
  moxie: {
    id: 'moxie', icon: '🧪', name: { ar: 'معمل أكسجين MOXIE', en: 'MOXIE oxygen lab' },
    description: { ar: 'نموذج تجريبي مصغّر يحاكي استخراج نحو 0.24 kg أكسجين يوميًا من جو المريخ.', en: 'A small-scale demonstration model extracting about 0.24 kg of oxygen per day from the Martian atmosphere.' },
    phase: 3, cost: 120, cargo: 20, energyCost: 10, area: 3, production: { oxygen: 0.24 }, consumption: { energy: dailyPowerUse('moxie') }, destination: 'mars',
  },
  reactor: {
    id: 'reactor', icon: '⚛️', name: { ar: 'مفاعل سطحي', en: 'Surface reactor' },
    description: { ar: 'مصدر ثابت بقدرة اسمية 25 kW؛ يعمل على مدار الساعة في النموذج.', en: 'A steady 25 kW nameplate source, available continuously in this model.' },
    phase: 4, cost: 160, cargo: 28, energyCost: 8, area: 4, production: { energy: 25 }, consumption: { energy: dailyPowerUse('reactor') },
  },
  'storm-shelter': {
    id: 'storm-shelter', icon: '🛡️', name: { ar: 'ملجأ عواصف', en: 'Storm shelter' },
    description: { ar: 'يحمي الطاقم من أضرار العواصف الشمسية.', en: 'Shields the crew from solar-storm damage.' },
    phase: 1, cost: 100, cargo: 20, energyCost: 4, area: 4, production: {}, consumption: { energy: dailyPowerUse('storm-shelter') },
  },
  'water-recycler': {
    id: 'water-recycler', icon: '💧', name: { ar: 'معمل تدوير الماء', en: 'Water recycler' },
    description: { ar: 'يعيد تدوير المياه بنسبة تعتمد على مستوى الصعوبة: 98% أو 94% أو 90%.', en: 'Recycles water at a difficulty-based rate: 98%, 94%, or 90%.' },
    phase: 3, cost: 85, cargo: 16, energyCost: 6, area: 3, production: {}, consumption: { energy: dailyPowerUse('water-recycler') },
  },
  expansion: {
    id: 'expansion', icon: '🧱', name: { ar: 'توسعة القاعدة', en: 'Base expansion' },
    description: { ar: 'تضيف مساحة للبنية التحتية المستقبلية.', en: 'Adds space for future base infrastructure.' },
    phase: 4, cost: 120, cargo: 24, energyCost: 4, area: 6, production: {}, consumption: { energy: dailyPowerUse('expansion') },
  },
}

export function getConstructionDurationHours(buildingId: string, destination: 'moon' | 'mars'): number {
  const building = BUILDINGS[buildingId]
  if (!building) throw new RangeError(`Unknown building: ${buildingId}`)
  return CONSTRUCTION_HOURS[buildingId]?.[destination] ?? Math.max(4, building.area * 6)
}

export const BUILDING_PHASES = [
  { phase: 1, buildings: ['landing-pad', 'solar-panels', 'battery', 'habitat', 'airlock', 'storm-shelter'] },
  { phase: 2, buildings: ['command-center', 'storage', 'communications'] },
  { phase: 3, buildings: ['workshop', 'research-lab', 'medical-bay', 'isru'] },
  { phase: 4, buildings: ['reactor', 'greenhouse', 'expansion'] },
] as const
