import { create } from 'zustand'

export type Language = 'ar' | 'en'
const KEY = 'little-orbit-language'
const SOUND_KEY = 'little-orbit-sound-enabled'

interface SettingsState {
  language: Language
  soundEnabled: boolean
  setLanguage: (language: Language) => void
  setSoundEnabled: (enabled: boolean) => void
}

function readLanguage(): Language {
  try {
    return localStorage.getItem(KEY) === 'ar' ? 'ar' : 'en'
  } catch (error) {
    console.error('Could not read language preference.', error)
    return 'en'
  }
}

function readSoundEnabled(): boolean {
  try {
    return localStorage.getItem(SOUND_KEY) !== 'false'
  } catch (error) {
    console.error('Could not read sound preference.', error)
    return true
  }
}

export const useSettingsStore = create<SettingsState>((set) => ({
  language: readLanguage(),
  soundEnabled: readSoundEnabled(),
  setLanguage: (language) => {
    try {
      localStorage.setItem(KEY, language)
    } catch (error) {
      console.error('Could not save language preference.', error)
    }
    set({ language })
  },
  setSoundEnabled: (soundEnabled) => {
    try {
      localStorage.setItem(SOUND_KEY, String(soundEnabled))
    } catch (error) {
      console.error('Could not save sound preference.', error)
    }
    set({ soundEnabled })
  },
}))
