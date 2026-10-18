import type { Destination } from './model'

export interface CrewAssignment {
  title: string
  count: number
  specialty: 'command' | 'pilot' | 'science' | 'medical' | 'engineering' | 'communications' | 'power' | 'resources' | 'robotics' | 'agriculture' | 'agriculture-resources' | 'science-medical' | 'engineering-science' | 'geology-agriculture'
}

export interface CrewRoster {
  destination: Destination
  missionLength: 'short' | 'long'
  crewSize: number
  label: string
  assignments: readonly CrewAssignment[]
}

const roster = (
  destination: Destination,
  missionLength: CrewRoster['missionLength'],
  crewSize: number,
  label: string,
  assignments: readonly CrewAssignment[],
): CrewRoster => ({ destination, missionLength, crewSize, label, assignments })

export const CREW_ROSTERS: readonly CrewRoster[] = [
  roster('moon', 'short', 2, 'Moon short', [
    { title: 'Commander/Pilot', count: 1, specialty: 'command' },
    { title: 'Science/Medical Specialist', count: 1, specialty: 'science-medical' },
  ]),
  roster('moon', 'short', 3, 'Moon short', [
    { title: 'Commander', count: 1, specialty: 'command' },
    { title: 'Flight Engineer/Geologist', count: 1, specialty: 'engineering-science' },
    { title: 'Doctor/Biologist', count: 1, specialty: 'medical' },
  ]),
  roster('moon', 'short', 4, 'Moon short & base', [
    { title: 'Commander', count: 1, specialty: 'command' },
    { title: 'Pilot', count: 1, specialty: 'pilot' },
    { title: 'Geologist', count: 1, specialty: 'science' },
    { title: 'Flight Surgeon/Biologist', count: 1, specialty: 'medical' },
  ]),
  roster('moon', 'long', 4, 'Moon short & base', [
    { title: 'Commander', count: 1, specialty: 'command' },
    { title: 'Pilot', count: 1, specialty: 'pilot' },
    { title: 'Geologist', count: 1, specialty: 'science' },
    { title: 'Flight Surgeon/Biologist', count: 1, specialty: 'medical' },
  ]),
  roster('moon', 'long', 6, 'Moon base', [
    { title: 'Commander', count: 1, specialty: 'command' },
    { title: 'Assistant/Comms', count: 1, specialty: 'communications' },
    { title: 'Maintenance & Infrastructure Engineer', count: 2, specialty: 'engineering' },
    { title: 'Doctor/Psychologist', count: 1, specialty: 'medical' },
    { title: 'Geologist/Space Agriculture', count: 1, specialty: 'geology-agriculture' },
  ]),
  roster('moon', 'long', 8, 'Moon base', [
    { title: 'Commander', count: 1, specialty: 'command' },
    { title: 'Operations Coordinator', count: 1, specialty: 'communications' },
    { title: 'Power/Reactor Engineer', count: 2, specialty: 'power' },
    { title: 'Surgeon', count: 1, specialty: 'medical' },
    { title: 'Resource Prospector', count: 1, specialty: 'resources' },
    { title: 'Robotics & Comms Engineer', count: 1, specialty: 'robotics' },
    { title: 'Space Agriculture Scientist', count: 1, specialty: 'agriculture' },
  ]),
  roster('mars', 'short', 4, 'Mars short', [
    { title: 'Commander/Pilot', count: 1, specialty: 'command' },
    { title: 'Systems Engineer', count: 1, specialty: 'engineering' },
    { title: 'Biologist Doctor', count: 1, specialty: 'medical' },
    { title: 'Geologist', count: 1, specialty: 'science' },
  ]),
  roster('mars', 'long', 6, 'Mars long', [
    { title: 'Colony Commander', count: 1, specialty: 'command' },
    { title: 'Chief Reactor & Power Engineer', count: 1, specialty: 'power' },
    { title: 'Surgeon/Flight Doctor', count: 1, specialty: 'medical' },
    { title: 'Space Agriculture Scientist', count: 1, specialty: 'agriculture' },
    { title: 'Sabatier/ISRU Fuel Chemist', count: 1, specialty: 'resources' },
    { title: 'Robotics Engineer', count: 1, specialty: 'robotics' },
  ]),
  roster('mars', 'long', 9, 'Mars long', [
    { title: 'Commander 1', count: 1, specialty: 'command' },
    { title: 'Commander 2/Co-Pilot', count: 1, specialty: 'command' },
    { title: 'Power & Infrastructure Engineer', count: 2, specialty: 'power' },
    { title: 'Surgeon', count: 1, specialty: 'medical' },
    { title: 'Space Agriculture Scientist', count: 1, specialty: 'agriculture' },
    { title: 'Fuel Chemist/ISRU', count: 1, specialty: 'resources' },
    { title: 'AI & Robotics Engineer', count: 1, specialty: 'robotics' },
    { title: 'Astrobiologist/Geologist', count: 1, specialty: 'science' },
  ]),
  roster('mars', 'long', 12, 'Mars long', [
    { title: 'Commander', count: 1, specialty: 'command' },
    { title: 'Deputy Commander/Navigator', count: 1, specialty: 'command' },
    { title: 'Power Engineer', count: 2, specialty: 'power' },
    { title: 'Maintenance Engineer', count: 2, specialty: 'engineering' },
    { title: 'Surgeon', count: 1, specialty: 'medical' },
    { title: 'Psychologist/Biologist', count: 1, specialty: 'medical' },
    { title: 'Geologist', count: 2, specialty: 'science' },
    { title: 'Agriculture & ISRU Specialist', count: 1, specialty: 'agriculture-resources' },
    { title: 'Robotics & Comms Engineer', count: 1, specialty: 'robotics' },
  ]),
]

