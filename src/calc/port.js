import {

  SPEED_OF_SOUND_IN_SEC,

  CU_FT_TO_CU_IN,

  END_CORRECTION_FLANGED,

  END_CORRECTION_FREE,

  END_CORRECTION_K_BY_COMMON_WALLS,

  clamp

} from './constants.js'



export const CALC_MODES = {

  HELMHOLTZ: 'helmholtz',

  QUARTER_WAVE: 'quarter_wave',

  ALL_CONSIDERED: 'all_considered'

}



export const PORT_STYLE_MODES = {

  ROUND_AERO: 'round_aero',

  RECT_SLOT: 'rect_slot'

}



export function normalizeCalcMode(mode) {

  if (mode === CALC_MODES.QUARTER_WAVE || mode === 'Quarter_Wave') return CALC_MODES.QUARTER_WAVE

  if (mode === CALC_MODES.ALL_CONSIDERED || mode === 'All_Considered') return CALC_MODES.ALL_CONSIDERED

  return CALC_MODES.HELMHOLTZ

}



export function normalizePortStyleMode(mode) {

  if (mode === PORT_STYLE_MODES.RECT_SLOT || mode === 'rect_slot') return PORT_STYLE_MODES.RECT_SLOT

  return PORT_STYLE_MODES.ROUND_AERO

}



export function calcModeLabel(mode) {

  switch (normalizeCalcMode(mode)) {

    case CALC_MODES.QUARTER_WAVE:

      return 'Quarter wave'

    case CALC_MODES.ALL_CONSIDERED:

      return 'All Considered (MLTL)'

    default:

      return 'Helmholtz'

  }

}



export function portStyleLabel(mode) {

  return normalizePortStyleMode(mode) === PORT_STYLE_MODES.RECT_SLOT

    ? 'Rectangular Slot Port'

    : 'Round / Aero Port'

}



export function commonWallsLabel(commonWalls) {

  const n = clamp(Math.round(commonWalls ?? 0), 0, 3)

  switch (n) {

    case 1:

      return '1 wall (e.g. floor)'

    case 2:

      return '2 walls (e.g. floor + side)'

    case 3:

      return '3 walls (e.g. corner + back)'

    default:

      return '0 walls (free / flush external)'

  }

}



/** Resolve k-factor for end correction (multiplied by equivalent radius). */

export function endCorrectionK(endCorrectionOpts = {}) {

  const portStyleMode = normalizePortStyleMode(endCorrectionOpts.portStyleMode)

  if (portStyleMode === PORT_STYLE_MODES.RECT_SLOT) {

    const walls = clamp(Math.round(endCorrectionOpts.commonWalls ?? 0), 0, 3)

    return END_CORRECTION_K_BY_COMMON_WALLS[walls] ?? END_CORRECTION_K_BY_COMMON_WALLS[0]

  }

  return endCorrectionOpts.isFlanged !== false ? END_CORRECTION_FLANGED : END_CORRECTION_FREE

}



export function defaultEndCorrectionOpts(isFlanged = true) {

  return { portStyleMode: PORT_STYLE_MODES.ROUND_AERO, isFlanged }

}



/** Backward-compatible: boolean isFlanged → endCorrectionOpts. */

export function coerceEndCorrectionOpts(arg) {

  if (typeof arg === 'boolean') {

    return defaultEndCorrectionOpts(arg)

  }

  if (arg && typeof arg === 'object') {

    return {

      portStyleMode: normalizePortStyleMode(arg.portStyleMode),

      isFlanged: arg.isFlanged !== false,

      commonWalls: clamp(Math.round(arg.commonWalls ?? 0), 0, 3)

    }

  }

  return defaultEndCorrectionOpts(true)

}



function emptyPortResult(endCorrectionOpts) {

  const opts = coerceEndCorrectionOpts(endCorrectionOpts)

  const k = endCorrectionK(opts)

  return {

    physicalLengthIn: 0,

    portVolumeCuFt: 0,

    rawLengthIn: 0,

    endCorrectionIn: 0,

    endCorrectionK: k,

    endCorrectionFactor: k,

    portStyleMode: opts.portStyleMode,

    commonWalls: opts.portStyleMode === PORT_STYLE_MODES.RECT_SLOT ? opts.commonWalls : undefined,

    isFlanged: opts.portStyleMode === PORT_STYLE_MODES.ROUND_AERO ? opts.isFlanged !== false : undefined

  }

}



