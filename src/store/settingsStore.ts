import { create } from 'zustand'

export type Language = 'ar' | 'en'
const KEY = 'little-orbit-language'
const SOUND_KEY = 'little-orbit-sound-enabled'
const ROBOT_NAME_KEY = 'astra-one-robot-name'
const ROBOT_STYLE_KEY = 'astra-one-robot-style'
const ROBOT_STYLES = ['🤖', '🛰️', '🧠', '👾'] as const

interface SettingsState {
  language: Language
  soundEnabled: boolean
  robotName: string
  robotStyle: typeof ROBOT_STYLES[number]
  setLanguage: (language: Language) => void
  setSoundEnabled: (enabled: boolean) => void
  setRobotName: (name: string) => void
  setRobotStyle: (style: string) => void
}

function readLanguage(): Language {
  try {
    return localStorage.getItem(KEY) === 'en' ? 'en' : 'ar'
  } catch (error) {
    console.error('Could not read language preference.', error)
    return 'ar'
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

function readRobotName(): string {
  try {
    return localStorage.getItem(ROBOT_NAME_KEY) || 'Astra'
  } catch (error) {
    console.error('Could not read assistant name preference.', error)
    return 'Astra'
  }
}

function readRobotStyle(): typeof ROBOT_STYLES[number] {
  try {
    const style = localStorage.getItem(ROBOT_STYLE_KEY)
    return ROBOT_STYLES.find((item) => item === style) || ROBOT_STYLES[0]
  } catch (error) {
    console.error('Could not read assistant appearance preference.', error)
    return ROBOT_STYLES[0]
  }
}

export const useSettingsStore = create<SettingsState>((set) => ({
  language: readLanguage(),
  soundEnabled: readSoundEnabled(),
  robotName: readRobotName(),
  robotStyle: readRobotStyle(),
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
  setRobotName: (robotName) => {
    const normalized = robotName.slice(0, 24)
    try {
      localStorage.setItem(ROBOT_NAME_KEY, normalized)
    } catch (error) {
      console.error('Could not save assistant name preference.', error)
    }
    set({ robotName: normalized })
  },
  setRobotStyle: (style) => {
    const robotStyle = ROBOT_STYLES.find((item) => item === style)
    if (!robotStyle) {
      console.error('Rejected invalid assistant appearance preference.')
      return
    }
    try {
      localStorage.setItem(ROBOT_STYLE_KEY, robotStyle)
    } catch (error) {
      console.error('Could not save assistant appearance preference.', error)
    }
    set({ robotStyle })
  },
}))
