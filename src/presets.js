/**
 * Series 6th-order wall example — dual 18", 10 cu ft rear @ 25 Hz, 20 cu ft front (slot ports).
 * 2:1 volume ratio; rear tuned low; front 60 Hz external slot to cabin.
 */
export const STARTUP_PRESET_VERSION = 2

export const SERIES_STARTUP_PRESET = {
  orderType: 'series',
  cabinLength: 115,
  cabinVolume: 75,
  doorsOpen: false,
  maxDepth: 32,
  maxHeight: 16,
  maxWidth: 58,
  wallThickness: 1.5,
  bracingPercent: 12,
  bracingEnabled: true,
  tolerancePercent: 8,
  toleranceEnabled: true,
  driverSize: 18,
  driverCount: 2,
  fb1: 25,
  vb1Basis: 'net',
  vb1: 10,
  port1Mode: 'slot',
  port1SlotW: 18,
  port1SlotH: 3.5,
  port1Wall: 0.75,
  port1CommonWalls: 2,
  fb2: 60,
  vb2Basis: 'net',
  vb2: 20,
  port2Mode: 'slot',
  port2SlotW: 28,
  port2SlotH: 5,
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
  set('port1Length', '')
  set('vb2Basis', p.vb2Basis)
  set('fb2', p.fb2)
  set('vb2', p.vb2)
  set('port2Mode', p.port2Mode)
  set('port2SlotW', p.port2SlotW)
  set('port2SlotH', p.port2SlotH)
  set('port2Wall', p.port2Wall)
  set('port2CommonWalls', p.port2CommonWalls)
  set('port2Length', '')
  if (p.tsFs != null) set('tsFs', p.tsFs)
  if (p.tsQts != null) set('tsQts', p.tsQts)
  if (p.tsVas != null) set('tsVas', p.tsVas)
  if (p.tsXmax != null) set('tsXmax', p.tsXmax)
}
