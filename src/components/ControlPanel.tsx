import { FlaskConical, Hammer, MoveUpRight, ShieldCheck } from 'lucide-react'
import type { Action } from '../game/model'
import ar from '../i18n/ar'
import en from '../i18n/en'
import { useSettingsStore } from '../store/settingsStore'

type ActionCopyKey = 'research' | 'researchDesc' | 'explore' | 'exploreDesc' | 'maintenance' | 'maintenanceDesc' | 'rest' | 'restDesc'

const actions: { id: Action; icon: typeof FlaskConical; title: ActionCopyKey; description: ActionCopyKey; tone: string }[] = [
  { id: 'research', icon: FlaskConical, title: 'research', description: 'researchDesc', tone: 'action-sky' },
  { id: 'explore', icon: MoveUpRight, title: 'explore', description: 'exploreDesc', tone: 'action-amber' },
  { id: 'maintenance', icon: Hammer, title: 'maintenance', description: 'maintenanceDesc', tone: 'action-violet' },
  { id: 'rest', icon: ShieldCheck, title: 'rest', description: 'restDesc', tone: 'action-emerald' },
]

export function ControlPanel({ disabled, onAction }: { disabled: boolean; onAction: (action: Action) => void }) {
  const language = useSettingsStore((state) => state.language)
  const t = language === 'ar' ? ar : en
  return (
    <section className="glass-panel p-4 sm:p-5">
      <div className="mb-4 flex items-end justify-between">
        <div>
          <p className="eyebrow"><span className="h-1.5 w-1.5 rounded-full bg-amber-300" /> {t.chooseStrategyLabel}</p>
          <h2 className="mt-2 text-lg font-black text-white">{t.control}</h2>
        </div>
        <span className="rounded-lg border border-white/[0.08] px-2 py-1 text-[10px] text-slate-500">{t.actionPerCycleLabel}</span>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {actions.map(({ id, icon: Icon, title, description, tone }) => (
          <button
            key={id}
            type="button"
            onClick={() => onAction(id)}
            disabled={disabled}
            className={`decision-card ${tone} disabled:cursor-not-allowed disabled:opacity-40`}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.07]"><Icon size={17} /></span>
            <span className="min-w-0 text-start">
              <span className="block text-sm font-bold text-slate-100">{t[title]}</span>
              <span className="mt-1 block text-[10px] leading-relaxed text-slate-500">{t[description]}</span>
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}
