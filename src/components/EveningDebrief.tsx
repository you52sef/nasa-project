import { useState } from 'react'
import { Check, Radio, Send, X } from 'lucide-react'
import type { GameState } from '../game/model'
import { getEveningBriefing } from '../game/teamwork'
import ar from '../i18n/ar'
import en from '../i18n/en'

export function EveningDebrief({
  state,
  language,
  queued,
  onQueueReport,
  onAcknowledge,
  onSleep,
}: {
  state: GameState
  language: 'ar' | 'en'
  queued: boolean
  onQueueReport: () => void
  onAcknowledge: () => void
  onSleep: () => void
}) {
  const arabic = language === 'ar'
  const t = arabic ? ar : en
  const [confirmed, setConfirmed] = useState(false)
  const briefing = getEveningBriefing(state, language)
  const resourceNames = {
    energy: arabic ? 'الطاقة' : 'Energy',
    oxygen: arabic ? 'الأكسجين' : 'Oxygen',
    water: arabic ? 'الماء' : 'Water',
    food: arabic ? 'الغذاء' : 'Food',
  }

  const acknowledge = () => {
    onAcknowledge()
    setConfirmed(true)
  }
  const continueToSleep = () => {
    onAcknowledge()
    onSleep()
  }

  return (
    <div className="modal-backdrop z-[60]" dir={arabic ? 'rtl' : 'ltr'}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="evening-debrief-title"
        className="modal-card max-h-[90vh] w-full max-w-3xl overflow-y-auto"
      >
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow"><span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />{arabic ? 'مراجعة نهاية اليوم' : 'END-OF-DAY REVIEW'}</p>
            <h2 id="evening-debrief-title" className="mt-2 text-xl font-black text-white">
              {arabic ? 'الاجتماع المسائي للطاقم' : 'Evening Crew Debrief'}
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              {state.destination === 'mars' ? 'Sol' : (arabic ? 'اليوم القمري' : 'Lunar day')} {state.day} · {arabic ? 'قبل النوم' : 'Pre-sleep briefing'}
            </p>
          </div>
          <button type="button" onClick={acknowledge} className="secondary-button !p-2" aria-label={arabic ? 'إقرار الاجتماع' : 'Acknowledge debrief'}>
            <X size={17} />
          </button>
        </header>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <Summary value={`${briefing.actionCount}`} label={arabic ? 'أنشطة مسجلة اليوم' : 'Activities logged today'} />
          <Summary value={`${briefing.completedWorkShifts}/2`} label={arabic ? 'ورديات العمل' : 'Work shifts'} />
          <Summary value={briefing.exerciseComplete ? (arabic ? 'مكتمل' : 'Complete') : (arabic ? 'غير مكتمل' : 'Incomplete')} label={arabic ? 'التمرين اليومي' : 'Daily exercise'} />
        </div>

        <section className="mt-5">
          <h3 className="text-xs font-black uppercase tracking-[0.14em] text-cyan-100">{arabic ? 'آراء الطاقم' : 'CREW NOTES'}</h3>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {briefing.crew.map((member) => (
              <li key={member.id} className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3">
                <p className="text-xs font-bold text-white">{member.icon} {member.name}</p>
                <p className="mt-1 text-[10px] font-semibold text-cyan-100">{member.role}</p>
                <p className="mt-2 text-[11px] leading-5 text-slate-300">{member.comment}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-5 rounded-xl border border-white/[0.07] bg-white/[0.025] p-3">
          <h3 className="text-xs font-black text-white">{arabic ? 'تغير الموارد خلال اليوم' : 'RESOURCE CHANGE TODAY'}</h3>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {briefing.resourceDeltas.map(({ id, delta }) => (
              <p key={id} className="flex justify-between gap-2 rounded-lg bg-black/20 px-2.5 py-2 text-[11px]">
                <span className="text-slate-300">{resourceNames[id]}</span>
                <b className={delta < 0 ? 'text-amber-100' : 'text-emerald-100'} dir="ltr">{delta > 0 ? '+' : ''}{delta.toFixed(1)}</b>
              </p>
            ))}
          </div>
        </section>

        {briefing.eventsReviewed.length ? (
          <section className="mt-3 rounded-xl border border-rose-200/10 bg-rose-100/[0.025] p-3">
            <h3 className="text-xs font-black text-rose-100">{arabic ? 'أحداث وقرارات اليوم' : 'TODAY’S EVENTS & DECISIONS'}</h3>
            <ul className="mt-2 grid gap-1.5">
              {briefing.eventsReviewed.map((event, index) => <li key={`${event}-${index}`} className="text-[11px] leading-5 text-slate-300">• {event}</li>)}
            </ul>
          </section>
        ) : null}

        {briefing.communicationNotes.length ? (
          <section className="mt-3 rounded-xl border border-cyan-200/10 bg-cyan-100/[0.025] p-3">
            <h3 className="text-xs font-black text-cyan-100">{arabic ? 'طلبات التواصل وقرارات الطاقم' : 'CREW REQUESTS & RESPONSES'}</h3>
            <ul className="mt-2 grid gap-2">
              {briefing.communicationNotes.map((note, index) => (
                <li key={`${note.role}-${note.action}-${index}`} className="rounded-lg bg-black/20 px-2.5 py-2">
                  <p className={`text-[10px] font-bold ${note.decision === 'accepted' ? 'text-emerald-100' : 'text-amber-100'}`}>
                    {note.decision === 'accepted' ? t.crewCommAccepted : t.crewCommRejected} · {note.role} · {t[`action_${note.action}`]}
                  </p>
                  <p className="mt-1 text-[9px] leading-4 text-slate-400">{t[`crewCommReason_${note.reason}`]}</p>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="mt-3 rounded-xl border border-amber-200/10 bg-amber-100/[0.03] p-3">
          <h3 className="text-xs font-black text-amber-100">{arabic ? 'مراقبة الوردية التالية وأولوياتها' : 'NEXT-SHIFT WATCH & PRIORITIES'}</h3>
          <p className="mt-2 text-[11px] leading-5 text-slate-300">{briefing.nextShiftWatch}</p>
          <p className="mt-1 text-[11px] leading-5 text-cyan-100">{briefing.nextShiftPriority}</p>
          <p className="mt-2 text-[9px] leading-4 text-slate-500">
            {arabic ? 'المراقبة مستمدة من سيناريو المهمة وحالتها الحالية؛ ليست توقعاً جوياً خارجياً.' : 'Watch items are derived from the mission scenario and current state, not an external weather forecast.'}
          </p>
        </section>

        <section className="mt-3 rounded-xl border border-cyan-200/10 bg-cyan-100/[0.025] p-3">
          <div className="flex items-center gap-2 text-xs font-black text-cyan-100"><Radio size={14} />{arabic ? 'مسودة تقرير إلى الأرض' : 'DRAFT EARTH REPORT'}</div>
          <p className="mt-2 text-[11px] leading-5 text-slate-300">
            {arabic
              ? `ملخص أولي لليوم ${state.day}: ${briefing.actionCount} أنشطة، ${briefing.completedWorkShifts} ورديات عمل، وتغيرات الموارد أعلاه. يُستكمل التقرير النهائي بعد دورة النوم.`
              : `Preliminary summary for day ${state.day}: ${briefing.actionCount} activities, ${briefing.completedWorkShifts} work shifts, and the resource changes above. The final report is completed after the sleep cycle.`}
          </p>
          <p className="mt-1 text-[10px] text-slate-500">
            {arabic ? `تأخير اتصال محاكى: ${briefing.reportDelayMinutes} دقيقة. لا يتم إرسال شبكي فعلي.` : `Modeled communication delay: ${briefing.reportDelayMinutes} minutes. No live network transmission.`}
          </p>
          <button type="button" onClick={onQueueReport} disabled={queued} className="secondary-button mt-3 !px-3 !py-2 text-xs disabled:opacity-50">
            {queued ? <Check size={14} /> : <Send size={14} />}
            {queued ? (arabic ? 'أُدرجت المسودة محلياً' : 'Draft queued locally') : (arabic ? 'إدراج المسودة في قائمة الإرسال' : 'Queue draft locally')}
          </button>
        </section>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={acknowledge} disabled={confirmed} className="secondary-button !px-4 !py-2 text-xs disabled:opacity-50">
            {confirmed ? <Check size={14} /> : null}
            {confirmed ? (arabic ? 'تم إقرار الاجتماع' : 'Debrief acknowledged') : (arabic ? 'إقرار ومتابعة' : 'Acknowledge & continue')}
          </button>
          <button type="button" onClick={continueToSleep} className="primary-button !px-4 !py-2 text-xs">
            🌙 {t.sleepAndNextDay}
          </button>
        </div>
      </section>
    </div>
  )
}

function Summary({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3">
      <p className="text-lg font-black tabular-nums text-white">{value}</p>
      <p className="mt-1 text-[10px] text-slate-400">{label}</p>
    </div>
  )
}
