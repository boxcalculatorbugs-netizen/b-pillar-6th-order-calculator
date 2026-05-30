import { runAll } from './calc/engine.js'
import { getTsSuggestions } from './calc/tsModel.js'
import { portAreaFromSlot, isLengthAdjustMode, calcModeLabel, formatEndCorrectionSummary, CALC_MODES, PORT_STYLE_MODES } from './calc/port.js'
import { applyStartupPreset } from './presets.js'
import {
  exportDesign,
  applyDesign,
  applyClearDesign,
  saveDesignToFile,
  loadDesignFromFile
} from './designIO.js'
import {
  bootstrapDesignState,
  debouncedAutoSave,
  clearAutoSave,
  isBetaBannerDismissed,
  dismissBetaBanner,
  showBetaBanner
} from './designPersistence.js'
import { enhanceNumberInputs } from './components/numberStepper.js'
import { renderDiagram } from './components/diagram.js'
import { applyTheme, loadSavedTheme, readThemeColors, themeLabel, THEME_IDS } from './themes.js'
import {
  loadSavedDoorTuningExperimental,
  saveDoorTuningExperimental,
  REALISTIC_JAMB_MIN_IN,
  REALISTIC_JAMB_MAX_IN,
  REALISTIC_DOOR_WIDTH_RANGE,
  REALISTIC_DOOR_HEIGHT_RANGE
} from './calc/doorTuning.js'
import {
  isFourth,
  isPorted,
  isSixthOrder,
  orderTypeLabel,
  orderTypeSubtitle,
  showChamber2
} from './calc/orderTypes.js'
import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  LogarithmicScale,
  CategoryScale,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js'

Chart.register(
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  LogarithmicScale,
  CategoryScale,
  Title,
  Tooltip,
  Legend,
  Filler
)

const $ = (id) => document.getElementById(id)

let cabinChart = null
let passbandChart = null
let sensitivityChart = null
let debounceTimer = null

const state = {
  volumeUnit: 'cuft',
  lengthUnit: 'in',
  areaUnit: 'sqin',
  calcMode: CALC_MODES.HELMHOLTZ,
  themeId: THEME_IDS.MIDNIGHT,
  doorTuningExperimental: false
}

function chartPalette() {
  const c = readThemeColors()
  return {
    title: c.muted,
    axis: c.muted,
    grid: c.chartGrid || 'rgba(51,65,85,0.4)'
  }
}

function num(id) {
  const v = parseFloat($(id).value)
  return Number.isFinite(v) ? v : 0
}

function toCuFt(value) {
  if (state.volumeUnit === 'liters') return value / 28.3168
  if (state.volumeUnit === 'cuin') return value / 1728
  return value
}

function fromCuFt(value) {
  if (state.volumeUnit === 'liters') return value * 28.3168
  if (state.volumeUnit === 'cuin') return value * 1728
  return value
}

function toInches(value) {
  return state.lengthUnit === 'mm' ? value / 25.4 : value
}

function toSqIn(value) {
  return state.areaUnit === 'sqcm' ? value / 6.4516 : value
}

function fromSqIn(value) {
  return state.areaUnit === 'sqcm' ? value * 6.4516 : value
}

function readChamber(ch) {
  const basis = $(`vb${ch}Basis`).value || 'net'
  const mode = $(`port${ch}Mode`).value
  return {
    fbHz: num(`fb${ch}`),
    volumeBasis: basis,
    volumeCuFt: basis === 'net' ? toCuFt(num(`vb${ch}`)) : 0,
    grossVolumeCuFt: toCuFt(num(`vb${ch}Gross`)),
    grossLengthIn: toInches(num(`vb${ch}Len`)),
    grossWidthIn: toInches(num(`vb${ch}Width`)),
    grossHeightIn: toInches(num(`vb${ch}Height`)),
    measureFromOuter: $(`vb${ch}Outer`)?.checked ?? false,
    extraDisplacementCuIn: num(`vb${ch}Extra`),
    portInputMode: mode,
    portAreaSqIn: toSqIn(num(`port${ch}Area`)),
    portDiameterIn: toInches(num(`port${ch}Diam`)),
    portSlotWidthIn: toInches(num(`port${ch}SlotW`)),
    portSlotHeightIn: toInches(num(`port${ch}SlotH`)),
    portWallThicknessIn: toInches(num(`port${ch}Wall`)) || 0.75,
    portLengthOverrideIn: toInches(num(`port${ch}Length`)),
    portStyleMode: mode === 'slot' ? PORT_STYLE_MODES.RECT_SLOT : PORT_STYLE_MODES.ROUND_AERO,
    commonWalls: parseInt($(`port${ch}CommonWalls`)?.value ?? '0', 10) || 0
  }
}

function readInputs() {
  return {
    orderType: $('orderType').value,
    doorsOpen: $('doorsOpen').checked,
    calcMode: state.calcMode,
    doorTuningExperimental: state.doorTuningExperimental,
    doorWidthIn: toInches(num('doorWidth')),
    doorHeightIn: toInches(num('doorHeight')),
    doorJambThicknessIn: toInches(num('doorJambThickness')),
    isCabinSealed: $('cabinSealed')?.checked ?? false,
    cabinLeakageAreaSqIn: toSqIn(num('cabinLeakageArea')) || 15,
    cabinLengthIn: toInches(num('cabinLength')),
    cabinVolumeCuFt: toCuFt(num('cabinVolume')),
    maxDepthIn: toInches(num('maxDepth')),
    maxHeightIn: toInches(num('maxHeight')),
    maxWidthIn: toInches(num('maxWidth')),
    wallThicknessIn: toInches(num('wallThickness')) || 1.5,
    bracingEnabled: $('bracingEnabled').checked,
    bracingPercent: $('bracingEnabled').checked
      ? (parseFloat($('bracingPercent').value) || 15)
      : 0,
    toleranceEnabled: $('toleranceEnabled').checked,
    tolerancePercent: parseFloat($('tolerancePercent').value) || 10,
    driverSizeIn: num('driverSize'),
    driverCount: Math.max(1, parseInt($('driverCount').value, 10) || 1),
    ts: {
      Fs: num('tsFs') || null,
      Qts: num('tsQts') || null,
      Qes: num('tsQes') || null,
      Vas: num('tsVas') || null,
      VasUnit: $('tsVasUnit').value,
      Sd: num('tsSd') || null,
      SdUnit: $('tsSdUnit').value,
      Re: num('tsRe') || null,
      Xmax: num('tsXmax') || null,
      Pe: num('tsPe') || null,
      Vd: num('tsVd') || null
    },
    chamber1: readChamber(1),
    chamber2: readChamber(2)
  }
}

function fmtLen(inches) {
  if (state.lengthUnit === 'mm') return `${(inches * 25.4).toFixed(0)} mm`
  return `${inches.toFixed(2)} in`
}

function fmtVol(cuFt) {
  if (state.volumeUnit === 'liters') return `${(cuFt * 28.3168).toFixed(1)} L`
  if (state.volumeUnit === 'cuin') return `${(cuFt * 1728).toFixed(0)} cu in`
  return `${cuFt.toFixed(2)} cu ft`
}

function fmtVolSmall(cuFt) {
  if (cuFt < 0.01 && cuFt > 0) return `${(cuFt * 1728).toFixed(0)} cu in`
  return fmtVol(cuFt)
}

function fmtArea(sqIn) {
  if (state.areaUnit === 'sqcm') return `${(sqIn * 6.4516).toFixed(0)} cm²`
  return `${sqIn.toFixed(1)} sq in`
}

function frequencyMarkerPlugin(markers, freqLabels) {
  return {
    id: 'frequencyMarkers',
    afterDraw(chart) {
      if (!markers?.length) return
      const { ctx, chartArea, scales } = chart
      const xScale = scales.x
      if (!xScale) return

      markers.forEach((marker) => {
        let bestIdx = 0
        let bestDiff = Infinity
        freqLabels.forEach((label, idx) => {
          const diff = Math.abs(parseFloat(label) - marker.freq)
          if (diff < bestDiff) {
            bestDiff = diff
            bestIdx = idx
          }
        })

        const x = xScale.getPixelForValue(bestIdx)
        if (x < chartArea.left || x > chartArea.right) return

        ctx.save()
        ctx.strokeStyle = marker.color
        ctx.lineWidth = 1.5
        ctx.setLineDash([4, 4])
        ctx.beginPath()
        ctx.moveTo(x, chartArea.top)
        ctx.lineTo(x, chartArea.bottom)
        ctx.stroke()
        ctx.fillStyle = marker.color
        ctx.font = '10px Segoe UI, sans-serif'
        ctx.fillText(marker.label, x + 3, chartArea.top + 12)
        ctx.restore()
      })
    }
  }
}