function portLengthResult(rawLength, portAreaSqIn, endCorrectionOpts) {

  const opts = coerceEndCorrectionOpts(endCorrectionOpts)

  const equivalentRadius = Math.sqrt(portAreaSqIn / Math.PI)

  const k = endCorrectionK(opts)

  const endCorrection = k * equivalentRadius

  const physicalLength = Math.max(0, rawLength - endCorrection)

  const portVolumeCuFt = (portAreaSqIn * physicalLength) / CU_FT_TO_CU_IN



  return {

    physicalLengthIn: physicalLength,

    portVolumeCuFt,

    rawLengthIn: rawLength,

    endCorrectionIn: endCorrection,

    endCorrectionK: k,

    endCorrectionFactor: k,

    portStyleMode: opts.portStyleMode,

    commonWalls: opts.portStyleMode === PORT_STYLE_MODES.RECT_SLOT ? opts.commonWalls : undefined,

    isFlanged: opts.portStyleMode === PORT_STYLE_MODES.ROUND_AERO ? opts.isFlanged !== false : undefined

  }

}



export function portAreaFromDiameter(diameterIn) {

  return Math.PI * (diameterIn / 2) ** 2

}



/** Port cross-section per cu ft of net chamber volume (sq in / cu ft). */

export function portAreaPerNetCuFt(portAreaSqIn, netVolumeCuFt) {

  if (!portAreaSqIn || !netVolumeCuFt || netVolumeCuFt <= 0) return 0

  return portAreaSqIn / netVolumeCuFt

}



export function portAreaFromSlot(outerWidthIn, outerHeightIn, portWallThicknessIn = 0) {

  const t = portWallThicknessIn || 0

  const innerW = Math.max(0, outerWidthIn - 2 * t)

  const innerH = Math.max(0, outerHeightIn - 2 * t)

  return innerW * innerH

}



export function equivalentRadiusFromArea(areaSqIn) {

  if (!areaSqIn || areaSqIn <= 0) return 0

  return Math.sqrt(areaSqIn / Math.PI)

}



export function diameterFromPortArea(areaSqIn) {

  return 2 * Math.sqrt(areaSqIn / Math.PI)

}



/**

 * Helmholtz port length with end correction.

 * @param {object|boolean} endCorrectionOpts - port style + common walls or legacy isFlanged boolean

 */

export function calculatePortLength(freqHz, volumeCuFt, portAreaSqIn, endCorrectionOpts = true) {

  const opts = coerceEndCorrectionOpts(endCorrectionOpts)

  if (!freqHz || !volumeCuFt || !portAreaSqIn || freqHz <= 0 || volumeCuFt <= 0 || portAreaSqIn <= 0) {

    return emptyPortResult(opts)

  }



  const volumeCuIn = volumeCuFt * CU_FT_TO_CU_IN

  const numerator = SPEED_OF_SOUND_IN_SEC ** 2 * portAreaSqIn

  const denominator = 4 * Math.PI ** 2 * freqHz ** 2 * volumeCuIn

  const rawLength = numerator / denominator



  return portLengthResult(rawLength, portAreaSqIn, opts)

}



/** Quarter-wave port length (λ/4). Volume-independent. */

export function calculateQuarterWaveLength(freqHz, portAreaSqIn, endCorrectionOpts = true) {

  const opts = coerceEndCorrectionOpts(endCorrectionOpts)

  if (!freqHz || !portAreaSqIn || freqHz <= 0 || portAreaSqIn <= 0) {

    return emptyPortResult(opts)

  }



  const rawLength = SPEED_OF_SOUND_IN_SEC / (4 * freqHz)

  return portLengthResult(rawLength, portAreaSqIn, opts)

}



