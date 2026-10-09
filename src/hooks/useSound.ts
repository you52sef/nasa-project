import { useCallback } from 'react'
import { useSettingsStore } from '../store/settingsStore'
import type { ScenarioId } from '../game/scenarios'

type Note = { frequency: number; duration: number; type?: OscillatorType; volume?: number; endFrequency?: number }

let sharedContext: AudioContext | null = null

function playNotes(notes: Note[]): void {
  if (typeof window === 'undefined' || !window.AudioContext) return
  sharedContext ??= new AudioContext()
  const context = sharedContext
  if (context.state === 'suspended') void context.resume()
  const startAt = context.currentTime + 0.02

  notes.forEach(({ frequency, duration, type = 'sine', volume = 0.12, endFrequency }, index) => {
    const start = startAt + notes.slice(0, index).reduce((total, note) => total + note.duration * 0.72, 0)
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.type = type
    oscillator.frequency.setValueAtTime(frequency, start)
    if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(endFrequency, start + duration)
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.025)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
    oscillator.connect(gain)
    gain.connect(context.destination)
    oscillator.start(start)
    oscillator.stop(start + duration + 0.02)
  })
}

export function useSound() {
  const soundEnabled = useSettingsStore((state) => state.soundEnabled)
  const setSoundEnabled = useSettingsStore((state) => state.setSoundEnabled)

  const play = useCallback((notes: Note[]) => {
    if (useSettingsStore.getState().soundEnabled) playNotes(notes)
  }, [])
  const playSuccess = useCallback(() => play([
    { frequency: 660, duration: 0.12 },
    { frequency: 880, duration: 0.18 },
  ]), [play])
  const playError = useCallback(() => play([
    { frequency: 260, duration: 0.18, type: 'triangle' },
    { frequency: 190, duration: 0.24, type: 'triangle' },
  ]), [play])
  const playEvent = useCallback(() => play([
    { frequency: 740, duration: 0.11, type: 'square', volume: 0.07 },
    { frequency: 520, duration: 0.11, type: 'square', volume: 0.07 },
    { frequency: 740, duration: 0.16, type: 'square', volume: 0.07 },
  ]), [play])
  const playWin = useCallback(() => play([
    { frequency: 523, duration: 0.2 },
    { frequency: 659, duration: 0.2 },
    { frequency: 784, duration: 0.2 },
    { frequency: 1047, duration: 0.45 },
  ]), [play])
  const playLose = useCallback(() => play([
    { frequency: 392, duration: 0.3, type: 'triangle' },
    { frequency: 311, duration: 0.34, type: 'triangle' },
    { frequency: 233, duration: 0.58, type: 'triangle' },
  ]), [play])
  const playClick = useCallback(() => play([
    { frequency: 540, duration: 0.055, volume: 0.055 },
  ]), [play])
  const playScenario = useCallback((scenario: ScenarioId) => {
    const cues: Record<ScenarioId, Note[]> = {
      baseline: [
        { frequency: 440, duration: 0.12 },
        { frequency: 587, duration: 0.16 },
      ],
      'dust-front': [
        { frequency: 310, duration: 0.2, type: 'triangle', volume: 0.1, endFrequency: 220 },
        { frequency: 196, duration: 0.18, type: 'triangle', volume: 0.08 },
      ],
      'water-rationing': [
        { frequency: 523, duration: 0.12, type: 'sine', volume: 0.08 },
        { frequency: 392, duration: 0.15, type: 'sine', volume: 0.08 },
        { frequency: 523, duration: 0.12, type: 'sine', volume: 0.08 },
      ],
      'oxygen-shortage': [
        { frequency: 740, duration: 0.1, type: 'square', volume: 0.045 },
        { frequency: 620, duration: 0.1, type: 'square', volume: 0.045 },
        { frequency: 740, duration: 0.16, type: 'square', volume: 0.045 },
      ],
    }
    play(cues[scenario])
  }, [play])
  const playLaunch = useCallback((scenario: ScenarioId) => {
    const scenarioTone: Record<ScenarioId, number> = {
      baseline: 392,
      'dust-front': 293.66,
      'water-rationing': 349.23,
      'oxygen-shortage': 440,
    }
    play([
      { frequency: 72, endFrequency: 118, duration: 1.35, type: 'sawtooth', volume: 0.045 },
      { frequency: scenarioTone[scenario], duration: 0.16, type: 'triangle', volume: 0.09 },
      { frequency: scenarioTone[scenario] * 1.25, duration: 0.2, type: 'triangle', volume: 0.08 },
      { frequency: 110, endFrequency: 58, duration: 1.15, type: 'triangle', volume: 0.07 },
    ])
  }, [play])

  return {
    soundEnabled,
    toggleSound: () => setSoundEnabled(!soundEnabled),
    playSuccess,
    playError,
    playEvent,
    playWin,
    playLose,
    playClick,
    playScenario,
    playLaunch,
  }
}