const ARABIC_ROLE_NAMES: Readonly<Record<string, string>> = {
  'Commander/Pilot': 'قائد المهمة والطيار',
  'Science/Medical Specialist': 'اختصاصي العلوم والطب',
  Commander: 'قائد المهمة',
  'Flight Engineer/Geologist': 'مهندس أنظمة الطيران والجيولوجي',
  'Doctor/Biologist': 'طبيب وعالم أحياء',
  Pilot: 'طيار',
  Geologist: 'جيولوجي',
  'Flight Surgeon/Biologist': 'طبيب طيران وعالم أحياء',
  'Assistant/Comms': 'مساعد/اتصالات',
  'Maintenance & Infrastructure Engineer': 'مهندس صيانة وبنية تحتية',
  'Doctor/Psychologist': 'طبيب/اختصاصي نفسي',
  'Geologist/Space Agriculture': 'جيولوجي/زراعة فضائية',
  Coordinator: 'منسق',
  'Operations Coordinator': 'منسق العمليات',
  'Power/Reactor Engineer': 'مهندس طاقة/مفاعل',
  Surgeon: 'جرّاح',
  'Resource Prospector': 'منقّب موارد',
  'Robotics/Comms Engineer': 'مهندس روبوتات/اتصالات',
  'Robotics & Comms Engineer': 'مهندس الروبوتات والاتصالات',
  'Space Agriculture Scientist': 'عالم زراعة فضائية',
  'Systems Engineer': 'مهندس أنظمة',
  'Biologist Doctor': 'طبيب عالم أحياء',
  'Colony Commander': 'قائد مستعمرة',
  'Chief Reactor Engineer': 'كبير مهندسي المفاعل',
  'Chief Reactor & Power Engineer': 'كبير مهندسي المفاعل والطاقة',
  'Surgeon/Flight Doctor': 'طبيب جراح / طبيب طيران',
  'Sabatier/ISRU Chemist': 'كيميائي ساباتيه/موارد محلية',
  'Sabatier/ISRU Fuel Chemist': 'كيميائي وقود وموارد محلية ساباتيه',
  'Robotics Engineer': 'مهندس روبوتات',
  'Commander 1': 'قائد المهمة الأول',
  'Commander 2/Co-Pilot': 'نائب القائد / مساعد الطيار',
  'Power & Infrastructure Engineer': 'مهندس طاقة وبنية تحتية',
  'Fuel Chemist/ISRU': 'كيميائي وقود / موارد محلية',
  'AI & Robotics Engineer': 'مهندس ذكاء اصطناعي وروبوتات',
  'Astrobiologist/Geologist': 'عالم أحياء فلكية / جيولوجي',
  'Deputy Commander/Navigator': 'نائب القائد / الملاح',
  'Power Engineer': 'مهندس طاقة',
  'Maintenance Engineer': 'مهندس صيانة',
  'Psychologist/Biologist': 'طبيب نفسي / عالم أحياء',
  'Agriculture & ISRU Specialist': 'اختصاصي الزراعة والموارد المحلية',
  Astrobiologist: 'عالم أحياء فلكية',
}

