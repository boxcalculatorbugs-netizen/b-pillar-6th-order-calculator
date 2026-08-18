import {
  resolvePortResult,
  calculateFreqAtPortLengthByMode,
  isLengthAdjustMode,
  portAreaFromDiameter,
  portAreaFromSlot,
  portAreaPerNetCuFt,
  diameterFromPortArea,
  CALC_MODES,
  PORT_STYLE_MODES
} from './port.js'
import {
  calculateCabinGain,
  calculateCabinVolumeCoupling,
  cabinGainCurveDual,
  closedCabinGainSlope
} from './cabin.js'
import {
  evaluateDriverSuitability,
  getTsSuggestions,
  getTsWarnings,
  estimateDriverDisplacementCuFt,
  hasTsParams
} from './tsModel.js'
import { analyzeChamberExcursion } from './excursion.js'
import { estimateGrossVolumes, computeEffectiveCabinCuFt } from './packaging.js'
import { estimateInCarResponse, getMarkerFrequencies, estimateBandwidth } from './response.js'
import { calculateDriverArray, getPortRatioWarnings } from './driverArray.js'
import { computeVolumeBreakdown, baffleDisplacementCuFt, baffleFaceSqInFromChambers, DEFAULT_WALL_THICKNESS_IN } from './volumeAccounting.js'
import { round, clamp } from './constants.js'
import { isFourth, isPorted, primaryTuningFb } from './orderTypes.js'
import { analyzeFourthOrderCompatibility } from './fourthOrder.js'
import { analyzeDoorTuning } from './doorTuning.js'

function resolvePortArea(chamber) {
  if (chamber.portInputMode === 'slot') {
    return portAreaFromSlot(
      chamber.portSlotWidthIn,
      chamber.portSlotHeightIn,
      chamber.portWallThicknessIn
    )
  }
  if (chamber.portInputMode === 'diameter' && chamber.portDiameterIn > 0) {
    return portAreaFromDiameter(chamber.portDiameterIn)
  }
  return chamber.portAreaSqIn || 0
}

function portFlangedForChamber(orderType, chamberIndex) {
  if (isFourth(orderType)) {
    return chamberIndex === 2
  }
  if (isPorted(orderType)) {
    return chamberIndex === 1
  }
  if (orderType === 'series') {
    return chamberIndex === 2
  }
  return true
}

function emptyPortResult() {
  return {
    physicalLengthIn: 0,
    calculatedLengthIn: 0,
    lengthOverridden: false,
    portVolumeCuFt: 0,
    endCorrectionK: 0,
    endCorrectionFactor: 0,
    commonWalls: undefined,
    isFlanged: undefined
  }
}

function breakdownOpts(chamber, build, portVolumeCuFt, driverShareCuFt) {
  return {
    volumeBasis: chamber.volumeBasis || 'net',
    netVolumeCuFt: chamber.volumeCuFt,
    grossVolumeCuFt: chamber.grossVolumeCuFt,
    grossLengthIn: chamber.grossLengthIn,
    grossWidthIn: chamber.grossWidthIn,
    grossHeightIn: chamber.grossHeightIn,
    measureFromOuter: chamber.measureFromOuter,
    wallThicknessIn: build.wallThicknessIn,
    portVolumeCuFt,
    driverShareCuFt,
    bracingPercent: 0,
    extraDisplacementCuIn: chamber.extraDisplacementCuIn,
    baffleCuFt: build.baffleShareCuFt ?? 0
  }
}

function runSealedChamberIteration(chamber, driverShareCuFt, build) {
  const volumeBasis = chamber.volumeBasis || 'net'
  let netVol = chamber.volumeCuFt
  const portResult = emptyPortResult()

  if (volumeBasis === 'net') {
    const breakdown = computeVolumeBreakdown({
      ...breakdownOpts(chamber, build, 0, driverShareCuFt),
      netVolumeCuFt: netVol
    })
    return { netVol, portResult, breakdown }
  }

  for (let pass = 0; pass < 3; pass++) {
    const breakdown = computeVolumeBreakdown({
      ...breakdownOpts(chamber, build, 0, driverShareCuFt),
      volumeBasis,
      netVolumeCuFt: netVol
    })
    netVol = breakdown.effectiveNetCuFt
    if (pass === 2) {
      return { netVol: breakdown.effectiveNetCuFt, portResult, breakdown }
    }
  }

  return { netVol, portResult, breakdown: null }
}

