import { cabinGainCurve } from './cabin.js'
import { isFourth, isPorted } from './orderTypes.js'
import { analyzeFourthOrderRatio } from './fourthOrder.js'

function lorentzianPeak(freq, center, q = 4) {
  const ratio = freq / center
  const bw = 1 / q
  return 1 / (1 + ((ratio - 1 / ratio) / bw) ** 2)
}

export function estimatePassbandCurveSingle(fb, minHz = 20, maxHz = 80, points = 80) {
  const data = []
  const logMin = Math.log10(minHz)
  const logMax = Math.log10(maxHz)

  for (let i = 0; i <= points; i++) {
    const freq = 10 ** (logMin + ((logMax - logMin) * i) / points)
    const peak = lorentzianPeak(freq, fb, 4)
    const db = 20 * Math.log10(Math.max(peak, 0.001))
    data.push({ freq, db })
  }

  return data
}

export function estimatePassbandCurveFourth(fbFront, fbRear, minHz = 20, maxHz = 80, points = 80) {
  const data = []
  const logMin = Math.log10(minHz)
  const logMax = Math.log10(maxHz)
  const rearHint = fbRear > 0 ? fbRear * 1.4 : fbFront * 0.6

  for (let i = 0; i <= points; i++) {
    const freq = 10 ** (logMin + ((logMax - logMin) * i) / points)
    const frontPeak = lorentzianPeak(freq, fbFront, 4)
    const rearShape = lorentzianPeak(freq, rearHint, 2.5) * 0.35
    const combined = frontPeak * 0.92 + rearShape
    const db = 20 * Math.log10(Math.max(combined, 0.001))
    data.push({ freq, db })
  }

  return data
}

export function estimatePassbandCurve(fb1, fb2, minHz = 20, maxHz = 80, points = 80) {
  const data = []
  const logMin = Math.log10(minHz)
  const logMax = Math.log10(maxHz)

  for (let i = 0; i <= points; i++) {
    const freq = 10 ** (logMin + ((logMax - logMin) * i) / points)
    const peak1 = lorentzianPeak(freq, fb1, 3.5)
    const peak2 = lorentzianPeak(freq, fb2, 4)
    const combined = peak1 * 0.85 + peak2 * 1.0
    const db = 20 * Math.log10(Math.max(combined, 0.001))
    data.push({ freq, db })
  }

  return data
}

export function estimateBandwidthSingle(fb, v1 = 1) {
  if (!fb || fb <= 0) return null

  const lowHz = fb * 0.7
  const highHz = fb * 1.3
  const bandwidthHz = Math.max(0, highHz - lowHz)

  return {
    lowHz,
    highHz,
    bandwidthHz,
    octaveSpread: Math.log2(highHz / lowHz),
    volumeRatio: 0,
    warning: `Ported tuning centered at ${fb.toFixed(1)} Hz (single-chamber vented).`,
    level: 'green',
    centerHz: fb
  }
}

export function estimateBandwidthFourth(fbFront, vRear, vFront) {
  if (!fbFront || fbFront <= 0) return null

  const lowHz = fbFront * 0.75
  const highHz = fbFront * 1.2
  const bandwidthHz = Math.max(0, highHz - lowHz)
  const ratioResult = analyzeFourthOrderRatio(vFront, vRear)
  const volumeRatio = ratioResult.volumeRatio

  return {
    lowHz,
    highHz,
    bandwidthHz,
    octaveSpread: Math.log2(highHz / lowHz),
    volumeRatio,
    warning: `4th order passband keyed to front Fb ${fbFront.toFixed(1)} Hz. ${ratioResult.profile}`,
    level: ratioResult.profileLevel,
    centerHz: Math.sqrt(lowHz * highHz),
    profile: ratioResult.profile,
    profileKey: ratioResult.profileKey
  }
}

/**
 * Heuristic passband / bandwidth estimate.
 * 6th: f_low = Fb1 × 0.85, f_high = Fb2 × 1.15
 */
