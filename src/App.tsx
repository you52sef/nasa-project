import ar from './i18n/ar'
import en from './i18n/en'
import { useGameStore } from './store/gameStore'
import { useSettingsStore } from './store/settingsStore'
import { GameScreen } from './components/GameScreen'
import { StartScreen } from './components/StartScreen'

export default function App() {
  const gameState = useGameStore()
  const started = gameState.started
  const language = useSettingsStore((state) => state.language)
  const t = language === 'ar' ? ar : en
  return (
    <div lang={language} dir={language === 'ar' ? 'rtl' : 'ltr'} className="min-h-screen">
      {started ? <GameScreen state={gameState} /> : <StartScreen />}
      <span className="sr-only">{t.title}</span>
    </div>
  )
}
