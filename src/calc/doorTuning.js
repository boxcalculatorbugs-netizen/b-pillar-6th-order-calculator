import {
  SPEED_OF_SOUND_IN_SEC,
  CU_FT_TO_CU_IN,
  END_CORRECTION_FLANGED,
  END_CORRECTION_FREE,
  DEFAULT_CABIN_LEAKAGE_AREA_SQIN
} from './constants.js'

export const DOOR_TUNING_COUPLING_TOLERANCE_HZ = 5

/** Typical physical jamb / throat path through a car door frame (inches). */
export const REALISTIC_JAMB_MIN_IN = 2
export const REALISTIC_JAMB_MAX_IN = 8

/** Typical rear-door mouth opening (inches) — width × height. */
export const REALISTIC_DOOR_WIDTH_RANGE = [18, 30]
export const REALISTIC_DOOR_HEIGHT_RANGE = [24, 42]

export function totalVentAreaSqIn(doorWidthIn, doorHeightIn, isCabinSealed = false, leakAreaSqIn = 0) {
  const mainDoorArea = (doorWidthIn || 0) * (doorHeightIn || 0)
  const actualLeak = isCabinSealed ? 0 : Math.max(0, leakAreaSqIn || 0)
  return {
    doorAreaSqIn: mainDoorArea,
    leakAreaSqIn: actualLeak,
    totalVentAreaSqIn: mainDoorArea + actualLeak
  }
}

export function doorEndCorrectionIn(ventAreaSqIn) {
  const eqRadius = Math.sqrt(ventAreaSqIn / Math.PI)
  return END_CORRECTION_FLANGED * eqRadius + END_CORRECTION_FREE * eqRadius
}

export function computeEffectiveLengthForHz(cabinVolCuFt, ventAreaSqIn, targetHz) {
  if (!cabinVolCuFt || !ventAreaSqIn || !targetHz || targetHz <= 0) return 0
  const cabinVolCuIn = cabinVolCuFt * CU_FT_TO_CU_IN
  const omegaRatio = (targetHz * 2 * Math.PI) / SPEED_OF_SOUND_IN_SEC
  return ventAreaSqIn / (cabinVolCuIn * omegaRatio * omegaRatio)
}

export function computeJambForTargetHz(
  cabinVolCuFt,
  doorWidthIn,
  doorHeightIn,
  targetHz,
  isCabinSealed = false,
  leakAreaSqIn = 0
) {
  const vent = totalVentAreaSqIn(doorWidthIn, doorHeightIn, isCabinSealed, leakAreaSqIn)
  if (!vent.totalVentAreaSqIn || !targetHz) {
    return { jambThicknessIn: 0, endCorrectionIn: 0, effectiveLengthIn: 0, feasible: false }
  }
  const endCorrectionIn = doorEndCorrectionIn(vent.totalVentAreaSqIn)
  const effectiveLengthIn = computeEffectiveLengthForHz(
    cabinVolCuFt,
    vent.totalVentAreaSqIn,
    targetHz
  )
  const jambThicknessIn = effectiveLengthIn - endCorrectionIn
  return {
    jambThicknessIn,
    endCorrectionIn,
    effectiveLengthIn,
    feasible: jambThicknessIn >= REALISTIC_JAMB_MIN_IN && jambThicknessIn <= REALISTIC_JAMB_MAX_IN
  }
}