function renderSummary(result) {
  const { summary, passbandBandwidth, orderType, doorsOpen } = result
  const bwLow = passbandBandwidth?.lowHz ?? summary.passbandLowHz
  const bwHigh = passbandBandwidth?.highHz ?? summary.passbandHighHz
  const octaveSpread = passbandBandwidth?.octaveSpread ?? summary.passbandOctaves
  const orderLabel = orderTypeLabel(orderType)
  const boostClosed = summary.cabinBoostFb2Closed?.toFixed(1) ?? '—'
  const boostOpen = summary.cabinBoostFb2Open?.toFixed(1) ?? '—'
  const activeLabel = doorsOpen ? 'open' : 'closed'
  const bwValue =
    bwLow && bwHigh ? `${bwLow.toFixed(1)} – ${bwHigh.toFixed(1)} Hz` : '—'
  const bwSub = isPorted(orderType)
    ? 'single-chamber vented'
    : isFourth(orderType)
      ? '4th order bandpass'
      : octaveSpread
        ? `${octaveSpread.toFixed(2)} oct tuning spread`
        : ''
  const cabinBoostLabel = isPorted(orderType) ? 'Cabin boost @ Fb' : 'Cabin boost @ Fb2'
  const fourthSummaryCards =
    isFourth(orderType) && summary.fcbHz
      ? `
    <div class="summary-card"><div class="label">Fcb (sealed)</div><div class="value">${summary.fcbHz} Hz</div></div>
    <div class="summary-card"><div class="label">Qtc</div><div class="value">${summary.qtc ?? '—'}</div></div>
    <div class="summary-card"><div class="label">Vf : Vr</div><div class="value">${summary.vfVrRatio ? `${summary.vfVrRatio.toFixed(2)}:1` : '—'}</div></div>`
      : ''
  const doorSummaryCard =
    result.doorTuningAnalysis?.valid
      ? `<div class="summary-card"><div class="label">Door jamb (F_door)</div><div class="value">${result.doorTuningAnalysis.hz.toFixed(1)} Hz</div>${result.doorTuningAnalysis.coupled ? '<div class="summary-sub port-ratio-amber">Aligned to front tuning</div>' : result.doorTuningAnalysis.recommendedJambForFront != null && result.doorTuningAnalysis.frontTuningHz ? `<div class="summary-sub">Jamb for F2: ~${result.doorTuningAnalysis.recommendedJambForFront.toFixed(1)} in</div>` : ''}</div>`
      : ''
  $('summaryCards').innerHTML = `
    <div class="summary-card"><div class="label">Order type</div><div class="value">${orderLabel}</div></div>
    ${fourthSummaryCards}
    ${doorSummaryCard}
    <div class="summary-card"><div class="label">Est. bandwidth</div><div class="value">${bwValue}</div>${bwSub ? `<div class="summary-sub">${bwSub}</div>` : ''}</div>
    <div class="summary-card"><div class="label">${cabinBoostLabel}</div><div class="value">+${summary.cabinBoostFb2Active?.toFixed(1) ?? '—'} dB</div><div class="summary-sub">${activeLabel}: +${summary.cabinBoostFb2Active?.toFixed(1) ?? '—'} · closed: +${boostClosed} · open: +${boostOpen}</div></div>
    <div class="summary-card"><div class="label">Total net vol</div><div class="value">${fmtVol(summary.totalNetCuFt)}</div></div>
    <div class="summary-card"><div class="label">Total gross vol</div><div class="value">${fmtVol(summary.totalGrossCuFt)}</div></div>
    <div class="summary-card"><div class="label">Est. wall depth</div><div class="value">${summary.estimatedDepthIn ? fmtLen(summary.estimatedDepthIn) : '—'}</div></div>
    <div class="summary-card"><div class="label">System Sd</div><div class="value">${summary.totalSdSqIn ? `${summary.totalSdSqIn} sq in` : '—'}</div><div class="summary-sub">${summary.driverCount || 1}× ${summary.driverSizeIn || '—'}"</div></div>
  `
}

function renderDriverSdInfo(driverArray) {
  const el = $('driverSdInfo')
  if (!driverArray?.totalSdSqIn) {
    el.className = 'suitability-box neutral'
    el.textContent = 'Set driver size and count to estimate total cone area (Sd).'
    return
  }
  const stdNote = driverArray.isStandardSize ? 'standard lookup' : 'custom size estimate (80% effective radius)'
  el.className = 'suitability-box green'
  el.innerHTML = `<strong>${driverArray.count}× ${driverArray.sizeIn}"</strong> — ${driverArray.singleSdSqIn.toFixed(1)} sq in per driver · <strong>${driverArray.totalSdSqIn.toFixed(1)} sq in total Sd</strong> (${stdNote})`
}

function renderChamberResults(elId, chamber, excursionInfo, orderType, portRatio, driverCount, fourthAnalysis = null) {
  const vel = excursionInfo?.velocityMps
  const isSeries = orderType === 'series'
  const isSealed = chamber.portRole === 'sealed' || chamber.isSealed
  const endCorrectionLabel = formatEndCorrectionSummary(chamber)
  const perSubRow = driverCount > 0 && chamber.volumeCuFt > 0
    ? `<div class="result-row"><span>Net vol / sub</span><span class="val">${fmtVol(chamber.volumeCuFt / driverCount)}</span></div>`
    : ''
  const sealedFourthRows =
    isSealed && fourthAnalysis && !fourthAnalysis.missingTs && fourthAnalysis.fcbHz
      ? `<div class="result-row"><span>Fcb (sealed rear)</span><span class="val">${fourthAnalysis.fcbHz.toFixed(1)} Hz</span></div>
         <div class="result-row"><span>Qtc</span><span class="val">${fourthAnalysis.qtc.toFixed(3)}</span></div>`
      : ''
  const cabinBoostRow = chamber.portRole === 'internal' || isSealed
    ? `<div class="result-row"><span>Cabin boost @ Fb</span><span class="val muted-val">N/A (${isSealed ? 'sealed' : 'internal'})</span></div>`
    : `<div class="result-row"><span>Cabin boost @ Fb</span><span class="val">+${chamber.cabinBoostDb.toFixed(1)} dB active</span></div>
       <div class="result-row"><span>Closed / open</span><span class="val muted-val">+${chamber.cabinBoostClosedDb.toFixed(1)} dB / +${chamber.cabinBoostOpenDb.toFixed(1)} dB</span></div>`
  const lengthNote = chamber.lengthOverridden
    ? `<div class="result-row"><span>${calcModeLabel(chamber.calcMode)} length</span><span class="val muted-val">${fmtLen(chamber.calculatedLengthIn)} (overridden)</span></div>`
    : ''
  const fbLabel = isSealed
    ? 'Chamber type'
    : chamber.fbComputedFromGeometry
      ? 'Tuning (Fb, computed)'
      : 'Tuning (Fb)'
  const fbValue = isSealed ? 'Sealed rear' : chamber.fbHz ? `${chamber.fbHz.toFixed(1)} Hz` : '—'
  const portAreaPerCuFtRow = !isSealed && chamber.portAreaPerCuFt > 0
    ? `<div class="result-row"><span>Port area / net vol</span><span class="val">${chamber.portAreaPerCuFt.toFixed(1)} sq in/cu ft</span></div>`
    : ''
  const buildVolRow =
    chamber.volumeBasis === 'net' && chamber.volumeBreakdown?.additionalBeyondNetCuFt > 0
      ? `<div class="result-row"><span>Built gross needed</span><span class="val">${fmtVol(chamber.volumeBreakdown.requiredGrossCuFt)} <span class="muted-val">(+${fmtVolSmall(chamber.volumeBreakdown.additionalBeyondNetCuFt)} beyond net)</span></span></div>`
      : ''
  const portRows = isSealed
    ? ''
    : `
    <div class="result-row"><span>End correction</span><span class="val">${endCorrectionLabel}</span></div>
    <div class="result-row"><span>Port area</span><span class="val">${fmtArea(chamber.portAreaSqIn)}</span></div>
    ${portAreaPerCuFtRow}
    <div class="result-row"><span>Port length</span><span class="val">${fmtLen(chamber.portLengthIn)}</span></div>
    ${lengthNote}
    <div class="result-row"><span>Port displacement</span><span class="val">${fmtVol(chamber.portVolumeCuFt)}</span></div>
    ${portRatio ? `<div class="result-row"><span>Port : Sd ratio</span><span class="val port-ratio-${portRatio.level}">${portRatio.message}</span></div>` : ''}
    ${chamber.portInputMode === 'slot' && chamber.portSlotInnerWidthIn ? `<div class="result-row"><span>Slot opening</span><span class="val">${chamber.portSlotInnerWidthIn.toFixed(2)} × ${chamber.portSlotInnerHeightIn.toFixed(2)} × ${chamber.portLengthIn.toFixed(2)} in</span></div>` : ''}
    ${vel ? `<div class="result-row"><span>Port velocity @ Xmax</span><span class="val">${vel.toFixed(1)} m/s</span></div>` : ''}
  `

  $(elId).innerHTML = `
    <div class="result-row"><span>${fbLabel}</span><span class="val">${fbValue}</span></div>
    ${sealedFourthRows}
    <div class="result-row"><span>Net volume</span><span class="val">${fmtVol(chamber.volumeCuFt)}</span></div>
    ${perSubRow}
    ${buildVolRow}
    ${portRows}
    ${cabinBoostRow}
    ${isSeries && chamber.portRole === 'internal' ? `<div class="result-row"><span>Note</span><span class="val muted-val">Subtract displacement from host chamber gross volume</span></div>` : ''}
  `
}

