import { DEFAULT_BRACING_PERCENT } from './volumeAccounting.js'

export function analyzePortPackaging(
  portLengthIn,
  maxDepthIn,
  maxHeightIn,
  portDiameterIn,
  slotOpts = null
) {
  if (!portLengthIn || portLengthIn <= 0) {
    return {
      fitsStraight: true,
      foldCount: 0,
      effectivePathIn: 0,
      clearanceNeededIn: 0,
      warnings: []
    }
  }

  const warnings = []
  const availableStraight = Math.max(0, (maxDepthIn || 999) - 2)
  const fitsStraight = portLengthIn <= availableStraight

  let foldCount = 0
  let effectivePathIn = portLengthIn

  if (!fitsStraight && maxDepthIn > 0) {
    const foldLeg = Math.max(4, (maxDepthIn - 4) / 2)
    foldCount = Math.ceil(portLengthIn / (foldLeg * 2))
    effectivePathIn = portLengthIn + foldCount * 2
    warnings.push({
      level: 'amber',
      message: `Port length ${portLengthIn.toFixed(1)}" exceeds available depth ${maxDepthIn.toFixed(1)}". Suggest ${foldCount}-fold port (~${effectivePathIn.toFixed(1)}" path).`
    })
  } else if (fitsStraight) {
    warnings.push({
      level: 'green',
      message: `Straight port fits within ${availableStraight.toFixed(1)}" depth.`
    })
  }

  const clearanceDim = slotOpts
    ? Math.min(slotOpts.innerWidthIn || 0, slotOpts.innerHeightIn || 0) || portDiameterIn
    : portDiameterIn
  const clearanceNeededIn = clearanceDim ? clearanceDim * 1.5 : 4

  if (maxHeightIn && clearanceDim && clearanceDim * 1.2 > maxHeightIn) {
    warnings.push({
      level: 'red',
      message: `Port opening ${clearanceDim.toFixed(1)}" may not fit height constraint ${maxHeightIn.toFixed(1)}".`
    })
  }

  if (slotOpts?.innerWidthIn && slotOpts?.innerHeightIn) {
    const ratio = Math.max(slotOpts.innerWidthIn, slotOpts.innerHeightIn) /
      Math.min(slotOpts.innerWidthIn, slotOpts.innerHeightIn)
    if (ratio > 8) {
      warnings.push({
        level: 'amber',
        message: `Slot aspect ratio ${ratio.toFixed(1)}:1 is extreme — turbulence may increase.`
      })
    }
  }

  return {
    fitsStraight,
    foldCount,
    effectivePathIn,
    clearanceNeededIn,
    warnings
  }
}

export function estimateGrossVolumeCuFt(
  netVolumeCuFt,
  portVolumeCuFt,
  driverDisplacementCuFt,
  bracingPercent = DEFAULT_BRACING_PERCENT
) {
  const displacement = (portVolumeCuFt || 0) + (driverDisplacementCuFt || 0)
  const withBracing = netVolumeCuFt * (bracingPercent / 100)
  return netVolumeCuFt + displacement + withBracing
}

export function estimateWallDepthCuIn(vb1CuFt, vb2CuFt, maxWidthIn, maxHeightIn) {
  if (!maxWidthIn || !maxHeightIn) return 0
  const totalCuFt = vb1CuFt + vb2CuFt
  const totalCuIn = totalCuFt * 1728
  const crossSection = maxWidthIn * maxHeightIn
  if (crossSection <= 0) return 0
  return totalCuIn / crossSection
}

export function analyzePackaging(inputs, chambers, driverDisplacementCuFt, buildOpts = {}, orderType = 'series') {
  const { maxDepthIn, maxHeightIn, maxWidthIn } = inputs
  const bracingPercent = buildOpts.bracingPercent ?? DEFAULT_BRACING_PERCENT
  const warnings = []
  const isPorted = orderType === 'ported'

  const driverShare1 = isPorted ? driverDisplacementCuFt : driverDisplacementCuFt / 2
  const driverShare2 = isPorted ? 0 : driverDisplacementCuFt / 2

  const gross1 = estimateGrossVolumeCuFt(
    chambers.chamber1.volumeCuFt,
    chambers.chamber1.portVolumeCuFt,
    driverShare1,
    bracingPercent
  )
  const gross2 = isPorted
    ? 0
    : estimateGrossVolumeCuFt(
        chambers.chamber2.volumeCuFt,
        chambers.chamber2.portVolumeCuFt,
        driverShare2,
        bracingPercent
      )

  const estimatedDepthIn = estimateWallDepthCuIn(
    gross1,
    isPorted ? 0 : gross2,
    maxWidthIn,
    maxHeightIn
  )

  if (maxDepthIn && estimatedDepthIn > maxDepthIn) {
    warnings.push({
      level: 'red',
      message: `Estimated wall depth ${estimatedDepthIn.toFixed(1)}" exceeds B-pillar depth limit ${maxDepthIn.toFixed(1)}".`
    })
  } else if (maxDepthIn && estimatedDepthIn > 0) {
    warnings.push({
      level: 'green',
      message: `Estimated wall depth ${estimatedDepthIn.toFixed(1)}" fits within ${maxDepthIn.toFixed(1)}" limit.`
    })
  }

  const slot1 = chambers.chamber1.portInputMode === 'slot'
    ? {
        innerWidthIn: chambers.chamber1.portSlotInnerWidthIn,
        innerHeightIn: chambers.chamber1.portSlotInnerHeightIn
      }
    : null
  const slot2 = chambers.chamber2.portInputMode === 'slot'
    ? {
        innerWidthIn: chambers.chamber2.portSlotInnerWidthIn,
        innerHeightIn: chambers.chamber2.portSlotInnerHeightIn
      }
    : null

  const port1Pkg = analyzePortPackaging(
    chambers.chamber1.portLengthIn,
    maxDepthIn,
    maxHeightIn,
    chambers.chamber1.portDiameterIn,
    slot1
  )
  const port2Pkg = isPorted
    ? {
        fitsStraight: true,
        foldCount: 0,
        effectivePathIn: 0,
        clearanceNeededIn: 0,
        warnings: []
      }
    : analyzePortPackaging(
        chambers.chamber2.portLengthIn,
        maxDepthIn,
        maxHeightIn,
        chambers.chamber2.portDiameterIn,
        slot2
      )

  return {
    estimatedDepthIn,
    grossVolume1CuFt: gross1,
    grossVolume2CuFt: gross2,
    totalGrossCuFt: isPorted ? gross1 : gross1 + gross2,
    chamber1Packaging: port1Pkg,
    chamber2Packaging: port2Pkg,
    warnings: [...warnings, ...port1Pkg.warnings, ...port2Pkg.warnings]
  }
}
