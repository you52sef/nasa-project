import assert from 'node:assert/strict'
import test from 'node:test'

test('English is used on first visit while an explicit Arabic preference is preserved', async () => {
  const values = new Map<string, string>()
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    },
  })
  const { useSettingsStore } = await import('./settingsStore')

  assert.equal(useSettingsStore.getState().language, 'en')
  useSettingsStore.getState().setLanguage('ar')
  assert.equal(useSettingsStore.getState().language, 'ar')
  assert.equal(values.get('little-orbit-language'), 'ar')
  useSettingsStore.getState().setLanguage('en')
})
