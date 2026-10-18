import { useState } from 'react'
import { Activity, ChevronDown, ChevronUp } from 'lucide-react'
import type { GameState, ResourceName } from '../game/model'
import { getMarsCommunicationDelayMinutes } from '../game/model'
import { RESOURCE_META } from '../game/resources'
import arStrings from '../i18n/ar'
import enStrings from '../i18n/en'

const trackedResources: ResourceName[] = ['energy', 'oxygen', 'water', 'food', 'health']

export function MissionLog({ state, language }: { state: GameState; language: 'ar' | 'en' }) {
  const [expanded, setExpanded] = useState(false)
  const ar = language === 'ar'
  const t = ar ? arStrings : enStrings
  const entries = [...state.log].reverse()
  const tickerEntries = entries.slice(0, 8)
  const updateCount = new Intl.NumberFormat(ar ? 'ar-EG' : 'en-US').format(entries.length)
  const reports = [...state.dailyReports].reverse()
  const number = (value: number) => new Intl.NumberFormat(language, { maximumFractionDigits: 1 }).format(value)
  const actionLabel = (action: string) => {
    const labels: Record<string, { ar: string; en: string }> = {
      research: { ar: 'بحث', en: 'Research' },
      explore: { ar: 'استكشاف', en: 'Explore' },
      maintenance: { ar: 'صيانة', en: 'Maintenance' },
      exercise: { ar: 'تمرين', en: 'Exercise' },
      rest: { ar: 'راحة', en: 'Rest' },
    }
    return labels[action]?.[language] || action
  }

  return (
    <section className="mission-log glass-panel mt-3 overflow-hidden" aria-label={t.operationsLogLabel}>
      <div className="flex items-center gap-3 border-b border-white/[0.06] px-4 py-2.5 sm:px-5">
        <span className="eyebrow shrink-0 text-emerald-200"><Activity size={12} /> {t.tickerLiveLabel}</span>
        <div className="mission-ticker min-w-0 flex-1" aria-label={tickerEntries.join(' · ')}>
          <div className="mission-ticker-track">
            {[...tickerEntries, ...tickerEntries].map((entry, index) => (
              <span key={`${entry}-${index}`} className="mission-ticker-item" aria-hidden={index >= tickerEntries.length}>
                <i aria-hidden="true">◆</i> {entry}
              </span>
            ))}
            {!tickerEntries.length ? <span className="mission-ticker-item">{t.emptyMissionLogLabel}</span> : null}
          </div>
        </div>
        <span className="shrink-0 text-[9px] text-slate-600">{updateCount}</span>
      </div>
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-start sm:px-5"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        aria-controls="mission-log-entries"
      >
        <span className="text-xs font-bold text-slate-200">{t.dailyReportTitle} <span className="ms-1 text-[10px] font-medium text-slate-500">{reports.length}</span></span>
        <span className="flex items-center gap-2 text-[10px] text-slate-500">
          {expanded ? t.collapseLogLabel : t.viewLogLabel}
          {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </span>
      </button>
      {expanded ? (
        <div id="mission-log-entries" className="border-t border-white/[0.06] px-3 py-3 sm:px-5">
          {reports.length ? (
            <ol className="grid gap-2 lg:grid-cols-2">
              {reports.map((report) => (
                <li key={report.day} className="rounded-xl border border-white/[0.06] bg-black/10 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-xs font-black text-slate-100">{t.operationCycle} {report.day}</h3>
                    <span className="text-[9px] text-slate-500">
                      {report.earthTransmission?.status === 'queued'
                        ? `${ar ? '↑ حزمة الأرض في قائمة الإرسال · تأخير محاكى ' : '↑ Earth packet queued · modeled delay '}${report.earthTransmission.delayMinutes}${ar ? ' د · ' : ' min · '}`
                        : report.earthTransmission?.status === 'local'
                          ? `${ar ? 'حُفظ التقرير محليًا · ' : 'Report stored locally · '}`
                          : state.destination === 'mars'
                            ? `${ar ? '↑ إرسال إلى الأرض · ' : '↑ Earth uplink · '}${getMarsCommunicationDelayMinutes(state.missionSeed, report.day, 'research')}${ar ? ' د · ' : ' min · '}`
                            : ''}
                      ☢ {number(report.radiationMsv)} mSv
                    </span>
                  </div>
                  <p className="mt-1 text-[10px] text-slate-400">
                    {report.actions.length ? report.actions.map(actionLabel).join(' · ') : t.emptyMissionLogLabel}
                  </p>
                  <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 sm:grid-cols-3">
                    {trackedResources.map((resource) => {
                      const delta = report.resourcesAtEnd[resource] - report.resourcesAtStart[resource]
                      return (
                        <div key={resource} className="flex justify-between gap-1 text-[9px]">
                          <dt className="text-slate-500">{RESOURCE_META[resource].label[language]}</dt>
                          <dd className={`font-bold tabular-nums ${delta < 0 ? 'text-amber-100' : delta > 0 ? 'text-emerald-200' : 'text-slate-300'}`}>
                            {delta > 0 ? '+' : ''}{number(delta)} {resource === 'health' ? '%' : RESOURCE_META[resource].unit}
                          </dd>
                        </div>
                      )
                    })}
                  </dl>
                  {report.events.length ? (
                    <div className="mt-2 border-t border-white/[0.05] pt-2">
                      <p className="text-[9px] font-bold text-amber-100">{t.dailyReportEvents}</p>
                      <ul className="mt-1 space-y-1">
                        {report.events.map((event, index) => <li key={`${event}-${index}`} className="text-[9px] leading-4 text-slate-400">• {event}</li>)}
                      </ul>
                    </div>
                  ) : null}
                </li>
              ))}
            </ol>
          ) : (
            <p className="py-4 text-center text-xs text-slate-500">{t.noDailyReports}</p>
          )}
          {entries.length ? (
            <ol className="mission-log-list mt-3 border-t border-white/[0.06] pt-2">
              {entries.slice(0, 20).map((entry, index) => (
                <li key={`${entry}-${index}`} className="mission-log-entry">
                  <span className="mission-log-icon" aria-hidden="true">◈</span>
                  <span className="min-w-0 flex-1 truncate text-xs text-slate-300">{entry}</span>
                </li>
              ))}
            </ol>
          ) : null}
          <p className="mt-3 text-[9px] leading-4 text-slate-500">
            {ar
              ? 'الإرسال إلى الأرض محاكاة محلية فقط؛ لا تُرسل بيانات عبر الشبكة.'
              : 'Earth transmission is simulated locally; no data is sent over a network.'}
          </p>
        </div>
      ) : null}
    </section>
  )
}
