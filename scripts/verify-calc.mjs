import {
  calculatePortLength,
  calculateQuarterWaveLength,
  calculateAllConsideredLength,
  calculatePortLengthByMode,
  calculateFreqAtPortLengthByMode,
  portAreaFromSlot,
  portAreaPerNetCuFt,
  calculateFbFromPort,
  calculateFreqAtPortLength,
  resolvePortResult,
  CALC_MODES,
  PORT_STYLE_MODES,
  endCorrectionK
} from '../src/calc/port.js'
import { calculateCabinGain, closedCabinGainSlope } from '../src/calc/cabin.js'
import { estimateSd, getPortRatioWarning } from '../src/calc/driverArray.js'
import {
  computeVolumeBreakdown,
  internalDimsFromOuter,
  volumeCuFtFromDims
} from '../src/calc/volumeAccounting.js'
import { sweepVolumeSensitivity } from '../src/calc/sensitivity.js'
import { estimateBandwidth } from '../src/calc/response.js'
import { runAll } from '../src/calc/engine.js'
import {
  calculateSealedChamber,
  analyzeFourthOrderRatio,
  analyzeFourthOrderCompatibility
} from '../src/calc/fourthOrder.js'
import {
  calculateDoorTuning,
  analyzeDoorTuningCoupling,
  computeJambForTargetHz
} from '../src/calc/doorTuning.js'