export interface CrewDutyDescription {
  en: string
  ar: string
}

export const CREW_DUTIES: Readonly<Record<string, readonly [CrewDutyDescription, ...CrewDutyDescription[]]>> = {
  'Commander/Pilot': [
    { en: 'Lead the mission, pilot and navigate the spacecraft, monitor flight systems, and communicate with Earth.', ar: 'قيادة المهمة والمركبة والملاحة ومراقبة أنظمة الطيران والاتصال بالأرض.' },
  ],
  'Science/Medical Specialist': [
    { en: 'Perform initial crew health checks and collect the first lunar surface samples.', ar: 'إجراء الفحوصات الطبية الأولية وجمع عينات سطح القمر الأولى.' },
  ],
  Commander: [
    { en: 'Lead the crew, direct exploration, and make final mission decisions.', ar: 'إدارة الطاقم وتوجيه الاستكشاف واتخاذ القرار النهائي للمهمة.' },
  ],
  'Flight Engineer/Geologist': [
    { en: 'Inspect spacecraft mechanical systems and analyze lunar rocks and surface soil.', ar: 'فحص الأنظمة الميكانيكية للمركبة وتحليل الصخور وتربة السطح.' },
  ],
  'Doctor/Biologist': [
    { en: 'Monitor crew vital signs and respond to medical emergencies.', ar: 'مراقبة المؤشرات الحيوية والاستجابة للحالات الطبية الطارئة.' },
  ],
  Pilot: [
    { en: 'Operate flight systems and pilot surface rovers.', ar: 'إدارة أنظمة الطيران وقيادة المركبات الجوالة.' },
  ],
  Geologist: [
    { en: 'Explore the surface and collect geological samples.', ar: 'استكشاف السطح وجمع العينات الجيولوجية.' },
    { en: 'Analyze minerals and assess geological hazards.', ar: 'تحليل المعادن وتقييم المخاطر الجيولوجية.' },
  ],
  'Flight Surgeon/Biologist': [
    { en: 'Provide comprehensive medical care and monitor crew biological health.', ar: 'تقديم الرعاية الطبية الشاملة ومتابعة الاستقرار الحيوي للطاقم.' },
  ],
  'Assistant/Comms': [
    { en: 'Coordinate Earth communications, messages, and signal processing.', ar: 'تنظيم الاتصالات الأرضية والرسائل ومعالجة الإشارات.' },
  ],
  'Maintenance & Infrastructure Engineer': [
    { en: 'Maintain habitats and power generators.', ar: 'صيانة الوحدات السكنية ومولدات الطاقة.' },
    { en: 'Maintain pressure systems and EVA equipment.', ar: 'صيانة أنظمة الضغط ومعدات الخروج إلى السطح.' },
  ],
  'Doctor/Psychologist': [
    { en: 'Monitor crew physical and psychological health during isolation.', ar: 'متابعة الصحة الجسدية والنفسية للطاقم أثناء العزلة.' },
  ],
  'Geologist/Space Agriculture': [
    { en: 'Study lunar soil and monitor greenhouse experiments.', ar: 'دراسة تربة القمر ومتابعة تجارب الصوبات الزراعية.' },
  ],
  'Operations Coordinator': [
    { en: 'Coordinate daily activity schedules and crew movement.', ar: 'تنظيم جداول الأنشطة اليومية وحركة الطاقم.' },
  ],
  'Power/Reactor Engineer': [
    { en: 'Operate and maintain the Kilopower reactor.', ar: 'تشغيل مفاعل كيلوباور النووي وصيانته.' },
    { en: 'Monitor power distribution networks and battery storage.', ar: 'مراقبة شبكات توزيع الطاقة وتخزين البطاريات.' },
  ],
  Surgeon: [
    { en: 'Provide advanced medical care and respond to urgent injuries.', ar: 'تقديم الرعاية الطبية المتقدمة والتعامل مع الإصابات الطارئة.' },
  ],
  'Resource Prospector': [
    { en: 'Operate ISRU systems to extract water and useful gases.', ar: 'إدارة وحدات الموارد المحلية لاستخراج الماء والغازات.' },
  ],
  'Robotics & Comms Engineer': [
    { en: 'Operate robots and 3D printers, and maintain communications networks.', ar: 'تشغيل الروبوتات والطابعات ثلاثية الأبعاد وصيانة شبكات الاتصال.' },
  ],
  'Space Agriculture Scientist': [
    { en: 'Manage greenhouse production of food and oxygen.', ar: 'إدارة إنتاج الغذاء والأكسجين في الصوبات الزراعية.' },
    { en: 'Maintain sustainable food production and greenhouse health.', ar: 'ضمان استدامة إنتاج الغذاء وسلامة الصوبات الزراعية.' },
  ],
  'Systems Engineer': [
    { en: 'Operate life-support and environmental-control systems.', ar: 'إدارة أنظمة دعم الحياة والتحكم البيئي.' },
  ],
  'Biologist Doctor': [
    { en: 'Protect crew health and reduce muscle and bone loss.', ar: 'الحفاظ على صحة الطاقم والحد من فقدان العضلات والعظام.' },
  ],
  'Colony Commander': [
    { en: 'Lead long-term settlement operations and research.', ar: 'إدارة عمليات الاستيطان والبحث العلمي طويل الأمد.' },
  ],
  'Chief Reactor & Power Engineer': [
    { en: 'Maintain reliable reactor power through Martian dust storms.', ar: 'ضمان استمرار الطاقة وصيانة المفاعل أثناء عواصف المريخ الترابية.' },
  ],
  'Surgeon/Flight Doctor': [
    { en: 'Provide comprehensive advanced medical and surgical care.', ar: 'تقديم الرعاية الطبية والجراحية المتقدمة والشاملة.' },
  ],
  'Sabatier/ISRU Fuel Chemist': [
    { en: 'Convert atmospheric and local resources into oxygen and fuel.', ar: 'تحويل الغلاف الجوي والموارد المحلية إلى أكسجين ووقود.' },
  ],
  'Robotics Engineer': [
    { en: 'Operate and maintain service and exploration robots.', ar: 'تشغيل وصيانة الروبوتات الخدمية والاستكشافية.' },
  ],
  'Commander 1': [
    { en: 'Direct mission strategy and overall operating policy.', ar: 'التوجيه العام ووضع السياسة التشغيلية للمهمة.' },
  ],
  'Commander 2/Co-Pilot': [
    { en: 'Lead alternate daily operations and support spacecraft navigation.', ar: 'إدارة العمليات اليومية البديلة ومساندة الملاحة.' },
  ],
  'Power & Infrastructure Engineer': [
    { en: 'Maintain the reactor and power distribution network.', ar: 'صيانة المفاعلات وشبكات توزيع الطاقة.' },
    { en: 'Maintain building insulation and underground heating systems.', ar: 'صيانة عزل المباني وأنظمة التدفئة تحت السطح.' },
  ],
  'Fuel Chemist/ISRU': [
    { en: 'Produce methane and liquid oxygen from Martian resources.', ar: 'إنتاج الميثان والأكسجين السائل من موارد المريخ.' },
  ],
  'AI & Robotics Engineer': [
    { en: 'Maintain autonomous systems, robotics, and intelligent software.', ar: 'صيانة الأنظمة الآلية والروبوتات والبرمجيات الذكية.' },
  ],
  'Astrobiologist/Geologist': [
    { en: 'Search for signs of ancient life and analyze hazardous samples.', ar: 'البحث عن آثار الحياة القديمة وتحليل العينات الخطرة.' },
  ],
  'Deputy Commander/Navigator': [
    { en: 'Calculate routes and coordinate field operations as deputy lead.', ar: 'حساب المسارات وتنسيق العمليات الميدانية بصفته نائب القائد.' },
  ],
  'Power Engineer': [
    { en: 'Maintain nuclear power-generation systems.', ar: 'صيانة أنظمة توليد الطاقة النووية.' },
    { en: 'Operate and maintain energy storage and battery systems.', ar: 'تشغيل وصيانة أنظمة تخزين الطاقة والبطاريات.' },
  ],
  'Maintenance Engineer': [
    { en: 'Maintain rovers and workshop equipment.', ar: 'صيانة المركبات الجوالة ومعدات الورش.' },
    { en: 'Repair infrastructure failures and heavy equipment.', ar: 'إصلاح أعطال البنية التحتية والمعدات الثقيلة.' },
  ],
  'Psychologist/Biologist': [
    { en: 'Monitor crew mental health and the effects of prolonged isolation.', ar: 'متابعة الصحة النفسية وآثار العزلة طويلة الأمد على الطاقم.' },
  ],
  'Agriculture & ISRU Specialist': [
    { en: 'Integrate greenhouse operations with biological resource production.', ar: 'دمج تشغيل الصوبات مع إنتاج الموارد الحيوية.' },
  ],
}

