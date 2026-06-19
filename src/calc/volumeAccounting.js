import { CU_FT_TO_CU_IN } from './constants.js'

export const DEFAULT_WALL_THICKNESS_IN = 1.5
export const DEFAULT_BAFFLE_THICKNESS_IN = 0.75
export const DEFAULT_PORT_WALL_THICKNESS_IN = 0.75
export const DEFAULT_BRACING_PERCENT = 15

/** Internal chamber divider at full B-pillar cross-section (W × H × thickness). */
export function baffleDisplacementCuFt(maxWidthIn, maxHeightIn, baffleThicknessIn) {
  if (!maxWidthIn || !maxHeightIn || !baffleThicknessIn || baffleThicknessIn <= 0) return 0
  return (maxWidthIn * maxHeightIn * baffleThicknessIn) / CU_FT_TO_CU_IN
}

/** Outer L×W×H → internal airspace before displacements */
export function internalDimsFromOuter(lengthIn, widthIn, heightIn, wallThicknessIn) {
  const t = wallThicknessIn || 0
  return {
    lengthIn: Math.max(0, lengthIn - 2 * t),
    widthIn: Math.max(0, widthIn - 2 * t),
    heightIn: Math.max(0, heightIn - 2 * t)
  }
}

export function volumeCuFtFromDims(lengthIn, widthIn, heightIn) {
  if (!lengthIn || !widthIn || !heightIn) return 0
  return (lengthIn * widthIn * heightIn) / CU_FT_TO_CU_IN
}

export function wallPanelLossCuFt(outerLengthIn, outerWidthIn, outerHeightIn, wallThicknessIn) {
  if (!wallThicknessIn || wallThicknessIn <= 0) return 0
  const outer = volumeCuFtFromDims(outerLengthIn, outerWidthIn, outerHeightIn)
  const inner = internalDimsFromOuter(outerLengthIn, outerWidthIn, outerHeightIn, wallThicknessIn)
  const innerVol = volumeCuFtFromDims(inner.lengthIn, inner.widthIn, inner.heightIn)
  return Math.max(0, outer - innerVol)
}

export function bracingCuFt(netVolumeCuFt, bracingPercent) {
  const pct = bracingPercent ?? DEFAULT_BRACING_PERCENT
  return netVolumeCuFt * (pct / 100)
}

/**
 * Compute effective net volume from gross inputs and displacements.
 * @param {object} opts
 */
export function computeVolumeBreakdown({
  volumeBasis = 'net',
  netVolumeCuFt = 0,
  grossVolumeCuFt = 0,
  grossLengthIn = 0,
  grossWidthIn = 0,
  grossHeightIn = 0,
  measureFromOuter = false,
  wallThicknessIn = DEFAULT_WALL_THICKNESS_IN,
  portVolumeCuFt = 0,
  driverShareCuFt = 0,
  bracingPercent = DEFAULT_BRACING_PERCENT,
  extraDisplacementCuIn = 0,
  baffleCuFt = 0
}) {
  const extraCuFt = (extraDisplacementCuIn || 0) / CU_FT_TO_CU_IN
  const baffleCuFtVal = baffleCuFt || 0
  let grossInternalCuFt = 0
  let wallLossCuFt = 0

  if (volumeBasis === 'grossDims') {
    const dims = measureFromOuter
      ? internalDimsFromOuter(grossLengthIn, grossWidthIn, grossHeightIn, wallThicknessIn)
      : { lengthIn: grossLengthIn, widthIn: grossWidthIn, heightIn: grossHeightIn }
    if (measureFromOuter) {
      wallLossCuFt = wallPanelLossCuFt(grossLengthIn, grossWidthIn, grossHeightIn, wallThicknessIn)
    }
    grossInternalCuFt = volumeCuFtFromDims(dims.lengthIn, dims.widthIn, dims.heightIn)
  } else if (volumeBasis === 'grossVolume') {
    grossInternalCuFt = grossVolumeCuFt
  } else {
    grossInternalCuFt = netVolumeCuFt + portVolumeCuFt + driverShareCuFt + extraCuFt + baffleCuFtVal
  }

  const bracingCuFtVal = bracingCuFt(
    volumeBasis === 'net' ? netVolumeCuFt : grossInternalCuFt,
    bracingPercent
  )

  let effectiveNetCuFt
  if (volumeBasis === 'net') {
    effectiveNetCuFt = netVolumeCuFt
    grossInternalCuFt =
      netVolumeCuFt + portVolumeCuFt + driverShareCuFt + bracingCuFtVal + extraCuFt + baffleCuFtVal
    wallLossCuFt = 0
  } else {
    effectiveNetCuFt = Math.max(
      0,
      grossInternalCuFt - portVolumeCuFt - driverShareCuFt - bracingCuFtVal - extraCuFt - baffleCuFtVal
    )
  }

  const displacementTotalCuFt =
    portVolumeCuFt + driverShareCuFt + bracingCuFtVal + extraCuFt + baffleCuFtVal
  const enteredNetCuFt = volumeBasis === 'net' ? netVolumeCuFt : effectiveNetCuFt
  const requiredGrossCuFt = grossInternalCuFt
  const additionalBeyondNetCuFt =
    volumeBasis === 'net' ? Math.max(0, requiredGrossCuFt - enteredNetCuFt) : 0

  return {
    volumeBasis,
    grossInternalCuFt,
    wallLossCuFt,
    portCuFt: portVolumeCuFt,
    driverCuFt: driverShareCuFt,
    bracingCuFt: bracingCuFtVal,
    extraCuFt,
    baffleCuFt: baffleCuFtVal,
    effectiveNetCuFt,
    enteredNetCuFt,
    requiredGrossCuFt,
    displacementTotalCuFt,
    additionalBeyondNetCuFt
  }
}
