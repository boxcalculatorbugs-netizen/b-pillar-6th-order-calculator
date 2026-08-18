import { clamp, MPS_TO_INPS } from './constants.js'

const V_MAX_MPS = 25

export function litersToCuFt(liters) {
  return liters / 28.3168
}

export function cuFtToLiters(cuFt) {
  return cuFt * 28.3168
}

export function sqCmToSqIn(sqCm) {
  return sqCm / 6.4516
}

export function hasTsParams(ts) {
  return Boolean(ts?.Fs && ts?.Qts && ts?.Vas && ts?.Sd)
}

export function evaluateDriverSuitability(ts, orderType = 'series') {
  const hasCore =
    orderType === 'fourth'
      ? Boolean(ts?.Fs && ts?.Qts && ts?.Vas)
      : hasTsParams(ts)
  if (!hasCore) {
    return { score: null, verdict: 'Enter T/S parameters for suitability analysis.', level: 'neutral' }
  }

  const fsQes = ts.Qes ? ts.Fs / ts.Qes : 0
  let score = 0
  const notes = []
  const enclosureLabel =
    orderType === 'ported' ? 'ported' : orderType === 'fourth' ? '4th order' : '6th order'

  if (fsQes >= 50) {
    score += 50
    notes.push(`Fs/Qes = ${fsQes.toFixed(1)} (good for ${enclosureLabel})`)
  } else if (fsQes >= 45) {
    score += 30
    notes.push(`Fs/Qes = ${fsQes.toFixed(1)} (marginal)`)
  } else {
    score += orderType === 'ported' ? 20 : 10
    notes.push(`Fs/Qes = ${fsQes.toFixed(1)} (below 45 — consider ported or higher tuning)`)
  }

  if (ts.Qts < 0.45) {
    score += 50
    notes.push(`Qts = ${ts.Qts.toFixed(3)} (ideal)`)
  } else if (ts.Qts <= 0.55) {
    score += 30
    notes.push(`Qts = ${ts.Qts.toFixed(3)} (may work with careful tuning)`)
  } else {
    score += orderType === 'ported' ? 25 : 10
    notes.push(`Qts = ${ts.Qts.toFixed(3)} (high — usually favors ported/4th order)`)
  }

  let verdict =
    orderType === 'ported'
      ? 'Poor candidate for ported enclosure.'
      : `Poor candidate for ${enclosureLabel} bandpass.`
  let level = 'red'
  if (score >= 80) {
    verdict =
      orderType === 'ported'
        ? 'Excellent ported enclosure candidate.'
        : `Excellent ${enclosureLabel} candidate.`
    level = 'green'
  } else if (score >= 60) {
    verdict =
      orderType === 'ported'
        ? 'Acceptable ported candidate — verify in modeling software.'
        : `Acceptable ${enclosureLabel} candidate — verify in modeling software.`
    level = 'amber'
  }

  return { score, verdict, level, notes, fsQes }
}

export function estimateDriverDisplacementCuFt(ts) {
  if (ts.Vd && ts.Vd > 0) {
    return ts.Vd / 1728
  }
  if (ts.Sd && ts.Xmax) {
    const vdCuIn = ts.Sd * (ts.Xmax / 1000)
    return vdCuIn / 1728
  }
  return 0
}

export function minPortAreaFromVelocity(sdSqIn, xmaxMm, freqHz, vMaxMps = V_MAX_MPS) {
  if (!sdSqIn || !xmaxMm || !freqHz) return 0
  const vMaxInPs = vMaxMps * MPS_TO_INPS
  const peakLinearVel = sdSqIn * (xmaxMm / 1000) * 2 * Math.PI * freqHz
  return peakLinearVel / vMaxInPs
}

export function getTsSuggestions(ts) {
  if (!ts?.Fs || !ts?.Vas) return null

  const vasCuFt = ts.VasUnit === 'liters' ? litersToCuFt(ts.Vas) : ts.Vas
  const sdSqIn = ts.Sd ? (ts.SdUnit === 'sqcm' ? sqCmToSqIn(ts.Sd) : ts.Sd) : 0
  const xmax = ts.Xmax || 0

  const vb1 = vasCuFt * 1.8
  const vb2 = vasCuFt * 1.2
  const fb1 = clamp(ts.Fs * 0.9, 20, 35)
  const fb2 = clamp(ts.Fs * 2.0, 45, 65)

  const minPort1 = minPortAreaFromVelocity(sdSqIn, xmax, fb1)
  const minPort2 = minPortAreaFromVelocity(sdSqIn, xmax, fb2)
  const portArea1 = sdSqIn > 0 ? Math.max(minPort1, sdSqIn * 0.14) : 0
  const portArea2 = sdSqIn > 0 ? Math.max(minPort2, sdSqIn * 0.14) : 0

  return {
    vb1CuFt: vb1,
    vb2CuFt: vb2,
    fb1Hz: fb1,
    fb2Hz: fb2,
    portArea1SqIn: portArea1,
    portArea2SqIn: portArea2,
    hasPortSuggestions: sdSqIn > 0,
    driverDisplacementCuFt: estimateDriverDisplacementCuFt({ ...ts, Sd: sdSqIn })
  }
}

export function getTsWarnings(ts, fb1, fb2) {
  const warnings = []
  if (!hasTsParams(ts)) return warnings

  if (fb1 && ts.Fs && fb1 < ts.Fs * 0.7) {
    warnings.push({
      level: 'red',
      message: `Fb1 (${fb1} Hz) is below 0.7×Fs (${(ts.Fs * 0.7).toFixed(1)} Hz) — unloading risk.`
    })
  }

  if (fb2 && ts.Fs && fb2 > ts.Fs * 3) {
    warnings.push({
      level: 'amber',
      message: `Fb2 (${fb2} Hz) is above 3×Fs (${(ts.Fs * 3).toFixed(0)} Hz) — response may be narrow/peaky.`
    })
  }

  return warnings
}