function renderVolumeBreakdown(result) {
  const b1 = result.volumeBreakdown?.chamber1
  const b2 = result.volumeBreakdown?.chamber2
  const singleChamber = isPorted(result.orderType)
  if (!b1 || (!singleChamber && !b2)) {
    $('volumeBreakdown').innerHTML = ''
    return
  }

  const row = (label, v1, v2) => {
    const fmt = (v) => (v > 0 || label.includes('=') || label.includes('Your net') ? fmtVolSmall(v) : '—')
    if (singleChamber) {
      return `<tr><td>${label}</td><td>${fmt(v1)}</td></tr>`
    }
    return `<tr><td>${label}</td><td>${fmt(v1)}</td><td>${fmt(v2)}</td></tr>`
  }

  const isNetMode = b1.volumeBasis === 'net' && (singleChamber || b2?.volumeBasis === 'net')
  let tableBody = ''

  if (isNetMode) {
    tableBody = `
        ${row('Your net airspace', b1.enteredNetCuFt, b2?.enteredNetCuFt)}
        ${row('+ Port displacement', b1.portCuFt, b2?.portCuFt)}
        ${row('+ Driver', b1.driverCuFt, b2?.driverCuFt)}
        ${row('+ Bracing', b1.bracingCuFt, b2?.bracingCuFt)}
        ${row('+ Other', b1.extraCuFt, b2?.extraCuFt)}
        ${row('<strong>= Built gross needed</strong>', b1.requiredGrossCuFt, b2?.requiredGrossCuFt)}
    `
  } else {
    tableBody = `
        ${row('Gross internal', b1.grossInternalCuFt, b2?.grossInternalCuFt)}
        ${b1.wallLossCuFt || b2?.wallLossCuFt ? row('− Wall panel loss', b1.wallLossCuFt, b2?.wallLossCuFt) : ''}
        ${row('− Port', b1.portCuFt, b2?.portCuFt)}
        ${row('− Driver', b1.driverCuFt, b2?.driverCuFt)}
        ${row('− Bracing', b1.bracingCuFt, b2?.bracingCuFt)}
        ${row('− Other', b1.extraCuFt, b2?.extraCuFt)}
        ${row('<strong>= Effective net</strong>', b1.effectiveNetCuFt, b2?.effectiveNetCuFt)}
    `
  }

  const callouts = []
  if (isNetMode && b1.additionalBeyondNetCuFt > 0) {
    callouts.push(`Ch. 1: add ${fmtVolSmall(b1.additionalBeyondNetCuFt)} beyond your net airspace to fit port + displacements`)
  }
  if (!singleChamber && isNetMode && b2?.additionalBeyondNetCuFt > 0) {
    callouts.push(`Ch. 2: add ${fmtVolSmall(b2.additionalBeyondNetCuFt)} beyond your net airspace to fit port + displacements`)
  }

  const colHead = singleChamber ? 'Ch. 1' : 'Ch. 1'
  const colHead2 = singleChamber ? '' : '<th>Ch. 2</th>'

  $('volumeBreakdown').innerHTML = `
    <table class="breakdown-table">
      <thead><tr><th>Line</th><th>${colHead}</th>${colHead2}</tr></thead>
      <tbody>${tableBody}</tbody>
    </table>
    ${callouts.length ? `<div class="volume-callouts">${callouts.map((c) => `<p class="volume-callout">${c}</p>`).join('')}</div>` : ''}
  `
}

function renderFourthOrderAnalysis(result) {
  const block = $('fourthOrderBlock')
  const el = $('fourthOrderAnalysis')
  if (!block || !el) return

  if (!isFourth(result.orderType)) {
    block.classList.add('hidden')
    el.innerHTML = ''
    return
  }

  block.classList.remove('hidden')
  const a = result.fourthOrderAnalysis
  const f2 = result.chambers.chamber2.fbHz

  if (!a) {
    el.innerHTML = '<p class="muted-inline">4th-order analysis unavailable.</p>'
    return
  }

  if (a.missingTs) {
    el.innerHTML = `
      <p class="muted-inline">Enter Fs, Vas, and Qts above to compute Fcb and check whether the sealed rear is compatible with your front tuning F2.</p>
      ${f2 ? `<div class="result-row"><span>Front tuning F2</span><span class="val">${f2.toFixed(1)} Hz</span></div>` : ''}
    `
    return
  }

  const compatClass = a.fightingBox ? 'red' : a.compatible ? 'green' : a.compatibilityLevel
  el.innerHTML = `
    <div class="result-row"><span>Fcb (sealed rear)</span><span class="val">${a.fcbHz.toFixed(1)} Hz</span></div>
    <div class="result-row"><span>Qtc</span><span class="val">${a.qtc.toFixed(3)}</span></div>
    <div class="result-row"><span>Front tuning F2</span><span class="val">${f2 ? `${f2.toFixed(1)} Hz` : '—'}</span></div>
    <div class="result-row"><span>Vf : Vr</span><span class="val">${a.volumeRatio ? `${a.volumeRatio.toFixed(2)}:1` : '—'}</span></div>
    <div class="result-row"><span>Ratio profile</span><span class="val port-ratio-${a.profileLevel}">${a.profile}</span></div>
    <div class="result-row"><span>Compatibility</span><span class="val port-ratio-${compatClass}">${a.compatibilityMessage}</span></div>
    ${a.disclaimer ? `<div class="suitability-box ${a.fightingBox ? 'red' : 'amber'}">${a.disclaimer}</div>` : ''}
    ${a.driverGuide?.length && !a.compatible ? `<div class="suitability-box neutral fourth-driver-guide"><strong>Lowering Fcb (sealed rear)</strong><ul>${a.driverGuide.map((line) => `<li>${line}</li>`).join('')}</ul></div>` : ''}
    ${a.qtcNotes?.length ? a.qtcNotes.map((n) => `<p class="field-hint">${n}</p>`).join('') : ''}
  `
}

