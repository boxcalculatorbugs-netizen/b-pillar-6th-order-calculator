/** Traditional series 6th default — single source of truth for startup preset */
export const SERIES_STARTUP_PRESET = {
  orderType: 'series',
  cabinLength: 120,
  cabinVolume: 80,
  doorsOpen: false,
  maxDepth: 18,
  maxHeight: 14,
  maxWidth: 52,
  wallThickness: 1.5,
  bracingPercent: 15,
  bracingEnabled: true,
  tolerancePercent: 10,
  toleranceEnabled: true,
  driverSize: 15,
  driverCount: 2,
  fb1: 30,
  vb1Basis: 'net',
  vb1: 2.0,
  port1Mode: 'area',
  port1Area: 22,
  fb2: 60,
  vb2Basis: 'net',
  vb2: 4.0,
  port2Mode: 'area',
  port2Area: 30
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
  set('port1Area', p.port1Area)
  set('vb2Basis', p.vb2Basis)
  set('fb2', p.fb2)
  set('vb2', p.vb2)
  set('port2Mode', p.port2Mode)
  set('port2Area', p.port2Area)
}
