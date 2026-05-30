/**
 * Realistic series 6th-order wall example — dual 18", slot ports, musical/SPL-friendly spread.
 * Rear ~3.25 cu ft @ 32 Hz (internal slot into front); front ~5.75 cu ft @ 48 Hz (external slot to cabin).
 * Volume ratio ~1.77:1; tuning spread ~0.58 oct (not a textbook 2:1 octave) — typical street build starting point.
 */
export const SERIES_STARTUP_PRESET = {
  orderType: 'series',
  cabinLength: 115,
  cabinVolume: 75,
  doorsOpen: false,
  maxDepth: 26,
  maxHeight: 15,
  maxWidth: 54,
  wallThickness: 1.5,
  bracingPercent: 12,
  bracingEnabled: true,
  tolerancePercent: 8,
  toleranceEnabled: true,
  driverSize: 18,
  driverCount: 2,
  fb1: 32,
  vb1Basis: 'net',
  vb1: 3.25,
  port1Mode: 'slot',
  port1SlotW: 14,
  port1SlotH: 2.75,
  port1Wall: 0.75,
  port1CommonWalls: 2,
  fb2: 48,
  vb2Basis: 'net',
  vb2: 5.75,
  port2Mode: 'slot',
  port2SlotW: 22,
  port2SlotH: 4,
  port2Wall: 0.75,
  port2CommonWalls: 0,
  tsFs: 32,
  tsQts: 0.38,
  tsVas: 4.5,
  tsXmax: 18
}

export function applyStartupPreset() {
  const p = SERIES_STARTUP_PRESET
  const set = (id, value) => {
    const el = document.getElementById(id)
    if (el) el.value = value
  }
  const setCheck = (id, checked) => {
    const el = document.getElementById(id)
    if (el) el.checked = checked
  }

  set('orderType', p.orderType)
  set('cabinLength', p.cabinLength)
  set('cabinVolume', p.cabinVolume)
  setCheck('doorsOpen', p.doorsOpen)
  set('maxDepth', p.maxDepth)
  set('maxHeight', p.maxHeight)
  set('maxWidth', p.maxWidth)
  set('wallThickness', p.wallThickness)
  setCheck('bracingEnabled', p.bracingEnabled)
  set('bracingPercent', p.bracingPercent)
  setCheck('toleranceEnabled', p.toleranceEnabled)
  set('tolerancePercent', p.tolerancePercent)
  set('driverSize', p.driverSize)
  set('driverCount', p.driverCount)
  set('vb1Basis', p.vb1Basis)
  set('fb1', p.fb1)
  set('vb1', p.vb1)
  set('port1Mode', p.port1Mode)
  set('port1SlotW', p.port1SlotW)
  set('port1SlotH', p.port1SlotH)
  set('port1Wall', p.port1Wall)
  set('port1CommonWalls', p.port1CommonWalls)
  set('vb2Basis', p.vb2Basis)
  set('fb2', p.fb2)
  set('vb2', p.vb2)
  set('port2Mode', p.port2Mode)
  set('port2SlotW', p.port2SlotW)
  set('port2SlotH', p.port2SlotH)
  set('port2Wall', p.port2Wall)
  set('port2CommonWalls', p.port2CommonWalls)
  if (p.tsFs != null) set('tsFs', p.tsFs)
  if (p.tsQts != null) set('tsQts', p.tsQts)
  if (p.tsVas != null) set('tsVas', p.tsVas)
  if (p.tsXmax != null) set('tsXmax', p.tsXmax)
}
