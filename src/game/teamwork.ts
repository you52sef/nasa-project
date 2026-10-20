import type { Action, CrewCommunicationReason, CrewCommunicationRecord, CrewRole, Destination, GameState } from './model'
import type { EventDefinition } from './events'
import { EVENTS } from './events'
import { CREW_DUTIES, getCrewAssignmentById, getMissionSpecialization, localizeCrewRole, type CrewAssignment, type CrewSpecialty } from './crewRosters'
import { canPerformActivity, deterministicRoll, getActivityResourceCost, getControlledMissionSpecialization, getCrewCondition, getCrewPersonality, getEnergyCapacity, getExplorationRisk, getMarsCommunicationDelayMinutes, getRoleIneligibleMessage, getSupplyCapacity, isCrewMemberAvailable } from './model'
import { canChooseEventOption } from './events'
import { getCrewRoster } from './crewRosters'

export const CREW_ROLES: readonly {
  id: CrewRole
  title: 'roleCommander' | 'rolePowerEngineer' | 'roleBiologist' | 'roleGeologist'
  focus: 'roleCommanderFocus' | 'rolePowerEngineerFocus' | 'roleBiologistFocus' | 'roleGeologistFocus'
  icon: string
}[] = [
  { id: 'commander', title: 'roleCommander', focus: 'roleCommanderFocus', icon: '🧭' },
  { id: 'power-engineer', title: 'rolePowerEngineer', focus: 'rolePowerEngineerFocus', icon: '⚡' },
  { id: 'biologist', title: 'roleBiologist', focus: 'roleBiologistFocus', icon: '🧬' },
  { id: 'water-officer', title: 'roleGeologist', focus: 'roleGeologistFocus', icon: '🪨' },
]

const ROLE_SPECIALTIES: Record<CrewRole, readonly CrewAssignment['specialty'][]> = {
  commander: ['command', 'pilot'],
  'power-engineer': ['engineering', 'power', 'robotics', 'communications', 'engineering-science'],
  biologist: ['medical', 'agriculture', 'agriculture-resources', 'science-medical'],
  'water-officer': ['science', 'resources', 'geology-agriculture'],
}

const SPECIALTY_CONTROL_ROLE: Record<CrewAssignment['specialty'], CrewRole> = {
  command: 'commander',
  pilot: 'commander',
  science: 'water-officer',
  medical: 'biologist',
  engineering: 'power-engineer',
  communications: 'power-engineer',
  power: 'power-engineer',
  resources: 'water-officer',
  robotics: 'power-engineer',
  agriculture: 'biologist',
  'agriculture-resources': 'biologist',
  'science-medical': 'biologist',
  'engineering-science': 'power-engineer',
  'geology-agriculture': 'water-officer',
}

export function getAvailableCrewRoles(crewSize: number, destination?: Destination, maxDays?: number) {
  if (destination === undefined || maxDays === undefined) {
    return CREW_ROLES.slice(0, Math.max(1, Math.min(CREW_ROLES.length, Math.floor(crewSize))))
  }
  const roster = getCrewRoster(destination, maxDays, crewSize)
  if (!roster) return []
  const specialties = new Set(roster.assignments.map((assignment) => assignment.specialty))
  return CREW_ROLES.filter((role) => ROLE_SPECIALTIES[role.id].some((specialty) => specialties.has(specialty)))
}

export function getCommandRoleForSpecialty(specialty: CrewSpecialty): CrewRole {
  return SPECIALTY_CONTROL_ROLE[specialty]
}

export function getMissionCrewAssignments(
  crewSize: number,
  destination: Destination,
  maxDays: number,
  specialtyOverrides: Readonly<Record<string, CrewSpecialty>> = {},
) {
  const roster = getCrewRoster(destination, maxDays, crewSize)
  if (!roster) return []
  return roster.assignments.flatMap((assignment) => {
    const duties = CREW_DUTIES[assignment.title]
    if (!duties) throw new Error(`Missing mission duty for crew assignment "${assignment.title}".`)
    const slug = assignment.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    return Array.from({ length: assignment.count }, (_, index) => {
      const id = `${slug}-${index + 1}`
      const specialty = specialtyOverrides[id] || assignment.specialty
      return {
        id,
        title: assignment.count > 1 ? `${assignment.title} ${index + 1}` : assignment.title,
        duty: duties[Math.min(index, duties.length - 1)],
        specialty,
        controlRole: SPECIALTY_CONTROL_ROLE[specialty],
      }
    })
  })
}