export function estimateBandwidth(f1, f2, v1, v2, orderType = 'series') {
  if (isPorted(orderType)) {
    return estimateBandwidthSingle(f1, v1)
  }
  if (isFourth(orderType)) {
    return estimateBandwidthFourth(f2, v1, v2)
  }

  if (!f1 || !f2 || f1 <= 0 || f2 <= 0) return null

  const lowHz = f1 * 0.85
  const highHz = f2 * 1.15
  const bandwidthHz = Math.max(0, highHz - lowHz)
  const octaveSpread = Math.log2(f2 / f1)
  const volumeRatio = v1 > 0 && v2 > 0 ? v2 / v1 : 0

  let warning = ''
  let level = 'green'

  if (octaveSpread > 2.0) {
    warning = `EXTREME WIDEBAND (${octaveSpread.toFixed(2)} octaves). Expect a "saddle" dip between ${f1} Hz and ${f2} Hz.`
    level = 'red'
  } else if (octaveSpread > 1.2) {
    warning = `Wide passband (${octaveSpread.toFixed(2)} octaves). Good for musical range.`
    level = 'green'
  } else {
    warning = `Narrow passband (${octaveSpread.toFixed(2)} octaves). High peak SPL, very peaky response.`
    level = 'amber'
  }

  return {
    lowHz,
    highHz,
    bandwidthHz,
    octaveSpread,
    volumeRatio,
    warning,
    level,
    centerHz: Math.sqrt(lowHz * highHz)
  }
}

/** @deprecated alias — use estimateBandwidth */
export function estimatePassbandBandwidth(fb1, fb2, v1 = 1, v2 = 1, orderType = 'series') {
  return estimateBandwidth(fb1, fb2, v1, v2, orderType)
}

function buildInCarOverlay(passband, cabinCurve, boxRatio, doorsOpen) {
  const qBump =
    !doorsOpen && boxRatio > 0.15 ? Math.min(3, (boxRatio - 0.15) * 20) : 0

  return passband.map((point, i) => {
    const cabinDb = cabinCurve[i]?.dbBoost || 0
    const adjustedCabin =
      cabinDb + (qBump > 0 && point.freq <= (cabinCurve[i]?.onsetFreqHz || 999) * 1.2 ? qBump : 0)
    return {
      freq: point.freq,
      passbandDb: point.db,
      cabinDb: adjustedCabin,
      inCarDb: point.db + adjustedCabin
    }
  })
}

function passbandForOrderType(orderType, fb1, fb2, minHz, maxHz) {
  if (isPorted(orderType)) {
    return estimatePassbandCurveSingle(fb1, minHz, maxHz)
  }
  if (isFourth(orderType)) {
    return estimatePassbandCurveFourth(fb2, fb1, minHz, maxHz)
  }
  return estimatePassbandCurve(fb1, fb2, minHz, maxHz)
}

export function estimateInCarResponse(
  cabinLengthIn,
  fb1,
  fb2,
  boxRatio = 0,
  minHz = 20,
  maxHz = 80,
  orderType = 'series',
  cabinLeakage = null,
  includeCabin = true
) {
  const passband = passbandForOrderType(orderType, fb1, fb2, minHz, maxHz)
  if (!includeCabin) {
    const passbandOnly = passband.map((point) => ({
      freq: point.freq,
      passbandDb: point.db,
      cabinDb: 0,
      inCarDb: point.db
    }))
    return { closed: passbandOnly, open: passbandOnly, legacy: passbandOnly }
  }
  const points = passband.length - 1
  const cabinClosed = cabinGainCurve(cabinLengthIn, minHz, maxHz, points, false, cabinLeakage)
  const cabinOpen = cabinGainCurve(cabinLengthIn, minHz, maxHz, points, true, null)

  const closed = buildInCarOverlay(passband, cabinClosed, boxRatio, false)
  const open = buildInCarOverlay(passband, cabinOpen, boxRatio, true)

  return {
    closed,
    open,
    legacy: closed
  }
}

export function getMarkerFrequencies(fb1, fb2, onsetFreqHz, v1 = 1, v2 = 1, orderType = 'series') {
  const bw = estimateBandwidth(fb1, fb2, v1, v2, orderType)
  const markers = []

  if (isPorted(orderType)) {
    markers.push({ freq: fb1, label: 'Fb', color: '#60a5fa' })
  } else if (isFourth(orderType)) {
    markers.push({ freq: fb2, label: 'Fb (front)', color: '#34d399' })
  } else {
    markers.push({ freq: fb1, label: 'Fb1', color: '#60a5fa' })
    markers.push({ freq: fb2, label: 'Fb2', color: '#34d399' })
  }

  markers.push({ freq: onsetFreqHz, label: 'Cabin onset', color: '#fbbf24' })

  if (bw?.lowHz) {
    markers.push({ freq: bw.lowHz, label: 'Est. lo', color: '#a78bfa' })
  }
  if (bw?.highHz) {
    markers.push({ freq: bw.highHz, label: 'Est. hi', color: '#c084fc' })
  }

  return markers.filter((m) => m.freq > 0)
}
