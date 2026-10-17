import { AlertTriangle } from 'lucide-react'
import { canChooseEventOption, EVENTS } from '../game/events'
import ar from '../i18n/ar'
import en from '../i18n/en'
import { useGameStore } from '../store/gameStore'
import { useEffect, useRef, useState } from 'react'
import { useSettingsStore } from '../store/settingsStore'
import { useSound } from '../hooks/useSound'
import { getAvailableCrewRoles, recommendEventResponse } from '../game/teamwork'
import type { EventChoice } from '../game/events'
import { getEnergyCapacity, RESOURCE_CAP, type GameState } from '../game/model'
import { formatResourceValue, RESOURCE_META } from '../game/resources'

const EVENT_EFFECT_RESOURCES = ['energy', 'oxygen', 'water', 'food', 'health', 'credits'] as const

function describeChoiceEffects(
  choice: EventChoice,
  state: GameState,
  language: 'ar' | 'en',
  translations: typeof en,
): string[] {
  return EVENT_EFFECT_RESOURCES.flatMap((resource) => {
    const delta = choice.effects[resource]
    if (delta === undefined) return []
    const current = state.resources[resource]
    const cap = resource === 'energy'
      ? getEnergyCapacity(state)
      : resource === 'credits'
        ? Number.MAX_SAFE_INTEGER
        : RESOURCE_CAP
    const resultingBalance = Math.round(Math.max(0, Math.min(cap, current + delta)) * 100) / 100
    const appliedDelta = resultingBalance - current
    const amount = resource === 'credits'
      ? `${new Intl.NumberFormat(language, { maximumFractionDigits: 0 }).format(Math.abs(appliedDelta))} ${translations.creditsUnit}`
      : formatResourceValue(resource, Math.abs(appliedDelta), language)
    const signedAmount = appliedDelta > 0 ? `+${amount}` : appliedDelta < 0 ? `-${amount}` : amount
    const label = resource === 'credits'
      ? translations.credits
      : `${RESOURCE_META[resource].icon} ${RESOURCE_META[resource].label[language]}`
    return [`${label}: ${signedAmount}`]
  })
}

