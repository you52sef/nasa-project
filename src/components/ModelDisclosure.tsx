import ar from '../i18n/ar'
import en from '../i18n/en'
import { useSettingsStore } from '../store/settingsStore'

export function ModelDisclosure() {
  const language = useSettingsStore((state) => state.language)
  const t = language === 'ar' ? ar : en

  return (
    <details className="mt-4 rounded-xl border border-white/[0.08] bg-slate-950/35 p-3 text-start">
      <summary className="cursor-pointer text-xs font-bold text-sky-100">{t.modelNotesTitle}</summary>
      <p className="mt-3 text-xs leading-6 text-slate-300">{t.modelNotes}</p>
      <ul className="mt-2 list-disc space-y-1 ps-5 text-[10px] leading-5 text-slate-400">
        <li>{t.modelResourceUnits}</li>
        <li>{t.modelEnvironment}</li>
        <li>{t.modelRandomness}</li>
      </ul>
      <h3 className="mt-3 text-[10px] font-bold text-slate-200">{t.references}</h3>
      <ul className="mt-1 space-y-1 text-[10px]">
        <li><a className="text-sky-200 underline decoration-sky-200/30 underline-offset-2 hover:text-white" href="https://science.nasa.gov/moon/facts/" target="_blank" rel="noreferrer">{t.nasaMoonFacts}</a></li>
        <li><a className="text-sky-200 underline decoration-sky-200/30 underline-offset-2 hover:text-white" href="https://science.nasa.gov/mars/facts/" target="_blank" rel="noreferrer">{t.nasaMarsFacts}</a></li>
        <li><a className="text-sky-200 underline decoration-sky-200/30 underline-offset-2 hover:text-white" href="https://science.nasa.gov/moon/moon-water-and-ices/" target="_blank" rel="noreferrer">{t.nasaMoonWater}</a></li>
      </ul>
    </details>
  )
}
