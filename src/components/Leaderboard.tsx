import { useEffect, useState } from 'react'
import { Trash2, Trophy } from 'lucide-react'
import type { GameState } from '../game/model'
import type { LeaderboardEntry } from '../utils/leaderboard'
import { clearLeaderboard, saveScore } from '../utils/leaderboard'
import ar from '../i18n/ar'
import en from '../i18n/en'

export function Leaderboard({ state, language }: { state: GameState; language: 'ar' | 'en' }) {
  const t = language === 'ar' ? ar : en
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    try {
      setEntries(saveScore(state))
      setError('')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t.leaderboardError)
      setEntries([])
    }
  }, [state, t.leaderboardError])

  const handleClear = () => {
    if (!window.confirm(t.clearLeaderboardConfirm)) return
    try {
      clearLeaderboard()
      setEntries([])
      setError('')
      setNotice(t.leaderboardCleared)
    } catch (clearError) {
      setError(clearError instanceof Error ? clearError.message : t.leaderboardError)
    }
  }

  const objectiveName = (objective: LeaderboardEntry['objective']) => objective === 'survival'
    ? t.objective_survival
    : objective === 'science'
      ? t.objective_science
      : objective === 'exploration'
        ? t.objective_exploration
        : t.objective_tutorial

  return (
    <section className="mt-6 rounded-2xl border border-amber-200/10 bg-amber-100/[0.025] p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-black text-amber-100"><Trophy size={17} /> {t.leaderboardTitle}</h2>
          <p className="mt-1 text-xs text-slate-500">{t.leaderboardDescription}</p>
        </div>
        <button type="button" onClick={handleClear} className="secondary-button !px-3 !py-2 text-xs">
          <Trash2 size={14} /> {t.clearLeaderboard}
        </button>
      </div>

      {error ? <p role="alert" className="mt-3 text-xs text-rose-300">{error}</p> : null}
      {notice ? <p role="status" className="mt-3 text-xs text-emerald-200">{notice}</p> : null}

      {entries.length ? (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-start text-xs">
            <thead className="text-slate-500">
              <tr>
                <th className="border-b border-white/[0.08] px-3 py-2 text-start font-semibold">{t.rank}</th>
                <th className="border-b border-white/[0.08] px-3 py-2 text-start font-semibold">{t.score}</th>
                <th className="border-b border-white/[0.08] px-3 py-2 text-start font-semibold">{t.daysSurvived}</th>
                <th className="border-b border-white/[0.08] px-3 py-2 text-start font-semibold">{t.destination}</th>
                <th className="border-b border-white/[0.08] px-3 py-2 text-start font-semibold">{t.missionObjective}</th>
                <th className="border-b border-white/[0.08] px-3 py-2 text-start font-semibold">{t.result}</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, index) => (
                <tr key={entry.runId} className="text-slate-300">
                  <td className="border-b border-white/[0.04] px-3 py-3 font-bold text-amber-200">{index + 1}</td>
                  <td className="border-b border-white/[0.04] px-3 py-3 font-black text-white">{entry.score}/100</td>
                  <td className="border-b border-white/[0.04] px-3 py-3">{entry.day}/{entry.maxDays} · {t[entry.difficulty]}</td>
                  <td className="border-b border-white/[0.04] px-3 py-3">{entry.destination === 'moon' ? `🌙 ${t.moon}` : `🔴 ${t.mars}`}</td>
                  <td className="border-b border-white/[0.04] px-3 py-3">{objectiveName(entry.objective)}</td>
                  <td className="border-b border-white/[0.04] px-3 py-3">
                    <span className={entry.status === 'success' ? 'text-emerald-200' : entry.status === 'ended' ? 'text-amber-200' : 'text-rose-200'}>
                      {entry.status === 'success' ? t.resultWin : entry.status === 'ended' ? t.resultEnded : t.resultLose}
                    </span>
                    <span className="mt-1 block text-[10px] text-slate-600">{new Date(`${entry.date}T00:00:00Z`).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', { timeZone: 'UTC' })}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-4 rounded-xl border border-dashed border-white/10 px-4 py-6 text-center text-xs text-slate-500">{t.leaderboardEmpty}</p>
      )}
    </section>
  )
}
