import { AlertTriangle } from 'lucide-react'
import { canChooseEventOption, EVENTS } from '../game/events'
import ar from '../i18n/ar'
import en from '../i18n/en'
import { useGameStore } from '../store/gameStore'
import { useEffect, useState } from 'react'
import { useSettingsStore } from '../store/settingsStore'
import { useSound } from '../hooks/useSound'

export function EventModal() {
  const activeEvent = useGameStore((state) => state.activeEvent)
  const resolveEvent = useGameStore((state) => state.resolveEvent)
  const language = useSettingsStore((state) => state.language)
  const t = language === 'ar' ? ar : en
  const { playEvent, playSuccess, playError } = useSound()
  const [announcedEventId, setAnnouncedEventId] = useState<string | null>(null)
  const event = EVENTS.find((item) => item.id === activeEvent?.id)
  const gameState = useGameStore((store) => store)
  useEffect(() => {
    if (activeEvent?.id && announcedEventId !== activeEvent.id) {
      playEvent()
      setAnnouncedEventId(activeEvent.id)
    }
  }, [activeEvent?.id, announcedEventId, playEvent])
  if (!event) return null
  const handleChoice = (choiceIndex: number) => {
    resolveEvent(choiceIndex)
    const next = useGameStore.getState()
    if (next.isGameOver) playError()
    else playSuccess()
    setAnnouncedEventId(null)
  }
  return (
    <div className="modal-backdrop">
      <section role="dialog" aria-modal="true" aria-labelledby="event-title" className="modal-card">
        <div className="mb-5 flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-amber-200/15 bg-amber-100/[0.06] text-2xl">{event.icon}</div>
          <div>
            <p className="eyebrow"><AlertTriangle size={12} className="text-amber-300" /> {t.event}</p>
            <h2 id="event-title" className="mt-2 text-2xl font-black text-white">{event.title[language]}</h2>
            <p className="mt-2 text-sm leading-7 text-slate-400">{event.description[language]}</p>
            {activeEvent?.id === 'solar-storm' &&
            useGameStore.getState().buildings.includes('storm-shelter') &&
            !(useGameStore.getState().offlineBuildings || []).includes('storm-shelter') ? (
              <p className="mt-2 text-xs font-bold text-emerald-200">🛡️ {t.shelterSafe}</p>
            ) : null}
          </div>
        </div>
        <p className="mb-3 text-xs font-bold text-slate-400">{t.choose}</p>
        <div className="grid gap-2">
          {event.choices.map((choice, index) => {
            const requirementMissing = !canChooseEventOption(gameState, choice)
            return (
            <button key={choice.label.en} type="button" onClick={() => handleChoice(index)} disabled={requirementMissing} title={requirementMissing ? t.stormShelterRequired : undefined} className="rounded-xl border border-white/[0.08] bg-white/[0.035] p-3 text-start text-sm font-semibold text-slate-200 transition hover:border-sky-200/25 hover:bg-sky-100/[0.06] disabled:cursor-not-allowed disabled:opacity-40">
              <span className="me-2 text-sky-200">{index === 0 ? '01' : '02'}</span>{choice.label[language]}
            </button>
          )})}
        </div>
      </section>
    </div>
  )
}
