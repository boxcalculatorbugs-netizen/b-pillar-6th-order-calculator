import { MPS_TO_INPS } from './constants.js'
import { isFourth, isPorted } from './orderTypes.js'

export function portAirVelocityMps(sdSqIn, xmaxMm, freqHz, portAreaSqIn) {
  if (!sdSqIn || !xmaxMm || !freqHz || !portAreaSqIn || portAreaSqIn <= 0) return 0
  const peakLinearVelInPs = sdSqIn * (xmaxMm / 1000) * 2 * Math.PI * freqHz
  return peakLinearVelInPs / MPS_TO_INPS
}

export function getPortVelocityWarning(velocityMps) {
  if (velocityMps <= 0) return null
  if (velocityMps > 35) {
    return { level: 'red', message: `Port velocity ${velocityMps.toFixed(1)} m/s exceeds 35 m/s — chuffing likely.` }
  }
  if (velocityMps > 25) {
    return { level: 'amber', message: `Port velocity ${velocityMps.toFixed(1)} m/s exceeds 25 m/s — consider larger port area.` }
  }
  return { level: 'green', message: `Port velocity ${velocityMps.toFixed(1)} m/s is within safe range.` }
}

export function estimateExcursionAtFreq(xmaxMm, freqHz, fb1, fb2, fh) {
  if (!xmaxMm || !freqHz || !fb1) {
    return { excursionMm: 0, ratio: 0 }
  }

  const effectiveFb2 = fb2 || fb1
  const center = fh || Math.sqrt(fb1 * effectiveFb2)
  const distFromCenter = Math.abs(Math.log2(freqHz / center))
  const distFromFb1 = Math.abs(Math.log2(freqHz / fb1))
  const distFromFb2 = Math.abs(Math.log2(freqHz / effectiveFb2))
  const minDist = Math.min(distFromCenter, distFromFb1, distFromFb2)

  const multiplier = 0.35 + Math.min(3.5, minDist * 1.8 + (1 / (minDist + 0.15)) * 0.12)
  const excursionMm = xmaxMm * multiplier
  const ratio = excursionMm / xmaxMm

  return { excursionMm, ratio, multiplier }
}

export function getExcursionWarnings(ts, fb1, fb2, orderType = 'series') {
  const warnings = []
  if (!ts?.Xmax || !fb1) return warnings

  const checkFreqs = []
  if (isPorted(orderType)) {
    checkFreqs.push({ label: 'Fb', freq: fb1 })
  } else if (isFourth(orderType)) {
    if (fb2) {
      checkFreqs.push({ label: 'Fb (front)', freq: fb2 })
      checkFreqs.push({ label: 'passband center', freq: fb2 * 0.95 })
    }
  } else {
    const fh = fb2 ? Math.sqrt(fb1 * fb2) : fb1
    checkFreqs.push({ label: 'Fb1', freq: fb1 })
    if (fb2) checkFreqs.push({ label: 'Fb2', freq: fb2 })
    checkFreqs.push({ label: 'passband center', freq: fh })
  }

  for (const { label, freq } of checkFreqs) {
    const { excursionMm, ratio } = estimateExcursionAtFreq(ts.Xmax, freq, fb1, fb2, freq)
    if (ratio > 1.05) {
      warnings.push({
        level: ratio > 1.20 ? 'red' : 'amber',
        message: `Estimated excursion at ${label} (${freq.toFixed(1)} Hz): ${excursionMm.toFixed(1)} mm (${(ratio * 100).toFixed(0)}% of Xmax).`
      })
    }
  }

  return warnings
}

export function analyzeChamberExcursion(ts, fb1, fb2, portArea1, portArea2, orderType = 'series') {
  const sdSqIn = ts?.SdUnit === 'sqcm' ? ts.Sd / 6.4516 : ts?.Sd
  const xmax = ts?.Xmax || 0

  const vel1 = isFourth(orderType) ? 0 : portAirVelocityMps(sdSqIn, xmax, fb1, portArea1)
  const vel2 = isPorted(orderType)
    ? 0
    : portAirVelocityMps(sdSqIn, xmax, isFourth(orderType) ? fb2 : fb2, portArea2)

  const portedVel = isPorted(orderType)
    ? portAirVelocityMps(sdSqIn, xmax, fb1, portArea1)
    : 0

  return {
    chamber1: {
      velocityMps: isPorted(orderType) ? portedVel : vel1,
      velocityWarning: getPortVelocityWarning(isPorted(orderType) ? portedVel : vel1)
    },
    chamber2: {
      velocityMps: isPorted(orderType) ? 0 : vel2,
      velocityWarning: isPorted(orderType) ? null : getPortVelocityWarning(vel2)
    },
    excursionWarnings: getExcursionWarnings(ts, fb1, fb2, orderType)
  }
}