export type MissionPanelId = 'resources' | 'crew' | 'systems' | 'operations' | 'infrastructure' | 'forecast' | 'communications'

const SPECIALIZATION_PANELS: Record<'command' | 'engineering' | 'biology' | 'geology', readonly MissionPanelId[]> = {
  command: ['resources', 'crew', 'systems', 'forecast', 'communications', 'operations'],
  engineering: ['resources', 'crew', 'systems', 'operations', 'infrastructure'],
  biology: ['resources', 'crew', 'systems', 'operations'],
  geology: ['resources', 'crew', 'operations', 'forecast'],
}

export function getAccessibleMissionPanels(state: GameState): readonly MissionPanelId[] {
  const accessible = getControlledMissionSpecialization(state)
  if (!accessible || !isCrewMemberAvailable(state, state.controlledDutyId)) return ['resources', 'crew']
  return SPECIALIZATION_PANELS[accessible]
}

export function getAllowedSpecialistActions(state: GameState): readonly Action[] {
  return (['research', 'explore', 'maintenance', 'exercise', 'rest'] as const)
    .filter((action) => canPerformActivity(state, action))
}

export type CrewRequestReason = CrewCommunicationReason

const CREW_REQUEST_REPLIES: Record<CrewRequestReason, { en: string; ar: string }> = {
  requestAccepted: { en: 'The request was accepted and completed.', ar: 'قُبل الطلب ونُفّذ.' },
  commandAuthorityRequired: { en: 'Only the Commander or Pilot may dispatch crew directives.', ar: 'يحق للقائد أو الطيار فقط إصدار تكليفات الطاقم.' },
  selfConversation: { en: 'A crewmember cannot send a request to themselves.', ar: 'لا يمكن لفرد الطاقم إرسال طلب إلى نفسه.' },
  specialtyMismatch: { en: 'This request falls outside the crewmember’s assigned specialty.', ar: 'يقع هذا الطلب خارج نطاق تخصص فرد الطاقم.' },
  emergencyPriority: { en: 'An active emergency takes priority over secondary requests.', ar: 'الأولوية للاستجابة للطوارئ النشطة، لا للطلبات الثانوية.' },
  crewFatigue: { en: 'The crewmember is too fatigued for this activity.', ar: 'إرهاق فرد الطاقم مرتفع ولا يسمح بهذا النشاط.' },
  energyInsufficient: { en: 'Available energy is insufficient for this activity.', ar: 'الطاقة المتاحة لا تكفي لتنفيذ هذا النشاط.' },
  oxygenInsufficient: { en: 'Available oxygen is insufficient for this activity.', ar: 'الأكسجين المتاح لا يكفي لتنفيذ هذا النشاط.' },
  crewBusy: { en: 'The crewmember is occupied with an active operation or construction task.', ar: 'فرد الطاقم مشغول بعملية ميدانية أو إنشاء جارٍ.' },
  requestAlreadyHandled: { en: 'This request was already completed by this crewmember today.', ar: 'أنجز فرد الطاقم هذا الطلب مسبقًا اليوم.' },
}

const CREW_ACTION_LABELS: Record<Action, { en: string; ar: string }> = {
  research: { en: 'research', ar: 'البحث العلمي' },
  explore: { en: 'exploration', ar: 'الاستكشاف' },
  maintenance: { en: 'maintenance', ar: 'الصيانة' },
  exercise: { en: 'exercise', ar: 'التمرين' },
  rest: { en: 'rest', ar: 'الراحة' },
}

export function getCrewRequestActions(state: GameState, dutyId: string): readonly Action[] {
  const duty = getMissionCrewAssignments(state.crewSize, state.destination, state.maxDays, state.crewSpecialtyOverrides)
    .find((assignment) => assignment.id === dutyId)
  if (!duty || duty.id === state.controlledDutyId || getControlledMissionSpecialization(state) !== 'command') return []
  const targetState = { ...state, controlledDutyId: duty.id, controlledRole: duty.controlRole }
  return (['research', 'explore', 'maintenance', 'exercise', 'rest'] as const)
    .filter((action) => canPerformActivity(targetState, action))
}

