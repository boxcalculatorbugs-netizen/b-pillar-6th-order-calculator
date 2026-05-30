import { exportDesign, applyDesign, validateDesign } from './designIO.js'

export const AUTOSAVE_STORAGE_KEY = 'b-pillar-design-autosave'
export const BETA_BANNER_DISMISSED_KEY = 'betaBannerDismissed'
export const URL_STATE_PARAM = 'state'
export const MAX_URL_STATE_CHARS = 1800

let persistencePaused = false
let autosaveTimer = null

export function encodeDesignToUrlState(data) {
  const json = JSON.stringify(data)
  const bytes = new TextEncoder().encode(json)
  let binary = ''
  bytes.forEach((b) => {
    binary += String.fromCharCode(b)
  })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function decodeDesignFromUrlState(encoded) {
  let b64 = encoded.replace(/-/g, '+').replace(/_/g, '/')
  while (b64.length % 4) b64 += '='
  const binary = atob(b64)
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
  const json = new TextDecoder().decode(bytes)
  return JSON.parse(json)
}

export function buildShareUrl(state) {
  const data = exportDesign(state)
  const encoded = encodeDesignToUrlState(data)
  if (encoded.length > MAX_URL_STATE_CHARS) {
    return { ok: false, tooLarge: true, encodedLength: encoded.length }
  }
  const url = new URL(window.location.href)
  url.searchParams.set(URL_STATE_PARAM, encoded)
  return { ok: true, url: url.toString(), encodedLength: encoded.length }
}

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

export function loadStateFromUrl(state) {
  const params = new URLSearchParams(window.location.search)
  const encoded = params.get(URL_STATE_PARAM)
  if (!encoded) return { ok: false, source: null }

  try {
    const data = decodeDesignFromUrlState(encoded)
    if (!validateDesign(data)) {
      return { ok: false, source: 'url', error: 'Invalid share link — design data rejected.' }
    }
    applyDesign(data, state)
    return { ok: true, source: 'url' }
  } catch {
    return { ok: false, source: 'url', error: 'Invalid share link — could not decode state.' }
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

export function bootstrapDesignState(state, applyPreset) {
  pausePersistence()
  const urlResult = loadStateFromUrl(state)
  let lsResult = { ok: false, source: null }

  if (!urlResult.ok) {
    lsResult = loadStateFromLocalStorage(state)
    if (!lsResult.ok && applyPreset) {
      applyPreset()
    }
  }

  resumePersistence()
  return { urlResult, lsResult }
}

export function debouncedAutoSave(state, delay = 400) {
  if (persistencePaused) return
  clearTimeout(autosaveTimer)
  autosaveTimer = setTimeout(() => saveStateToLocalStorage(state), delay)
}

export async function copyShareLinkToClipboard(state) {
  const result = buildShareUrl(state)
  if (!result.ok) return result

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(result.url)
  } else {
    const ta = document.createElement('textarea')
    ta.value = result.url
    ta.style.position = 'fixed'
    ta.style.left = '-9999px'
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
  }

  return result
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
