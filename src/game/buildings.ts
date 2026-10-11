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
    description: { ar: 'متوسط إنتاج مرجعي 18 kWh يوميًا عند 1 AU؛ يتغير يوميًا مع إضاءة القمر وبُعد المريخ.', en: 'Reference mean output is 18 kWh/day at 1 AU; daily output varies with lunar illumination and Mars distance.' },
    cost: 50, cargo: 10, energyCost: 0, area: 2, production: { energy: 18 }, consumption: {},
  },
  battery: {
    id: 'battery', icon: '🔋', name: { ar: 'بنك بطاريات', en: 'Battery bank' },
    description: { ar: 'يوسّع سعة تخزين الطاقة إلى 150 kWh.', en: 'Raises energy storage capacity by 50 kWh, to 150 kWh.' },
    cost: 40, cargo: 8, energyCost: 0, area: 1, production: {}, consumption: {}, storage: { energy: 50 },
  },
  'life-support': {
    id: 'life-support', icon: '🫁', name: { ar: 'دعم الحياة', en: 'Life support' },
    description: { ar: 'ينتج نحو 1.8 kg أكسجين يوميًا بالتحليل الكهربائي، ويستهلك الماء والطاقة.', en: 'Produces about 1.8 kg of oxygen per day by electrolysis, using water and power.' },
    cost: 75, cargo: 14, energyCost: 5, area: 3, production: { oxygen: 1.8 }, consumption: { energy: 2 },
  },
  greenhouse: {
    id: 'greenhouse', icon: '🌱', name: { ar: 'دفيئة زراعية', en: 'Greenhouse' },
    description: { ar: 'نموذج إنتاج تعليمي: 1 kg غذاء يوميًا مقابل الماء والطاقة.', en: 'Educational production estimate: 1 kg of food per day, using water and power.' },
    cost: 90, cargo: 18, energyCost: 7, area: 4, production: { food: 1 }, consumption: { energy: 4, water: 1.5 },
  },
  moxie: {
    id: 'moxie', icon: '🧪', name: { ar: 'معمل أكسجين MOXIE', en: 'MOXIE oxygen lab' },
    description: { ar: 'نموذج تجريبي مصغّر يحاكي استخراج نحو 0.24 kg أكسجين يوميًا من جو المريخ.', en: 'A small-scale demonstration model extracting about 0.24 kg of oxygen per day from the Martian atmosphere.' },
    cost: 120, cargo: 20, energyCost: 10, area: 3, production: { oxygen: 0.24 }, consumption: { energy: 6 }, destination: 'mars',
  },
  reactor: {
    id: 'reactor', icon: '⚛️', name: { ar: 'مفاعل سطحي', en: 'Surface reactor' },
    description: { ar: 'مصدر ثابت ينتج 25 kWh يوميًا في هذا النموذج التعليمي.', en: 'A steady 25 kWh/day source in this educational model.' },
    cost: 160, cargo: 28, energyCost: 8, area: 4, production: { energy: 25 }, consumption: {},
  },
  'storm-shelter': {
    id: 'storm-shelter', icon: '🛡️', name: { ar: 'ملجأ عواصف', en: 'Storm shelter' },
    description: { ar: 'يحمي الطاقم من أضرار العواصف الشمسية.', en: 'Shields the crew from solar-storm damage.' },
    cost: 100, cargo: 20, energyCost: 4, area: 4, production: {}, consumption: { energy: 1 },
  },
  'water-recycler': {
    id: 'water-recycler', icon: '💧', name: { ar: 'معمل تدوير الماء', en: 'Water recycler' },
    description: { ar: 'يعيد نحو 98% من استهلاك الطاقم اليومي للماء في النموذج.', en: 'Recovers about 98% of the crew’s daily water use in this model.' },
    cost: 85, cargo: 16, energyCost: 6, area: 3, production: {}, consumption: { energy: 2 },
  },
}