export function evaluateCrewRequest(
  state: GameState,
  dutyId: string,
  action: Action,
): CrewRequestReason {
  const duty = getMissionCrewAssignments(state.crewSize, state.destination, state.maxDays, state.crewSpecialtyOverrides)
    .find((assignment) => assignment.id === dutyId)
  if (!duty) throw new Error(`Crew request target "${dutyId}" is unavailable for this mission.`)
  if (duty.id === state.controlledDutyId) return 'selfConversation'
  if (getControlledMissionSpecialization(state) !== 'command') return 'commandAuthorityRequired'
  const targetState = { ...state, controlledDutyId: duty.id, controlledRole: duty.controlRole }
  const handledToday = state.crewCommunications.some((request) =>
    request.day === state.day && request.dutyId === dutyId && request.action === action && request.decision === 'accepted',
  )
  if (handledToday) return 'requestAlreadyHandled'
  if (getRoleIneligibleMessage(targetState, action)) return 'specialtyMismatch'
  const condition = getCrewCondition(state, dutyId)
  if ((condition.health <= 20 || condition.fatigue >= 90 || condition.stress >= 90) && action !== 'rest') return 'crewFatigue'
  if (!canPerformActivity(targetState, action)) return 'specialtyMismatch'
  if (state.activeEvent) return 'emergencyPriority'
  if (state.ongoingLeak || state.emergencyLevel > 0 || state.oxygenEmergencyHoursRemaining !== null) {
    if (action !== 'maintenance') return 'emergencyPriority'
    const requiredSpecialization = state.emergencyLevel === 4 || (state.emergencyLevel === 0 && state.ongoingLeak)
      ? 'biology'
      : 'engineering'
    if (getMissionSpecialization(duty.specialty) !== requiredSpecialization) return 'emergencyPriority'
  }
  if (state.activeOperation?.status === 'active' || state.constructionProject) return 'crewBusy'
  const cost = getActivityResourceCost(action, state.difficulty)
  if ((cost.energy || 0) > state.resources.energy) return 'energyInsufficient'
  if ((cost.oxygen || 0) > state.resources.oxygen) return 'oxygenInsufficient'
  return 'requestAccepted'
}