function renderBandwidthAnalysis(passbandBandwidth, orderType) {
  const el = $('bandwidthResults')
  if (!el) return
  if (!passbandBandwidth?.lowHz || !passbandBandwidth?.highHz) {
    el.innerHTML = '<p class="muted-inline">Enter tuning and chamber volumes for passband analysis.</p>'
    return
  }
  const { lowHz, highHz, octaveSpread, volumeRatio, warning, level } = passbandBandwidth
  const spreadLabel = isPorted(orderType)
    ? 'Tuning span'
    : isFourth(orderType)
      ? 'Front:rear volume ratio'
      : 'Tuning spread (Fb2:Fb1)'
  const spreadValue = isPorted(orderType)
    ? `${octaveSpread.toFixed(2)} octaves`
    : isFourth(orderType)
      ? volumeRatio ? `${volumeRatio.toFixed(2)}:1` : '—'
      : `${octaveSpread.toFixed(2)} octaves`
  const ratioRow = isSixthOrder(orderType)
    ? `<div class="result-row"><span>Chamber volume ratio (front:rear)</span><span class="val">${volumeRatio ? `${volumeRatio.toFixed(2)}:1` : '—'}</span></div>`
    : ''
  el.innerHTML = `
    <div class="result-row"><span>Estimated usable range</span><span class="val">${lowHz.toFixed(1)} – ${highHz.toFixed(1)} Hz</span></div>
    <div class="result-row"><span>${spreadLabel}</span><span class="val">${spreadValue}</span></div>
    ${ratioRow}
    <div class="result-row"><span>Response profile</span><span class="val port-ratio-${level}">${warning}</span></div>
  `
}

function renderChamber3Results(result) {
  const block = $('chamber3ResultBlock')
  const el = $('chamber3Results')
  if (!block || !el) return

  const a = result.doorTuningAnalysis
  if (!a?.enabled) {
    block.classList.add('hidden')
    el.innerHTML = ''
    return
  }

  block.classList.remove('hidden')
  block.classList.add('chamber-cabin')

  if (!a.valid) {
    el.innerHTML =
      '<p class="muted-inline">Enter cabin volume plus door width, height, and jamb thickness to compute Helmholtz cabin resonance.</p>'
    return
  }

  const compatClass = a.coupled ? 'amber' : 'green'
  const deltaLabel =
    a.deltaHz != null && a.frontTuningHz
      ? `${a.deltaHz.toFixed(1)} Hz from ${a.frontTuningLabel || 'front tuning'}`
      : '—'

  el.innerHTML = `
    <div class="result-row"><span>Chamber type</span><span class="val">Cabin + door port (Helmholtz)</span></div>
    <div class="result-row"><span>Net volume (cabin)</span><span class="val">${fmtVol(a.cabinVolCuFt)}</span></div>
    <div class="result-row"><span>Cabin sealed</span><span class="val">${a.isCabinSealed ? 'Yes — armored/deadened' : 'No — flex/leak modeled'}</span></div>
    <div class="result-row"><span>Parasitic leak area</span><span class="val">${a.isCabinSealed ? '0 sq in' : fmtArea(a.leakAreaSqIn)}</span></div>
    <div class="result-row"><span>Door port area</span><span class="val">${fmtArea(a.doorAreaSqIn)} <span class="muted-val">(${a.doorWidthIn.toFixed(1)} × ${a.doorHeightIn.toFixed(1)} in)</span></span></div>
    <div class="result-row"><span>Total vent area</span><span class="val">${fmtArea(a.totalVentAreaSqIn)} <span class="muted-val">door + leak</span></span></div>
    <div class="result-row"><span>Closed cabin slope</span><span class="val">${a.closedGainSlope != null ? `${a.closedGainSlope.toFixed(1)} dB/oct` : '—'}</span></div>
    <div class="result-row"><span>Jamb thickness (physical)</span><span class="val">${fmtLen(a.jambThicknessIn)}${a.jambRealistic === false ? ' <span class="muted-val">(atypical)</span>' : ''}</span></div>
    <div class="result-row"><span>End correction (added)</span><span class="val">${fmtLen(a.endCorrectionIn)}</span></div>
    <div class="result-row"><span>Effective length (L_eff)</span><span class="val">${fmtLen(a.effectiveLengthIn)} <span class="muted-val">jamb + correction</span></span></div>
    <div class="result-row"><span>Door jamb tuning (F_door)</span><span class="val">${a.hz.toFixed(1)} Hz</span></div>
    <div class="result-row"><span>Front tuning (compare)</span><span class="val">${a.frontTuningHz ? `${a.frontTuningHz.toFixed(1)} Hz (${a.frontTuningLabel || 'F2'})` : '—'}</span></div>
    <div class="result-row"><span>Coupling Δ</span><span class="val port-ratio-${compatClass}">${deltaLabel}</span></div>
    ${a.recommendedJambForFront != null && a.frontTuningHz ? `<div class="result-row"><span>Jamb for ${a.frontTuningLabel || 'F2'} match</span><span class="val">${fmtLen(a.recommendedJambForFront)}${a.recommendedJambLow != null ? ` <span class="muted-val">(±5 Hz: ${a.recommendedJambLow.toFixed(1)}–${a.recommendedJambHigh.toFixed(1)} in)</span>` : ''}</span></div>` : ''}
    ${a.goalVerdict ? `<div class="suitability-box ${a.goalLevel}">${a.goalVerdict}</div>` : ''}
    ${!a.coupled && a.frontTuningHz ? '<div class="result-row"><span>Compatibility</span><span class="val port-ratio-green">Door jamb tuning clear of front tuning (±5 Hz)</span></div>' : ''}
    ${a.goalNotes?.length ? a.goalNotes.map((n) => `<p class="field-hint">${n}</p>`).join('') : ''}
    <p class="field-hint">Realistic starting points: jamb ${REALISTIC_JAMB_MIN_IN}–${REALISTIC_JAMB_MAX_IN} in through the frame, door mouth ~${REALISTIC_DOOR_WIDTH_RANGE[0]}–${REALISTIC_DOOR_WIDTH_RANGE[1]} × ${REALISTIC_DOOR_HEIGHT_RANGE[0]}–${REALISTIC_DOOR_HEIGHT_RANGE[1]} in. SPL door-open builds often align F_door to F2; musical builds keep &gt;5 Hz separation.</p>
  `
}

function renderCabinResults(result) {
  const { volumeCoupling, packaging, driverDisplacementCuFt } = result
  $('cabinResults').innerHTML = `
    <div class="result-row"><span>Box / cabin ratio</span><span class="val">${(volumeCoupling.boxRatio * 100).toFixed(1)}%</span></div>
    <div class="result-row"><span>Driver displacement</span><span class="val">${driverDisplacementCuFt ? fmtVol(driverDisplacementCuFt) : '—'}</span></div>
    <div class="result-row"><span>Ch.1 gross volume</span><span class="val">${fmtVol(packaging.grossVolume1CuFt)}</span></div>
    <div class="result-row"><span>Ch.2 gross volume</span><span class="val">${fmtVol(packaging.grossVolume2CuFt)}</span></div>
    <div class="result-row"><span>Ch.1 port packaging</span><span class="val">${packaging.chamber1Packaging.fitsStraight ? 'Straight fit' : `${packaging.chamber1Packaging.foldCount}-fold`}</span></div>
    <div class="result-row"><span>Ch.2 port packaging</span><span class="val">${packaging.chamber2Packaging.fitsStraight ? 'Straight fit' : `${packaging.chamber2Packaging.foldCount}-fold`}</span></div>
  `
}

function renderWarnings(warnings) {
  const list = $('warningsList')
  if (!warnings.length) {
    list.innerHTML = '<li class="empty">No warnings — design looks reasonable for the inputs given.</li>'
    return
  }
  list.innerHTML = warnings
    .map((w) => `<li class="${w.level}">${w.message}</li>`)
    .join('')
}

function renderTsSuitability(suitability) {
  const el = $('tsSuitability')
  el.className = `suitability-box ${suitability.level}`
  const notes = suitability.notes?.length ? `<br><small>${suitability.notes.join(' · ')}</small>` : ''
  const score = suitability.score != null ? ` (score ${suitability.score}/100)` : ''
  el.innerHTML = `${suitability.verdict}${score}${notes}`
}