export function localizeCrewRole(title: string, language: 'ar' | 'en'): string {
  const numberedRole = /^(.*) (\d+)$/.exec(title)
  const baseTitle = numberedRole?.[1] || title
  const localizedTitle = language === 'ar' ? ARABIC_ROLE_NAMES[baseTitle] || baseTitle : baseTitle
  if (!numberedRole) return localizedTitle
  const ordinal = language === 'ar'
    ? numberedRole[2].replace(/\d/g, (digit) => '٠١٢٣٤٥٦٧٨٩'[Number(digit)])
    : numberedRole[2]
  return `${localizedTitle} ${ordinal}`
}

export function getCrewAssignmentById(destination: Destination, maxDays: number, crewSize: number, dutyId: string) {
  const roster = getCrewRoster(destination, maxDays, crewSize)
  if (!roster) return undefined
  for (const assignment of roster.assignments) {
    const slug = assignment.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    for (let index = 0; index < assignment.count; index += 1) {
      if (`${slug}-${index + 1}` === dutyId) return assignment
    }
  }
  return undefined
}

function missionLengthFor(maxDays: number): CrewRoster['missionLength'] {
  return maxDays <= 30 ? 'short' : 'long'
}

export function getAllowedCrewSizes(destination: Destination, maxDays: number): number[] {
  const missionLength = missionLengthFor(maxDays)
  return CREW_ROSTERS
    .filter((entry) => entry.destination === destination && entry.missionLength === missionLength)
    .map((entry) => entry.crewSize)
}