export function respondToCrewRequest(state: GameState, dutyId: string, action: Action, language: 'ar' | 'en'): GameState {
  if (!state.started || state.paused || state.isGameOver || state.missionPhase !== 'surface') return state
  const duty = getMissionCrewAssignments(state.crewSize, state.destination, state.maxDays, state.crewSpecialtyOverrides)
    .find((assignment) => assignment.id === dutyId)
  if (!duty) throw new Error(`Crew request target "${dutyId}" is unavailable for this mission.`)
  if (duty.id === state.controlledDutyId) {
    return {
      ...state,
      lastMessage: CREW_REQUEST_REPLIES.selfConversation[language],
    }
  }
  if (getControlledMissionSpecialization(state) !== 'command') {
    return {
      ...state,
      lastMessage: CREW_REQUEST_REPLIES.commandAuthorityRequired[language],
    }
  }
  const decision = evaluateCrewRequest(state, dutyId, action)
  const record: CrewCommunicationRecord = { day: state.day, dutyId, action, decision: decision === 'requestAccepted' ? 'accepted' : 'rejected', reason: decision }
  const records = [...state.crewCommunications, record]
  const localizedName = localizeCrewRole(duty.title, language)
  const actionLabel = CREW_ACTION_LABELS[action][language]
  const response = CREW_REQUEST_REPLIES[decision][language]
  if (decision !== 'requestAccepted') {
    return {
      ...state,
      crewCommunications: records,
      lastMessage: response,
      log: [...state.log, `${language === 'ar' ? `اليوم ${state.day}` : `Day ${state.day}`}: ${localizedName} · ${actionLabel} · ${response}`],
    }
  }

  const resources = { ...state.resources }
  const cost = getActivityResourceCost(action, state.difficulty)
  resources.energy = Math.max(0, resources.energy - (cost.energy || 0))
  resources.oxygen = Math.max(0, resources.oxygen - (cost.oxygen || 0))
  let science = state.science
  let successfulExpeditions = state.successfulExpeditions
  let fatigue = state.fatigue
  let morale = state.morale
  let ongoingLeak = state.ongoingLeak
  let emergencyLevel = state.emergencyLevel
  let oxygenEmergencyHoursRemaining = state.oxygenEmergencyHoursRemaining
  const crewConditions = { ...state.crewConditions }
  const condition = getCrewCondition(state, dutyId)
  const roleStrain: Record<CrewAssignment['specialty'], number> = {
    command: 1,
    pilot: 1.2,
    science: 1,
    medical: .8,
    engineering: 1,
    communications: .8,
    power: .9,
    resources: .9,
    robotics: 1.1,
    agriculture: .8,
    'agriculture-resources': .9,
    'science-medical': .9,
    'engineering-science': 1,
    'geology-agriculture': 1,
  }
  const strain = roleStrain[duty.specialty]
  let lastMessage = `${localizedName} · ${actionLabel}: ${response}`
  switch (action) {
    case 'research':
      science += 8
      fatigue = Math.min(100, fatigue + 3)
      if (duty.specialty === 'agriculture' || duty.specialty === 'agriculture-resources') {
        if (state.buildings.includes('greenhouse') && !state.offlineBuildings.includes('greenhouse')) {
          resources.food = Math.min(getSupplyCapacity('food', state.crewSize), resources.food + 1)
          resources.oxygen = Math.min(getSupplyCapacity('oxygen', state.crewSize), resources.oxygen + 0.25)
        }
      }
      break
    case 'explore': {
      const dutyIndex = getMissionCrewAssignments(state.crewSize, state.destination, state.maxDays, state.crewSpecialtyOverrides)
        .findIndex((assignment) => assignment.id === dutyId)
      const success = deterministicRoll(state.missionSeed, state.day, 300 + dutyIndex) >= getExplorationRisk(state)
      fatigue = Math.min(100, fatigue + 8 * strain)
      if (success) {
        successfulExpeditions += 1
        science += 4
        resources.water = Math.min(100, resources.water + 6)
        resources.credits += 25
        lastMessage = language === 'ar'
          ? `عاد ${localizedName} ببيانات ميدانية وعينة ماء.`
          : `${localizedName} returned with field data and a water sample.`
      } else {
        resources.health = Math.max(0, resources.health - 5)
        lastMessage = language === 'ar'
          ? `عاد ${localizedName} بأمان دون عينة مؤكدة.`
          : `${localizedName} returned safely without a confirmed sample.`
      }
      break
    }
    case 'maintenance':
      resources.energy = Math.min(getEnergyCapacity(state), resources.energy + (duty.specialty === 'engineering' || duty.specialty === 'power' ? 5 : 4))
      fatigue = Math.min(100, fatigue + 2 * strain)
      if (ongoingLeak) ongoingLeak = false
      if (oxygenEmergencyHoursRemaining !== null) {
        resources.oxygen = Math.min(100, resources.oxygen + 4)
        if (resources.oxygen > 0) oxygenEmergencyHoursRemaining = null
      }
      if (emergencyLevel > 0) emergencyLevel = 0
      break
    case 'exercise':
      fatigue = Math.max(0, fatigue - 8)
      morale = Math.min(100, morale + 2)
      break
    case 'rest':
      fatigue = Math.max(0, fatigue - 12)
      morale = Math.min(100, morale + 1)
      resources.health = Math.min(100, resources.health + 3)
      break
  }
  const conditionDelta: Record<Action, { health: number; fatigue: number; stress: number }> = {
    research: { health: 0, fatigue: 5 * strain, stress: 4 * strain },
    explore: { health: 0, fatigue: 12 * strain, stress: 10 * strain },
    maintenance: { health: 0, fatigue: 8 * strain, stress: 6 * strain },
    exercise: { health: 0, fatigue: -8, stress: -6 },
    rest: { health: 3, fatigue: -18, stress: -14 },
  }
  const delta = conditionDelta[action]
  const personality = getCrewPersonality(state, dutyId)
  const moraleDelta: Record<Action, number> = {
    research: 1,
    explore: -4,
    maintenance: 0,
    exercise: 3,
    rest: 5,
  }
  crewConditions[dutyId] = {
    health: Math.max(0, Math.min(100, condition.health + delta.health)),
    fatigue: Math.max(0, Math.min(100, condition.fatigue + delta.fatigue)),
    stress: Math.max(0, Math.min(100, condition.stress + delta.stress / personality.stressTolerance)),
    morale: Math.max(0, Math.min(100, condition.morale + moraleDelta[action] * personality.stressTolerance)),
  }

  return {
    ...state,
    crewConditions,
    resources,
    science,
    successfulExpeditions,
    fatigue,
    morale,
    ongoingLeak,
    emergencyLevel,
    oxygenEmergencyHoursRemaining,
    crewCommunications: records,
    crewSupportActionHistory: [...state.crewSupportActionHistory, action],
    lastMessage,
    log: [...state.log, `${language === 'ar' ? `اليوم ${state.day}` : `Day ${state.day}`}: ${localizedName} · ${actionLabel} · ${lastMessage}`],
  }
}

