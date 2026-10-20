import { useCallback, useEffect, useRef, useState } from 'react'
import { UserRound, X } from 'lucide-react'
import { createPortal } from 'react-dom'
import type { GameState } from '../game/model'
import { getAstronautDutyProgress, getMissionCrewAssignments } from '../game/teamwork'
import { getCrewCondition } from '../game/model'
import { localizeCrewRole, localizeCrewSpecialty } from '../game/crewRosters'
import { MISSION_PROFILES } from '../game/missionProfiles'
import type { Language } from '../store/settingsStore'
import { useGameStore } from '../store/gameStore'
import ar from '../i18n/ar'
import en from '../i18n/en'

export function AstronautProfileHud({
  state,
  language,
  flight = false,
}: {
  state: GameState
  language: Language
  flight?: boolean
}) {
  const t = language === 'ar' ? ar : en
  const progress = getAstronautDutyProgress(state, language)
  const missionProfile = MISSION_PROFILES[state.missionType]
  const setControlledDuty = useGameStore((store) => store.setControlledDuty)
  const crewAssignments = getMissionCrewAssignments(state.crewSize, state.destination, state.maxDays, state.crewSpecialtyOverrides)
  const [open, setOpen] = useState(false)
  const [closing, setClosing] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const drawerRef = useRef<HTMLElement>(null)
  const closeTimerRef = useRef<number | null>(null)

  const closeProfile = useCallback(() => {
    if (!open || closing) return
    setClosing(true)
    closeTimerRef.current = window.setTimeout(() => {
      setOpen(false)
      setClosing(false)
      closeTimerRef.current = null
    }, 280)
  }, [closing, open])

  useEffect(() => () => {
    if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current)
  }, [])

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    return () => {
      document.body.style.overflow = previousOverflow
      triggerRef.current?.focus()
    }
  }, [open])

  const percent = progress.percent
  const name = state.astronautName.trim() || t.astronautDefaultName
  const trigger = (
    <button
      ref={triggerRef}
      type="button"
      className={`astronaut-profile-trigger${flight ? ' astronaut-profile-trigger-flight' : ''}`}
      aria-label={t.openAstronautProfile}
      aria-haspopup="dialog"
      aria-expanded={open}
      onClick={() => {
        if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current)
        closeTimerRef.current = null
        setClosing(false)
        setOpen(true)
      }}
    >
      <UserRound size={18} aria-hidden="true" />
      <span>{name}</span>
      <strong>{percent}%</strong>
    </button>
  )

  return (
    <>
      {flight ? createPortal(trigger, document.body) : trigger}
      {open ? createPortal(
        <div
          className={`astronaut-profile-backdrop${language === 'ar' ? ' is-rtl' : ''}${closing ? ' is-closing' : ''}`}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeProfile()
          }}
        >
          <section
            ref={drawerRef}
            className="astronaut-profile-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="astronaut-profile-title"
            dir={language === 'ar' ? 'rtl' : 'ltr'}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault()
                closeProfile()
                return
              }
              if (event.key !== 'Tab') return
              const focusableElements = drawerRef.current?.querySelectorAll<HTMLElement>(
                'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
              )
              if (!focusableElements?.length) {
                event.preventDefault()
                return
              }
              const first = focusableElements[0]
              const last = focusableElements[focusableElements.length - 1]
              if (event.shiftKey && document.activeElement === first) {
                event.preventDefault()
                last.focus()
              } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault()
                first.focus()
              }
            }}
          >
            <header className="astronaut-profile-drawer-heading">
              <div className="astronaut-profile-identity">
                <span className="astronaut-profile-avatar" aria-hidden="true"><UserRound size={25} /></span>
                <div>
                  <p className="astronaut-profile-eyebrow">{t.astronautProfileTitle}</p>
                  <h2 id="astronaut-profile-title">{name}</h2>
                  <p className="astronaut-profile-role">{localizeCrewRole(progress.duty.title, language)}</p>
                </div>
              </div>
              <button
                ref={closeRef}
                type="button"
                className="astronaut-profile-close"
                aria-label={t.closeAstronautProfile}
                onClick={closeProfile}
              >
                <X size={18} aria-hidden="true" />
              </button>
            </header>

            <div className="astronaut-profile-drawer-body">
              <section className="astronaut-profile-card">
                <h3>{language === 'ar' ? 'اختيار فرد الطاقم النشط' : 'Select active astronaut'}</h3>
                <ul className="mt-3 grid gap-2">
                  {crewAssignments.map((duty) => {
                    const condition = getCrewCondition(state, duty.id)
                    const selected = duty.id === state.controlledDutyId
                    return (
                      <li key={duty.id}>
                        <button
                          type="button"
                          className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2 text-start transition ${selected ? 'border-cyan-300/40 bg-cyan-300/[0.08]' : 'border-white/[0.08] bg-white/[0.025] hover:border-cyan-300/25'}`}
                          aria-pressed={selected}
                          onClick={() => setControlledDuty(duty.id)}
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-xs font-bold text-slate-100">{localizeCrewRole(duty.title, language)}</span>
                            <span className="mt-1 block truncate text-[10px] text-slate-400">{localizeCrewSpecialty(duty.specialty, language)}</span>
                          </span>
                          <span className="shrink-0 text-[10px] font-bold text-cyan-100">
                            {selected ? (language === 'ar' ? 'نشط' : 'ACTIVE') : `${Math.round(condition.health)}%`}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </section>

              <section className="astronaut-profile-card">
                <h3>{t.astronautDuty}</h3>
                <p>{localizeCrewRole(progress.duty.title, language)}</p>
                <h3 className="mt-4">{t.missionTypeLabel}</h3>
                <p>{missionProfile.goal[language]}</p>
                <p className="mt-1 text-xs leading-5 text-slate-400">{missionProfile.goalDescription[language]}</p>
              </section>

              <section className="astronaut-profile-card">
                <div className="astronaut-profile-progress-heading">
                  <h3>{t.dailyTasksTitle}</h3>
                  <strong>{t.completedLabel}: {percent}%</strong>
                </div>
                <div
                  className="astronaut-profile-track"
                  role="progressbar"
                  aria-label={t.astronautDutyCompletion}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={percent}
                >
                  <span style={{ transform: `scaleX(${percent / 100})` }} />
                </div>
                <ul className="astronaut-profile-task-list">
                  {progress.tasks.map((task) => (
                    <li key={task.action} className={task.complete ? 'is-complete' : ''}>
                      <span className="astronaut-profile-task-check" aria-hidden="true">{task.complete ? '✓' : '○'}</span>
                      <span>{task.label[language]}</span>
                      <span className="sr-only">{task.complete ? t.astronautDutyComplete : t.astronautDutyPending}</span>
                    </li>
                  ))}
                </ul>
                <p className={`astronaut-profile-status${progress.complete ? ' is-complete' : ''}`}>
                  {progress.complete ? t.astronautDutyComplete : t.astronautDutyPending}
                </p>
              </section>
            </div>
          </section>
        </div>,
        document.body,
      ) : null}
    </>
  )
}