function assertClose(actual, expected, tolerance, label) {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`)
  }
}

function netChamber(overrides = {}) {
  return {
    fbHz: 30,
    volumeBasis: 'net',
    volumeCuFt: 2,
    portInputMode: 'area',
    portAreaSqIn: 22,
    portDiameterIn: 0,
    extraDisplacementCuIn: 0,
    ...overrides
  }
}

const portParallel = calculatePortLength(28, 3.5, 30, true)
assertClose(portParallel.physicalLengthIn, 26.96, 0.1, 'Parallel port length (flanged)')

const portSeriesInternal = calculatePortLength(28, 3.5, 30, false)
assertClose(portSeriesInternal.physicalLengthIn, 27.33, 0.1, 'Series internal port length (free-standing)')

const override = resolvePortResult({
  fbHz: 28,
  volumeCuFt: 3.5,
  portAreaSqIn: 30,
  isFlanged: true,
  portInputMode: 'diameter',
  portLengthOverrideIn: 20
})
if (!override.lengthOverridden || override.physicalLengthIn !== 20) {
  throw new Error('Diameter/slot length override should use entered length')
}

const roundTripFb = calculateFreqAtPortLength(portParallel.physicalLengthIn, 3.5, 30, true)
assertClose(roundTripFb, 28, 0.05, 'Inverse Helmholtz round-trip (flanged)')

assertClose(endCorrectionK({ portStyleMode: PORT_STYLE_MODES.RECT_SLOT, commonWalls: 0 }), 1.346, 0.001, 'Rect slot k at 0 walls')
assertClose(endCorrectionK({ portStyleMode: PORT_STYLE_MODES.RECT_SLOT, commonWalls: 2 }), 1.8, 0.001, 'Rect slot k at 2 walls')

const rectSlotPort = calculatePortLength(28, 3.5, 30, {
  portStyleMode: PORT_STYLE_MODES.RECT_SLOT,
  commonWalls: 2
})
if (rectSlotPort.physicalLengthIn >= portParallel.physicalLengthIn) {
  throw new Error('Rect slot end correction should shorten physical port vs round flanged')
}

const rectRoundTrip = calculateFreqAtPortLength(rectSlotPort.physicalLengthIn, 3.5, 30, {
  portStyleMode: PORT_STYLE_MODES.RECT_SLOT,
  commonWalls: 2
})
assertClose(rectRoundTrip, 28, 0.5, 'Rect slot inverse round-trip')

const quarterWave = calculateQuarterWaveLength(28, 30, true)
assertClose(quarterWave.rawLengthIn, 13504 / (4 * 28), 0.01, 'Quarter wave raw length')
assertClose(
  quarterWave.physicalLengthIn,
  quarterWave.rawLengthIn - quarterWave.endCorrectionIn,
  0.01,
  'Quarter wave physical length'
)

const mltl = calculateAllConsideredLength(28, 3.5, 30, true)
if (mltl.physicalLengthIn <= 0) throw new Error('MLTL should yield positive port length')

const mltlRoundTrip = calculateFreqAtPortLengthByMode(
  CALC_MODES.ALL_CONSIDERED,
  mltl.physicalLengthIn,
  3.5,
  30,
  true
)
assertClose(mltlRoundTrip, 28, 0.5, 'MLTL inverse round-trip')

const byMode = calculatePortLengthByMode(CALC_MODES.HELMHOLTZ, 28, 3.5, 30, true)
assertClose(byMode.physicalLengthIn, portParallel.physicalLengthIn, 0.001, 'Port length by mode dispatcher')

const slotArea = portAreaFromSlot(11, 2.5, 0.75)
assertClose(slotArea, 9.5 * 1, 0.01, 'Slot port inner area with 0.75" walls')

const inner = internalDimsFromOuter(20, 14, 18, 1.5)
assertClose(inner.lengthIn, 17, 0.01, 'Inner length after 1.5" walls')
assertClose(inner.widthIn, 11, 0.01, 'Inner width after 1.5" walls')
assertClose(inner.heightIn, 15, 0.01, 'Inner height after 1.5" walls')

const innerVol = volumeCuFtFromDims(inner.lengthIn, inner.widthIn, inner.heightIn)
assertClose(innerVol, (17 * 11 * 15) / 1728, 0.01, 'Inner volume from outer dims')

const driftFb = calculateFbFromPort(30, 2.0, 1.9, 22)
assertClose(driftFb, 30 * Math.sqrt(2 / 1.9), 0.05, 'Fb drift when volume 5% low')

const cabinClosed = calculateCabinGain(120, 28, false)
assertClose(cabinClosed.onsetFreqHz, 56.27, 0.1, 'Cabin onset frequency')
assertClose(cabinClosed.dbBoost, 12.1, 0.5, 'Cabin boost closed at 28 Hz')

const cabinOpen = calculateCabinGain(120, 28, true)
assertClose(cabinOpen.dbBoost, 3.0, 0.15, 'Cabin boost open at 28 Hz')
assertClose(cabinOpen.dbBoost, cabinClosed.dbBoost * (3 / 12), 0.05, 'Open boost is 1/4 of closed')

assertClose(closedCabinGainSlope({ isCabinSealed: true, leakAreaSqIn: 15 }), 12, 0.001, 'Sealed cabin slope')
assertClose(closedCabinGainSlope({ isCabinSealed: false, leakAreaSqIn: 15 }), 9, 0.001, 'Leak 15 sq in slope')
assertClose(closedCabinGainSlope({ isCabinSealed: false, leakAreaSqIn: 45 }), 3, 0.001, 'Leak 45 sq in slope floor')

const cabinSealedGain = calculateCabinGain(120, 28, false, { isCabinSealed: true, leakAreaSqIn: 0 })
assertClose(cabinSealedGain.gainSlope, 12, 0.001, 'Sealed cabin gain slope in calculateCabinGain')
const cabinLeakGain = calculateCabinGain(120, 28, false, { isCabinSealed: false, leakAreaSqIn: 15 })
assertClose(cabinLeakGain.gainSlope, 9, 0.001, 'Leaky cabin gain slope in calculateCabinGain')
assertClose(cabinLeakGain.dbBoost, cabinClosed.dbBoost * (9 / 12), 0.15, 'Leaky cabin boost scales with degraded slope')

assertClose(estimateSd(15), 125, 0.01, 'Standard 15" Sd')

const ratioRed = getPortRatioWarning(22, 250)
if (ratioRed.level !== 'red') throw new Error('Expected red port ratio warning for 22/250')

const breakdown = computeVolumeBreakdown({
  volumeBasis: 'grossDims',
  grossLengthIn: 20,
  grossWidthIn: 14,
  grossHeightIn: 18,
  measureFromOuter: true,
  wallThicknessIn: 1.5,
  portVolumeCuFt: 0.1,
  driverShareCuFt: 0.05,
  bracingPercent: 15,
  extraDisplacementCuIn: 0
})
if (breakdown.effectiveNetCuFt <= 0) {
  throw new Error('Gross dims breakdown should yield positive net volume')
}

const netBreakdown = computeVolumeBreakdown({
  volumeBasis: 'net',
  netVolumeCuFt: 2,
  portVolumeCuFt: 0.35,
  driverShareCuFt: 0.1,
  bracingPercent: 15,
  extraDisplacementCuIn: 0
})
assertClose(netBreakdown.additionalBeyondNetCuFt, 0.35 + 0.1 + netBreakdown.bracingCuFt, 0.01, 'Net mode additional beyond net')
assertClose(netBreakdown.requiredGrossCuFt, 2 + netBreakdown.additionalBeyondNetCuFt, 0.01, 'Net mode gross required')

assertClose(portAreaPerNetCuFt(22, 2), 11, 0.01, 'Port area per net cu ft')

const seriesResult = runAll({
  orderType: 'series',
  doorsOpen: false,
  driverSizeIn: 15,
  driverCount: 2,
  wallThicknessIn: 1.5,
  bracingPercent: 15,
  tolerancePercent: 10,
  cabinLengthIn: 120,
  cabinVolumeCuFt: 80,
  maxDepthIn: 18,
  maxHeightIn: 14,
  maxWidthIn: 52,
  ts: { Fs: null, Qts: null, Qes: null, Vas: null, Sd: null },
  chamber1: netChamber({ fbHz: 30, volumeCuFt: 2, portAreaSqIn: 22 }),
  chamber2: netChamber({ fbHz: 60, volumeCuFt: 4, portAreaSqIn: 30 })
})

if (seriesResult.summary.totalSdSqIn !== 250) {
  throw new Error(`Expected total Sd 250, got ${seriesResult.summary.totalSdSqIn}`)
}
if (!seriesResult.sensitivity?.volumeSweep?.chamber1?.length) {
  throw new Error('Sensitivity sweep not generated')
}
assertClose(seriesResult.chambers.chamber1.portAreaPerCuFt, 11, 0.5, 'Series Ch.1 port area per cu ft')

const rectSlotResult = runAll({
  orderType: 'series',
  driverSizeIn: 15,
  driverCount: 2,
  wallThicknessIn: 1.5,
  bracingPercent: 15,
  cabinLengthIn: 120,
  cabinVolumeCuFt: 80,
  maxDepthIn: 18,
  maxHeightIn: 14,
  maxWidthIn: 52,
  ts: {},
  chamber1: netChamber({
    fbHz: 30,
    volumeCuFt: 2,
    portAreaSqIn: 22,
    portStyleMode: PORT_STYLE_MODES.RECT_SLOT,
    commonWalls: 2
  }),
  chamber2: netChamber({
    fbHz: 60,
    volumeCuFt: 4,
    portAreaSqIn: 30,
    portStyleMode: PORT_STYLE_MODES.RECT_SLOT,
    commonWalls: 0
  })
})
assertClose(rectSlotResult.chambers.chamber1.endCorrectionK, 1.8, 0.01, 'Engine rect slot Ch.1 endCorrectionK')
assertClose(rectSlotResult.chambers.chamber2.endCorrectionK, 1.346, 0.01, 'Engine rect slot Ch.2 endCorrectionK')

const grossResult = runAll({
  orderType: 'series',
  driverSizeIn: 15,
  driverCount: 2,
  wallThicknessIn: 1.5,
  bracingPercent: 15,
  cabinLengthIn: 120,
  cabinVolumeCuFt: 80,
  maxDepthIn: 18,
  maxHeightIn: 14,
  maxWidthIn: 52,
  ts: {},
  chamber1: {
    fbHz: 30,
    volumeBasis: 'grossDims',
    volumeCuFt: 0,
    grossLengthIn: 20,
    grossWidthIn: 14,
    grossHeightIn: 18,
    measureFromOuter: true,
    portInputMode: 'slot',
    portSlotWidthIn: 11,
    portSlotHeightIn: 2.5,
    portWallThicknessIn: 0.75,
    extraDisplacementCuIn: 0
  },
  chamber2: netChamber({ fbHz: 60, volumeCuFt: 4, portAreaSqIn: 30 })
})

if (grossResult.chambers.chamber1.volumeCuFt <= 0) {
  throw new Error('Gross dims chamber should compute effective net volume')
}
if (!grossResult.chambers.chamber1.portSlotInnerWidthIn) {
  throw new Error('Slot inner dims missing')
}

const volSweep = sweepVolumeSensitivity({
  fbHz: 30,
  volumeCuFt: 2,
  portAreaSqIn: 22,
  isFlanged: false,
  tolerancePercent: 10
})
if (volSweep.length < 10) throw new Error('Volume sensitivity sweep too short')

const bw = estimateBandwidth(30, 60, 2, 4)
if (!bw || bw.bandwidthHz <= 0) throw new Error('Passband bandwidth estimate invalid for 30/60 Hz')
assertClose(bw.lowHz, 30 * 0.85, 0.01, 'Est. low edge Fb1×0.85')
assertClose(bw.highHz, 60 * 1.15, 0.01, 'Est. high edge Fb2×1.15')
assertClose(bw.octaveSpread, Math.log2(2), 0.01, 'Tuning octave spread')
assertClose(bw.volumeRatio, 2, 0.01, 'Front:rear volume ratio')
if (bw.level !== 'amber') throw new Error('Expected narrow passband warning for 1 oct spread')
if (seriesResult.passbandBandwidth?.bandwidthHz !== bw.bandwidthHz) {
  throw new Error('Engine passband bandwidth mismatch')
}

const parallelResult = runAll({
  orderType: 'parallel',
  doorsOpen: false,
  driverSizeIn: 15,
  driverCount: 1,
  cabinLengthIn: 120,
  cabinVolumeCuFt: 80,
  maxDepthIn: 18,
  maxHeightIn: 14,
  maxWidthIn: 52,
  ts: {},
  chamber1: netChamber({ fbHz: 28, volumeCuFt: 3.5, portAreaSqIn: 30 }),
  chamber2: netChamber({ fbHz: 52, volumeCuFt: 2.2, portAreaSqIn: 24 })
})

const openResult = runAll({
  orderType: 'parallel',
  doorsOpen: true,
  cabinLengthIn: 120,
  cabinVolumeCuFt: 80,
  maxDepthIn: 18,
  maxHeightIn: 14,
  maxWidthIn: 52,
  ts: {},
  chamber1: netChamber({ fbHz: 28, volumeCuFt: 3.5, portAreaSqIn: 30 }),
  chamber2: netChamber({ fbHz: 52, volumeCuFt: 2.2, portAreaSqIn: 24 })
})

if (!openResult.charts.cabinCurveClosed?.length || !openResult.charts.cabinCurveOpen?.length) {
  throw new Error('Dual cabin curves not generated')
}
if (openResult.chambers.chamber2.cabinBoostDb >= parallelResult.chambers.chamber2.cabinBoostDb) {
  throw new Error('Doors open should reduce active cabin boost vs closed')
}

const portedResult = runAll({
  orderType: 'ported',
  cabinLengthIn: 120,
  cabinVolumeCuFt: 80,
  driverSizeIn: 15,
  driverCount: 2,
  ts: {},
  chamber1: netChamber({ fbHz: 32, volumeCuFt: 3.0, portAreaSqIn: 28 }),
  chamber2: netChamber({ fbHz: 60, volumeCuFt: 4.0, portAreaSqIn: 30 })
})

if (portedResult.chambers.chamber1.portLengthIn <= 0) {
  throw new Error('Ported mode should compute port length for chamber 1')
}
if (portedResult.summary.totalNetCuFt !== portedResult.chambers.chamber1.volumeCuFt) {
  throw new Error('Ported mode total net should equal chamber 1 only')
}
if (portedResult.chambers.chamber2.volumeCuFt !== 0) {
  throw new Error('Ported mode should ignore chamber 2 volume')
}

const fourthResult = runAll({
  orderType: 'fourth',
  cabinLengthIn: 120,
  cabinVolumeCuFt: 80,
  driverSizeIn: 15,
  driverCount: 2,
  ts: {},
  chamber1: netChamber({ fbHz: 30, volumeCuFt: 1.5, portAreaSqIn: 22 }),
  chamber2: netChamber({ fbHz: 55, volumeCuFt: 3.0, portAreaSqIn: 26 })
})

if (fourthResult.chambers.chamber1.portVolumeCuFt !== 0) {
  throw new Error('4th order sealed rear should have zero port displacement')
}
if (fourthResult.chambers.chamber1.portRole !== 'sealed') {
  throw new Error('4th order chamber 1 should be sealed')
}
if (fourthResult.chambers.chamber2.portLengthIn <= 0) {
  throw new Error('4th order should compute front port length')
}
if (fourthResult.chambers.chamber2.cabinBoostDb <= 0 && fourthResult.chambers.chamber2.fbHz > 0) {
  throw new Error('4th order external port should receive cabin boost when Fb2 set')
}

const sealedCase = calculateSealedChamber(30, 2, 0.4, 1.5)
assertClose(sealedCase.fcbHz, 30 * Math.sqrt(1 + 2 / 1.5), 0.05, 'Fcb sealed rear')
assertClose(sealedCase.qtc, 0.4 * Math.sqrt(1 + 2 / 1.5), 0.001, 'Qtc sealed rear')
if (!sealedCase.valid) throw new Error('Fcb case should be valid')

const ratioStreet = analyzeFourthOrderRatio(3, 1.5)
if (ratioStreet.profileKey !== 'street') {
  throw new Error(`Ratio 2.0 should be street profile, got ${ratioStreet.profileKey}`)
}
if (!ratioStreet.profile.includes('Street Banger')) {
  throw new Error('Ratio 2.0 profile text should mention Street Banger')
}

const fightCompat = analyzeFourthOrderCompatibility({
  fs: 30,
  vas: 2,
  qts: 0.4,
  vrCuFt: 1.5,
  vfCuFt: 3,
  f2Hz: 40,
  driverCount: 1
})
if (!fightCompat.fightingBox) {
  throw new Error('Fcb > F2 should set fightingBox true')
}
if (!fightCompat.disclaimer) {
  throw new Error('Fighting box should include disclaimer')
}

const fourthTsResult = runAll({
  orderType: 'fourth',
  cabinLengthIn: 120,
  cabinVolumeCuFt: 80,
  driverSizeIn: 15,
  driverCount: 1,
  ts: { Fs: 30, Vas: 2, Qts: 0.4, VasUnit: 'cuft' },
  chamber1: netChamber({ fbHz: 30, volumeCuFt: 1.5, portAreaSqIn: 22 }),
  chamber2: netChamber({ fbHz: 40, volumeCuFt: 3.0, portAreaSqIn: 26 })
})
if (!fourthTsResult.fourthOrderAnalysis?.fightingBox) {
  throw new Error('Engine should emit fightingBox when Fcb exceeds F2')
}
const fightWarning = fourthTsResult.warnings.find((w) => w.level === 'red' && w.message.includes('fighting'))
if (!fightWarning) {
  throw new Error('Engine should emit red fighting-box warning')
}

const doorTuning = calculateDoorTuning(80, 24, 36, 4, true, 0)
if (!doorTuning.valid || doorTuning.hz <= 0) {
  throw new Error('Door tuning should be valid for sample cabin/door inputs')
}
assertClose(doorTuning.hz, 33.118, 0.05, 'Door Helmholtz Hz (sealed, door-only vent)')

const doorSealed = calculateDoorTuning(80, 24, 36, 4, true, 15)
const doorWithLeak = calculateDoorTuning(80, 24, 36, 4, false, 15)
if (doorWithLeak.hz <= doorSealed.hz) {
  throw new Error('Leak area should raise F_door above sealed door-only case')
}
if (doorWithLeak.totalVentAreaSqIn !== doorWithLeak.doorAreaSqIn + 15) {
  throw new Error('Total vent area should include leak when not sealed')
}
if (doorSealed.leakAreaSqIn !== 0) {
  throw new Error('Sealed cabin should zero leak area')
}

const jambFor33 = computeJambForTargetHz(80, 24, 36, 33.118, false, 15)
const roundTrip = calculateDoorTuning(80, 24, 36, jambFor33.jambThicknessIn, false, 15)
assertClose(roundTrip.hz, 33.118, 0.15, 'Jamb inverse for target Hz with leak vent area')

const invalidDoor = calculateDoorTuning(0, 24, 36, 4)
if (invalidDoor.valid) {
  throw new Error('Door tuning should be invalid when cabin volume missing')
}

const doorCoupling = analyzeDoorTuningCoupling(doorTuning.hz, 35, 5, 'F2')
if (!doorCoupling.coupled) {
  throw new Error('Door tuning within 5 Hz of F2 should set coupled true')
}

const doorEngineResult = runAll({
  orderType: 'series',
  cabinLengthIn: 120,
  cabinVolumeCuFt: 80,
  driverSizeIn: 15,
  driverCount: 2,
  doorTuningExperimental: true,
  doorWidthIn: 24,
  doorHeightIn: 36,
  doorJambThicknessIn: 4,
  isCabinSealed: false,
  cabinLeakageAreaSqIn: 15,
  ts: {},
  chamber1: netChamber({ fbHz: 30, volumeCuFt: 2.0, portAreaSqIn: 22 }),
  chamber2: netChamber({ fbHz: 35, volumeCuFt: 4.0, portAreaSqIn: 30 })
})
if (!doorEngineResult.doorTuningAnalysis?.valid) {
  throw new Error('Engine should return valid doorTuningAnalysis when experimental mode on')
}
if (doorEngineResult.doorTuningAnalysis.leakAreaSqIn !== 15) {
  throw new Error('Engine should pass leak area into door analysis')
}
if (doorEngineResult.summary.closedGainSlope !== 9) {
  throw new Error(`Engine should report closedGainSlope 9 with 15 sq in leak, got ${doorEngineResult.summary.closedGainSlope}`)
}
if (!doorEngineResult.doorTuningAnalysis.coupled) {
  throw new Error('Engine should detect door/front tuning coupling')
}
if (doorEngineResult.doorTuningAnalysis.recommendedJambForFront == null) {
  throw new Error('Door analysis should recommend jamb for front tuning match')
}
const doorWarning = doorEngineResult.warnings.find((w) => w.message.includes('intentional SPL door-jamb alignment'))
if (!doorWarning || doorWarning.level !== 'amber') {
  throw new Error('Engine should emit amber door coupling note when aligned to front tuning')
}

console.log('All calc verification checks passed.')
console.log(`  Gross-dims Ch.1 net: ${grossResult.chambers.chamber1.volumeCuFt.toFixed(3)} cu ft`)
console.log(`  Sensitivity callouts: ${seriesResult.sensitivity.callouts.length}`)