export interface EveningBriefing {
  crew: Array<{ id: string; name: string; role: string; icon: string; comment: string }>
  resourceDeltas: Array<{ id: 'energy' | 'oxygen' | 'water' | 'food'; delta: number }>
  actionCount: number
  completedWorkShifts: number
  exerciseComplete: boolean
  eventsReviewed: string[]
  communicationNotes: Array<{ role: string; action: Action; decision: 'accepted' | 'rejected'; reason: CrewRequestReason }>
  nextShiftWatch: string
  nextShiftPriority: string
  reportDelayMinutes: number
}

export function getEveningBriefing(state: GameState, language: 'ar' | 'en'): EveningBriefing {
  const arabic = language === 'ar'
  const assignments = getMissionCrewAssignments(state.crewSize, state.destination, state.maxDays, state.crewSpecialtyOverrides)
  const resources = (['energy', 'oxygen', 'water', 'food'] as const).map((id) => ({
    id,
    delta: state.resources[id] - state.dailyResourceStart[id],
  }))
  const mostDepleted = resources.reduce((lowest, resource) =>
    (state.resources[resource.id] / (resource.id === 'energy' ? getEnergyCapacity(state) : 100)) <
      (state.resources[lowest.id] / (lowest.id === 'energy' ? getEnergyCapacity(state) : 100))
      ? resource
      : lowest,
  )
  const resourceLabels = {
    energy: arabic ? 'الطاقة' : 'energy',
    oxygen: arabic ? 'الأكسجين' : 'oxygen',
    water: arabic ? 'المياه' : 'water',
    food: arabic ? 'الغذاء' : 'food',
  }
  const nextShiftPriority = mostDepleted.id === 'energy'
    ? (arabic ? 'راجع أحمال الطاقة وشحن وحدات التخزين.' : 'Review power loads and storage charging.')
    : mostDepleted.id === 'oxygen'
      ? (arabic ? 'تحقق من مخزون الأكسجين وكفاءة دعم الحياة.' : 'Check oxygen reserves and life-support performance.')
      : mostDepleted.id === 'water'
        ? (arabic ? 'راجع استهلاك المياه واستعادة المياه.' : 'Review water use and recovery.')
        : (arabic ? 'تحقق من مخزون الغذاء وإنتاج الدفيئة.' : 'Check food reserves and greenhouse output.')
  const scenarioWatch = state.dustStormDaysRemaining > 0 || state.scenario === 'dust-front'
    ? (arabic ? 'مراقبة الغبار: جبهة الغبار أو العاصفة النشطة قد تحدّ من إنتاج الطاقة الشمسية.' : 'Dust watch: the selected front or active storm may constrain solar generation.')
    : state.scenario === 'solar-flare'
      ? (arabic ? 'مراقبة النشاط الشمسي: تحقّق من تنبيهات الإشعاع وجهوزية الملجأ.' : 'Solar watch: review radiation alerts and shelter readiness.')
      : state.scenario === 'greenhouse-fault'
        ? (arabic ? 'مراقبة الدفيئة: افحص المحاصيل واحتياطي الغذاء والمياه.' : 'Greenhouse watch: inspect crops and food and water reserves.')
        : state.scenario === 'habitat-leak'
          ? (arabic ? 'مراقبة ضغط الموئل: راجع الأكسجين وسجلات التسرب.' : 'Habitat watch: review oxygen reserves and leak telemetry.')
          : (arabic ? 'لا يوجد إنذار بيئي متوقع في ملف السيناريو؛ راقب الموارد المحدودة.' : 'No scenario-specific environmental alert; monitor the lowest resource reserve.')

  const icons: Record<CrewAssignment['specialty'], string> = {
    command: '🧭', pilot: '🚀', science: '🔬', medical: '🩺', engineering: '🛠️',
    communications: '📡', power: '⚡', resources: '💧', robotics: '🤖',
    agriculture: '🌱', 'agriculture-resources': '🌿', 'science-medical': '🧪',
    'engineering-science': '🛰️', 'geology-agriculture': '🪨',
  }
  const crew = assignments.map((assignment, index) => {
    const isPlayer = assignment.id === state.controlledDutyId
    let comment: string
    switch (assignment.specialty) {
      case 'medical':
      case 'science-medical':
        comment = state.fatigue >= 70 || state.resources.health < 60
          ? (arabic ? 'أوصي بمراجعة الإجهاد والمؤشرات الصحية قبل بدء الوردية التالية.' : 'Recommend reviewing fatigue and crew health before the next shift.')
          : (arabic ? 'المؤشرات الصحية مستقرة؛ استمروا في متابعة الإجهاد والتعرض الإشعاعي.' : 'Crew health is stable; continue tracking fatigue and radiation exposure.')
        break
      case 'agriculture':
      case 'agriculture-resources':
      case 'geology-agriculture':
        comment = resources.find((resource) => resource.id === 'food')!.delta < 0
          ? (arabic ? 'انخفض مخزون الغذاء اليوم؛ افحصوا حالة المحاصيل ودورة الدفيئة.' : 'Food reserves fell today; inspect crop condition and the greenhouse cycle.')
          : (arabic ? 'مخزون الغذاء لم ينخفض اليوم؛ واصلوا فحص المحاصيل والدفيئة.' : 'Food reserves did not fall today; continue crop and greenhouse checks.')
        break
      case 'power':
      case 'engineering':
      case 'robotics':
        comment = state.ongoingLeak
          ? (arabic ? 'ما زال تسرب الموئل نشطاً؛ يجب إعطاء العزل والإصلاح أولوية.' : 'The habitat leak remains active; prioritize isolation and repair.')
          : resources.find((resource) => resource.id === 'energy')!.delta < 0
            ? (arabic ? 'انخفضت الطاقة اليوم؛ راجعوا الأحمال ومصادر التوليد.' : 'Energy reserves fell today; review loads and generation sources.')
            : (arabic ? 'أنظمة الطاقة مستقرة اليوم؛ استمروا في فحص القياسات.' : 'Power systems remained stable today; continue telemetry checks.')
        break
      case 'resources':
        comment = resources.find((resource) => resource.id === 'water')!.delta < 0
          ? (arabic ? 'انخفض مخزون المياه؛ تحقّقوا من إعادة التدوير ووحدة استخراج الموارد.' : 'Water reserves fell; inspect recycling and in-situ resource systems.')
          : (arabic ? 'لم ينخفض مخزون المياه اليوم؛ واصلوا مراقبة كفاءة الاستعادة.' : 'Water reserves did not fall today; continue monitoring recovery efficiency.')
        break
      case 'command':
      case 'pilot':
      case 'communications':
        comment = arabic
          ? `سُجّلت ${state.todayActions.length} أنشطة اليوم؛ راجعوا أولويات المهمة قبل الوردية التالية.`
          : `${state.todayActions.length} activities were logged today; review mission priorities before the next shift.`
        break
      case 'science':
      case 'engineering-science':
        comment = state.todayActions.includes('research') || state.todayActions.includes('explore')
          ? (arabic ? 'أُنجز نشاط علمي أو ميداني اليوم؛ وثّقوا النتائج قبل استئناف العمل.' : 'A research or field activity was completed today; document findings before resuming.')
          : (arabic ? 'لم يُسجّل نشاط علمي أو ميداني اليوم؛ أدرجوه ضمن أولويات الغد.' : 'No research or field activity was logged today; consider it for tomorrow’s priorities.')
        break
    }
    return {
      id: assignment.id,
      name: isPlayer && state.astronautName.trim()
        ? state.astronautName.trim()
        : `${arabic ? 'فرد الطاقم' : 'Crew member'} ${String(index + 1).padStart(2, '0')}`,
      role: localizeCrewRole(assignment.title, language),
      icon: icons[assignment.specialty],
      comment,
    }
  })
  const eventsReviewed = state.eventHistory
    .filter((event) => event.day === state.day)
    .map((event) => {
      const definition = EVENTS.find((candidate) => candidate.id === event.eventId)
      const choice = definition?.choices[event.choiceIndex]
      if (!definition || !choice) throw new Error(`Missing event history definition for "${event.eventId}".`)
      return `${definition.title[language]} · ${choice.label[language]}`
    })
  const communicationNotes = state.crewCommunications
    .filter((interaction) => interaction.day === state.day)
    .map((interaction) => {
      const duty = assignments.find((assignment) => assignment.id === interaction.dutyId)
      if (!duty) throw new Error(`Crew communication target "${interaction.dutyId}" is unavailable in the debrief roster.`)
      return {
        role: localizeCrewRole(duty.title, language),
        action: interaction.action,
        decision: interaction.decision,
        reason: interaction.reason,
      }
    })

  return {
    crew,
    resourceDeltas: resources,
    actionCount: state.todayActions.length,
    completedWorkShifts: state.todayActions.filter((action) => ['maintenance', 'research', 'explore'].includes(action)).length,
    exerciseComplete: state.todayActions.includes('exercise'),
    eventsReviewed,
    communicationNotes,
    nextShiftWatch: scenarioWatch,
    nextShiftPriority: `${arabic ? 'الأولوية' : 'Priority'} · ${resourceLabels[mostDepleted.id]}: ${nextShiftPriority}`,
    reportDelayMinutes: state.destination === 'mars'
      ? getMarsCommunicationDelayMinutes(state.missionSeed, state.day, 'research')
      : 2,
  }
}

