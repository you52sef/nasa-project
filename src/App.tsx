import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Rocket } from 'lucide-react'
import ar from './i18n/ar'
import en from './i18n/en'
import { useGameStore } from './store/gameStore'
import { useSettingsStore } from './store/settingsStore'
import { useSound } from './hooks/useSound'

const GameScreen = lazy(async () => ({ default: (await import('./components/GameScreen')).GameScreen }))
const StartScreen = lazy(async () => ({ default: (await import('./components/StartScreen')).StartScreen }))
const ACTIVE_VIEW_KEY = 'astra-one-active-view-v1'

export default function App() {
  const gameState = useGameStore()
  const started = gameState.started
  const savedGameExists = gameState.savedGameExists
  const loadGame = gameState.load
  const language = useSettingsStore((state) => state.language)
  const t = language === 'ar' ? ar : en
  const { playClick } = useSound()
  const [restoreMission, setRestoreMission] = useState(() => {
    try {
      return sessionStorage.getItem(ACTIVE_VIEW_KEY) === 'mission'
    } catch (error) {
      console.error('Could not read Astra One active-view state.', error)
      return false
    }
  })
  const [restoreComplete, setRestoreComplete] = useState(!restoreMission)
  const [restoreError, setRestoreError] = useState('')
  const previousStarted = useRef(started)
  const transitionTimer = useRef<number | null>(null)
  const [routeTransition, setRouteTransition] = useState<'launch' | 'landing' | null>(null)
  useEffect(() => {
    document.documentElement.lang = language
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr'
  }, [language])
  useEffect(() => {
    if (restoreComplete || !restoreMission) return
    if (started) {
      setRestoreComplete(true)
      return
    }
    try {
      if (!savedGameExists) throw new Error('The mission view was active, but no saved mission is available to restore.')
      previousStarted.current = true
      loadGame()
    } catch (error) {
      previousStarted.current = started
      console.error('Could not restore Astra One mission view.', error)
      setRestoreError(error instanceof Error ? error.message : 'Could not restore the active mission.')
      setRestoreComplete(true)
    }
  }, [loadGame, restoreComplete, restoreMission, savedGameExists, started])
  useEffect(() => {
    if (!restoreComplete) return
    try {
      sessionStorage.setItem(ACTIVE_VIEW_KEY, started ? 'mission' : 'start')
    } catch (error) {
      console.error('Could not save Astra One active-view state.', error)
    }
  }, [restoreComplete, started])
  useEffect(() => {
    if (previousStarted.current === started) return
    previousStarted.current = started
    setRouteTransition(started ? 'launch' : 'landing')
    if (transitionTimer.current !== null) window.clearTimeout(transitionTimer.current)
    const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 100 : 1250
    transitionTimer.current = window.setTimeout(() => {
      setRouteTransition(null)
      transitionTimer.current = null
    }, duration)
    return () => {
      if (transitionTimer.current !== null) {
        window.clearTimeout(transitionTimer.current)
        transitionTimer.current = null
      }
    }
  }, [started])
  return (
    <div
      lang={language}
      dir={language === 'ar' ? 'rtl' : 'ltr'}
      className="min-h-screen"
      onClickCapture={(event) => {
        if (event.target instanceof Element && event.target.closest('button:not(:disabled)')) playClick()
      }}
    >
      {!restoreComplete ? (
        <div className="mission-route-loading" role="status" aria-live="polite">
          <span className="mission-route-spinner" aria-hidden="true" />
          <span className="sr-only">{language === 'ar' ? 'جارٍ استعادة المهمة' : 'Restoring your mission'}</span>
        </div>
      ) : <Suspense fallback={
        <div className="mission-route-loading" role="status" aria-live="polite">
          <span className="mission-route-spinner" aria-hidden="true" />
          <span className="sr-only">{language === 'ar' ? 'جارٍ تحميل أنظمة المهمة' : 'Loading mission systems'}</span>
        </div>
      }>
        {started ? <GameScreen state={gameState} /> : <StartScreen />}
      </Suspense>}
      {restoreError ? <p className="mission-restore-error" role="alert">{restoreError}</p> : null}
      {routeTransition ? (
        <div className={`cinematic-route-transition is-${routeTransition}`} aria-hidden="true">
          <span className="cinematic-route-stars" />
          <span className="cinematic-route-streaks" />
          <span className="cinematic-route-atmosphere" />
          <span className="cinematic-route-vehicle"><Rocket size={46} strokeWidth={1.35} /></span>
          <span className="cinematic-route-flare" />
        </div>
      ) : null}
      <span className="sr-only">{t.title}</span>
    </div>
  )
}