function updateCharts(result) {
  const { charts, doorsOpen } = result
  const labels = charts.cabinCurveClosed.map((p) => p.freq.toFixed(1))

  if (cabinChart) cabinChart.destroy()
  cabinChart = new Chart($('cabinChart'), {
    type: 'line',
    plugins: [frequencyMarkerPlugin(charts.markers, labels)],
    data: {
      labels,
      datasets: [
        {
          label: 'Doors closed (12 dB/oct)',
          data: charts.cabinCurveClosed.map((p) => p.dbBoost),
          borderColor: '#fbbf24',
          backgroundColor: 'rgba(251, 191, 36, 0.08)',
          fill: true,
          tension: 0.3,
          pointRadius: 0,
          borderWidth: doorsOpen ? 1.5 : 2.5
        },
        {
          label: 'Doors open (3 dB/oct)',
          data: charts.cabinCurveOpen.map((p) => p.dbBoost),
          borderColor: '#fb923c',
          borderDash: [6, 4],
          fill: false,
          tension: 0.3,
          pointRadius: 0,
          borderWidth: doorsOpen ? 2.5 : 1.5
        }
      ]
    },
    options: chartOptions('Cabin Transfer Estimate', 'Boost (dB)', charts.markers)
  })

  if (passbandChart) passbandChart.destroy()
  const passbandLabels = charts.inCarResponseClosed.map((p) => p.freq.toFixed(1))
  passbandChart = new Chart($('passbandChart'), {
    type: 'line',
    plugins: [frequencyMarkerPlugin(charts.markers, passbandLabels)],
    data: {
      labels: passbandLabels,
      datasets: [
        {
          label: 'Passband estimate (dB)',
          data: charts.inCarResponseClosed.map((p) => p.passbandDb),
          borderColor: '#60a5fa',
          tension: 0.3,
          pointRadius: 0
        },
        {
          label: 'In-car — doors closed',
          data: charts.inCarResponseClosed.map((p) => p.inCarDb),
          borderColor: '#34d399',
          tension: 0.3,
          pointRadius: 0,
          borderWidth: doorsOpen ? 1.5 : 2.5
        },
        {
          label: 'In-car — doors open',
          data: charts.inCarResponseOpen.map((p) => p.inCarDb),
          borderColor: '#2dd4bf',
          borderDash: [6, 4],
          tension: 0.3,
          pointRadius: 0,
          borderWidth: doorsOpen ? 2.5 : 1.5
        }
      ]
    },
    options: chartOptions('Passband + In-Car Estimate', 'Relative level (dB)', charts.markers)
  })

  updateSensitivityChart(result)
}

function updateSensitivityChart(result) {
  const calloutEl = $('sensitivityCallouts')
  const sens = result.sensitivity

  if (!sens?.enabled || !sens?.volumeSweep) {
    if (sensitivityChart) {
      sensitivityChart.destroy()
      sensitivityChart = null
    }
    if (calloutEl) {
      calloutEl.innerHTML =
        '<p class="sensitivity-note muted">Tolerance sweep is off — enable it under Build Adjustments to see how measurement error affects Fb and port length.</p>'
    }
    return
  }

  if (calloutEl) {
    calloutEl.innerHTML = sens.callouts?.length
      ? sens.callouts.map((c) => `<p class="sensitivity-note">${c}</p>`).join('')
      : ''
  }

  const v1 = sens.volumeSweep.chamber1
  const v2 = sens.volumeSweep.chamber2
  const labels = v1.map((p) => `${p.pctError >= 0 ? '+' : ''}${p.pctError.toFixed(0)}%`)

  if (sensitivityChart) sensitivityChart.destroy()
  const chart = chartPalette()
  sensitivityChart = new Chart($('sensitivityChart'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Fb1 drift (Hz)',
          data: v1.map((p) => p.driftFbHz),
          borderColor: '#60a5fa',
          tension: 0.3,
          pointRadius: 2
        },
        {
          label: 'Fb2 drift (Hz)',
          data: v2.map((p) => p.driftFbHz),
          borderColor: '#34d399',
          tension: 0.3,
          pointRadius: 2
        },
        {
          label: 'P1 length @ hold Fb (in)',
          data: v1.map((p) => p.portLengthHoldFbIn),
          borderColor: '#a78bfa',
          borderDash: [4, 4],
          tension: 0.3,
          pointRadius: 0,
          yAxisID: 'y1'
        },
        {
          label: 'P2 length @ hold Fb (in)',
          data: v2.map((p) => p.portLengthHoldFbIn),
          borderColor: '#f472b6',
          borderDash: [4, 4],
          tension: 0.3,
          pointRadius: 0,
          yAxisID: 'y1'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: true,
          text: `Tuning Sensitivity (±${sens.tolerancePercent}% volume error)`,
          color: chart.title,
          font: { size: 13 }
        },
        legend: { labels: { color: chart.title } }
      },
      scales: {
        x: {
          title: { display: true, text: 'Volume measurement error', color: chart.axis },
          ticks: { color: chart.axis, maxTicksLimit: 11 },
          grid: { color: chart.grid }
        },
        y: {
          title: { display: true, text: 'Fb drift (Hz)', color: chart.axis },
          ticks: { color: chart.axis },
          grid: { color: chart.grid }
        },
        y1: {
          position: 'right',
          title: { display: true, text: 'Port length (in)', color: chart.axis },
          ticks: { color: chart.axis },
          grid: { drawOnChartArea: false }
        }
      }
    }
  })
}

function chartOptions(title, yLabel) {
  const chart = chartPalette()
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      title: { display: true, text: title, color: chart.title, font: { size: 13 } },
      legend: { labels: { color: chart.title } },
      tooltip: {
        callbacks: {
          title: (items) => `${items[0].label} Hz`
        }
      }
    },
    scales: {
      x: {
        title: { display: true, text: 'Frequency (Hz)', color: chart.axis },
        ticks: { color: chart.axis, maxTicksLimit: 10 },
        grid: { color: chart.grid }
      },
      y: {
        title: { display: true, text: yLabel, color: chart.axis },
        ticks: { color: chart.axis },
        grid: { color: chart.grid }
      }
    }
  }
}

function updateTsFourthHint(orderType) {
  const hint = $('tsFourthHint')
  if (!hint) return
  if (!isFourth(orderType)) {
    hint.classList.add('hidden')
    return
  }
  const hasCoreTs = Boolean(num('tsFs') && num('tsVas') && num('tsQts'))
  hint.classList.toggle('hidden', hasCoreTs)
}

function updateOrderTypeUI(orderType) {
  $('appSubtitle').textContent = orderTypeSubtitle(orderType)

  document.querySelectorAll('.ch1-port-field').forEach((el) => {
    el.classList.toggle('hidden', isFourth(orderType))
  })

  $('chamber2Section')?.classList.toggle('hidden', !showChamber2(orderType))
  $('chamber2ResultBlock')?.classList.toggle('hidden', !showChamber2(orderType))

  if (isFourth(orderType)) {
    $('chamber1Summary').textContent = 'Chamber 1 — Sealed Rear (Vr)'
    $('chamber2Summary').textContent = 'Chamber 2 — Ported Front (Vf) → Cabin'
    $('chamber1ResultTitle').textContent = 'Chamber 1 (Sealed Rear)'
    $('chamber2ResultTitle').textContent = 'Chamber 2 (Ported Front)'
    if ($('vb1NetTitle')) $('vb1NetTitle').textContent = 'Net volume Vr (sealed rear)'
    if ($('vb2NetTitle')) $('vb2NetTitle').textContent = 'Net volume Vf (ported front)'
    if ($('fb2LabelText')) $('fb2LabelText').textContent = 'F2 target tuning (Hz)'
    updateTsFourthHint(orderType)
    return
  }

  updateTsFourthHint(orderType)
  if ($('vb1NetTitle')) $('vb1NetTitle').textContent = 'Net volume'
  if ($('vb2NetTitle')) $('vb2NetTitle').textContent = 'Net volume'
  if ($('fb2LabelText')) $('fb2LabelText').textContent = 'Fb2 (Hz)'

  if (isPorted(orderType)) {
    $('chamber1Summary').textContent = 'Chamber — Vented to Cabin'
    $('chamber1ResultTitle').textContent = 'Chamber (Vented)'
    return
  }

  const isSeries = orderType === 'series'
  $('chamber1Summary').textContent = isSeries
    ? 'Chamber 1 — Rear / Internal Port → Front'
    : 'Chamber 1 — Rear / Low Tuning'
  $('chamber2Summary').textContent = isSeries
    ? 'Chamber 2 — Front / External Port → Cabin'
    : 'Chamber 2 — Front / High Tuning'
  $('chamber1ResultTitle').textContent = isSeries ? 'Chamber 1 (Internal → Front)' : 'Chamber 1 (Rear)'
  $('chamber2ResultTitle').textContent = isSeries ? 'Chamber 2 (External → Cabin)' : 'Chamber 2 (Front)'
}