/**

 * Pipe-cavity resonance (mass-loaded transmission line).

 * L = (c / 2πf) × arctan((A × c) / (2πf × V))

 */

export function calculateAllConsideredLength(freqHz, volumeCuFt, portAreaSqIn, endCorrectionOpts = true) {

  const opts = coerceEndCorrectionOpts(endCorrectionOpts)

  if (!freqHz || !volumeCuFt || !portAreaSqIn || freqHz <= 0 || volumeCuFt <= 0 || portAreaSqIn <= 0) {

    return emptyPortResult(opts)

  }



  const volumeCuIn = volumeCuFt * CU_FT_TO_CU_IN

  const omega = 2 * Math.PI * freqHz

  const kWave = omega / SPEED_OF_SOUND_IN_SEC

  const insideArctan = (portAreaSqIn * SPEED_OF_SOUND_IN_SEC) / (omega * volumeCuIn)

  const rawLength = (1 / kWave) * Math.atan(insideArctan)



  return portLengthResult(rawLength, portAreaSqIn, opts)

}



export function calculatePortLengthByMode(

  calcMode,

  freqHz,

  volumeCuFt,

  portAreaSqIn,

  endCorrectionOpts = true

) {

  switch (normalizeCalcMode(calcMode)) {

    case CALC_MODES.QUARTER_WAVE:

      return calculateQuarterWaveLength(freqHz, portAreaSqIn, endCorrectionOpts)

    case CALC_MODES.ALL_CONSIDERED:

      return calculateAllConsideredLength(freqHz, volumeCuFt, portAreaSqIn, endCorrectionOpts)

    default:

      return calculatePortLength(freqHz, volumeCuFt, portAreaSqIn, endCorrectionOpts)

  }

}



/** Diameter & slot modes: user sets port geometry/length; Fb is derived, not entered. */

export function isLengthAdjustMode(portInputMode) {

  return portInputMode === 'diameter' || portInputMode === 'slot'

}



/**

 * Inverse Helmholtz — tuning frequency at a fixed physical port length.

 * f = (c / 2π) × √(A / (V × L_eff))

 */

export function calculateFreqAtPortLength(

  physicalLengthIn,

  volumeCuFt,

  portAreaSqIn,

  endCorrectionOpts = true

) {

  const opts = coerceEndCorrectionOpts(endCorrectionOpts)

  if (!physicalLengthIn || physicalLengthIn <= 0 || !volumeCuFt || volumeCuFt <= 0 || !portAreaSqIn || portAreaSqIn <= 0) {

    return 0

  }



  const volumeCuIn = volumeCuFt * CU_FT_TO_CU_IN

  const eqRadius = Math.sqrt(portAreaSqIn / Math.PI)

  const endCorrection = endCorrectionK(opts) * eqRadius

  const effectiveLengthIn = physicalLengthIn + endCorrection

  const insideSqrt = portAreaSqIn / (volumeCuIn * effectiveLengthIn)



  if (insideSqrt <= 0) return 0

  return (SPEED_OF_SOUND_IN_SEC / (2 * Math.PI)) * Math.sqrt(insideSqrt)

}



function calculateFreqAtQuarterWaveLength(physicalLengthIn, portAreaSqIn, endCorrectionOpts = true) {

  const opts = coerceEndCorrectionOpts(endCorrectionOpts)

  if (!physicalLengthIn || physicalLengthIn <= 0 || !portAreaSqIn || portAreaSqIn <= 0) return 0



  const eqRadius = Math.sqrt(portAreaSqIn / Math.PI)

  const endCorrection = endCorrectionK(opts) * eqRadius

  const effectiveLengthIn = physicalLengthIn + endCorrection

  if (effectiveLengthIn <= 0) return 0



  return SPEED_OF_SOUND_IN_SEC / (4 * effectiveLengthIn)

}



