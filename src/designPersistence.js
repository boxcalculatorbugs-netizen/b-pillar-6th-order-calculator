import { exportDesign, applyDesign, validateDesign } from './designIO.js'
import { STARTUP_PRESET_VERSION } from './presets.js'

export const AUTOSAVE_STORAGE_KEY = 'b-pillar-design-autosave'
export const PRESET_VERSION_KEY = 'b-pillar-preset-version'
export const BETA_BANNER_DISMISSED_KEY = 'betaBannerDismissed'

let persistencePaused = false
let autosaveTimer = null

export function pausePersistence() {
  persistencePaused = true
}

export function resumePersistence() {
  persistencePaused = false
}

export function saveStateToLocalStorage(state) {
  if (persistencePaused) return false
  try {
    const data = exportDesign(state)
    localStorage.setItem(AUTOSAVE_STORAGE_KEY, JSON.stringify(data))
    return true
  } catch {
    return false
  }
}

export function clearAutoSave() {
  try {
    localStorage.removeItem(AUTOSAVE_STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

export function loadStateFromLocalStorage(state) {
  try {
    const raw = localStorage.getItem(AUTOSAVE_STORAGE_KEY)
    if (!raw) return { ok: false, source: null }

    const data = JSON.parse(raw)
    if (!validateDesign(data)) {
      return { ok: false, source: 'localStorage', error: 'Auto-save data invalid — using defaults.' }
    }
    applyDesign(data, state)
    return { ok: true, source: 'localStorage' }
  } catch {
    return { ok: false, source: 'localStorage', error: 'Could not restore auto-save.' }
  }
}

export function getStoredPresetVersion() {
  try {
    return parseInt(localStorage.getItem(PRESET_VERSION_KEY) || '0', 10) || 0
  } catch {
    return 0
  }
}

export function markPresetVersionCurrent() {
  try {
    localStorage.setItem(PRESET_VERSION_KEY, String(STARTUP_PRESET_VERSION))
  } catch {
    /* ignore */
  }
}

export function bootstrapDesignState(state, applyPreset) {
  pausePersistence()
  const presetStale = getStoredPresetVersion() < STARTUP_PRESET_VERSION
  let lsResult = { ok: false, source: null }

  if (presetStale) {
    clearAutoSave()
    if (applyPreset) applyPreset()
    markPresetVersionCurrent()
    lsResult = { ok: false, source: null, presetUpgrade: true }
  } else {
    lsResult = loadStateFromLocalStorage(state)
    if (!lsResult.ok && applyPreset) {
      applyPreset()
    }
  }

  resumePersistence()
  return { lsResult }
}

export function debouncedAutoSave(state, delay = 400) {
  if (persistencePaused) return
  clearTimeout(autosaveTimer)
  autosaveTimer = setTimeout(() => saveStateToLocalStorage(state), delay)
}

export function isBetaBannerDismissed() {
  try {
    return localStorage.getItem(BETA_BANNER_DISMISSED_KEY) === '1'
  } catch {
    return false
  }
}

export function dismissBetaBanner() {
  try {
    localStorage.setItem(BETA_BANNER_DISMISSED_KEY, '1')
  } catch {
    /* ignore */
  }
}

export function showBetaBanner() {
  try {
    localStorage.removeItem(BETA_BANNER_DISMISSED_KEY)
  } catch {
    /* ignore */
  }
  const banner = document.getElementById('betaBanner')
  if (banner) banner.hidden = false
}