export function getAstronautDutyProgress(state: GameState, language: 'ar' | 'en', missionWide = false) {
  const duty = getMissionCrewAssignments(state.crewSize, state.destination, state.maxDays, state.crewSpecialtyOverrides)
    .find((assignment) => assignment.id === state.astronautDutyId)
  if (!duty) throw new Error(`Astronaut duty "${state.astronautDutyId}" is unavailable for this mission crew.`)

  const responsibility = getMissionSpecialization(duty.specialty)
  const taskActions: readonly { action: Action; label: { en: string; ar: string } }[] = (() => {
    switch (responsibility) {
      case 'command':
        return [{ action: 'exercise', label: { en: 'Maintain readiness for command duties', ar: 'الحفاظ على الجاهزية لمهام القيادة' } }]
      case 'engineering':
        return [{ action: 'maintenance', label: { en: 'Inspect and maintain base systems', ar: 'فحص أنظمة القاعدة وصيانتها' } }]
      case 'biology':
        return [{ action: 'research', label: { en: 'Conduct life-support and crew-health research', ar: 'إجراء أبحاث دعم الحياة وصحة الطاقم' } }]
      case 'geology':
        return [{ action: 'explore', label: { en: 'Complete a field expedition', ar: 'تنفيذ مهمة استكشاف ميداني' } }]
    }
  })()
  const acceptedRequests = state.crewCommunications
    .filter((request) =>
      (missionWide || request.day === state.day) &&
      request.dutyId === state.astronautDutyId &&
      request.decision === 'accepted',
    )
    .map((request) => request.action)
  const completedActions = missionWide
    ? [...state.actionHistory, ...state.todayActions]
    : state.todayActions
  const tasks = taskActions.map((task) => ({
    ...task,
    complete: completedActions.includes(task.action) || acceptedRequests.includes(task.action),
  }))
  const completedTasks = tasks.filter((task) => task.complete).length
  const complete = completedTasks === tasks.length

  return {
    duty,
    requiredAction: taskActions[0].action,
    complete,
    tasks,
    percent: Math.round(completedTasks / tasks.length * 100),
    description: duty.duty[language],
  }
}

