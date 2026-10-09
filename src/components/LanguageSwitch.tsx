import { Languages } from 'lucide-react'
import { useSettingsStore } from '../store/settingsStore'

export function LanguageSwitch() {
  const language = useSettingsStore((state) => state.language)
  const setLanguage = useSettingsStore((state) => state.setLanguage)
  return (
    <button
      type="button"
      onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
      className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200 transition hover:bg-white/10"
      aria-label={language === 'ar' ? 'Switch language to English' : 'غيّر اللغة إلى العربية'}
    >
      <Languages size={16} />
      {language === 'ar' ? 'EN' : 'ع'}
    </button>
  )
}