export function calculateDoorTuning(
  cabinVolCuFt,
  doorWidthIn,
  doorHeightIn,
  jambThicknessIn,
  isCabinSealed = false,
  leakAreaSqIn = DEFAULT_CABIN_LEAKAGE_AREA_SQIN
) {
  if (
    !cabinVolCuFt ||
    cabinVolCuFt <= 0 ||
    !doorWidthIn ||
    doorWidthIn <= 0 ||
    !doorHeightIn ||
    doorHeightIn <= 0 ||
    jambThicknessIn == null ||
    jambThicknessIn < 0
  ) {
    return {
      hz: 0,
      valid: false,
      doorAreaSqIn: 0,
      leakAreaSqIn: 0,
      totalVentAreaSqIn: 0,
      isCabinSealed: Boolean(isCabinSealed),
      jambThicknessIn: 0,
      endCorrectionIn: 0,
      effectiveLengthIn: 0
    }
  }

  const vent = totalVentAreaSqIn(doorWidthIn, doorHeightIn, isCabinSealed, leakAreaSqIn)
  const cabinVolCuIn = cabinVolCuFt * CU_FT_TO_CU_IN
  const endCorrectionIn = doorEndCorrectionIn(vent.totalVentAreaSqIn)
  const effectiveLengthIn = jambThicknessIn + endCorrectionIn

  if (effectiveLengthIn <= 0 || vent.totalVentAreaSqIn <= 0) {
    return {
      hz: 0,
      valid: false,
      doorAreaSqIn: vent.doorAreaSqIn,
      leakAreaSqIn: vent.leakAreaSqIn,
      totalVentAreaSqIn: vent.totalVentAreaSqIn,
      isCabinSealed: Boolean(isCabinSealed),
      jambThicknessIn,
      endCorrectionIn,
      effectiveLengthIn: 0
    }
  }

  const insideSqrt = vent.totalVentAreaSqIn / (cabinVolCuIn * effectiveLengthIn)
  const hz = (SPEED_OF_SOUND_IN_SEC / (2 * Math.PI)) * Math.sqrt(insideSqrt)

  return {
    hz,
    valid: hz > 0,
    doorAreaSqIn: vent.doorAreaSqIn,
    leakAreaSqIn: vent.leakAreaSqIn,
    totalVentAreaSqIn: vent.totalVentAreaSqIn,
    isCabinSealed: Boolean(isCabinSealed),
    jambThicknessIn,
    endCorrectionIn,
    effectiveLengthIn
  }
}

