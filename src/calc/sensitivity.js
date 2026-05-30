import { calculatePortLengthByMode, calculateFbFromPort, CALC_MODES, PORT_STYLE_MODES } from './port.js'
import { portAirVelocityMps } from './excursion.js'
import { clamp } from './constants.js'
import { isFourth, isPorted } from './orderTypes.js'

export function sweepVolumeSensitivity({
  fbHz,
  volumeCuFt,
  portAreaSqIn,
  endCorrectionOpts,
  tolerancePercent = 10,
  steps = 21,
  calcMode = CALC_MODES.HELMHOLTZ
}) {
  if (!fbHz || !volumeCuFt || !portAreaSqIn) return []

  const points = []
  const minPct = -Math.abs(tolerancePercent)
  const maxPct = Math.abs(tolerancePercent)

  for (let i = 0; i < steps; i++) {
    const pctError = minPct + ((maxPct - minPct) * i) / (steps - 1)
    const adjustedVol = volumeCuFt * (1 + pctError / 100)
    const driftFb = calculateFbFromPort(fbHz, volumeCuFt, adjustedVol, portAreaSqIn)
    const portAtDrift = calculatePortLengthByMode(calcMode, driftFb, adjustedVol, portAreaSqIn, endCorrectionOpts)
    const portHoldFb = calculatePortLengthByMode(calcMode, fbHz, adjustedVol, portAreaSqIn, endCorrectionOpts)

    points.push({
      pctError,
      volumeCuFt: adjustedVol,
      driftFbHz: driftFb,
      portLengthDriftIn: portAtDrift.physicalLengthIn,
      portLengthHoldFbIn: portHoldFb.physicalLengthIn
    })
  }

  return points
}

export function sweepPortAreaSensitivity({
  fbHz,
  volumeCuFt,
  portAreaSqIn,
  endCorrectionOpts,
  sdSqIn = 0,
  xmaxMm = 0,
  tolerancePercent = 10,
  steps = 21,
  calcMode = CALC_MODES.HELMHOLTZ
}) {
  if (!fbHz || !volumeCuFt || !portAreaSqIn) return []

  const points = []
  const minPct = -Math.abs(tolerancePercent)
  const maxPct = Math.abs(tolerancePercent)
  const basePort = calculatePortLengthByMode(calcMode, fbHz, volumeCuFt, portAreaSqIn, endCorrectionOpts)
  const baseVel = sdSqIn && xmaxMm ? portAirVelocityMps(sdSqIn, xmaxMm, fbHz, portAreaSqIn) : 0

  for (let i = 0; i < steps; i++) {
    const pctError = minPct + ((maxPct - minPct) * i) / (steps - 1)
    const adjustedArea = portAreaSqIn * (1 + pctError / 100)
    const port = calculatePortLengthByMode(calcMode, fbHz, volumeCuFt, adjustedArea, endCorrectionOpts)
    const velocityMps =
      sdSqIn && xmaxMm ? portAirVelocityMps(sdSqIn, xmaxMm, fbHz, adjustedArea) : 0

    points.push({
      pctError,
      portAreaSqIn: adjustedArea,
      portLengthIn: port.physicalLengthIn,
      portLengthDeltaIn: port.physicalLengthIn - basePort.physicalLengthIn,
      velocityMps,
      velocityDeltaMps: velocityMps - baseVel
    })
  }

  return points
}

function endCorrectionFromChamber(chamber, orderType, chamberIndex) {
  const portStyleMode = chamber.portStyleMode || PORT_STYLE_MODES.ROUND_AERO
  if (portStyleMode === PORT_STYLE_MODES.RECT_SLOT) {
    return {
      portStyleMode: PORT_STYLE_MODES.RECT_SLOT,
      commonWalls: clamp(Math.round(chamber.commonWalls ?? 0), 0, 3)
    }
  }
  if (isFourth(orderType)) {
    return { portStyleMode: PORT_STYLE_MODES.ROUND_AERO, isFlanged: chamberIndex === 2 }
  }
  if (isPorted(orderType)) {
    return { portStyleMode: PORT_STYLE_MODES.ROUND_AERO, isFlanged: true }
  }
  const isFlanged = orderType === 'series' ? chamberIndex === 2 : true
  return { portStyleMode: PORT_STYLE_MODES.ROUND_AERO, isFlanged }
}

