import type { Destination, GameState } from './model'
import { getCrewRoster, type CrewAssignment } from './crewRosters'

export type OperationId = 'science-expedition' | 'maintenance' | 'construction' | 'rescue'

export interface MissionOperationDefinition {
  id: OperationId
  title: { en: string; ar: string }
  crew: { en: string; ar: string }
  crewMinimum: number
  requiredCrewSpecialties: readonly (readonly CrewAssignment['specialty'][])[]
  destinations: readonly Destination[]
  requiredBuildings: readonly string[]
  steps: readonly { en: string; ar: string }[]
  failure: { en: string; ar: string }
}

export const MISSION_OPERATIONS: readonly MissionOperationDefinition[] = [
  {
    id: 'science-expedition',
    title: { en: 'Scientific Research & Exploration', ar: 'البحث العلمي والاستكشاف' },
    crew: { en: '3: Geologist, Biologist, Driver', ar: '٣: جيولوجي، عالم أحياء، سائق' },
    crewMinimum: 3,
    requiredCrewSpecialties: [
      ['science', 'engineering', 'agriculture'],
      ['medical', 'agriculture'],
      ['pilot', 'command', 'robotics'],
    ],
    destinations: ['moon', 'mars'],
    requiredBuildings: ['pressurized-rover', 'drilling-tools', 'mass-spectrometer'],
    steps: [
      { en: 'Prepare suits', ar: 'تجهيز البدلات' },
      { en: 'Navigate to the site', ar: 'التنقل إلى الموقع' },
      { en: 'Collect samples & radiation telemetry', ar: 'جمع العينات وقياس الإشعاع' },
      { en: 'Analyze samples in the lab', ar: 'تحليل العينات في المختبر' },
      { en: 'Submit the science report', ar: 'تقديم التقرير العلمي' },
    ],
    failure: { en: 'Suit oxygen depletion or an active environmental storm aborts the expedition.', ar: 'يؤدي نفاد أكسجين البدلة أو عاصفة بيئية نشطة إلى إلغاء الرحلة.' },
  },
  {
    id: 'maintenance',
    title: { en: 'Maintenance & Operations', ar: 'الصيانة والتشغيل' },
    crew: { en: 'Maintenance Engineer', ar: 'مهندس صيانة' },
    crewMinimum: 1,
    requiredCrewSpecialties: [['engineering', 'power', 'robotics', 'resources']],
    destinations: ['moon', 'mars'],
    requiredBuildings: ['workshop'],
    steps: [
      { en: 'Detect and acknowledge the alert', ar: 'اكتشاف التنبيه والإقرار به' },
      { en: 'Navigate with spare parts', ar: 'الانتقال مع قطع الغيار' },
      { en: 'Isolate the damaged sector', ar: 'عزل القطاع المتضرر' },
      { en: 'Repair the system', ar: 'إصلاح النظام' },
      { en: 'Verify telemetry', ar: 'التحقق من القياسات' },
    ],
    failure: { en: 'The three-cycle repair timer can overflow, causing partial base damage.', ar: 'قد تنتهي مهلة الإصلاح البالغة ثلاث دورات، مما يسبب ضرراً جزئياً للقاعدة.' },
  },
  {
    id: 'construction',
    title: { en: 'Expansion & Construction', ar: 'التوسعة والإنشاء' },
    crew: { en: 'Project Commander & Robotics Operator', ar: 'قائد المشروع ومشغل الروبوتات' },
    crewMinimum: 2,
    requiredCrewSpecialties: [['command'], ['robotics']],
    destinations: ['moon', 'mars'],
    requiredBuildings: ['workshop', 'robotics-unit', 'isru', 'habitat', 'landing-pad'],
    steps: [
      { en: 'Select a site (at least 100 units from the habitat)', ar: 'اختيار موقع يبعد ١٠٠ وحدة على الأقل عن الموئل' },
      { en: 'Prepare regolith concrete', ar: 'تحضير خرسانة الثرى' },
      { en: 'Complete the construction timer', ar: 'إكمال مؤقت الإنشاء' },
      { en: 'Connect life support and power', ar: 'توصيل دعم الحياة والطاقة' },
    ],
    failure: { en: 'The selected site must be at least 100 distance units from every habitat.', ar: 'يجب أن يبعد الموقع ١٠٠ وحدة مسافة على الأقل عن كل موئل.' },
  },
  {
    id: 'rescue',
    title: { en: 'Rescue & Emergency', ar: 'الإنقاذ والطوارئ' },
    crew: { en: 'Space Commander, Maintenance Engineer, Medic', ar: 'قائد فضاء، مهندس صيانة، ومسعف' },
    crewMinimum: 3,
    requiredCrewSpecialties: [['command'], ['engineering', 'power', 'robotics', 'resources'], ['medical']],
    destinations: ['moon', 'mars'],
    requiredBuildings: ['storm-shelter', 'airlock', 'workshop', 'medical-bay'],
    steps: [
      { en: 'Trigger and assess the disaster', ar: 'تفعيل الكارثة وتقييمها' },
      { en: 'Evacuate uninjured crew to shelter', ar: 'إجلاء غير المصابين إلى الملجأ' },
      { en: 'Isolate the damaged sector', ar: 'عزل القطاع المتضرر' },
      { en: 'Rescue trapped crew', ar: 'إنقاذ الطاقم المحاصر' },
      { en: 'Seal the hull breach', ar: 'إغلاق خرق الهيكل' },
      { en: 'Treat injured crew at the clinic', ar: 'علاج المصابين في العيادة' },
    ],
    failure: { en: 'The rescue cannot launch unless all response facilities are operational.', ar: 'لا يمكن بدء الإنقاذ ما لم تكن جميع مرافق الاستجابة جاهزة.' },
  },
]