function recalculate() {
  const inputs = readInputs()
  const result = runAll(inputs)

  updateOrderTypeUI(result.orderType)
  renderSummary(result)
  renderDriverSdInfo(result.driverArray)
  renderChamberResults(
    'chamber1Results',
    result.chambers.chamber1,
    result.excursion.chamber1,
    result.orderType,
    result.portRatios?.port1,
    result.driverArray.count,
    result.fourthOrderAnalysis
  )
  if (showChamber2(result.orderType)) {
    renderChamberResults('chamber2Results', result.chambers.chamber2, result.excursion.chamber2, result.orderType, result.portRatios?.port2, result.driverArray.count)
  } else {
    $('chamber2Results').innerHTML = ''
  }
  renderFourthOrderAnalysis(result)
  renderVolumeBreakdown(result)
  renderBandwidthAnalysis(result.passbandBandwidth, result.orderType)
  renderChamber3Results(result)
  renderCabinResults(result)
  renderWarnings(result.warnings)
  renderTsSuitability(result.tsSuitability)

  renderDiagram($('diagramContainer'), {
    orderType: result.orderType,
    chambers: result.chambers,
    packaging: result.packaging,
    maxDepthIn: inputs.maxDepthIn,
    maxWidthIn: inputs.maxWidthIn,
    maxHeightIn: inputs.maxHeightIn,
    volumeUnit: state.volumeUnit,
    lengthUnit: state.lengthUnit,
    cabinVolumeCuFt: inputs.cabinVolumeCuFt,
    doorTuningAnalysis: result.doorTuningAnalysis
  })

  updateCharts(result)
  syncComputedFbFields(result)
  updateNetVolPerSubReadouts(result.driverArray.count)
}

function updateFbInputLock(chamber) {
  const mode = $(`port${chamber}Mode`).value
  const locked = isLengthAdjustMode(mode)
  const fb = $(`fb${chamber}`)
  const hint = $(`fb${chamber}LockHint`)
  if (fb) {
    fb.disabled = locked
    fb.classList.toggle('input-locked', locked)
  }
  if (hint) hint.classList.toggle('hidden', !locked)
}

function syncComputedFbFields(result) {
  ;[1, 2].forEach((ch) => {
    if (!isLengthAdjustMode($(`port${ch}Mode`).value)) return
    const chamber = result.chambers[`chamber${ch}`]
    const fb = $(`fb${ch}`)
    if (fb && chamber?.fbHz > 0) {
      fb.value = chamber.fbHz.toFixed(1)
    }
  })
}

function scheduleRecalculate() {
  debouncedAutoSave(state)
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(recalculate, 150)
}

function updateSlotAreaCalc(chamber) {
  const calcEl = $(`port${chamber}SlotCalc`)
  if (!calcEl) return
  const isSlot = $(`port${chamber}Mode`).value === 'slot'
  calcEl.classList.toggle('hidden', !isSlot)
  if (!isSlot) return

  const outerW = toInches(num(`port${chamber}SlotW`))
  const outerH = toInches(num(`port${chamber}SlotH`))
  const wall = toInches(num(`port${chamber}Wall`)) || 0
  const innerW = Math.max(0, outerW - 2 * wall)
  const innerH = Math.max(0, outerH - 2 * wall)
  const areaSqIn = portAreaFromSlot(outerW, outerH, wall)
  const lenUnit = state.lengthUnit === 'mm' ? 'mm' : 'in'
  const areaText = state.areaUnit === 'sqcm' ? 'cm²' : 'sq in'
  const fmtDim = (v) => (state.lengthUnit === 'mm' ? (v * 25.4).toFixed(1) : v.toFixed(2))
  const fmtArea = fromSqIn(areaSqIn).toFixed(2)

  if (innerW > 0 && innerH > 0) {
    calcEl.textContent = `Inner opening: ${fmtDim(innerW)} × ${fmtDim(innerH)} ${lenUnit} (${fmtArea} ${areaText})`
  } else {
    calcEl.textContent = `Inner opening: — × — ${lenUnit} (— ${areaText})`
  }
}

function togglePortMode(chamber) {
  const mode = $(`port${chamber}Mode`).value
  const isArea = mode === 'area'
  const isDiam = mode === 'diameter'
  const isSlot = mode === 'slot'
  const showLength = isDiam || isSlot
  $(`port${chamber}AreaLabel`).classList.toggle('hidden', !isArea)
  $(`port${chamber}DiamLabel`).classList.toggle('hidden', !isDiam)
  $(`port${chamber}SlotWLabel`).classList.toggle('hidden', !isSlot)
  $(`port${chamber}SlotHLabel`).classList.toggle('hidden', !isSlot)
  $(`port${chamber}WallLabel`).classList.toggle('hidden', !isSlot)
  $(`port${chamber}LengthLabel`).classList.toggle('hidden', !showLength)
  if (isSlot) {
    const wallsEl = $(`port${chamber}CommonWalls`)
    if (wallsEl && !wallsEl.dataset.userSet) {
      wallsEl.value = String(defaultCommonWallsForChamber(chamber))
    }
  }
  togglePortStyleForChamber(chamber)
  updateSlotAreaCalc(chamber)
  updateFbInputLock(chamber)
}

function toggleVolumeBasis(chamber) {
  const basisEl = $(`vb${chamber}Basis`)
  if (basisEl && !['net', 'grossVolume', 'grossDims'].includes(basisEl.value)) {
    basisEl.value = 'net'
  }

  const basis = basisEl?.value || 'net'
  const isNet = basis === 'net'
  const isGrossVol = basis === 'grossVolume'
  const isDims = basis === 'grossDims'

  $(`vb${chamber}NetLabel`).classList.toggle('hidden', !isNet)
  $(`vb${chamber}GrossVolLabel`).classList.toggle('hidden', !isGrossVol)
  $(`vb${chamber}LenLabel`).classList.toggle('hidden', !isDims)
  $(`vb${chamber}WidthLabel`).classList.toggle('hidden', !isDims)
  $(`vb${chamber}HeightLabel`).classList.toggle('hidden', !isDims)
  $(`vb${chamber}OuterLabel`).classList.toggle('hidden', !isDims)

  const netInput = $(`vb${chamber}`)
  const grossInput = $(`vb${chamber}Gross`)
  if (netInput) {
    netInput.disabled = !isNet
    netInput.tabIndex = isNet ? 0 : -1
  }
  if (grossInput) {
    grossInput.disabled = !isGrossVol
    grossInput.tabIndex = isGrossVol ? 0 : -1
  }
}

function updateSliderLabels() {
  const bracingOn = $('bracingEnabled').checked
  const toleranceOn = $('toleranceEnabled').checked
  $('bracingPercentLabel').textContent = bracingOn
    ? `${$('bracingPercent').value}%`
    : 'Off'
  $('tolerancePercentLabel').textContent = toleranceOn
    ? `±${$('tolerancePercent').value}%`
    : 'Off'
}

function updateBuildAdjustmentsUI() {
  const bracingOn = $('bracingEnabled').checked
  const toleranceOn = $('toleranceEnabled').checked
  $('bracingPercent').disabled = !bracingOn
  $('tolerancePercent').disabled = !toleranceOn
  updateSliderLabels()
}

function updateUnitLabels() {
  const volText =
    state.volumeUnit === 'liters' ? 'L' : state.volumeUnit === 'cuin' ? 'cu in' : 'cu ft'
  const lenText = state.lengthUnit === 'mm' ? 'mm' : 'in'
  const areaText = state.areaUnit === 'sqcm' ? 'cm²' : 'sq in'
  document.querySelectorAll('.volume-unit').forEach((el) => { el.textContent = volText })
  document.querySelectorAll('.length-unit').forEach((el) => { el.textContent = lenText })
  document.querySelectorAll('.area-unit').forEach((el) => { el.textContent = areaText })
}

function applyTsSuggestions() {
  const inputs = readInputs()
  const suggestions = getTsSuggestions(inputs.ts)
  if (!suggestions) {
    alert('Enter at least Fs, Qts, Vas, and Sd to apply suggestions.')
    return
  }

  $('fb1').value = suggestions.fb1Hz.toFixed(1)
  $('fb2').value = suggestions.fb2Hz.toFixed(1)
  $('vb1').value = fromCuFt(suggestions.vb1CuFt).toFixed(2)
  $('vb2').value = fromCuFt(suggestions.vb2CuFt).toFixed(2)
  $('port1Area').value = fromSqIn(suggestions.portArea1SqIn).toFixed(1)
  $('port2Area').value = fromSqIn(suggestions.portArea2SqIn).toFixed(1)
  $('port1Mode').value = 'area'
  $('port2Mode').value = 'area'
  togglePortMode(1)
  togglePortMode(2)
  recalculate()
}

