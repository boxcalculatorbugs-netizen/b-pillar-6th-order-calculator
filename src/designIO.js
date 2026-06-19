export const DESIGN_FILE_VERSION = 1
export const DESIGN_APP_ID = 'b-pillar-6th-order-calculator'

/** Raw form field IDs saved as-is (display units preserved). */
export const DESIGN_TEXT_IDS = [
  'orderType',
  'cabinLength',
  'cabinVolume',
  'doorWidth',
  'doorHeight',
  'doorJambThickness',
  'cabinLeakageArea',
  'maxDepth',
  'maxHeight',
  'maxWidth',
  'wallThickness',
  'baffleThickness',
  'portThickness',
  'driverSize',
  'driverCount',
  'tsFs',
  'tsQts',
  'tsQes',
  'tsVas',
  'tsVasUnit',
  'tsSd',
  'tsSdUnit',
  'tsRe',
  'tsXmax',
  'tsPe',
  'tsVd',
  'fb1',
  'vb1Basis',
  'vb1',
  'vb1Gross',
  'vb1Len',
  'vb1Width',
  'vb1Height',
  'vb1Extra',
  'port1Mode',
  'port1Area',
  'port1Diam',
  'port1Length',
  'port1SlotW',
  'port1SlotH',
  'port1Wall',
  'port1CommonWalls',
  'fb2',
  'vb2Basis',
  'vb2',
  'vb2Gross',
  'vb2Len',
  'vb2Width',
  'vb2Height',
  'vb2Extra',
  'port2Mode',
  'port2Area',
  'port2Diam',
  'port2Length',
  'port2SlotW',
  'port2SlotH',
  'port2Wall',
  'port2CommonWalls'
]

export const DESIGN_CHECKBOX_IDS = [
  'includeCabin',
  'doorsOpen',
  'cabinSealed',
  'vb1Outer',
  'vb2Outer'
]

export const DESIGN_UNIT_IDS = ['volumeUnit', 'lengthUnit', 'areaUnit']

export function exportDesign(state) {
  const fields = {}
  DESIGN_TEXT_IDS.forEach((id) => {
    const el = document.getElementById(id)
    if (el && el.value !== undefined && el.value !== '') {
      fields[id] = el.value
    } else if (el) {
      fields[id] = el.value
    }
  })
  DESIGN_CHECKBOX_IDS.forEach((id) => {
    const el = document.getElementById(id)
    if (el) fields[id] = el.checked
  })

  const units = {}
  DESIGN_UNIT_IDS.forEach((id) => {
    const el = document.getElementById(id)
    if (el) units[id.replace('Unit', '')] = el.value
  })

  fields.port1Style = document.getElementById('port1Mode')?.value === 'slot' ? 'rect_slot' : 'round_aero'
  fields.port2Style = document.getElementById('port2Mode')?.value === 'slot' ? 'rect_slot' : 'round_aero'

  return {
    app: DESIGN_APP_ID,
    version: DESIGN_FILE_VERSION,
    savedAt: new Date().toISOString(),
    units: {
      volume: units.volume || state.volumeUnit || 'cuft',
      length: units.length || state.lengthUnit || 'in',
      area: units.area || state.areaUnit || 'sqin'
    },
    calcMode: state.calcMode || 'helmholtz',
    doorTuningExperimental: Boolean(state.doorTuningExperimental),
    fields
  }
}

export function validateDesign(data) {
  if (!data || typeof data !== 'object') return false
  if (data.app && data.app !== DESIGN_APP_ID) return false
  if (!data.fields || typeof data.fields !== 'object') return false
  return true
}

/** Map 1.0.12 "dimensions" saves back to slot fields. */
function migratePortFields(fields) {
  ;[1, 2].forEach((ch) => {
    if (fields[`port${ch}Mode`] !== 'dimensions') return
    fields[`port${ch}Mode`] = 'slot'
    const w = parseFloat(fields[`port${ch}Width`])
    const h = parseFloat(fields[`port${ch}Height`])
    if (Number.isFinite(w)) fields[`port${ch}SlotW`] = w
    if (Number.isFinite(h)) fields[`port${ch}SlotH`] = h
    if (fields[`port${ch}Wall`] === undefined) fields[`port${ch}Wall`] = '0'
  })
}