export interface ActiveOperation {
  id: OperationId
  step: number
  status: 'active' | 'complete' | 'failed'
  cyclesRemaining: number
  partialDamage: boolean
  suitOxygenPercent: number
  siteDistanceUnits: number
}

export function getOperationDefinition(id: OperationId): MissionOperationDefinition {
  const definition = MISSION_OPERATIONS.find((operation) => operation.id === id)
  if (!definition) throw new Error(`Unknown mission operation: ${id}`)
  return definition
}

export function canStartOperation(state: GameState, id: OperationId): boolean {
  const operation = getOperationDefinition(id)
  const roster = getCrewRoster(state.destination, state.maxDays, state.crewSize)
  const availableSpecialties = roster?.assignments.flatMap((assignment) =>
    Array.from({ length: assignment.count }, () => assignment.specialty),
  ) || []
  const roleMatches = operation.requiredCrewSpecialties.every((alternatives) => {
    const assignedIndex = availableSpecialties.findIndex((specialty) => alternatives.includes(specialty))
    if (assignedIndex < 0) return false
    availableSpecialties.splice(assignedIndex, 1)
    return true
  })
  return (!state.activeOperation || state.activeOperation.status !== 'active') &&
    !state.isGameOver &&
    state.missionPhase === 'surface' &&
    operation.destinations.includes(state.destination) &&
    state.crewSize >= operation.crewMinimum &&
    roleMatches &&
    operation.requiredBuildings.every((building) =>
      state.buildings.includes(building) && !(state.offlineBuildings || []).includes(building),
    ) &&
    (id !== 'construction' || (
      state.buildings.includes('life-support') &&
      !(state.offlineBuildings || []).includes('life-support') &&
      state.buildings.includes('solar-panels') &&
      !(state.offlineBuildings || []).includes('solar-panels')
    )) &&
    (id !== 'maintenance' || state.resources.cargo >= 5) &&
    (id !== 'rescue' || state.buildings.includes('storm-shelter'))
}

export function startOperation(state: GameState, id: OperationId): GameState {
  if (!canStartOperation(state, id)) {
    return { ...state, lastMessage: 'Operation prerequisites are not met; check crew, destination, and required active facilities.' }
  }
  const activeOperation: ActiveOperation = {
    id,
    step: 0,
    status: 'active',
    cyclesRemaining: id === 'maintenance' ? 3 : 0,
    partialDamage: false,
    suitOxygenPercent: 100,
    siteDistanceUnits: 0,
  }
  return {
    ...state,
    activeOperation,
    resources: id === 'maintenance'
      ? { ...state.resources, cargo: state.resources.cargo - 5 }
      : state.resources,
    lastMessage: `${getOperationDefinition(id).title.en} operation started.`,
  }
}

export function setOperationSiteDistance(state: GameState, distance: number): GameState {
  const operation = state.activeOperation
  if (!operation || operation.id !== 'construction' || operation.step !== 0 || !Number.isFinite(distance) || distance < 0) {
    return state
  }
  return {
    ...state,
    activeOperation: { ...operation, siteDistanceUnits: distance },
    lastMessage: distance >= 100
      ? 'Expansion site meets the 100-unit habitat setback.'
      : 'Site rejected: landing pads must be at least 100 units from habitats.',
  }
}

