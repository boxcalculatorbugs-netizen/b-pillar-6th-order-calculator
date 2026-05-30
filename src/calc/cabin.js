import {
  SPEED_OF_SOUND_IN_SEC,
  CABIN_SLOPE_CLOSED,
  CABIN_SLOPE_OPEN,
  CABIN_LEAK_SLOPE_DEGRADATION_PER_SQIN
} from './constants.js'

export function closedCabinGainSlope(cabinLeakage = null) {
  if (!cabinLeakage) return CABIN_SLOPE_CLOSED
  if (cabinLeakage.isCabinSealed) return CABIN_SLOPE_CLOSED
  const leakAreaSqIn = cabinLeakage.leakAreaSqIn || 0
  const degradation = leakAreaSqIn * CABIN_LEAK_SLOPE_DEGRADATION_PER_SQIN
  return Math.max(CABIN_SLOPE_OPEN, CABIN_SLOPE_CLOSED - degradation)
}

export function calculateCabinGain(
  cabinLengthInches,
  targetFreqHz,
  doorsOpen = false,
  cabinLeakage = null
) {
  if (!cabinLengthInches || cabinLengthInches <= 0 || !targetFreqHz || targetFreqHz <= 0) {
    return {
      onsetFreqHz: 0,
      dbBoost: 0,
      gainSlope: doorsOpen ? CABIN_SLOPE_OPEN : closedCabinGainSlope(cabinLeakage)
    }
  }

  const onsetFreq = SPEED_OF_SOUND_IN_SEC / (2 * cabinLengthInches)
  const gainSlope = doorsOpen ? CABIN_SLOPE_OPEN : closedCabinGainSlope(cabinLeakage)
  let dbBoost = 0

  if (targetFreqHz < onsetFreq) {
    const octavesBelow = Math.log2(onsetFreq / targetFreqHz)
    dbBoost = octavesBelow * gainSlope
  }

  return { onsetFreqHz: onsetFreq, dbBoost, gainSlope }
}

export function calculateCabinVolumeCoupling(
  cabinVolumeCuFt,
  vb1CuFt,
  vb2CuFt,
  targetFreqHz,
  onsetFreqHz,
  doorsOpen = false
) {
  if (!cabinVolumeCuFt || cabinVolumeCuFt <= 0) {
    return {
      boxRatio: 0,
      boostAdjustDb: 0,
      warnings: []
    }
  }

  const totalBoxVol = (vb1CuFt || 0) + (vb2CuFt || 0)
  const boxRatio = totalBoxVol / cabinVolumeCuFt

  const warnings = []
  if (doorsOpen) {
    warnings.push({
      level: 'amber',
      message: 'Doors open — cabin loading reduced; box-to-cabin ratio is less predictive.'
    })
  } else {
    if (boxRatio > 0.25) {
      warnings.push({
        level: 'amber',
        message: `Box volume is ${(boxRatio * 100).toFixed(0)}% of cabin volume (>25%). Expect peaky cabin loading.`
      })
    } else if (boxRatio > 0 && boxRatio < 0.08) {
      warnings.push({
        level: 'amber',
        message: `Box volume is only ${(boxRatio * 100).toFixed(0)}% of cabin. You may be under-loading the cabin for low-frequency output.`
      })
    }
  }

  let boostAdjustDb = 0
  if (
    !doorsOpen &&
    boxRatio > 0.15 &&
    targetFreqHz &&
    onsetFreqHz &&
    targetFreqHz <= onsetFreqHz * 1.2
  ) {
    boostAdjustDb = Math.min(3, (boxRatio - 0.15) * 20)
  }

  return {
    boxRatio,
    boostAdjustDb,
    warnings
  }
}

export function cabinGainCurve(
  cabinLengthInches,
  minHz = 20,
  maxHz = 80,
  points = 60,
  doorsOpen = false,
  cabinLeakage = null
) {
  const data = []
  const logMin = Math.log10(minHz)
  const logMax = Math.log10(maxHz)

  for (let i = 0; i <= points; i++) {
    const freq = 10 ** (logMin + ((logMax - logMin) * i) / points)
    const { onsetFreqHz, dbBoost, gainSlope } = calculateCabinGain(
      cabinLengthInches,
      freq,
      doorsOpen,
      doorsOpen ? null : cabinLeakage
    )
    data.push({ freq, dbBoost, onsetFreqHz, gainSlope })
  }

  return data
}

export function cabinGainCurveDual(cabinLengthInches, minHz = 20, maxHz = 80, points = 60, cabinLeakage = null) {
  return {
    closed: cabinGainCurve(cabinLengthInches, minHz, maxHz, points, false, cabinLeakage),
    open: cabinGainCurve(cabinLengthInches, minHz, maxHz, points, true, null)
  }
}