export function recommendDailyAction(state: GameState): Action {
  const priorities: readonly Action[] = state.resources.health <= 45 || state.fatigue >= 70
    ? ['rest', 'exercise', 'maintenance', 'research', 'explore']
    : Math.min(state.resources.energy, state.resources.oxygen, state.resources.water, state.resources.food) <= 25
      ? ['maintenance', 'research', 'explore', 'exercise', 'rest']
      : state.objective === 'science'
        ? ['research', 'maintenance', 'explore', 'exercise', 'rest']
        : state.objective === 'exploration' && getExplorationRisk(state) <= 0.4
          ? ['explore', 'maintenance', 'research', 'exercise', 'rest']
          : ['maintenance', 'research', 'explore', 'exercise', 'rest']
  return priorities.find((action) => canPerformActivity(state, action)) || 'rest'
}

export function recommendSpecialistActivity(state: GameState): Action {
  if (state.resources.health <= 50 || state.fatigue >= 70) return 'rest'
  const duty = getMissionCrewAssignments(state.crewSize, state.destination, state.maxDays, state.crewSpecialtyOverrides)
    .find((assignment) => assignment.id === state.controlledDutyId)
  const preferred: Action = duty
    ? ({
        command: 'exercise',
        engineering: 'maintenance',
        biology: 'research',
        geology: 'explore',
      } as const)[getMissionSpecialization(duty.specialty)]
    : 'rest'
  if (canPerformActivity(state, preferred)) return preferred
  return (['rest', 'exercise', 'maintenance', 'research', 'explore'] as const)
    .find((action) => canPerformActivity(state, action)) || 'rest'
}