export function EventModal() {
  const activeEvent = useGameStore((state) => state.activeEvent)
  const resolveEvent = useGameStore((state) => state.resolveEvent)
  const language = useSettingsStore((state) => state.language)
  const t = language === 'ar' ? ar : en
  const { playEvent, playSuccess, playError } = useSound()
  const [announcedEventId, setAnnouncedEventId] = useState<string | null>(null)
  const dialogRef = useRef<HTMLElement>(null)
  const event = EVENTS.find((item) => item.id === activeEvent?.id)
  const gameState = useGameStore((store) => store)
  useEffect(() => {
    if (activeEvent?.id && announcedEventId !== activeEvent.id) {
      playEvent()
      setAnnouncedEventId(activeEvent.id)
    }
  }, [activeEvent?.id, announcedEventId, playEvent])
  useEffect(() => {
    if (!activeEvent?.id) return
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const dialog = dialogRef.current
    const getFocusable = () => Array.from(dialog?.querySelectorAll<HTMLElement>(
      'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
    ) ?? [])
    getFocusable()[0]?.focus()
    const handleKeyDown = (keyboardEvent: KeyboardEvent) => {
      if (keyboardEvent.key !== 'Tab') return
      const focusable = getFocusable()
      if (!focusable.length) {
        keyboardEvent.preventDefault()
        return
      }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (keyboardEvent.shiftKey && document.activeElement === first) {
        keyboardEvent.preventDefault()
        last.focus()
      } else if (!keyboardEvent.shiftKey && document.activeElement === last) {
        keyboardEvent.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      if (previousFocus?.isConnected) previousFocus.focus()
    }
  }, [activeEvent?.id])
  if (!event) return null
  const teamRecommendation = recommendEventResponse(gameState, event)
  const handleChoice = (choiceIndex: number) => {
    resolveEvent(choiceIndex)
    const next = useGameStore.getState()
    if (next.isGameOver) playError()
    else playSuccess()
    setAnnouncedEventId(null)
  }
  return (
    <div className={`modal-backdrop event-incident-backdrop event-incident-${event.id}`} dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="event-title" aria-describedby="event-description" className="modal-card event-modal-card">
        <div className="mb-5 flex items-start gap-4">
          <div className="event-modal-icon flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-amber-200/15 bg-amber-100/[0.06] text-2xl">{event.icon}</div>
          <div>
            <p className="eyebrow"><AlertTriangle size={12} className="text-amber-300" /> {t.event}</p>
            <h2 id="event-title" className="mt-2 text-2xl font-black text-white">{event.title[language]}</h2>
            <p id="event-description" className="mt-2 text-sm leading-7 text-slate-400">{event.description[language]}</p>
            {activeEvent?.id === 'solar-storm' &&
            useGameStore.getState().buildings.includes('storm-shelter') &&
            !(useGameStore.getState().offlineBuildings || []).includes('storm-shelter') ? (
              <p className="mt-2 text-xs font-bold text-emerald-200">🛡️ {t.shelterSafe}</p>
            ) : null}
          </div>
        </div>
        <section className="mb-5 rounded-xl border border-cyan-200/10 bg-cyan-100/[0.025] p-3">
          <h3 className="text-xs font-black text-cyan-50">{t.teamEventHeader}</h3>
          <p className="mt-1 text-[10px] leading-5 text-slate-500">{t.teamEventNote}</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {getAvailableCrewRoles(gameState.crewSize).map((role) => (
              <article key={role.id} className="rounded-lg border border-white/[0.06] bg-slate-950/40 p-2">
                <p className="text-[11px] font-bold text-slate-200">{role.icon} {t[role.title]}</p>
                <p className="mt-1 text-[10px] leading-5 text-slate-500">{t[role.focus]}</p>
                <p className="mt-1 text-[10px] leading-5 text-cyan-100/80">
                  {t.teamEventVote}: {event.choices[teamRecommendation.votes[role.id]]?.label[language]}
                </p>
              </article>
            ))}
          </div>
          <p className="mt-3 text-[11px] font-bold text-emerald-100">
            {t.teamEventRecommendation}: {event.choices[teamRecommendation.recommendedIndex]?.label[language]}
          </p>
        </section>
        <p className="mb-3 text-xs font-bold text-slate-400">{t.choose}</p>
        <div className="grid gap-2">
          {event.choices.map((choice, index) => {
            const requirementMissing = !canChooseEventOption(gameState, choice)
            const effectDescriptions = describeChoiceEffects(choice, gameState, language, t)
            return (
            <button key={choice.label.en} type="button" onClick={() => handleChoice(index)} disabled={requirementMissing} title={requirementMissing ? t.stormShelterRequired : undefined} className={`rounded-xl border p-3 text-start text-sm font-semibold text-slate-200 transition hover:border-sky-200/25 hover:bg-sky-100/[0.06] disabled:cursor-not-allowed disabled:opacity-40 ${index === teamRecommendation.recommendedIndex ? 'border-emerald-200/35 bg-emerald-100/[0.035]' : 'border-white/[0.08] bg-white/[0.035]'}`}>
              <span className="me-2 text-sky-200">{index === 0 ? '01' : '02'}</span>{choice.label[language]}
              {index === teamRecommendation.recommendedIndex ? <span className="ms-2 text-[10px] text-emerald-100">· {t.teamEventRecommendation}</span> : null}
              <span className="mt-2 block text-[10px] font-medium leading-5 text-slate-400">
                <span className="font-bold text-slate-300">{t.eventEffectsLabel}</span>{' '}
                {effectDescriptions.length ? effectDescriptions.join(' · ') : t.noImmediateResourceChange}
                {choice.rescues ? ` · +${choice.rescues} ${t.eventRescueEffect}` : ''}
                {choice.ongoingLeak ? ` · ${t.eventLeakContinues}` : ''}
              </span>
            </button>
          )})}
        </div>
      </section>
    </div>
  )
}
