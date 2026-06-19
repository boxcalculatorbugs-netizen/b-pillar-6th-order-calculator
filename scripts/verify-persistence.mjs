/**
 * Auto-save design JSON validation checks.
 */
import { validateDesign, DESIGN_APP_ID } from '../src/designIO.js'

const sampleDesign = {
  app: DESIGN_APP_ID,
  version: 1,
  savedAt: new Date().toISOString(),
  units: { volume: 'cuft', length: 'in', area: 'sqin' },
  calcMode: 'helmholtz',
  doorTuningExperimental: false,
  fields: {
    orderType: 'series',
    cabinLength: '120',
    vehicleInteriorVolume: '80',
    ampRackVolume: '0',
    fb1: '25',
    vb1: '10',
    fb2: '60',
    vb2: '20'
  }
}

if (!validateDesign(sampleDesign)) {
  throw new Error('Sample design should validate')
}

const autosavePayload = JSON.stringify(sampleDesign)
const reparsed = JSON.parse(autosavePayload)
if (!validateDesign(reparsed)) {
  throw new Error('Auto-save JSON payload should validate')
}

if (reparsed.fields.vb1 !== '10' || reparsed.fields.vb2 !== '20') {
  throw new Error('Auto-save round-trip lost chamber volumes')
}

console.log('All persistence verification checks passed.')