export function buildSensitivityReport(
  chamber1,
  chamber2,
  orderType,
  ts,
  tolerancePercent,
  calcMode = CALC_MODES.HELMHOLTZ
) {
  const endCorrection1 = endCorrectionFromChamber(chamber1, orderType, 1)
  const endCorrection2 = endCorrectionFromChamber(chamber2, orderType, 2)

  const vol1 = isFourth(orderType)
    ? []
    : sweepVolumeSensitivity({
        fbHz: chamber1.fbHz,
        volumeCuFt: chamber1.volumeCuFt,
        portAreaSqIn: chamber1.portAreaSqIn,
        endCorrectionOpts: endCorrection1,
        tolerancePercent,
        calcMode
      })

  const vol2 = isPorted(orderType)
    ? []
    : sweepVolumeSensitivity({
        fbHz: chamber2.fbHz,
        volumeCuFt: chamber2.volumeCuFt,
        portAreaSqIn: chamber2.portAreaSqIn,
        endCorrectionOpts: endCorrection2,
        tolerancePercent,
        calcMode
      })

  const sd = ts?.Sd || 0
  const xmax = ts?.Xmax || 0

  const area1 = isFourth(orderType)
    ? []
    : sweepPortAreaSensitivity({
        fbHz: chamber1.fbHz,
        volumeCuFt: chamber1.volumeCuFt,
        portAreaSqIn: chamber1.portAreaSqIn,
        endCorrectionOpts: endCorrection1,
        sdSqIn: sd,
        xmaxMm: xmax,
        tolerancePercent,
        calcMode
      })

  const area2 = isPorted(orderType)
    ? []
    : sweepPortAreaSensitivity({
        fbHz: chamber2.fbHz,
        volumeCuFt: chamber2.volumeCuFt,
        portAreaSqIn: chamber2.portAreaSqIn,
        endCorrectionOpts: endCorrection2,
        sdSqIn: sd,
        xmaxMm: xmax,
        tolerancePercent,
        calcMode
      })

  const callouts = []

  if (isFourth(orderType)) {
    const vol2only = sweepVolumeSensitivity({
      fbHz: chamber2.fbHz,
      volumeCuFt: chamber2.volumeCuFt,
      portAreaSqIn: chamber2.portAreaSqIn,
      endCorrectionOpts: endCorrection2,
      tolerancePercent,
      calcMode
    })
    const pct5front = vol2only.find((p) => Math.abs(p.pctError + 5) < 0.6)
    if (pct5front && chamber2.fbHz) {
      callouts.push(
        `If ported front measures 5% small, Fb rises from ${chamber2.fbHz.toFixed(1)} → ${pct5front.driftFbHz.toFixed(1)} Hz`
      )
    }
  } else {
    const pct5 = vol1.find((p) => Math.abs(p.pctError + 5) < 0.6)
    if (pct5 && chamber1.fbHz) {
      const label = isPorted(orderType) ? 'Fb' : 'Fb1'
      callouts.push(
        `If ${isPorted(orderType) ? 'chamber' : 'rear chamber'} measures 5% small, ${label} rises from ${chamber1.fbHz.toFixed(1)} → ${pct5.driftFbHz.toFixed(1)} Hz`
      )
    }
  }

  const pct5b = vol2.find((p) => Math.abs(p.pctError + 5) < 0.6)
  if (pct5b && chamber2.fbHz && !isPorted(orderType) && !isFourth(orderType)) {
    callouts.push(
      `If front chamber measures 5% small, Fb2 rises from ${chamber2.fbHz.toFixed(1)} → ${pct5b.driftFbHz.toFixed(1)} Hz`
    )
  }

  return {
    tolerancePercent,
    enabled: true,
    volumeSweep: { chamber1: isFourth(orderType) ? [] : vol1, chamber2: vol2 },
    portAreaSweep: { chamber1: area1, chamber2: area2 },
    callouts
  }
}