export function analyzeDoorTuningGoals({
  hz,
  jambThicknessIn,
  endCorrectionIn,
  effectiveLengthIn,
  doorWidthIn,
  doorHeightIn,
  cabinVolCuFt,
  frontTuningHz,
  frontTuningLabel = 'F2',
  isCabinSealed = false,
  leakAreaSqIn = 0,
  totalVentAreaSqIn: totalVent = 0,
  doorAreaSqIn = 0
}) {
  const notes = []
  const jambRealistic =
    jambThicknessIn >= REALISTIC_JAMB_MIN_IN && jambThicknessIn <= REALISTIC_JAMB_MAX_IN

  if (doorWidthIn < REALISTIC_DOOR_WIDTH_RANGE[0] || doorWidthIn > REALISTIC_DOOR_WIDTH_RANGE[1]) {
    notes.push(
      `Door width ${doorWidthIn.toFixed(1)} in — typical rear-door mouth is ~${REALISTIC_DOOR_WIDTH_RANGE[0]}–${REALISTIC_DOOR_WIDTH_RANGE[1]} in.`
    )
  }
  if (doorHeightIn < REALISTIC_DOOR_HEIGHT_RANGE[0] || doorHeightIn > REALISTIC_DOOR_HEIGHT_RANGE[1]) {
    notes.push(
      `Door height ${doorHeightIn.toFixed(1)} in — typical opening is ~${REALISTIC_DOOR_HEIGHT_RANGE[0]}–${REALISTIC_DOOR_HEIGHT_RANGE[1]} in.`
    )
  }
  if (!jambRealistic) {
    notes.push(
      `Jamb ${jambThicknessIn.toFixed(1)} in is outside the usual ${REALISTIC_JAMB_MIN_IN}–${REALISTIC_JAMB_MAX_IN} in physical path — verify the through-frame distance.`
    )
  }

  notes.push(
    `Jamb adds ${jambThicknessIn.toFixed(1)} in physical path; end correction adds ${endCorrectionIn.toFixed(1)} in (L_eff = ${effectiveLengthIn.toFixed(1)} in total).`
  )

  if (!isCabinSealed && leakAreaSqIn > 0) {
    notes.push(
      `Parasitic leak ${leakAreaSqIn.toFixed(1)} sq in raises total vent area to ${totalVent.toFixed(1)} sq in (door ${doorAreaSqIn.toFixed(1)} + leak) — F_door runs higher than door-only.`
    )
  } else if (isCabinSealed) {
    notes.push('Perfectly sealed cabin — no parasitic leak area added to door Helmholtz.')
  }

  let goalVerdict = ''
  let goalLevel = 'neutral'
  let recommendedJambForFront = null
  let recommendedJambLow = null
  let recommendedJambHigh = null

  if (frontTuningHz > 0) {
    const leakOpts = { isCabinSealed, leakAreaSqIn }
    const forFront = computeJambForTargetHz(
      cabinVolCuFt,
      doorWidthIn,
      doorHeightIn,
      frontTuningHz,
      isCabinSealed,
      leakAreaSqIn
    )
    recommendedJambForFront = forFront.jambThicknessIn

    const forLow = computeJambForTargetHz(
      cabinVolCuFt,
      doorWidthIn,
      doorHeightIn,
      frontTuningHz + DOOR_TUNING_COUPLING_TOLERANCE_HZ,
      isCabinSealed,
      leakAreaSqIn
    )
    const forHigh = computeJambForTargetHz(
      cabinVolCuFt,
      doorWidthIn,
      doorHeightIn,
      frontTuningHz - DOOR_TUNING_COUPLING_TOLERANCE_HZ,
      isCabinSealed,
      leakAreaSqIn
    )
    recommendedJambLow = Math.min(forLow.jambThicknessIn, forHigh.jambThicknessIn)
    recommendedJambHigh = Math.max(forLow.jambThicknessIn, forHigh.jambThicknessIn)

    const delta = Math.abs(hz - frontTuningHz)
    if (delta <= DOOR_TUNING_COUPLING_TOLERANCE_HZ) {
      goalVerdict = `SPL door-jamb alignment — F_door is within ±${DOOR_TUNING_COUPLING_TOLERANCE_HZ} Hz of ${frontTuningLabel} (${frontTuningHz.toFixed(1)} Hz). Expect strong door-open coupling at tuning.`
      goalLevel = 'amber'
    } else if (hz > frontTuningHz) {
      goalVerdict = `F_door is above ${frontTuningLabel} — thicken jamb toward ~${recommendedJambForFront.toFixed(1)} in to pull door resonance down, or reduce total vent area (smaller door mouth / less leak).`
      goalLevel = 'neutral'
    } else {
      goalVerdict = `F_door is below ${frontTuningLabel} — shorten jamb toward ~${recommendedJambForFront.toFixed(1)} in to raise door resonance, or increase total vent area.`
      goalLevel = 'neutral'
    }

    if (forFront.feasible) {
      notes.push(
        `To nail ${frontTuningLabel} (${frontTuningHz.toFixed(1)} Hz): target jamb ~${recommendedJambForFront.toFixed(1)} in (±${DOOR_TUNING_COUPLING_TOLERANCE_HZ} Hz band ≈ ${recommendedJambLow.toFixed(1)}–${recommendedJambHigh.toFixed(1)} in jamb).`
      )
    } else if (recommendedJambForFront > REALISTIC_JAMB_MAX_IN) {
      notes.push(
        `Hitting ${frontTuningLabel} needs ~${recommendedJambForFront.toFixed(1)} in jamb — thicker than a typical ${REALISTIC_JAMB_MAX_IN} in door path; try a larger vent area or accept a higher F_door.`
      )
    } else if (recommendedJambForFront < REALISTIC_JAMB_MIN_IN) {
      notes.push(
        `Hitting ${frontTuningLabel} needs ~${recommendedJambForFront.toFixed(1)} in jamb — shorter than typical; try a smaller vent area or accept a lower F_door.`
      )
    }
  } else {
    goalVerdict =
      'Enter front chamber tuning (F2 / Fb) to compare door-jamb resonance and get alignment targets.'
    goalLevel = 'neutral'
    notes.push(
      `Doors-open SPL builds often aim F_door ≈ front tuning (35–55 Hz common). Musical builds usually keep F_door clear of F2 by >5 Hz.`
    )
  }

  return {
    goalVerdict,
    goalLevel,
    recommendedJambForFront,
    recommendedJambLow,
    recommendedJambHigh,
    jambRealistic,
    notes
  }
}

