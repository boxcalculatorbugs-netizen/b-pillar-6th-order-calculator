export const THEME_IDS = {
  MIDNIGHT: 'midnight',
  CARBON: 'carbon',
  OCEAN: 'ocean',
  FOREST: 'forest',
  SLATE: 'slate'
}

export const THEMES = [
  { id: THEME_IDS.MIDNIGHT, label: 'Midnight (default)' },
  { id: THEME_IDS.CARBON, label: 'Carbon' },
  { id: THEME_IDS.OCEAN, label: 'Ocean' },
  { id: THEME_IDS.FOREST, label: 'Forest' },
  { id: THEME_IDS.SLATE, label: 'Slate Light' }
]

const STORAGE_KEY = 'sixthCalcColorTheme'

export function themeLabel(id) {
  return THEMES.find((t) => t.id === id)?.label ?? 'Midnight'
}

export function loadSavedTheme() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved && THEMES.some((t) => t.id === saved)) return saved
  } catch {
    /* ignore */
  }
  return THEME_IDS.MIDNIGHT
}

export function applyTheme(themeId) {
  const id = THEMES.some((t) => t.id === themeId) ? themeId : THEME_IDS.MIDNIGHT
  document.documentElement.dataset.theme = id
  try {
    localStorage.setItem(STORAGE_KEY, id)
  } catch {
    /* ignore */
  }
  return id
}

export function readThemeColors() {
  const style = getComputedStyle(document.documentElement)
  const pick = (name) => style.getPropertyValue(name).trim()
  return {
    muted: pick('--muted'),
    text: pick('--text'),
    accent: pick('--accent'),
    green: pick('--green'),
    amber: pick('--amber'),
    red: pick('--red'),
    chartGrid: pick('--chart-grid')
  }
}
