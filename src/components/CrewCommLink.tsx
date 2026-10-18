import { useEffect, useState } from 'react'
import { Check, MessageCircle, Send, X } from 'lucide-react'
import type { Action, CrewCommunicationRecord, GameState } from '../game/model'
import { evaluateCrewRequest, getCrewRequestActions, getMissionCrewAssignments } from '../game/teamwork'
import { localizeCrewRole } from '../game/crewRosters'
import { useGameStore } from '../store/gameStore'
import { useSettingsStore } from '../store/settingsStore'
import ar from '../i18n/ar'
import en from '../i18n/en'

export function CrewCommLink({ state }: { state: GameState }) {
  const language = useSettingsStore((store) => store.language)
  const t = language === 'ar' ? ar : en
  const sendRequest = useGameStore((store) => store.sendCrewRequest)
  const arabic = language === 'ar'
  const duties = getMissionCrewAssignments(state.crewSize, state.destination, state.maxDays)
    .filter((duty) => state.controlMode !== 'specialist' || duty.id !== state.controlledDutyId)
  const [targetDutyId, setTargetDutyId] = useState('')
  const target = duties.find((duty) => duty.id === targetDutyId)
  const targetActions = target ? getCrewRequestActions(state, target.id) : []
  const recentInteractions = state.crewCommunications
    .filter((interaction) => interaction.day === state.day)
    .slice(-6)
    .reverse()
  const latestTargetResponse = target
    ? recentInteractions.find((interaction) => interaction.dutyId === target.id)
    : undefined

  useEffect(() => {
    if (duties.some((duty) => duty.id === targetDutyId)) return
    const defaultDuty = duties.find((duty) => duty.id === state.astronautDutyId) || duties[0]
    setTargetDutyId(defaultDuty?.id || '')
  }, [targetDutyId, state.astronautDutyId, state.crewSize, state.destination, state.maxDays, state.controlMode, state.controlledDutyId])

  const unavailable = state.missionPhase !== 'surface' || state.paused || state.isGameOver
  const send = (action: Action) => {
    if (!target) return
    sendRequest(target.id, action, language)
  }

  return (
    <section className="rounded-2xl border border-cyan-200/15 bg-slate-950/55 p-4 sm:p-5" aria-label={t.crewCommTitle}>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-200/15 bg-cyan-100/[0.05] text-cyan-100">
          <MessageCircle size={18} />
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-200/70">CREW COMM-LINK</p>
          <h2 className="mt-1 text-sm font-black text-white">{t.crewCommTitle}</h2>
          <p className="mt-1 text-[10px] leading-5 text-slate-400">{t.crewCommPrompt}</p>
        </div>
      </div>

      {duties.length ? (
        <>
          <label className="mt-4 block text-[10px] font-bold text-slate-300">
            {t.crewCommTarget}
            <select
              value={targetDutyId}
              onChange={(event) => setTargetDutyId(event.target.value)}
              className="mt-1.5 block w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-xs text-white"
              disabled={unavailable}
            >
              {duties.map((duty, index) => (
                <option key={duty.id} value={duty.id}>
                  {arabic ? `فرد الطاقم ${String(index + 1).padStart(2, '0')}` : `Crew member ${String(index + 1).padStart(2, '0')}`} · {localizeCrewRole(duty.title, language)}
                </option>
              ))}
            </select>
          </label>

          <div className="mt-3">
            <p className="mb-2 text-[10px] font-bold text-slate-300">{t.crewCommChooseRequest}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {targetActions.map((action) => {
                const reason = target ? evaluateCrewRequest(state, target.id, action) : 'crewBusy'
                const handled = reason === 'requestAlreadyHandled'
                return (
                  <button
                    key={action}
                    type="button"
                    onClick={() => send(action)}
                    disabled={unavailable || handled}
                    className="flex items-center justify-between gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] px-3 py-2.5 text-start text-xs font-bold text-slate-100 transition hover:border-cyan-200/25 hover:bg-cyan-100/[0.04] disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <span>{t[`action_${action}`]}</span>
                    <Send size={13} className="shrink-0 text-cyan-100/70" />
                  </button>
                )
              })}
            </div>
          </div>
          {target ? (
            <p className="mt-2 text-[9px] leading-4 text-slate-500">
              {target.duty[language]}
              {targetActions.length === 0 ? ` · ${t.crewCommNoHistory}` : ''}
            </p>
          ) : null}
        </>
      ) : (
        <p className="mt-4 rounded-lg bg-white/[0.03] p-3 text-xs text-slate-400">{t.crewCommNoHistory}</p>
      )}
      {unavailable ? <p className="mt-2 text-[10px] text-amber-100/75">{t.crewCommUnavailable}</p> : null}
      {latestTargetResponse ? (
        <p
          role="status"
          aria-live="polite"
          className={`mt-3 rounded-lg border px-3 py-2 text-[10px] leading-5 ${
            latestTargetResponse.decision === 'accepted'
              ? 'border-emerald-200/15 bg-emerald-200/[0.04] text-emerald-100'
              : 'border-amber-200/15 bg-amber-200/[0.04] text-amber-100'
          }`}
        >
          {latestTargetResponse.decision === 'accepted' ? t.crewCommAccepted : t.crewCommRejected} · {t[`action_${latestTargetResponse.action}`]} — {getReasonCopy(latestTargetResponse, t)}
        </p>
      ) : null}
      {state.controlMode === 'specialist' ? <p className="mt-2 text-[9px] text-slate-500">{t.crewCommProgress}</p> : null}

      <div className="mt-4 border-t border-white/[0.07] pt-3">
        <h3 className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-300">{t.crewCommRecent}</h3>
        {recentInteractions.length ? (
          <ul className="mt-2 grid gap-2">
            {recentInteractions.map((interaction, index) => (
              <li key={`${interaction.day}-${interaction.dutyId}-${interaction.action}-${index}`} className="flex items-start gap-2 rounded-lg bg-black/20 px-2.5 py-2">
                <span className={`mt-0.5 ${interaction.decision === 'accepted' ? 'text-emerald-200' : 'text-amber-200'}`} aria-hidden="true">
                  {interaction.decision === 'accepted' ? <Check size={13} /> : <X size={13} />}
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-slate-200">
                    {interaction.decision === 'accepted' ? t.crewCommAccepted : t.crewCommRejected} · {t[`action_${interaction.action}`]}
                  </p>
                  <p className="mt-0.5 text-[9px] leading-4 text-slate-400">{getReasonCopy(interaction, t)}</p>
                </div>
              </li>
            ))}
          </ul>
        ) : <p className="mt-2 text-[10px] text-slate-500">{t.crewCommNoHistory}</p>}
      </div>
    </section>
  )
}

function getReasonCopy(
  record: CrewCommunicationRecord,
  translations: typeof en,
): string {
  return translations[`crewCommReason_${record.reason}`]
}
