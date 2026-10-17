import type { Action, CrewRole, GameState } from './model'
import type { EventDefinition } from './events'
import { canPerformActivity, getEnergyCapacity, getExplorationRisk } from './model'
import { canChooseEventOption } from './events'

export const CREW_ROLES: readonly {
  id: CrewRole
  title: 'roleCommander' | 'rolePowerEngineer' | 'roleBiologist' | 'roleWaterOfficer'
  focus: 'roleCommanderFocus' | 'rolePowerEngineerFocus' | 'roleBiologistFocus' | 'roleWaterOfficerFocus'
  icon: string
}[] = [
  { id: 'commander', title: 'roleCommander', focus: 'roleCommanderFocus', icon: '🧭' },
  { id: 'power-engineer', title: 'rolePowerEngineer', focus: 'rolePowerEngineerFocus', icon: '⚡' },
  { id: 'biologist', title: 'roleBiologist', focus: 'roleBiologistFocus', icon: '🧬' },
  { id: 'water-officer', title: 'roleWaterOfficer', focus: 'roleWaterOfficerFocus', icon: '💧' },
]

export function getAvailableCrewRoles(crewSize: number) {
  return CREW_ROLES.slice(0, Math.max(1, Math.min(CREW_ROLES.length, Math.floor(crewSize))))
}

export function recommendDailyAction(state: GameState): Action {
  if (state.resources.health <= 45 || state.fatigue >= 70) return 'rest'
  if (Math.min(state.resources.energy, state.resources.oxygen, state.resources.water, state.resources.food) <= 25) return 'maintenance'
  if (state.objective === 'science') return 'research'
  if (state.objective === 'exploration' && getExplorationRisk(state) <= 0.4) return 'explore'
  return 'maintenance'
}

export function recommendSpecialistActivity(state: GameState): Action {
  if (state.resources.health <= 50 || state.fatigue >= 70) return 'rest'

  let preferred: Action
  switch (state.controlledRole) {
    case 'commander':
      preferred = state.objective === 'exploration' && getExplorationRisk(state) <= 0.4
        ? 'explore'
        : recommendDailyAction(state)
      break
    case 'power-engineer':
      preferred = state.objective === 'science' && state.resources.energy > 35
        ? 'research'
        : 'maintenance'
      break
    case 'biologist':
      preferred = state.objective === 'exploration' && getExplorationRisk(state) <= 0.4
        ? 'explore'
        : 'research'
      break
    case 'water-officer':
      preferred = state.objective === 'exploration' && state.resources.water > 45 && getExplorationRisk(state) <= 0.35
        ? 'explore'
        : 'maintenance'
      break
  }
  if (canPerformActivity(state, preferred)) return preferred
  return (['maintenance', 'research', 'explore', 'exercise', 'rest'] as const)
    .find((action) => canPerformActivity(state, action)) || 'rest'
}

export function recommendCrewSupportAction(state: GameState): Action {
  if (state.resources.health <= 45 || state.fatigue >= 70) return 'rest'
  if (Math.min(state.resources.energy, state.resources.oxygen, state.resources.water, state.resources.food) <= 30) return 'maintenance'

  const priorities: readonly Action[] = state.objective === 'science'
    ? ['research', 'maintenance', 'rest', 'explore']
    : state.objective === 'exploration'
      ? ['explore', 'maintenance', 'research', 'rest']
      : ['maintenance', 'research', 'explore', 'rest']
  return priorities.find((action) => !state.todayActions.includes(action)) || 'rest'
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
  recommendedIndex: number
} {
  const available = event.choices
    .map((choice, index) => ({ choice, index }))
    .filter(({ choice }) => canChooseEventOption(state, choice))
  const options = available.length ? available : [{ choice: event.choices[0], index: 0 }]
  const votes: Record<CrewRole, number> = {
    commander: 0,
    'power-engineer': 0,
    biologist: 0,
    'water-officer': 0,
  }
  const counts = event.choices.map(() => 0)

  for (const role of getAvailableCrewRoles(state.crewSize)) {
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