export function recommendCrewSupportAction(state: GameState): Action {
  const priorities: readonly Action[] = state.resources.health <= 45 || state.fatigue >= 70
    ? ['rest', 'exercise', 'maintenance', 'research', 'explore']
    : Math.min(state.resources.energy, state.resources.oxygen, state.resources.water, state.resources.food) <= 30
      ? ['maintenance', 'research', 'explore', 'rest', 'exercise']
      : state.objective === 'science'
        ? ['research', 'maintenance', 'rest', 'explore', 'exercise']
        : state.objective === 'exploration'
          ? ['explore', 'maintenance', 'research', 'rest', 'exercise']
          : ['maintenance', 'research', 'explore', 'rest', 'exercise']
  return priorities.find((action) =>
    !state.todayActions.includes(action) && canPerformActivity(state, action),
  ) || priorities.find((action) => canPerformActivity(state, action)) || 'rest'
}

function eventResponseScore(state: GameState, event: EventDefinition, index: number, role: CrewRole): number {
  const choice = event.choices[index]
  const rolePriority: Record<CrewRole, Partial<Record<keyof typeof choice.effects, number>>> = {
    commander: { health: 1.8 },
    'power-engineer': { energy: 2.2, oxygen: 1.2 },
    biologist: { food: 2, health: 1.5 },
    'water-officer': { water: 2.2, oxygen: 1.2 },
  }
  const importance = {
    energy: 100 / (state.resources.energy + 20),
    oxygen: 100 / (state.resources.oxygen + 20),
    water: 100 / (state.resources.water + 20),
    food: 100 / (state.resources.food + 20),
    health: 130 / (state.resources.health + 20),
    credits: 0.03,
  }
  const score = Object.entries(choice.effects).reduce((total, [resource, effect]) => {
    const key = resource as keyof typeof importance
    const current = state.resources[key]
    const cap = key === 'energy'
      ? getEnergyCapacity(state)
      : key === 'credits'
        ? Number.MAX_SAFE_INTEGER
        : 100
    const after = Math.max(0, Math.min(cap, current + effect))
    const effectiveChange = after - current
    const roleWeight = rolePriority[role][resource as keyof typeof choice.effects] || 1
    const depletionPenalty = current > 0 && after === 0 ? 1_000 : 0
    return total + effectiveChange * importance[key] * roleWeight - depletionPenalty
  }, 0)
  const leavesLeak = choice.ongoingLeak ?? (event.id === 'water-leak' ? false : state.ongoingLeak)
  const leakImpact = state.resources.water <= 30 ? 28 : 12
  const leakScore = state.ongoingLeak && !leavesLeak
    ? leakImpact
    : !state.ongoingLeak && leavesLeak
      ? -leakImpact
      : 0
  return score + leakScore + (choice.rescues || 0) * 2
}

export function recommendEventResponse(state: GameState, event: EventDefinition): {
  votes: Record<CrewRole, number>
  recommendedIndex: number | null
} {
  const available = event.choices
    .map((choice, index) => ({ choice, index }))
    .filter(({ choice }) => canChooseEventOption(state, choice, event.id))
  const votes: Record<CrewRole, number> = {
    commander: 0,
    'power-engineer': 0,
    biologist: 0,
    'water-officer': 0,
  }
  if (!available.length) return { votes, recommendedIndex: null }
  const options = available
  const counts = event.choices.map(() => 0)

  for (const role of getAvailableCrewRoles(state.crewSize, state.destination, state.maxDays)) {
    const preferred = options.reduce((best, candidate) =>
      eventResponseScore(state, event, candidate.index, role.id) >
        eventResponseScore(state, event, best.index, role.id)
        ? candidate
        : best,
    )
    votes[role.id] = preferred.index
    counts[preferred.index] += 1
  }

  const recommendedIndex = options.reduce((best, candidate) =>
    counts[candidate.index] > counts[best.index] ? candidate : best,
  ).index
  return { votes, recommendedIndex }
}