export function getCrewRoster(destination: Destination, maxDays: number, crewSize: number): CrewRoster | null {
  const missionLength = missionLengthFor(maxDays)
  if (!Number.isInteger(crewSize) || crewSize < 2 || crewSize > 12) return null
  const exactRoster = CREW_ROSTERS.find((entry) =>
    entry.destination === destination &&
    entry.missionLength === missionLength &&
    entry.crewSize === crewSize,
  )
  if (exactRoster) return exactRoster

  const referenceRoster = CREW_ROSTERS
    .filter((entry) => entry.destination === destination && entry.missionLength === missionLength)
    .reduce((nearest, entry) =>
      Math.abs(entry.crewSize - crewSize) < Math.abs(nearest.crewSize - crewSize) ? entry : nearest,
    )
  const assignments = referenceRoster.assignments.map((assignment) => ({ ...assignment }))
  let assignedCrew = assignments.reduce((total, assignment) => total + assignment.count, 0)
  let nextAssignmentIndex = 0
  const specialistAssignments = assignments.filter((assignment) => assignment.specialty !== 'command')
  while (assignedCrew < crewSize) {
    const assignment = specialistAssignments[nextAssignmentIndex % specialistAssignments.length] || assignments[0]
    assignment.count += 1
    assignedCrew += 1
    nextAssignmentIndex += 1
  }
  while (assignedCrew > crewSize) {
    let assignmentIndex = assignments.map((item) => item.specialty !== 'command' && item.count > 1).lastIndexOf(true)
    if (assignmentIndex >= 0) {
      assignments[assignmentIndex].count -= 1
    } else {
      assignmentIndex = assignments.map((item) => item.specialty !== 'command').lastIndexOf(true)
      if (assignmentIndex < 0) break
      assignments.splice(assignmentIndex, 1)
    }
    assignedCrew -= 1
  }
  return {
    ...referenceRoster,
    crewSize,
    label: `${referenceRoster.label} · customizable`,
    assignments,
  }
}