/** Migrate legacy portStyleMode / per-chamber style to port input mode. */
function migratePortStyleFields(fields, data) {
  const legacy = data.portStyleMode
  ;[1, 2].forEach((ch) => {
    const style = fields[`port${ch}Style`] ?? legacy
    if (style === 'rect_slot' && fields[`port${ch}Mode`] !== 'slot') {
      fields[`port${ch}Mode`] = 'slot'
    }
  })
}

export function applyDesign(data, state) {
  if (!validateDesign(data)) {
    throw new Error('Invalid design file')
  }

  migratePortFields(data.fields)
  migratePortStyleFields(data.fields, data)

  state.calcMode = data.calcMode || 'helmholtz'
  if (data.doorTuningExperimental !== undefined) {
    state.doorTuningExperimental = Boolean(data.doorTuningExperimental)
  }

  if (data.units) {
    state.volumeUnit = data.units.volume || 'cuft'
    state.lengthUnit = data.units.length || 'in'
    state.areaUnit = data.units.area || 'sqin'
    const volEl = document.getElementById('volumeUnit')
    const lenEl = document.getElementById('lengthUnit')
    const areaEl = document.getElementById('areaUnit')
    if (volEl) volEl.value = state.volumeUnit
    if (lenEl) lenEl.value = state.lengthUnit
    if (areaEl) areaEl.value = state.areaUnit
  }

  DESIGN_TEXT_IDS.forEach((id) => {
    if (data.fields[id] === undefined) return
    const el = document.getElementById(id)
    if (el) el.value = data.fields[id]
  })

  DESIGN_CHECKBOX_IDS.forEach((id) => {
    if (data.fields[id] === undefined) return
    const el = document.getElementById(id)
    if (el) el.checked = Boolean(data.fields[id])
  })
}

export function applyClearDesign(state) {
  const TS_EMPTY_IDS = new Set([
    'tsFs', 'tsQts', 'tsQes', 'tsVas', 'tsSd', 'tsRe', 'tsXmax', 'tsPe', 'tsVd'
  ])

  state.volumeUnit = 'cuft'
  state.lengthUnit = 'in'
  state.areaUnit = 'sqin'
  state.calcMode = 'helmholtz'

  const set = (id, value) => {
    const el = document.getElementById(id)
    if (el) el.value = value
  }
  const setCheck = (id, checked) => {
    const el = document.getElementById(id)
    if (el) el.checked = checked
  }

  set('volumeUnit', 'cuft')
  set('lengthUnit', 'in')
  set('areaUnit', 'sqin')

  DESIGN_TEXT_IDS.forEach((id) => {
    const el = document.getElementById(id)
    if (!el) return
    if (TS_EMPTY_IDS.has(id)) {
      el.value = ''
    } else if (el.tagName === 'SELECT') {
      if (id === 'orderType') el.value = 'parallel'
      else if (id.includes('Basis')) el.value = 'net'
      else if (id.includes('Mode') && id.startsWith('port')) el.value = 'area'
      else if (id === 'tsVasUnit') el.value = 'cuft'
      else if (id === 'tsSdUnit') el.value = 'sqin'
    } else {
      el.value = ''
    }
  })

  DESIGN_CHECKBOX_IDS.forEach((id) => setCheck(id, id === 'includeCabin'))
}

export function downloadDesignJson(jsonString, filename = '6th-order-design.json') {
  const blob = new Blob([jsonString], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export async function saveDesignToFile(jsonString) {
  if (window.electronAPI?.saveDesignFile) {
    return window.electronAPI.saveDesignFile(jsonString)
  }
  downloadDesignJson(jsonString)
  return { ok: true, filePath: null, browser: true }
}

export async function loadDesignFromFile() {
  if (window.electronAPI?.loadDesignFile) {
    return window.electronAPI.loadDesignFile()
  }
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json,application/json'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) {
        resolve({ ok: false })
        return
      }
      try {
        const content = await file.text()
        resolve({ ok: true, content, filePath: file.name, browser: true })
      } catch {
        resolve({ ok: false, error: 'Could not read file' })
      }
    }
    input.click()
  })
}
