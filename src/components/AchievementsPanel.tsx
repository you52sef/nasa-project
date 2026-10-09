import { useEffect, useState } from 'react'
import { Award, Check, X } from 'lucide-react'
import { ACHIEVEMENTS, useAchievementsStore } from '../store/achievementsStore'
import { useSettingsStore } from '../store/settingsStore'
import ar from '../i18n/ar'
import en from '../i18n/en'

export function AchievementsPanel() {
  const language = useSettingsStore((state) => state.language)
  const t = language === 'ar' ? ar : en
  const unlocked = useAchievementsStore((state) => state.unlocked)
  const newUnlocks = useAchievementsStore((state) => state.newUnlocks)
  const clearNewUnlocks = useAchievementsStore((state) => state.clearNewUnlocks)
  const [open, setOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const unlockedCount = ACHIEVEMENTS.filter((badge) => unlocked[badge.id]).length

  useEffect(() => {
    if (!newUnlocks.length) return
    const badge = ACHIEVEMENTS.find((item) => item.id === newUnlocks[newUnlocks.length - 1])
    if (badge) setNotice(`${t.badgeUnlocked}: ${badge.name[language]}`)
    clearNewUnlocks()
    const timer = window.setTimeout(() => setNotice(''), 4500)
    return () => window.clearTimeout(timer)
  }, [newUnlocks, clearNewUnlocks, language, t.badgeUnlocked])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="secondary-button !px-3 !py-2 text-xs"
        aria-label={`${t.achievements} ${unlockedCount}/${ACHIEVEMENTS.length}`}
      >
        <Award size={15} /> <span>{t.achievements}</span>
        <span className="border-s border-white/15 ps-2 tabular-nums">{unlockedCount}/{ACHIEVEMENTS.length}</span>
      </button>
      {notice ? (
        <div role="status" className="fixed bottom-5 start-1/2 z-50 -translate-x-1/2 border border-amber-200/30 bg-[#171712] px-4 py-3 text-sm text-amber-100">
          <Award size={16} className="me-2 inline" />{notice}
        </div>
      ) : null}
      {open ? (
        <div className="modal-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setOpen(false)
        }}>
          <section role="dialog" aria-modal="true" aria-labelledby="achievement-title" className="modal-card max-w-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="eyebrow"><Award size={14} /> {t.crewRecordLabel}</p>
                <h2 id="achievement-title" className="mt-3 text-xl font-black text-white">{t.achievements}</h2>
                <p className="mt-1 text-xs text-slate-500">{unlockedCount} / {ACHIEVEMENTS.length} {t.badgesEarned}</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="icon-button" aria-label={t.close}><X size={16} /></button>
            </div>
            <ol className="mt-5 grid gap-2 sm:grid-cols-2">
              {ACHIEVEMENTS.map((badge) => {
                const earnedAt = unlocked[badge.id]
                return (
                  <li
                    key={badge.id}
                    className={`flex min-h-20 items-center gap-3 border p-3 ${earnedAt ? 'border-amber-200/20 bg-amber-100/[0.035]' : 'border-white/[0.06] bg-white/[0.015] opacity-55'}`}
                  >
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center border font-mono text-xl ${earnedAt ? 'border-amber-200/30 text-amber-100' : 'border-white/10 text-slate-600'}`}>
                      {badge.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={`block text-xs ${earnedAt ? 'font-black text-white' : 'font-semibold text-slate-400'}`}>{badge.name[language]}</span>
                      <span className="mt-1 block text-[10px] leading-4 text-slate-500">{badge.description[language]}</span>
                      {earnedAt ? <span className="mt-1 block text-[9px] text-amber-200/70">{new Date(earnedAt).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US')}</span> : null}
                    </span>
                    {earnedAt ? <Check size={15} className="shrink-0 text-emerald-200" /> : null}
                  </li>
                )
              })}
            </ol>
          </section>
        </div>
      ) : null}
    </>
  )
}