function endCorrectionForChamber(chamber, orderType, chamberIndex) {
  const portStyleMode = chamber.portStyleMode || PORT_STYLE_MODES.ROUND_AERO
  if (portStyleMode === PORT_STYLE_MODES.RECT_SLOT) {
    return {
      portStyleMode: PORT_STYLE_MODES.RECT_SLOT,
      commonWalls: clamp(Math.round(chamber.commonWalls ?? 0), 0, 3)
    }
  }
  return {
    portStyleMode: PORT_STYLE_MODES.ROUND_AERO,
    isFlanged: portFlangedForChamber(orderType, chamberIndex)
  }
}

function applyBoostAdjust(cabinGain, volumeCoupling, doorsOpen) {
  if (doorsOpen || cabinGain.dbBoost === 0) return cabinGain.dbBoost
  return cabinGain.dbBoost + volumeCoupling.boostAdjustDb
}

function slotInnerDims(chamber) {
  const t = chamber.portWallThicknessIn || 0
  return {
    innerWidthIn: Math.max(0, (chamber.portSlotWidthIn || 0) - 2 * t),
    innerHeightIn: Math.max(0, (chamber.portSlotHeightIn || 0) - 2 * t)
  }
}

function chamberPortResult(chamber, area, orderType, chamberIndex, netVol, calcMode) {
  return resolvePortResult({
    fbHz: chamber.fbHz,
    volumeCuFt: netVol,
    portAreaSqIn: area,
    endCorrectionOpts: endCorrectionForChamber(chamber, orderType, chamberIndex),
    portInputMode: chamber.portInputMode,
    portLengthOverrideIn: chamber.portLengthOverrideIn || 0,
    calcMode
  })
}

function resolveEffectiveFb(chamber, portResult, netVol, area, orderType, chamberIndex, calcMode) {
  if (!isLengthAdjustMode(chamber.portInputMode)) return chamber.fbHz
  return calculateFreqAtPortLengthByMode(
    calcMode,
    portResult.physicalLengthIn,
    netVol,
    area,
    endCorrectionForChamber(chamber, orderType, chamberIndex)
  )
}

function runChamberIteration(
  chamber,
  area,
  orderType,
  chamberIndex,
  driverShareCuFt,
  build,
  calcMode,
  breakdownPortVolumeCuFt = null
) {
  const volumeBasis = chamber.volumeBasis || 'net'
  let netVol = chamber.volumeCuFt
  let portResult = chamberPortResult(chamber, area, orderType, chamberIndex, netVol, calcMode)
  const portVolForBreakdown = (vol) =>
    breakdownPortVolumeCuFt != null ? breakdownPortVolumeCuFt : vol

  if (volumeBasis === 'net') {
    const breakdown = computeVolumeBreakdown({
      ...breakdownOpts(chamber, build, portVolForBreakdown(portResult.portVolumeCuFt), driverShareCuFt),
      netVolumeCuFt: netVol
    })
    return { netVol, portResult, breakdown }
  }

  for (let pass = 0; pass < 3; pass++) {
    portResult = chamberPortResult(chamber, area, orderType, chamberIndex, netVol, calcMode)
    const bdPortVol = portVolForBreakdown(portResult.portVolumeCuFt)
    const breakdown = computeVolumeBreakdown({
      ...breakdownOpts(chamber, build, bdPortVol, driverShareCuFt),
      volumeBasis,
      netVolumeCuFt: netVol
    })
    netVol = breakdown.effectiveNetCuFt
    if (pass === 2) {
      portResult = chamberPortResult(chamber, area, orderType, chamberIndex, netVol, calcMode)
      const finalBdPortVol = portVolForBreakdown(portResult.portVolumeCuFt)
      breakdown.portCuFt = finalBdPortVol
      breakdown.effectiveNetCuFt = computeVolumeBreakdown({
        ...breakdownOpts(chamber, build, finalBdPortVol, driverShareCuFt),
        volumeBasis,
        netVolumeCuFt: netVol
      }).effectiveNetCuFt
      return { netVol: breakdown.effectiveNetCuFt, portResult, breakdown }
    }
  }

  return { netVol, portResult, breakdown: null }
}