function calculateFreqAtAllConsideredLength(

  physicalLengthIn,

  volumeCuFt,

  portAreaSqIn,

  endCorrectionOpts = true

) {

  const opts = coerceEndCorrectionOpts(endCorrectionOpts)

  if (!physicalLengthIn || physicalLengthIn <= 0 || !volumeCuFt || volumeCuFt <= 0 || !portAreaSqIn || portAreaSqIn <= 0) {

    return 0

  }



  let lo = 5

  let hi = 200

  for (let i = 0; i < 50; i++) {

    const mid = (lo + hi) / 2

    const len = calculateAllConsideredLength(mid, volumeCuFt, portAreaSqIn, opts).physicalLengthIn

    if (len > physicalLengthIn) lo = mid

    else hi = mid

  }



  return (lo + hi) / 2

}



export function calculateFreqAtPortLengthByMode(

  calcMode,

  physicalLengthIn,

  volumeCuFt,

  portAreaSqIn,

  endCorrectionOpts = true

) {

  switch (normalizeCalcMode(calcMode)) {

    case CALC_MODES.QUARTER_WAVE:

      return calculateFreqAtQuarterWaveLength(physicalLengthIn, portAreaSqIn, endCorrectionOpts)

    case CALC_MODES.ALL_CONSIDERED:

      return calculateFreqAtAllConsideredLength(physicalLengthIn, volumeCuFt, portAreaSqIn, endCorrectionOpts)

    default:

      return calculateFreqAtPortLength(physicalLengthIn, volumeCuFt, portAreaSqIn, endCorrectionOpts)

  }

}



/** Diameter & slot modes may supply a built port length; area mode uses the selected calc model. */

export function resolvePortResult({

  fbHz,

  volumeCuFt,

  portAreaSqIn,

  endCorrectionOpts,

  isFlanged,

  portStyleMode,

  commonWalls,

  portInputMode,

  portLengthOverrideIn,

  calcMode = CALC_MODES.HELMHOLTZ

}) {

  const opts = endCorrectionOpts ?? {

    portStyleMode: portStyleMode ?? PORT_STYLE_MODES.ROUND_AERO,

    isFlanged: isFlanged !== false,

    commonWalls

  }

  const calc = calculatePortLengthByMode(calcMode, fbHz, volumeCuFt, portAreaSqIn, opts)

  const canOverride = portInputMode === 'diameter' || portInputMode === 'slot'

  const override = canOverride && portLengthOverrideIn > 0 ? portLengthOverrideIn : 0



  if (override > 0) {

    return {

      ...calc,

      physicalLengthIn: override,

      portVolumeCuFt: (portAreaSqIn * override) / CU_FT_TO_CU_IN,

      lengthOverridden: true,

      calculatedLengthIn: calc.physicalLengthIn

    }

  }



  return {

    ...calc,

    lengthOverridden: false,

    calculatedLengthIn: calc.physicalLengthIn

  }

}



/** If volume changes but port geometry fixed, what Fb becomes? */

export function calculateFbFromPort(originalFbHz, originalVolumeCuFt, newVolumeCuFt, portAreaSqIn) {

  if (!originalFbHz || !originalVolumeCuFt || !newVolumeCuFt || !portAreaSqIn) return 0

  return originalFbHz * Math.sqrt(originalVolumeCuFt / newVolumeCuFt)

}



/** Alias — port length at target Fb for given volume/area */

export function calculatePortLengthForTargetFb(

  freqHz,

  volumeCuFt,

  portAreaSqIn,

  endCorrectionOpts = true,

  calcMode = CALC_MODES.HELMHOLTZ

) {

  return calculatePortLengthByMode(calcMode, freqHz, volumeCuFt, portAreaSqIn, endCorrectionOpts)

}



/** Human-readable end correction summary for results UI. */

export function formatEndCorrectionSummary(result) {

  if (!result) return '—'

  if (result.portStyleMode === PORT_STYLE_MODES.RECT_SLOT) {

    const walls = result.commonWalls ?? 0

    return `Rectangular Slot — ${walls} common wall${walls === 1 ? '' : 's'} (k ${result.endCorrectionK?.toFixed(3)}×r)`

  }

  const k = result.endCorrectionK ?? (result.isFlanged ? END_CORRECTION_FLANGED : END_CORRECTION_FREE)

  return `Round / Aero — k ${k.toFixed(3)}×r`

}