export function analyzeDoorTuningCoupling(
  doorHz,
  frontTuningHz,
  toleranceHz = DOOR_TUNING_COUPLING_TOLERANCE_HZ,
  frontTuningLabel = 'front tuning F2'
) {
  if (!doorHz || doorHz <= 0 || !frontTuningHz || frontTuningHz <= 0) {
    return { coupled: false, deltaHz: null, message: '' }
  }

  const deltaHz = Math.abs(doorHz - frontTuningHz)
  const coupled = deltaHz <= toleranceHz

  if (!coupled) {
    return { coupled: false, deltaHz, message: '' }
  }

  return {
    coupled: true,
    deltaHz,
    message: `Door open cabin resonance (${doorHz.toFixed(1)} Hz) is within ${toleranceHz} Hz of ${frontTuningLabel} (${frontTuningHz.toFixed(1)} Hz) — intentional SPL door-jamb alignment; expect strong coupling at tuning.`
  }
}

export function analyzeDoorTuning({
  enabled,
  cabinVolCuFt,
  doorWidthIn,
  doorHeightIn,
  jambThicknessIn,
  frontTuningHz,
  frontTuningLabel = 'front tuning F2',
  isCabinSealed = false,
  cabinLeakageAreaSqIn = DEFAULT_CABIN_LEAKAGE_AREA_SQIN,
  closedGainSlope = null
}) {
  if (!enabled) return null

  const tuning = calculateDoorTuning(
    cabinVolCuFt,
    doorWidthIn,
    doorHeightIn,
    jambThicknessIn,
    isCabinSealed,
    cabinLeakageAreaSqIn
  )
  const coupling = analyzeDoorTuningCoupling(
    tuning.hz,
    frontTuningHz,
    DOOR_TUNING_COUPLING_TOLERANCE_HZ,
    frontTuningLabel
  )
  const goals =
    tuning.valid
      ? analyzeDoorTuningGoals({
          hz: tuning.hz,
          jambThicknessIn: tuning.jambThicknessIn,
          endCorrectionIn: tuning.endCorrectionIn,
          effectiveLengthIn: tuning.effectiveLengthIn,
          doorWidthIn,
          doorHeightIn,
          cabinVolCuFt,
          frontTuningHz,
          frontTuningLabel,
          isCabinSealed,
          leakAreaSqIn: tuning.leakAreaSqIn,
          totalVentAreaSqIn: tuning.totalVentAreaSqIn,
          doorAreaSqIn: tuning.doorAreaSqIn
        })
      : null

  return {
    enabled: true,
    hz: tuning.hz,
    valid: tuning.valid,
    doorAreaSqIn: tuning.doorAreaSqIn,
    leakAreaSqIn: tuning.leakAreaSqIn,
    totalVentAreaSqIn: tuning.totalVentAreaSqIn,
    isCabinSealed: tuning.isCabinSealed,
    jambThicknessIn: tuning.jambThicknessIn,
    endCorrectionIn: tuning.endCorrectionIn,
    effectiveLengthIn: tuning.effectiveLengthIn,
    cabinVolCuFt: cabinVolCuFt || 0,
    doorWidthIn: doorWidthIn || 0,
    doorHeightIn: doorHeightIn || 0,
    frontTuningHz: frontTuningHz || 0,
    frontTuningLabel,
    closedGainSlope,
    deltaHz: coupling.deltaHz,
    coupled: coupling.coupled,
    message: coupling.message,
    goalVerdict: goals?.goalVerdict || '',
    goalLevel: goals?.goalLevel || 'neutral',
    recommendedJambForFront: goals?.recommendedJambForFront ?? null,
    recommendedJambLow: goals?.recommendedJambLow ?? null,
    recommendedJambHigh: goals?.recommendedJambHigh ?? null,
    jambRealistic: goals?.jambRealistic ?? true,
    goalNotes: goals?.notes || []
  }
}

const DOOR_TUNING_STORAGE_KEY = 'sixthCalcDoorTuningExperimental'

export function loadSavedDoorTuningExperimental() {
  try {
    return localStorage.getItem(DOOR_TUNING_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function saveDoorTuningExperimental(enabled) {
  try {
    localStorage.setItem(DOOR_TUNING_STORAGE_KEY, enabled ? '1' : '0')
  } catch {
    /* ignore */
  }
}