function refreshUIFromForm() {
  togglePortMode(1)
  togglePortMode(2)
  toggleVolumeBasis(1)
  toggleVolumeBasis(2)
  updateBuildAdjustmentsUI()
  updateUnitLabels()
  updateCalcModeMenuUI()
  updatePortLengthPlaceholders()
  updateDoorTuningUI()
  togglePortStyleUI()
  updateOrderTypeUI($('orderType').value)
  recalculate()
}

function setDesignStatus(msg) {
  const el = $('designStatus')
  if (!el) return
  el.textContent = msg
  if (msg) {
    setTimeout(() => {
      if (el.textContent === msg) el.textContent = ''
    }, 5000)
  }
}

function closeAllMenus() {
  document.querySelectorAll('.menu-item.open').forEach((item) => {
    item.classList.remove('open')
    const dd = item.querySelector('.menu-dropdown')
    if (dd) dd.hidden = true
  })
}

async function handleSaveDesign() {
  closeAllMenus()
  const data = exportDesign(state)
  const json = JSON.stringify(data, null, 2)
  const result = await saveDesignToFile(json)
  if (result.ok) {
    const name = result.filePath
      ? result.filePath.split(/[/\\]/).pop()
      : '6th-order-design.json'
    setDesignStatus(`Saved ${name}`)
  }
}

async function handleLoadDesign() {
  closeAllMenus()
  const result = await loadDesignFromFile()
  if (!result.ok || result.canceled) return
  try {
    const data = JSON.parse(result.content)
    applyDesign(data, state)
    refreshUIFromForm()
    debouncedAutoSave(state, 0)
    const name = result.filePath
      ? String(result.filePath).split(/[/\\]/).pop()
      : 'design'
    setDesignStatus(`Loaded ${name}`)
  } catch {
    alert('Could not load design — file is missing or invalid.')
  }
}

function handleClearDesign() {
  closeAllMenus()
  if (!confirm('Clear all inputs to zero / empty? This cannot be undone.')) return
  applyClearDesign(state)
  clearAutoSave()
  refreshUIFromForm()
  setDesignStatus('All fields cleared')
}

function updateCalcModeMenuUI() {
  document.querySelectorAll('[data-calc-mode]').forEach((btn) => {
    const active = btn.dataset.calcMode === state.calcMode
    btn.classList.toggle('menu-radio-active', active)
    btn.setAttribute('aria-checked', active ? 'true' : 'false')
  })
}

function setCalcMode(mode) {
  state.calcMode = mode
  updateCalcModeMenuUI()
  updatePortLengthPlaceholders()
  scheduleRecalculate()
  setDesignStatus(`Port model: ${calcModeLabel(mode)}`)
}

function updatePortLengthPlaceholders() {
  const hint =
    state.calcMode === CALC_MODES.HELMHOLTZ
      ? 'Helmholtz if blank'
      : state.calcMode === CALC_MODES.QUARTER_WAVE
        ? 'Quarter wave if blank'
        : 'MLTL if blank'
  ;['port1Length', 'port2Length'].forEach((id) => {
    const el = $(id)
    if (el) el.placeholder = hint
  })
}

function setupCalcModeMenu() {
  document.querySelectorAll('[data-calc-mode]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      setCalcMode(btn.dataset.calcMode)
      closeAllMenus()
    })
  })
  updateCalcModeMenuUI()
  updatePortLengthPlaceholders()
}

function updateThemeMenuUI() {
  document.querySelectorAll('[data-theme]').forEach((btn) => {
    const active = btn.dataset.theme === state.themeId
    btn.classList.toggle('menu-radio-active', active)
    btn.setAttribute('aria-checked', active ? 'true' : 'false')
  })
}

function setTheme(themeId) {
  state.themeId = applyTheme(themeId)
  updateThemeMenuUI()
  scheduleRecalculate()
  setDesignStatus(`Theme: ${themeLabel(state.themeId)}`)
}

function updateDoorTuningUI() {
  const on = state.doorTuningExperimental
  $('doorTuningFields')?.classList.toggle('hidden', !on)
  $('doorTuningHint')?.classList.toggle('hidden', !on)
  document.querySelector('.results-grid')?.classList.toggle('door-tuning-active', on)
  const sealed = $('cabinSealed')?.checked ?? false
  $('cabinLeakageAreaLabel')?.classList.toggle('hidden', sealed)
  const leakInput = $('cabinLeakageArea')
  if (leakInput) leakInput.disabled = sealed
  const btn = $('menuDoorTuningToggle')
  if (btn) {
    btn.classList.toggle('menu-radio-active', on)
    btn.setAttribute('aria-checked', on ? 'true' : 'false')
  }
}

function setDoorTuningExperimental(enabled) {
  state.doorTuningExperimental = Boolean(enabled)
  saveDoorTuningExperimental(state.doorTuningExperimental)
  updateDoorTuningUI()
  scheduleRecalculate()
  setDesignStatus(
    state.doorTuningExperimental ? 'Experimental: door tuning ON' : 'Experimental: door tuning OFF'
  )
}

function setupDoorTuningMenu() {
  $('menuDoorTuningToggle')?.addEventListener('click', (e) => {
    e.stopPropagation()
    setDoorTuningExperimental(!state.doorTuningExperimental)
    closeAllMenus()
  })
  updateDoorTuningUI()
}

function initDoorTuning() {
  state.doorTuningExperimental = loadSavedDoorTuningExperimental()
  updateDoorTuningUI()
}

function setupThemeMenu() {
  document.querySelectorAll('[data-theme]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      setTheme(btn.dataset.theme)
      closeAllMenus()
    })
  })
  updateThemeMenuUI()
}

function initTheme() {
  state.themeId = applyTheme(loadSavedTheme())
  updateThemeMenuUI()
}

function defaultCommonWallsForChamber(ch) {
  const isSeries = $('orderType')?.value === 'series'
  if (isSeries) return ch === 1 ? 2 : 0
  return 1
}

function updateNetVolPerSubReadouts(driverCount) {
  ;[1, 2].forEach((ch) => {
    const el = $(`vb${ch}PerSub`)
    if (!el) return
    const basis = $(`vb${ch}Basis`)?.value || 'net'
    const isNet = basis === 'net'
    el.classList.toggle('hidden', !isNet)
    if (!isNet || !driverCount) {
      el.textContent = ''
      return
    }
    const cuFt = toCuFt(num(`vb${ch}`))
    el.textContent = cuFt > 0 ? `Per sub: ${fmtVol(cuFt / driverCount)}` : 'Per sub: —'
  })
}

function togglePortStyleForChamber(ch) {
  const isRect = $(`port${ch}Mode`)?.value === 'slot'
  $(`port${ch}CommonWallsLabel`)?.classList.toggle('hidden', !isRect)
}

function togglePortStyleUI() {
  togglePortStyleForChamber(1)
  togglePortStyleForChamber(2)
}

function initBetaBanner() {
  const banner = $('betaBanner')
  const dismissBtn = $('betaBannerDismiss')
  if (!banner) return

  banner.hidden = isBetaBannerDismissed()
  dismissBtn?.addEventListener('click', () => {
    dismissBetaBanner()
    banner.hidden = true
  })
}

