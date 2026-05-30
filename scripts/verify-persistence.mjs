/**
 * Persistence encode/decode checks (Node — polyfills btoa/atob).
 */
import {
  encodeDesignToUrlState,
  decodeDesignFromUrlState,
  MAX_URL_STATE_CHARS
} from '../src/designPersistence.js'
import { validateDesign, DESIGN_APP_ID } from '../src/designIO.js'

if (typeof globalThis.btoa === 'undefined') {
  globalThis.btoa = (str) => Buffer.from(str, 'binary').toString('base64')
  globalThis.atob = (str) => Buffer.from(str, 'base64').toString('binary')
}

if (typeof globalThis.TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = await import('util')
  globalThis.TextEncoder = TextEncoder
  globalThis.TextDecoder = TextDecoder
}

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
    cabinVolume: '80',
    fb1: '30',
    vb1: '2',
    fb2: '60',
    vb2: '4'
  }
}

if (!validateDesign(sampleDesign)) {
  throw new Error('Sample design should validate')
}

const encoded = encodeDesignToUrlState(sampleDesign)
const decoded = decodeDesignFromUrlState(encoded)

if (decoded.fields.orderType !== 'series') {
  throw new Error('URL state round-trip lost orderType')
}
if (decoded.fields.cabinVolume !== '80') {
  throw new Error('URL state round-trip lost cabinVolume')
}

if (encoded.includes('+') || encoded.includes('/') || encoded.includes('=')) {
  throw new Error('URL state should be base64url without + / = padding')
}

const autosavePayload = JSON.stringify(sampleDesign)
const reparsed = JSON.parse(autosavePayload)
if (!validateDesign(reparsed)) {
  throw new Error('Auto-save JSON payload should validate')
}

if (MAX_URL_STATE_CHARS !== 1800) {
  throw new Error('MAX_URL_STATE_CHARS should be 1800')
}

console.log('All persistence verification checks passed.')
console.log(`  URL state length (sample): ${encoded.length} chars`)