function splitSeriesInternalPort(totalCuFt, frontSharePct) {
  const front = totalCuFt * (frontSharePct / 100)
  return { total: totalCuFt, front, rear: totalCuFt - front }
}

export function runAll(inputs) {
  const {
    orderType = 'series',
    includeCabin = true,
    doorsOpen = false,
    driverSizeIn,
    driverCount,
    cabinLengthIn,
    vehicleInteriorCuFt,
    ampRackCuFt = 0,
    wallThicknessIn = DEFAULT_WALL_THICKNESS_IN,
    baffleThicknessIn = 0,
    ts,
    chamber1,
    chamber2,
    calcMode = CALC_MODES.HELMHOLTZ,
    doorTuningExperimental = false,
    doorWidthIn = 0,
    doorHeightIn = 0,
    doorJambThicknessIn = 0,
    isCabinSealed = false,
    cabinLeakageAreaSqIn = 15,
    port1FrontSharePct = 0
  } = inputs

  const cabinLeakage = doorTuningExperimental
    ? { isCabinSealed, leakAreaSqIn: cabinLeakageAreaSqIn }
    : null
  const closedGainSlope = cabinLeakage ? closedCabinGainSlope(cabinLeakage) : null

  const totalBaffleCuFt = isPorted(orderType)
    ? 0
    : baffleDisplacementCuFt(
        baffleFaceSqInFromChambers(chamber1, chamber2),
        baffleThicknessIn
      )
  const build = {
    wallThicknessIn,
    bracingPercent: 0,
    baffleShareCuFt: totalBaffleCuFt / 2
  }
  const isSeries = orderType === 'series'
  const area1 = isFourth(orderType) ? 0 : resolvePortArea(chamber1)
  const area2 = isPorted(orderType) ? 0 : resolvePortArea(chamber2)

  const driverArray = calculateDriverArray(driverSizeIn, driverCount)
  const tsForCalc = {
    ...ts,
    Sd: ts?.Sd || driverArray.totalSdSqIn,
    SdUnit: ts?.Sd ? ts.SdUnit : 'sqin'
  }
  const driverDisplacement = estimateDriverDisplacementCuFt(tsForCalc)
  const driverShare1 = isPorted(orderType) ? driverDisplacement : driverDisplacement / 2
  const driverShare2 = isPorted(orderType) ? 0 : driverDisplacement / 2

  let iter1 = isFourth(orderType)
    ? runSealedChamberIteration(chamber1, driverShare1, build)
    : runChamberIteration(chamber1, area1, orderType, 1, driverShare1, build, calcMode)
  let iter2 = isPorted(orderType)
    ? { netVol: 0, portResult: emptyPortResult(), breakdown: null }
    : runChamberIteration(chamber2, area2, orderType, 2, driverShare2, build, calcMode)

  const seriesFrontSharePct = isSeries ? clamp(port1FrontSharePct, 0, 100) : 0
  let internalPortSplit = { total: 0, front: 0, rear: 0 }
  let ch1PortVolBreakdown = iter1.portResult.portVolumeCuFt
  let ch2PortVolBreakdown = iter2.portResult?.portVolumeCuFt ?? 0

  if (isSeries && iter1.portResult.portVolumeCuFt > 0) {
    internalPortSplit = splitSeriesInternalPort(iter1.portResult.portVolumeCuFt, seriesFrontSharePct)
    ch1PortVolBreakdown = internalPortSplit.rear
    ch2PortVolBreakdown = (iter2.portResult?.portVolumeCuFt ?? 0) + internalPortSplit.front
    if (!isFourth(orderType)) {
      iter1 = runChamberIteration(
        chamber1, area1, orderType, 1, driverShare1, build, calcMode, ch1PortVolBreakdown
      )
    }
    if (!isPorted(orderType)) {
      iter2 = runChamberIteration(
        chamber2, area2, orderType, 2, driverShare2, build, calcMode, ch2PortVolBreakdown
      )
    }
  }

  const netVol1 = iter1.netVol
  const netVol2 = iter2.netVol
  const port1 = iter1.portResult
  const port2 = iter2.portResult

  const breakdown1 = iter1.breakdown || computeVolumeBreakdown({
    ...breakdownOpts(chamber1, build, ch1PortVolBreakdown, driverShare1),
    netVolumeCuFt: netVol1
  })
  const breakdown2 = iter2.breakdown || computeVolumeBreakdown({
    ...breakdownOpts(chamber2, build, ch2PortVolBreakdown, driverShare2),
    netVolumeCuFt: netVol2
  })

  const slot1Inner = chamber1.portInputMode === 'slot' ? slotInnerDims(chamber1) : null
  const slot2Inner = chamber2.portInputMode === 'slot' ? slotInnerDims(chamber2) : null

  const fb1 = isFourth(orderType) ? 0 : resolveEffectiveFb(chamber1, port1, netVol1, area1, orderType, 1, calcMode)
  const fb2 = isPorted(orderType) ? 0 : resolveEffectiveFb(chamber2, port2, netVol2, area2, orderType, 2, calcMode)

  const cabin1Closed = !includeCabin || isSeries || isFourth(orderType)
    ? { onsetFreqHz: 0, dbBoost: 0 }
    : calculateCabinGain(cabinLengthIn, fb1, false, cabinLeakage)
  const cabin1Open = !includeCabin || isSeries || isFourth(orderType)
    ? { onsetFreqHz: 0, dbBoost: 0 }
    : calculateCabinGain(cabinLengthIn, fb1, true)

  const externalFb = isPorted(orderType) ? fb1 : fb2
  const cabin2Closed = !includeCabin || isPorted(orderType)
    ? { onsetFreqHz: 0, dbBoost: 0 }
    : calculateCabinGain(cabinLengthIn, externalFb, false, cabinLeakage)
  const cabin2Open = !includeCabin || isPorted(orderType)
    ? { onsetFreqHz: 0, dbBoost: 0 }
    : calculateCabinGain(cabinLengthIn, externalFb, true)
  const cabinExternalClosed = !includeCabin
    ? { onsetFreqHz: 0, dbBoost: 0 }
    : isPorted(orderType)
      ? calculateCabinGain(cabinLengthIn, fb1, false, cabinLeakage)
      : cabin2Closed

  const packaging = estimateGrossVolumes(
    orderType,
    netVol1,
    isFourth(orderType) ? 0 : port1.portVolumeCuFt,
    netVol2,
    isPorted(orderType) ? 0 : port2.portVolumeCuFt,
    driverDisplacement
  )
  const effectiveCabinCuFt = computeEffectiveCabinCuFt(
    vehicleInteriorCuFt,
    packaging.totalGrossCuFt,
    ampRackCuFt
  )

  const volumeCoupling = includeCabin
    ? calculateCabinVolumeCoupling(
        effectiveCabinCuFt,
        netVol1,
        isPorted(orderType) ? 0 : netVol2,
        externalFb,
        cabinExternalClosed.onsetFreqHz,
        doorsOpen
      )
    : { boxRatio: 0, boostAdjustDb: 0, warnings: [] }

  const activeCabin1 = doorsOpen ? cabin1Open : cabin1Closed
  const activeCabin2 = doorsOpen ? cabin2Open : cabin2Closed

  const tsSuitability = evaluateDriverSuitability(tsForCalc, orderType)
  // Advisory only — never copied onto chamber1/chamber2 inputs from this result.
  const tsSuggestions = getTsSuggestions(tsForCalc)

  const excursion = analyzeChamberExcursion(
    tsForCalc,
    fb1,
    fb2,
    area1,
    area2,
    orderType
  )

  const portRatios = isPorted(orderType)
    ? getPortRatioWarnings(area1, 0, driverArray.totalSdSqIn)
    : isFourth(orderType)
      ? getPortRatioWarnings(0, area2, driverArray.totalSdSqIn)
      : getPortRatioWarnings(area1, area2, driverArray.totalSdSqIn)

  const chamber1PortRole = isFourth(orderType) ? 'sealed' : isSeries ? 'internal' : 'external'
  const chamber1CabinBoost = isFourth(orderType) || isSeries
    ? 0
    : applyBoostAdjust(activeCabin1, volumeCoupling, doorsOpen)
  const chamber1CabinClosed = isFourth(orderType) || isSeries
    ? 0
    : applyBoostAdjust(cabin1Closed, volumeCoupling, false)
  const chamber1CabinOpen = isFourth(orderType) || isSeries
    ? 0
    : applyBoostAdjust(cabin1Open, volumeCoupling, true)

  const externalCabinBoost = isPorted(orderType)
    ? applyBoostAdjust(activeCabin1, volumeCoupling, doorsOpen)
    : applyBoostAdjust(activeCabin2, volumeCoupling, doorsOpen)
  const externalCabinClosed = isPorted(orderType)
    ? applyBoostAdjust(cabin1Closed, volumeCoupling, false)
    : applyBoostAdjust(cabin2Closed, volumeCoupling, false)
  const externalCabinOpen = isPorted(orderType)
    ? applyBoostAdjust(cabin1Open, volumeCoupling, true)
    : applyBoostAdjust(cabin2Open, volumeCoupling, true)

  const chambers = {
    chamber1: {
      ...chamber1,
      calcMode,
      fbHz: fb1,
      fbComputedFromGeometry: isLengthAdjustMode(chamber1.portInputMode),
      volumeCuFt: netVol1,
      portAreaSqIn: area1,
      portAreaPerCuFt: portAreaPerNetCuFt(area1, netVol1),
      portDiameterIn:
        chamber1.portInputMode === 'diameter'
          ? chamber1.portDiameterIn
          : diameterFromPortArea(area1),
      portSlotInnerWidthIn: slot1Inner?.innerWidthIn,
      portSlotInnerHeightIn: slot1Inner?.innerHeightIn,
      portLengthIn: port1.physicalLengthIn,
      calculatedLengthIn: port1.calculatedLengthIn,
      lengthOverridden: port1.lengthOverridden,
      portVolumeCuFt: ch1PortVolBreakdown,
      internalPortTotalCuFt: isSeries ? internalPortSplit.total : 0,
      internalPortFrontShareCuFt: isSeries ? internalPortSplit.front : 0,
      port1FrontSharePct: seriesFrontSharePct,
      endCorrectionK: port1.endCorrectionK,
      endCorrectionFactor: port1.endCorrectionFactor,
      commonWalls: port1.commonWalls,
      isFlanged: port1.isFlanged,
      portRole: chamber1PortRole,
      volumeBreakdown: breakdown1,
      cabinBoostDb: chamber1CabinBoost,
      cabinBoostClosedDb: chamber1CabinClosed,
      cabinBoostOpenDb: chamber1CabinOpen,
      cabinOnsetHz: cabinExternalClosed.onsetFreqHz,
      isSealed: isFourth(orderType)
    },
    chamber2: {
      ...chamber2,
      calcMode,
      fbHz: fb2,
      fbComputedFromGeometry: isLengthAdjustMode(chamber2.portInputMode),
      volumeCuFt: netVol2,
      portAreaSqIn: area2,
      portAreaPerCuFt: portAreaPerNetCuFt(area2, netVol2),
      portDiameterIn:
        chamber2.portInputMode === 'diameter'
          ? chamber2.portDiameterIn
          : diameterFromPortArea(area2),
      portSlotInnerWidthIn: slot2Inner?.innerWidthIn,
      portSlotInnerHeightIn: slot2Inner?.innerHeightIn,
      portLengthIn: port2.physicalLengthIn,
      calculatedLengthIn: port2.calculatedLengthIn,
      lengthOverridden: port2.lengthOverridden,
      portVolumeCuFt: ch2PortVolBreakdown,
      internalPortFrontShareCuFt: isSeries ? internalPortSplit.front : 0,
      endCorrectionK: port2.endCorrectionK,
      endCorrectionFactor: port2.endCorrectionFactor,
      commonWalls: port2.commonWalls,
      isFlanged: port2.isFlanged,
      portRole: isPorted(orderType) ? 'unused' : 'external',
      volumeBreakdown: breakdown2,
      cabinBoostDb: isPorted(orderType) ? 0 : externalCabinBoost,
      cabinBoostClosedDb: isPorted(orderType) ? 0 : externalCabinClosed,
      cabinBoostOpenDb: isPorted(orderType) ? 0 : externalCabinOpen,
      cabinOnsetHz: cabinExternalClosed.onsetFreqHz
    }
  }

  const sensitivity = { enabled: false, tolerancePercent: 0, volumeSweep: null, portAreaSweep: null, callouts: [] }

  let fourthOrderAnalysis = null
  if (isFourth(orderType)) {
    fourthOrderAnalysis = analyzeFourthOrderCompatibility({
      fs: ts?.Fs,
      vas: ts?.Vas,
      vasUnit: ts?.VasUnit || 'cuft',
      qts: ts?.Qts,
      vrCuFt: netVol1,
      vfCuFt: netVol2,
      f2Hz: fb2,
      driverCount: driverArray.count
    })
  }

  const frontTuningHz = primaryTuningFb(orderType, fb1, fb2)
  const frontTuningLabel = isPorted(orderType) ? 'Fb' : isFourth(orderType) ? 'F2' : 'Fb2'
  const doorTuningAnalysis = analyzeDoorTuning({
    enabled: doorTuningExperimental,
    cabinVolCuFt: effectiveCabinCuFt,
    doorWidthIn,
    doorHeightIn,
    jambThicknessIn: doorJambThicknessIn,
    frontTuningHz,
    frontTuningLabel,
    isCabinSealed,
    cabinLeakageAreaSqIn,
    closedGainSlope
  })

  const allWarnings = [
    ...(includeCabin ? volumeCoupling.warnings : []),
    ...getTsWarnings(tsForCalc, fb1, fb2),
    ...excursion.excursionWarnings,
    ...(portRatios.port1 && !isFourth(orderType) && portRatios.port1.level !== 'green'
      ? [{ level: portRatios.port1.level, message: `P1 port:Sd — ${portRatios.port1.message}` }]
      : []),
    ...(portRatios.port2 && !isPorted(orderType) && portRatios.port2.level !== 'green'
      ? [{ level: portRatios.port2.level, message: `${isFourth(orderType) ? 'Port' : 'P2'} port:Sd — ${portRatios.port2.message}` }]
      : []),
    ...(excursion.chamber1.velocityWarning && excursion.chamber1.velocityWarning.level !== 'green'
      ? [excursion.chamber1.velocityWarning]
      : []),
    ...(excursion.chamber2.velocityWarning && excursion.chamber2.velocityWarning.level !== 'green'
      ? [excursion.chamber2.velocityWarning]
      : []),
    ...packaging.warnings
  ]

  if (fourthOrderAnalysis?.fightingBox) {
    allWarnings.unshift({
      level: 'red',
      message: fourthOrderAnalysis.compatibilityMessage
    })
  } else if (fourthOrderAnalysis?.qtcNotes?.length) {
    fourthOrderAnalysis.qtcNotes.forEach((note) => {
      allWarnings.push({ level: 'amber', message: note })
    })
  }

  if (doorTuningAnalysis?.coupled) {
    allWarnings.unshift({
      level: 'amber',
      message: doorTuningAnalysis.message
    })
  }

  const passbandBandwidth = estimateBandwidth(
    fb1,
    fb2,
    netVol1,
    netVol2,
    orderType
  )
  const fh = passbandBandwidth?.centerHz || 0
  const inCarResponse = estimateInCarResponse(
    cabinLengthIn,
    fb1,
    fb2,
    volumeCoupling.boxRatio,
    20,
    80,
    orderType,
    cabinLeakage,
    includeCabin
  )
  const cabinCurves = includeCabin
    ? cabinGainCurveDual(cabinLengthIn, 20, 80, 60, cabinLeakage)
    : { closed: [], open: [] }
  const markers = getMarkerFrequencies(
    fb1,
    fb2,
    cabinExternalClosed.onsetFreqHz,
    netVol1,
    netVol2,
    orderType
  )

  if (passbandBandwidth?.warning) {
    allWarnings.push({
      level: passbandBandwidth.level,
      message: `Passband: ${passbandBandwidth.warning}`
    })
  }

  return {
    orderType,
    includeCabin,
    doorsOpen,
    calcMode,
    driverArray,
    portRatios,
    chambers,
    volumeBreakdown: { chamber1: breakdown1, chamber2: breakdown2 },
    sensitivity,
    passbandBandwidth,
    fhHz: fh,
    cabinOnsetHz: cabinExternalClosed.onsetFreqHz,
    volumeCoupling,
    vehicleInteriorCuFt: round(vehicleInteriorCuFt || 0, 2),
    ampRackCuFt: round(ampRackCuFt || 0, 2),
    effectiveCabinCuFt: round(effectiveCabinCuFt, 2),
    tsSuitability,
    tsSuggestions,
    driverDisplacementCuFt: driverDisplacement,
    excursion,
    packaging,
    fourthOrderAnalysis,
    doorTuningAnalysis,
    warnings: allWarnings,
    charts: {
      cabinCurveClosed: cabinCurves.closed,
      cabinCurveOpen: cabinCurves.open,
      inCarResponseClosed: inCarResponse.closed,
      inCarResponseOpen: inCarResponse.open,
      markers,
      sensitivity
    },
    summary: {
      orderType,
      doorsOpen,
      totalNetCuFt: round(isPorted(orderType) ? netVol1 : netVol1 + netVol2, 2),
      totalPortDisplacementCuFt: round(
        (isFourth(orderType) ? 0 : port1.portVolumeCuFt) + (isPorted(orderType) ? 0 : port2.portVolumeCuFt),
        3
      ),
      totalGrossCuFt: round(packaging.totalGrossCuFt, 2),
      vehicleInteriorCuFt: round(vehicleInteriorCuFt || 0, 2),
      ampRackCuFt: round(ampRackCuFt || 0, 2),
      effectiveCabinCuFt: round(effectiveCabinCuFt, 2),
      hasTs: hasTsParams(ts),
      cabinBoostFb2Closed: externalCabinClosed,
      cabinBoostFb2Open: externalCabinOpen,
      cabinBoostFb2Active: externalCabinBoost,
      primaryTuningHz: primaryTuningFb(orderType, fb1, fb2),
      totalSdSqIn: round(driverArray.totalSdSqIn, 1),
      driverCount: driverArray.count,
      driverSizeIn: driverArray.sizeIn,
      wallThicknessIn,
      passbandBandwidthHz: passbandBandwidth ? round(passbandBandwidth.bandwidthHz, 1) : null,
      passbandLowHz: passbandBandwidth ? round(passbandBandwidth.lowHz, 1) : null,
      passbandHighHz: passbandBandwidth ? round(passbandBandwidth.highHz, 1) : null,
      passbandOctaves: passbandBandwidth ? round(passbandBandwidth.octaveSpread, 2) : null,
      passbandVolumeRatio: passbandBandwidth ? round(passbandBandwidth.volumeRatio, 2) : null,
      fcbHz: fourthOrderAnalysis?.fcbHz ? round(fourthOrderAnalysis.fcbHz, 1) : null,
      qtc: fourthOrderAnalysis?.qtc ? round(fourthOrderAnalysis.qtc, 3) : null,
      vfVrRatio: fourthOrderAnalysis?.volumeRatio ? round(fourthOrderAnalysis.volumeRatio, 2) : null,
      closedGainSlope: closedGainSlope != null ? round(closedGainSlope, 1) : null
    }
  }
}
