export interface BuildingDefinition {
  id: string
  icon: string
  name: { ar: string; en: string }
  description: { ar: string; en: string }
  cost: number
  cargo: number
  energyCost: number
  area: number
  production: Partial<Record<'energy' | 'oxygen' | 'water' | 'food' | 'health', number>>
  consumption: Partial<Record<'energy' | 'oxygen' | 'water' | 'food', number>>
  storage?: Partial<Record<'energy' | 'oxygen' | 'water' | 'food', number>>
  destination?: 'moon' | 'mars'
}

export const BUILDINGS: Record<string, BuildingDefinition> = {
  'solar-panels': {
    id: 'solar-panels', icon: '☀️', name: { ar: 'ألواح شمسية', en: 'Solar panels' },
    description: { ar: 'تولّد 18 وحدة طاقة يوميًا من ضوء الشمس.', en: 'Generates 18 units of solar power each day.' },
    cost: 50, cargo: 10, energyCost: 0, area: 2, production: { energy: 18 }, consumption: {},
  },
  battery: {
    id: 'battery', icon: '🔋', name: { ar: 'بنك بطاريات', en: 'Battery bank' },
    description: { ar: 'يوسّع سعة تخزين الطاقة إلى 150 وحدة.', en: 'Raises the energy storage capacity to 150 units.' },
    cost: 40, cargo: 8, energyCost: 0, area: 1, production: {}, consumption: {}, storage: { energy: 50 },
  },
  'life-support': {
    id: 'life-support', icon: '🫁', name: { ar: 'دعم الحياة', en: 'Life support' },
    description: { ar: 'ينتج 10 وحدات أكسجين يوميًا.', en: 'Produces 10 units of oxygen per day.' },
    cost: 75, cargo: 14, energyCost: 5, area: 3, production: { oxygen: 10 }, consumption: { energy: 2 },
  },
  greenhouse: {
    id: 'greenhouse', icon: '🌱', name: { ar: 'دفيئة زراعية', en: 'Greenhouse' },
    description: { ar: 'تنتج 9 وحدات غذاء يوميًا.', en: 'Produces 9 units of food per day.' },
    cost: 90, cargo: 18, energyCost: 7, area: 4, production: { food: 9 }, consumption: { energy: 4, water: 2 },
  },
  moxie: {
    id: 'moxie', icon: '🧪', name: { ar: 'معمل أكسجين MOXIE', en: 'MOXIE oxygen lab' },
    description: { ar: 'يستخرج الأكسجين من غلاف المريخ الغني بثاني أكسيد الكربون.', en: 'Extracts oxygen from the carbon-dioxide-rich Martian atmosphere.' },
    cost: 120, cargo: 20, energyCost: 10, area: 3, production: { oxygen: 16 }, consumption: { energy: 6 }, destination: 'mars',
  },
  reactor: {
    id: 'reactor', icon: '⚛️', name: { ar: 'مفاعل سطحي', en: 'Surface reactor' },
    description: { ar: 'مصدر ثابت ينتج 25 وحدة طاقة يوميًا.', en: 'A steady source of 25 units of power per day.' },
    cost: 160, cargo: 28, energyCost: 8, area: 4, production: { energy: 25 }, consumption: {},
  },
  'storm-shelter': {
    id: 'storm-shelter', icon: '🛡️', name: { ar: 'ملجأ عواصف', en: 'Storm shelter' },
    description: { ar: 'يحمي الطاقم من أضرار العواصف الشمسية.', en: 'Shields the crew from solar-storm damage.' },
    cost: 100, cargo: 20, energyCost: 4, area: 4, production: { health: 2 }, consumption: { energy: 1 },
  },
  'water-recycler': {
    id: 'water-recycler', icon: '💧', name: { ar: 'معمل تدوير الماء', en: 'Water recycler' },
    description: { ar: 'يعيد تدوير الماء وينتج 9 وحدات يوميًا.', en: 'Recycles water and returns 9 units each day.' },
    cost: 85, cargo: 16, energyCost: 6, area: 3, production: { water: 9 }, consumption: { energy: 2 },
  },
}