function setupMobileView() {
  const mq = window.matchMedia('(max-width: 960px)')
  const nav = document.getElementById('mobileNav')
  if (!nav) return

  const btnInputs = nav.querySelector('[data-mobile-view="inputs"]')
  const btnResults = nav.querySelector('[data-mobile-view="results"]')

  function setView(view) {
    document.body.dataset.mobileView = view
    btnInputs?.classList.toggle('active', view === 'inputs')
    btnResults?.classList.toggle('active', view === 'results')
    if (view === 'results') {
      document.querySelector('.results-panel')?.scrollIntoView({ block: 'start' })
      window.scrollTo({ top: 0, behavior: 'smooth' })
      requestAnimationFrame(() => {
        cabinChart?.resize()
        passbandChart?.resize()
        sensitivityChart?.resize()
      })
    } else {
      document.querySelector('.inputs-panel')?.scrollIntoView({ block: 'start' })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  function applyMobileMode(isMobile) {
    document.body.classList.toggle('mobile-mode', isMobile)
    if (isMobile) {
      if (!document.body.dataset.mobileView) setView('inputs')
    } else {
      delete document.body.dataset.mobileView
      btnInputs?.classList.remove('active')
      btnResults?.classList.remove('active')
      btnInputs?.classList.add('active')
    }
  }

  btnInputs?.addEventListener('click', () => setView('inputs'))
  btnResults?.addEventListener('click', () => setView('results'))

  applyMobileMode(mq.matches)
  mq.addEventListener('change', (e) => applyMobileMode(e.matches))
}

function updateMobileMenuAnchor() {
  if (!window.matchMedia('(max-width: 960px)').matches) return
  const bar = document.querySelector('.menu-bar')
  if (!bar) return
  document.documentElement.style.setProperty('--mobile-menu-top', `${bar.getBoundingClientRect().bottom}px`)
}

function setupMenuBar() {
  document.querySelectorAll('.menu-item').forEach((item) => {
    const trigger = item.querySelector('.menu-trigger')
    const dropdown = item.querySelector('.menu-dropdown')
    trigger?.addEventListener('click', (e) => {
      e.stopPropagation()
      const wasOpen = item.classList.contains('open')
      closeAllMenus()
      if (!wasOpen && dropdown) {
        updateMobileMenuAnchor()
        item.classList.add('open')
        dropdown.hidden = false
      }
    })
  })

  document.addEventListener('click', closeAllMenus)

  $('menuSaveDesign')?.addEventListener('click', (e) => {
    e.stopPropagation()
    handleSaveDesign()
  })
  $('menuLoadDesign')?.addEventListener('click', (e) => {
    e.stopPropagation()
    handleLoadDesign()
  })
  $('menuClearDesign')?.addEventListener('click', (e) => {
    e.stopPropagation()
    handleClearDesign()
  })
  $('menuShowHelp')?.addEventListener('click', (e) => {
    e.stopPropagation()
    closeAllMenus()
    $('helpDialog')?.showModal()
  })
  $('menuShowBetaDisclaimer')?.addEventListener('click', (e) => {
    e.stopPropagation()
    closeAllMenus()
    showBetaBanner()
  })
  $('helpCloseBtn')?.addEventListener('click', () => $('helpDialog')?.close())
  $('helpDialog')?.addEventListener('click', (e) => {
    if (e.target === $('helpDialog')) $('helpDialog').close()
  })
}

function setupTabs() {
  document.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'))
      document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'))
      tab.classList.add('active')
      $(`tab${tab.dataset.tab.charAt(0).toUpperCase()}${tab.dataset.tab.slice(1)}`).classList.add('active')
    })
  })
}

function bindEvents() {
  const inputIds = [
    'cabinLength', 'cabinVolume', 'doorWidth', 'doorHeight', 'doorJambThickness', 'cabinLeakageArea',
    'maxDepth', 'maxHeight', 'maxWidth',
    'wallThickness', 'bracingPercent', 'tolerancePercent',
    'driverSize', 'driverCount',
    'tsFs', 'tsQts', 'tsQes', 'tsVas', 'tsSd', 'tsRe', 'tsXmax', 'tsPe', 'tsVd',
    'fb1', 'vb1', 'vb1Gross', 'vb1Len', 'vb1Width', 'vb1Height', 'vb1Extra',
    'port1Area', 'port1Diam', 'port1Length', 'port1SlotW', 'port1SlotH', 'port1Wall',
    'fb2', 'vb2', 'vb2Gross', 'vb2Len', 'vb2Width', 'vb2Height', 'vb2Extra',
    'port2Area', 'port2Diam', 'port2Length', 'port2SlotW', 'port2SlotH', 'port2Wall'
  ]

  ;['bracingEnabled', 'toleranceEnabled'].forEach((id) => {
    $(id).addEventListener('change', () => {
      updateBuildAdjustmentsUI()
      scheduleRecalculate()
    })
  })

  inputIds.forEach((id) => {
    $(id).addEventListener('input', () => {
      if (id === 'bracingPercent' || id === 'tolerancePercent') updateSliderLabels()
      if (id.match(/^port[12]SlotW|^port[12]SlotH|^port[12]Wall$/)) {
        updateSlotAreaCalc(id.includes('port1') ? 1 : 2)
      }
      if (id.startsWith('ts')) updateTsFourthHint($('orderType').value)
      scheduleRecalculate()
    })
  })

  ;['vb1Basis', 'vb2Basis'].forEach((id) => {
    $(id).addEventListener('change', () => {
      toggleVolumeBasis(id.includes('1') ? 1 : 2)
      scheduleRecalculate()
    })
  })

  ;['vb1Outer', 'vb2Outer'].forEach((id) => {
    $(id).addEventListener('change', scheduleRecalculate)
  })

  ;['tsVasUnit', 'tsSdUnit', 'port1Mode', 'port2Mode'].forEach((id) => {
    $(id).addEventListener('change', () => {
      if (id.startsWith('port')) togglePortMode(id.includes('1') ? 1 : 2)
      if (id.startsWith('ts')) updateTsFourthHint($('orderType').value)
      scheduleRecalculate()
    })
  })

  $('applyTsBtn').addEventListener('click', applyTsSuggestions)

  $('volumeUnit').addEventListener('change', (e) => {
    const prevUnit = state.volumeUnit
    state.volumeUnit = e.target.value
    const volFields = ['cabinVolume', 'vb1', 'vb2', 'vb1Gross', 'vb2Gross']
    volFields.forEach((id) => {
      const raw = num(id)
      if (raw > 0) {
        let cuFt = raw
        if (prevUnit === 'liters') cuFt = raw / 28.3168
        else if (prevUnit === 'cuin') cuFt = raw / 1728
        $(id).value = fromCuFt(cuFt).toFixed(state.volumeUnit === 'cuin' ? 0 : 2)
      }
    })
    updateUnitLabels()
    updateSlotAreaCalc(1)
    updateSlotAreaCalc(2)
    scheduleRecalculate()
  })

  $('lengthUnit').addEventListener('change', (e) => {
    state.lengthUnit = e.target.value
    updateUnitLabels()
    updateSlotAreaCalc(1)
    updateSlotAreaCalc(2)
    scheduleRecalculate()
  })

  ;['port1CommonWalls', 'port2CommonWalls'].forEach((id) => {
    $(id)?.addEventListener('change', (e) => {
      e.target.dataset.userSet = '1'
      scheduleRecalculate()
    })
  })

  $('orderType').addEventListener('change', () => {
    ;[1, 2].forEach((ch) => {
      const wallsEl = $(`port${ch}CommonWalls`)
      if ($(`port${ch}Mode`)?.value === 'slot' && wallsEl && !wallsEl.dataset.userSet) {
        wallsEl.value = String(defaultCommonWallsForChamber(ch))
      }
    })
    scheduleRecalculate()
  })

  $('doorsOpen').addEventListener('change', scheduleRecalculate)
  $('cabinSealed')?.addEventListener('change', () => {
    updateDoorTuningUI()
    scheduleRecalculate()
  })

  $('areaUnit').addEventListener('change', (e) => {
    const prevUnit = state.areaUnit
    state.areaUnit = e.target.value
    ;['port1Area', 'port2Area'].forEach((id) => {
      const raw = num(id)
      if (raw > 0) {
        const sqIn = prevUnit === 'sqcm' ? raw / 6.4516 : raw
        $(id).value = fromSqIn(sqIn).toFixed(1)
      }
    })
    updateUnitLabels()
    updateSlotAreaCalc(1)
    updateSlotAreaCalc(2)
    scheduleRecalculate()
  })
}

setupTabs()
initTheme()
initDoorTuning()
initBetaBanner()
setupMenuBar()
setupMobileView()
setupCalcModeMenu()
setupThemeMenu()
setupDoorTuningMenu()
enhanceNumberInputs()
bindEvents()

const { lsResult } = bootstrapDesignState(state, applyStartupPreset)
if (lsResult.ok) {
  setDesignStatus('Restored auto-save')
} else if (lsResult.error) {
  setDesignStatus(lsResult.error)
}

refreshUIFromForm()
