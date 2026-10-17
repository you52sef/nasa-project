import type { Destination } from './model'

export interface CrewAssignment {
  title: string
  count: number
  specialty: 'command' | 'pilot' | 'science' | 'medical' | 'engineering' | 'communications' | 'power' | 'resources' | 'robotics' | 'agriculture'
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
    { title: 'Science/Medical Specialist', count: 1, specialty: 'science' },
  ]),
  roster('moon', 'short', 3, 'Moon short', [
    { title: 'Commander', count: 1, specialty: 'command' },
    { title: 'Flight Engineer/Geologist', count: 1, specialty: 'engineering' },
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
    { title: 'Geologist/Space Agriculture', count: 1, specialty: 'agriculture' },
  ]),
  roster('moon', 'long', 8, 'Moon base', [
    { title: 'Commander', count: 1, specialty: 'command' },
    { title: 'Coordinator', count: 1, specialty: 'communications' },
    { title: 'Power/Reactor Engineer', count: 2, specialty: 'power' },
    { title: 'Surgeon', count: 1, specialty: 'medical' },
    { title: 'Resource Prospector', count: 1, specialty: 'resources' },
    { title: 'Robotics/Comms Engineer', count: 1, specialty: 'robotics' },
    { title: 'Space Agriculture Scientist', count: 1, specialty: 'agriculture' },
  ]),
  roster('mars', 'short', 4, 'Mars short', [
    { title: 'Commander/Pilot', count: 1, specialty: 'command' },
    { title: 'Systems Engineer', count: 1, specialty: 'engineering' },
    { title: 'Biologist Doctor', count: 1, specialty: 'medical' },
    { title: 'Geologist', count: 1, specialty: 'science' },
  ]),
  roster('mars', 'long', 6, 'Mars long', [
    { title: 'Colony Commander/Astrobiologist', count: 1, specialty: 'command' },
    { title: 'Chief Reactor Engineer', count: 1, specialty: 'power' },
    { title: 'Surgeon', count: 1, specialty: 'medical' },
    { title: 'Space Agriculture Scientist', count: 1, specialty: 'agriculture' },
    { title: 'Sabatier/ISRU Chemist', count: 1, specialty: 'resources' },
    { title: 'AI/Robotics Engineer', count: 1, specialty: 'robotics' },
  ]),
  roster('mars', 'long', 9, 'Mars long', [
    { title: 'Colony Commander', count: 1, specialty: 'command' },
    { title: 'Chief Reactor Engineer', count: 1, specialty: 'power' },
    { title: 'Surgeon', count: 1, specialty: 'medical' },
    { title: 'Space Agriculture Scientist', count: 1, specialty: 'agriculture' },
    { title: 'Sabatier/ISRU Chemist', count: 1, specialty: 'resources' },
    { title: 'AI/Robotics Engineer', count: 1, specialty: 'robotics' },
    { title: 'Astrobiologist', count: 1, specialty: 'science' },
    { title: 'Systems Engineer', count: 2, specialty: 'engineering' },
  ]),
  roster('mars', 'long', 12, 'Mars long', [
    { title: 'Colony Commander', count: 1, specialty: 'command' },
    { title: 'Chief Reactor Engineer', count: 2, specialty: 'power' },
    { title: 'Surgeon', count: 1, specialty: 'medical' },
    { title: 'Space Agriculture Scientist', count: 2, specialty: 'agriculture' },
    { title: 'Sabatier/ISRU Chemist', count: 2, specialty: 'resources' },
    { title: 'AI/Robotics Engineer', count: 2, specialty: 'robotics' },
    { title: 'Astrobiologist', count: 1, specialty: 'science' },
    { title: 'Systems Engineer', count: 1, specialty: 'engineering' },
  ]),
]

const ARABIC_ROLE_NAMES: Readonly<Record<string, string>> = {
  'Commander/Pilot': 'قائد/طيار',
  'Science/Medical Specialist': 'اختصاصي علوم/طب',
  Commander: 'قائد',
  'Flight Engineer/Geologist': 'مهندس طيران/جيولوجي',
  'Doctor/Biologist': 'طبيب/عالم أحياء',
  Pilot: 'طيار',
  Geologist: 'جيولوجي',
  'Flight Surgeon/Biologist': 'جرّاح طيران/عالم أحياء',
  'Assistant/Comms': 'مساعد/اتصالات',
  'Maintenance & Infrastructure Engineer': 'مهندس صيانة وبنية تحتية',
  'Doctor/Psychologist': 'طبيب/اختصاصي نفسي',
  'Geologist/Space Agriculture': 'جيولوجي/زراعة فضائية',
  Coordinator: 'منسق',
  'Power/Reactor Engineer': 'مهندس طاقة/مفاعل',
  Surgeon: 'جرّاح',
  'Resource Prospector': 'منقّب موارد',
  'Robotics/Comms Engineer': 'مهندس روبوتات/اتصالات',
  'Space Agriculture Scientist': 'عالم زراعة فضائية',
  'Systems Engineer': 'مهندس أنظمة',
  'Biologist Doctor': 'طبيب عالم أحياء',
  'Colony Commander/Astrobiologist': 'قائد مستعمرة/عالم أحياء فلكية',
  'Colony Commander': 'قائد مستعمرة',
  'Chief Reactor Engineer': 'كبير مهندسي المفاعل',
  'Sabatier/ISRU Chemist': 'كيميائي ساباتيه/موارد محلية',
  'AI/Robotics Engineer': 'مهندس ذكاء اصطناعي/روبوتات',
  Astrobiologist: 'عالم أحياء فلكية',
}

export function localizeCrewRole(title: string, language: 'ar' | 'en'): string {
  return language === 'ar' ? ARABIC_ROLE_NAMES[title] || title : title
}

function missionLengthFor(maxDays: number): CrewRoster['missionLength'] {
  return maxDays === 10 ? 'short' : 'long'
}

export function getAllowedCrewSizes(destination: Destination, maxDays: number): number[] {
  const missionLength = missionLengthFor(maxDays)
  return CREW_ROSTERS
    .filter((entry) => entry.destination === destination && entry.missionLength === missionLength)
    .map((entry) => entry.crewSize)
}

export function getCrewRoster(destination: Destination, maxDays: number, crewSize: number): CrewRoster | null {
  const missionLength = missionLengthFor(maxDays)
  return CREW_ROSTERS.find((entry) =>
    entry.destination === destination &&
    entry.missionLength === missionLength &&
    entry.crewSize === crewSize,
  ) || null
}