export function advanceOperation(state: GameState): GameState {
  const active = state.activeOperation
  if (!active || active.status !== 'active') return state
  const definition = getOperationDefinition(active.id)
  if (active.id === 'science-expedition') {
    if (state.destination === 'mars' && state.dustStormDaysRemaining > 0) {
      return { ...state, activeOperation: { ...active, status: 'failed' }, lastMessage: 'Expedition aborted by the active Mars dust storm.' }
    }
    if (state.emergencyLevel === 1 || state.resources.oxygen <= 0) {
      return { ...state, activeOperation: { ...active, status: 'failed' }, lastMessage: 'Expedition aborted: storm conditions or suit oxygen depletion.' }
    }
  }
  if (active.id === 'construction' && active.step === 0 && active.siteDistanceUnits < 100) {
    return { ...state, lastMessage: 'Select a construction site at least 100 distance units from the habitat.' }
  }
  if (active.id === 'construction' && active.step === 2 && active.cyclesRemaining > 0) {
    return { ...state, lastMessage: `Construction timer has ${active.cyclesRemaining} mission cycle(s) remaining.` }
  }
  const nextStep = active.step + 1
  const completed = nextStep >= definition.steps.length
  const completedState: ActiveOperation = {
    ...active,
    step: completed ? active.step : nextStep,
    status: completed ? 'complete' : 'active',
    cyclesRemaining: active.id === 'construction' && nextStep === 2 ? 2 : active.cyclesRemaining,
    suitOxygenPercent: active.id === 'science-expedition'
      ? Math.max(0, active.suitOxygenPercent - 10)
      : active.suitOxygenPercent,
  }
  if (active.id === 'science-expedition' && completedState.suitOxygenPercent <= 0 && !completed) {
    completedState.status = 'failed'
  }
  const next: GameState = {
    ...state,
    activeOperation: completedState,
    science: state.science + (active.id === 'science-expedition' && completed ? 10 : 0),
    totalRescues: state.totalRescues + (active.id === 'rescue' && completed ? 1 : 0),
    resources: {
      ...state.resources,
      health: active.id === 'rescue' && completed ? Math.min(100, state.resources.health + 10) : state.resources.health,
    },
    lastMessage: completed
      ? `${definition.title.en} operation complete.`
      : `${definition.steps[nextStep].en} — ${nextStep + 1}/${definition.steps.length}`,
    log: [...state.log, `Day ${state.day}: ${definition.id} step ${completed ? definition.steps.length : nextStep + 1}`],
  }
  if (completed && active.id === 'construction' && !next.buildings.includes('expansion')) {
    next.buildings = [...next.buildings, 'expansion']
  }
  if (completed && active.id === 'maintenance') next.ongoingLeak = false
  if (completed && active.id === 'rescue') next.ongoingLeak = false
  if (completedState.status === 'failed') next.lastMessage = 'Expedition failed: suit oxygen depleted.'
  return next
}

export function advanceOperationCycle(state: GameState): GameState {
  const operation = state.activeOperation
  if (!operation || operation.status !== 'active') return state
  if (operation.id === 'science-expedition') {
    const suitOxygenPercent = Math.max(0, operation.suitOxygenPercent - 30)
    const failed = suitOxygenPercent <= 0
    return {
      ...state,
      activeOperation: { ...operation, suitOxygenPercent, status: failed ? 'failed' : 'active' },
      lastMessage: failed ? 'Expedition failed: suit oxygen depleted before the crew returned.' : state.lastMessage,
    }
  }
  if (operation.id === 'construction' && operation.step === 2 && operation.cyclesRemaining > 0) {
    const cyclesRemaining = operation.cyclesRemaining - 1
    return {
      ...state,
      activeOperation: { ...operation, cyclesRemaining },
      lastMessage: cyclesRemaining === 0 ? 'Expansion construction timer complete; connect life support and power.' : state.lastMessage,
    }
  }
  if (operation.id !== 'maintenance') return state
  const cyclesRemaining = operation.cyclesRemaining - 1
  if (cyclesRemaining > 0) {
    return { ...state, activeOperation: { ...operation, cyclesRemaining } }
  }
  return {
    ...state,
    activeOperation: { ...operation, cyclesRemaining: 0, status: 'failed', partialDamage: true },
    resources: { ...state.resources, health: Math.max(1, state.resources.health - 10) },
    lastMessage: 'Maintenance timer overflow: unrepaired sector has taken partial damage.',
  }
}
