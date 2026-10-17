import ar from './i18n/ar'
import en from './i18n/en'
import { useGameStore } from './store/gameStore'
import { useSettingsStore } from './store/settingsStore'
import { GameScreen } from './components/GameScreen'
import { StartScreen } from './components/StartScreen'
import { useSound } from './hooks/useSound'

export default function App() {
  const gameState = useGameStore()
  const started = gameState.started
  const language = useSettingsStore((state) => state.language)
  const t = language === 'ar' ? ar : en
  const { playClick } = useSound()
  return (
    <div
      lang={language}
      dir={language === 'ar' ? 'rtl' : 'ltr'}
      className="min-h-screen"
      onClickCapture={(event) => {
        if (event.target instanceof Element && event.target.closest('button:not(:disabled)')) playClick()
      }}
    >
      {started ? <GameScreen state={gameState} /> : <StartScreen />}
      <span className="sr-only">{t.title}</span>
    </div>
  )
}
