export function renderDiagram(container, data) {
  if (data.orderType === 'ported') {
    renderPortedDiagram(container, data)
  } else if (data.orderType === 'fourth') {
    renderFourthDiagram(container, data)
  } else if (data.orderType === 'series') {
    renderSeriesDiagram(container, data)
  } else {
    renderParallelDiagram(container, data)
  }
}

const SVG_W = 900
const SVG_H = 420
const BOX_X = 40
const BOX_W = 420
const BOX_Y = 48
const BOX_H = 150
const CABIN_X = BOX_X + BOX_W + 12
const CABIN_W = SVG_W - CABIN_X - 24
const LEGEND_Y = 230

function fmtDiagramVol(v, volumeUnit) {
  return volumeUnit === 'liters' ? (v * 28.3168).toFixed(1) : v.toFixed(2)
}

function fmtDiagramLen(v, lengthUnit) {
  return lengthUnit === 'mm' ? (v * 25.4).toFixed(0) : v.toFixed(1)
}

function fmtDiagramArea(sqIn, areaUnit) {
  if (areaUnit === 'sqcm') return `${(sqIn * 6.4516).toFixed(0)} cm²`
  return `${sqIn.toFixed(0)} sq in`
}

function renderCabinZone({
  includeCabin = true,
  effectiveCabinCuFt,
  vehicleInteriorCuFt,
  doorTuning,
  volumeUnit,
  lengthUnit,
  areaUnit = 'sqin'
}) {
  if (!includeCabin) {
    return `
  <rect x="${CABIN_X}" y="${BOX_Y - 8}" width="${CABIN_W}" height="${BOX_H + 16}" fill="rgba(148,163,184,0.06)" stroke="#475569" stroke-width="1" stroke-dasharray="8 4" rx="6"/>
  <text x="${CABIN_X + CABIN_W / 2}" y="${BOX_Y + BOX_H / 2}" text-anchor="middle" fill="#64748b" font-size="14" font-family="Segoe UI, sans-serif" opacity="0.5">CABIN</text>`
  }

  const doorActive = doorTuning?.enabled
  const doorValid = doorTuning?.valid
  const volLabel = volumeUnit === 'liters' ? 'L' : 'ft³'
  const lenLabel = lengthUnit === 'mm' ? 'mm' : 'in'
  const fmtVol = (v) => fmtDiagramVol(v, volumeUnit)
  const fmtLen = (v) => fmtDiagramLen(v, lengthUnit)
  const fmtArea = (sqIn) => fmtDiagramArea(sqIn, areaUnit)
  const cabinVolLabel = effectiveCabinCuFt
    ? `${fmtVol(effectiveCabinCuFt)} ${volLabel} effective`
    : '— effective'
  const vehicleSub =
    vehicleInteriorCuFt && effectiveCabinCuFt != null
      ? `<text x="${CABIN_X + CABIN_W / 2}" y="${BOX_Y + 54}" text-anchor="middle" fill="#64748b" font-size="9" font-family="Segoe UI, sans-serif">${fmtVol(vehicleInteriorCuFt)} ${volLabel} vehicle total</text>`
      : ''

  const fill = doorActive ? 'rgba(251,191,36,0.1)' : 'rgba(148,163,184,0.06)'
  const stroke = doorActive ? '#fbbf24' : '#475569'
  const strokeDash = doorActive ? 'none' : '8 4'
  const strokeW = doorActive ? 2 : 1

  const doorH = doorActive && doorValid
    ? Math.min(BOX_H - 24, Math.max(36, (doorTuning.doorHeightIn / Math.max(doorTuning.doorWidthIn, 1)) * 48))
    : 0
  const doorW = doorActive && doorValid ? Math.max(14, Math.min(28, doorH * 0.35)) : 0
  const doorX = CABIN_X + CABIN_W - 2
  const doorY = BOX_Y + (BOX_H - doorH) / 2
  const coupledLabelY = doorTuning?.leakAreaSqIn > 0 ? BOX_Y + 96 : BOX_Y + 82
  const doorLabelX = doorX - doorW - 10
  const doorPortGraphic =
    doorActive && doorValid
      ? `
  <rect x="${doorX - doorW + 2}" y="${doorY}" width="${doorW}" height="${doorH}" fill="#fbbf24" opacity="0.85" rx="2"/>
  <line x1="${doorX - doorW + 2}" y1="${doorY + doorH / 2}" x2="${doorX - doorW - 6}" y2="${doorY + doorH / 2}" stroke="#fbbf24" stroke-width="1.5" stroke-dasharray="3 2" opacity="0.7"/>
  <text x="${doorLabelX}" y="${doorY + doorH / 2 - 6}" text-anchor="end" fill="#fbbf24" font-size="9" font-weight="600" font-family="Segoe UI, sans-serif">DOOR →</text>
  <text x="${doorLabelX}" y="${doorY + doorH / 2 + 8}" text-anchor="end" fill="#94a3b8" font-size="8" font-family="Segoe UI, sans-serif">${fmtArea(doorTuning.doorAreaSqIn)}</text>
  ${doorTuning.leakAreaSqIn > 0 ? `<text x="${doorLabelX}" y="${doorY + doorH / 2 + 20}" text-anchor="end" fill="#94a3b8" font-size="8" font-family="Segoe UI, sans-serif">+ leak ${fmtArea(doorTuning.leakAreaSqIn)}</text>` : ''}`
      : ''

  const labelBlock = doorActive
    ? `
  <text x="${CABIN_X + CABIN_W / 2}" y="${BOX_Y + 24}" text-anchor="middle" fill="#fbbf24" font-size="12" font-weight="600" font-family="Segoe UI, sans-serif">Ch. 3 — Cabin</text>
  <text x="${CABIN_X + CABIN_W / 2}" y="${BOX_Y + 40}" text-anchor="middle" fill="#94a3b8" font-size="10" font-family="Segoe UI, sans-serif">${cabinVolLabel}</text>
  ${vehicleSub}
  ${
    doorValid
      ? `<text x="${CABIN_X + CABIN_W / 2}" y="${BOX_Y + 68}" text-anchor="middle" fill="#fbbf24" font-size="10" font-weight="600" font-family="Segoe UI, sans-serif">F_door ${doorTuning.hz.toFixed(1)} Hz</text>
  <text x="${CABIN_X + CABIN_W / 2}" y="${BOX_Y + 82}" text-anchor="middle" fill="#94a3b8" font-size="9" font-family="Segoe UI, sans-serif">L_eff ${fmtLen(doorTuning.effectiveLengthIn)} ${lenLabel}</text>
  ${doorTuning.leakAreaSqIn > 0 ? `<text x="${CABIN_X + CABIN_W / 2}" y="${BOX_Y + 96}" text-anchor="middle" fill="#94a3b8" font-size="9" font-family="Segoe UI, sans-serif">+ leak ${fmtArea(doorTuning.leakAreaSqIn)}</text>` : ''}
  ${doorTuning.coupled ? `<text x="${CABIN_X + CABIN_W / 2}" y="${coupledLabelY + 14}" text-anchor="middle" fill="#fbbf24" font-size="9" font-weight="600" font-family="Segoe UI, sans-serif">Aligned to front tuning (±5 Hz)</text>` : ''}`
      : `<text x="${CABIN_X + CABIN_W / 2}" y="${BOX_Y + BOX_H / 2}" text-anchor="middle" fill="#64748b" font-size="10" font-family="Segoe UI, sans-serif">Enter door dimensions</text>`
  }`
    : `<text x="${CABIN_X + CABIN_W / 2}" y="${BOX_Y + BOX_H / 2 - 8}" text-anchor="middle" fill="#64748b" font-size="12" font-family="Segoe UI, sans-serif">${cabinVolLabel}</text>
    ${vehicleSub}`

  return `
  <rect x="${CABIN_X}" y="${BOX_Y - 8}" width="${CABIN_W}" height="${BOX_H + 16}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeW}" stroke-dasharray="${strokeDash}" rx="6"/>
  ${labelBlock}
  ${doorPortGraphic}`
}

function doorTuningLegend(y, doorTuning, fmtLen, fmtArea, lenLabel) {
  if (!doorTuning?.enabled || !doorTuning?.valid) return ''
  return `
  <circle cx="${BOX_X + 36}" cy="${y + 128}" r="10" fill="#fbbf24"/>
  <text x="${BOX_X + 36}" y="${y + 132}" text-anchor="middle" fill="#0f172a" font-size="8" font-weight="700" font-family="Segoe UI, sans-serif">D</text>
  <text x="${BOX_X + 56}" y="${y + 124}" fill="#fbbf24" font-size="11" font-family="Segoe UI, sans-serif">Ch. 3 door port · F_door ${doorTuning.hz.toFixed(1)} Hz · L_eff ${fmtLen(doorTuning.effectiveLengthIn)} ${lenLabel}</text>
  <text x="${BOX_X + 56}" y="${y + 140}" fill="#94a3b8" font-size="10" font-family="Segoe UI, sans-serif">${fmtArea(doorTuning.totalVentAreaSqIn ?? doorTuning.doorAreaSqIn)} total vent · jamb ${fmtLen(doorTuning.jambThicknessIn)} ${lenLabel}${doorTuning.leakAreaSqIn > 0 ? ` · leak ${fmtArea(doorTuning.leakAreaSqIn)}` : ''}${doorTuning.coupled ? ' · aligned to front tuning' : ''}</text>`
}

function chamberWidthFromVolume(rearVol, frontVol) {
  const total = (rearVol || 1) + (frontVol || 1)
  const rearFrac = rearVol / total
  const clamped = Math.max(0.25, Math.min(0.75, rearFrac))
  return BOX_W * clamped
}

function cabinZoneProps(data) {
  return {
    includeCabin: data.includeCabin !== false,
    effectiveCabinCuFt: data.effectiveCabinCuFt,
    vehicleInteriorCuFt: data.vehicleInteriorCuFt,
    doorTuning: data.doorTuningAnalysis,
    volumeUnit: data.volumeUnit,
    lengthUnit: data.lengthUnit
  }
}

function renderPortedDiagram(container, data) {
  const { chambers, volumeUnit, lengthUnit, doorTuningAnalysis } = data
  const c1 = chambers.chamber1
  const volLabel = volumeUnit === 'liters' ? 'L' : 'ft³'
  const lenLabel = lengthUnit === 'mm' ? 'mm' : 'in'
  const fmtLen = (v) => fmtDiagramLen(v, lengthUnit)
  const fmtVol = (v) => fmtDiagramVol(v, volumeUnit)
  const fmtArea = (sqIn) => fmtDiagramArea(sqIn, 'sqin')
  const pPort = straightPortGraphic(BOX_X + BOX_W - 22, BOX_Y + 44, BOX_H - 60, '#60a5fa', 'right')

  container.innerHTML = `
<svg viewBox="0 0 ${SVG_W} ${SVG_H}" xmlns="http://www.w3.org/2000/svg" role="img">
  ${defs()}
  <text x="${SVG_W / 2}" y="24" text-anchor="middle" fill="#94a3b8" font-size="13" font-weight="600" font-family="Segoe UI, sans-serif">Ported — single chamber vents to cabin</text>
  ${renderCabinZone(cabinZoneProps(data))}
  <rect x="${BOX_X}" y="${BOX_Y}" width="${BOX_W}" height="${BOX_H}" fill="#1a2332" stroke="#64748b" stroke-width="2" rx="4"/>
  <rect x="${BOX_X + 6}" y="${BOX_Y + 6}" width="${BOX_W - 12}" height="${BOX_H - 12}" fill="url(#rearGrad)" stroke="#60a5fa" stroke-width="1.5" rx="3"/>
  <text x="${BOX_X + BOX_W / 2}" y="${BOX_Y + 28}" text-anchor="middle" fill="#e2e8f0" font-size="12" font-weight="600" font-family="Segoe UI, sans-serif">Vented chamber</text>
  <text x="${BOX_X + BOX_W / 2}" y="${BOX_Y + 44}" text-anchor="middle" fill="#94a3b8" font-size="10" font-family="Segoe UI, sans-serif">${fmtVol(c1.volumeCuFt)} ${volLabel}</text>
  <text x="${BOX_X + BOX_W / 2}" y="${BOX_Y + 58}" text-anchor="middle" fill="#94a3b8" font-size="10" font-family="Segoe UI, sans-serif">Fb ${c1.fbHz} Hz</text>
  <rect x="${BOX_X + BOX_W / 2 - 16}" y="${BOX_Y + BOX_H / 2 - 30}" width="32" height="60" fill="#334155" stroke="#cbd5e1" stroke-width="1.5" rx="4"/>
  <circle cx="${BOX_X + BOX_W / 2}" cy="${BOX_Y + BOX_H / 2}" r="11" fill="#0f172a" stroke="#e2e8f0" stroke-width="1.5"/>
  <text x="${BOX_X + BOX_W / 2}" y="${BOX_Y + BOX_H / 2 + 4}" text-anchor="middle" fill="#e2e8f0" font-size="8" font-weight="600" font-family="Segoe UI, sans-serif">DRV</text>
  ${pPort}
  ${portBadge(BOX_X + BOX_W - 20, BOX_Y + 36, 'P', '#60a5fa')}
  <path d="M ${BOX_X + BOX_W - 10} ${BOX_Y + 50} L ${CABIN_X + 30} ${BOX_Y + 50}" stroke="#60a5fa" stroke-width="2" stroke-dasharray="5 3" fill="none" marker-end="url(#arrowBlue)" opacity="0.8"/>
  <rect x="${BOX_X}" y="${LEGEND_Y}" width="${SVG_W - BOX_X - 24}" height="120" fill="#1a2332" stroke="#334155" stroke-width="1" rx="6"/>
  <text x="${BOX_X + 16}" y="${LEGEND_Y + 22}" fill="#94a3b8" font-size="11" font-weight="600" font-family="Segoe UI, sans-serif">LEGEND</text>
  <circle cx="${BOX_X + 36}" cy="${LEGEND_Y + 48}" r="10" fill="#60a5fa"/>
  <text x="${BOX_X + 36}" y="${LEGEND_Y + 52}" text-anchor="middle" fill="#0f172a" font-size="8" font-weight="700" font-family="Segoe UI, sans-serif">P</text>
  <text x="${BOX_X + 56}" y="${LEGEND_Y + 44}" fill="#e2e8f0" font-size="11" font-family="Segoe UI, sans-serif">${fmtLen(c1.portLengthIn)} ${lenLabel} · Fb ${c1.fbHz} Hz · External (0.732×r)</text>
  <text x="${BOX_X + 56}" y="${LEGEND_Y + 60}" fill="#94a3b8" font-size="10" font-family="Segoe UI, sans-serif">→ Cabin</text>
  ${doorTuningLegend(LEGEND_Y, doorTuningAnalysis, fmtLen, fmtArea, lenLabel)}
</svg>`
}

function renderFourthDiagram(container, data) {
  renderLayout(container, data, {
    title: '4th Order — sealed rear, ported front to cabin',
    p1Dest: 'Sealed (no port)',
    p2Dest: '→ Cabin',
    p1Route: 'fourthSealed',
    p2Route: 'parallelP2'
  })
}

function renderParallelDiagram(container, data) {
  renderLayout(container, data, {
    title: 'Parallel 6th Order — both ports vent to cabin',
    p1Dest: '→ Cabin',
    p2Dest: '→ Cabin',
    p1Route: 'parallelP1',
    p2Route: 'parallelP2'
  })
}

function renderSeriesDiagram(container, data) {
  renderLayout(container, data, {
    title: 'Series 6th Order — rear vents into front, front vents to cabin',
    p1Dest: '→ Front chamber',
    p2Dest: '→ Cabin',
    p1Route: 'seriesP1',
    p2Route: 'parallelP2'
  })
}

function renderLayout(container, data, config) {
  const { chambers, volumeUnit, lengthUnit, orderType, doorTuningAnalysis } = data
  const c1 = chambers.chamber1
  const c2 = chambers.chamber2

  const rearW = chamberWidthFromVolume(c1.volumeCuFt, c2.volumeCuFt)
  const frontW = BOX_W - rearW
  const dividerX = BOX_X + rearW

  const volLabel = volumeUnit === 'liters' ? 'L' : 'ft³'
  const lenLabel = lengthUnit === 'mm' ? 'mm' : 'in'
  const fmtLen = (v) => fmtDiagramLen(v, lengthUnit)
  const fmtVol = (v) => fmtDiagramVol(v, volumeUnit)
  const fmtArea = (sqIn) => fmtDiagramArea(sqIn, 'sqin')

  container.innerHTML = `
<svg viewBox="0 0 ${SVG_W} ${SVG_H}" xmlns="http://www.w3.org/2000/svg" role="img">
  ${defs()}
  <text x="${SVG_W / 2}" y="24" text-anchor="middle" fill="#94a3b8" font-size="13" font-weight="600" font-family="Segoe UI, sans-serif">${config.title}</text>

  ${renderCabinZone(cabinZoneProps(data))}

  <!-- Box wall -->
  <rect x="${BOX_X}" y="${BOX_Y}" width="${BOX_W}" height="${BOX_H}" fill="#1a2332" stroke="#64748b" stroke-width="2" rx="4"/>
  <text x="${BOX_X - 6}" y="${BOX_Y + BOX_H / 2}" text-anchor="end" fill="#64748b" font-size="10" font-family="Segoe UI, sans-serif" transform="rotate(-90, ${BOX_X - 6}, ${BOX_Y + BOX_H / 2})">B-Pillar</text>

  ${chamberRects(BOX_X, BOX_Y, BOX_H, rearW, frontW, dividerX, c1, c2, fmtVol, volLabel, orderType)}
  ${driverOnDivider(dividerX, BOX_Y, BOX_H)}
  ${renderPortRoutes(config, { dividerX, frontW, c1, c2 })}
  ${config.p1Route === 'fourthSealed' ? '' : portBadge(config.p1Route === 'seriesP1' ? dividerX + frontW * 0.35 : BOX_X + 28, BOX_Y + BOX_H / 2 - 6, 'P1', '#60a5fa')}
  ${portBadge(config.p2Route === 'parallelP2' ? BOX_X + BOX_W - 20 : BOX_X + BOX_W - 20, BOX_Y + 36, config.p1Route === 'fourthSealed' ? 'P' : 'P2', '#34d399')}

  ${legendPanel(LEGEND_Y, {
    c1, c2, fmtLen, fmtVol, volLabel, lenLabel, config, orderType, doorTuningAnalysis, fmtArea
  })}
</svg>`
}

function defs() {
  return `<defs>
    <linearGradient id="rearGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#1e3a5f"/><stop offset="100%" stop-color="#1e40af"/>
    </linearGradient>
    <linearGradient id="frontGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#14532d"/><stop offset="100%" stop-color="#166534"/>
    </linearGradient>
    <marker id="arrowBlue" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
      <path d="M0,0 L8,4 L0,8 Z" fill="#60a5fa"/>
    </marker>
    <marker id="arrowGreen" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
      <path d="M0,0 L8,4 L0,8 Z" fill="#34d399"/>
    </marker>
  </defs>`
}

function chamberRects(boxX, boxY, boxH, rearW, frontW, dividerX, c1, c2, fmtVol, volLabel, orderType) {
  const rearLabel = orderType === 'series' ? 'Rear' : orderType === 'fourth' ? 'Sealed rear' : 'Rear / Low'
  const frontLabel = orderType === 'series' ? 'Front' : orderType === 'fourth' ? 'Ported front' : 'Front / High'
  return `
  <rect x="${boxX + 6}" y="${boxY + 6}" width="${rearW - 12}" height="${boxH - 12}" fill="url(#rearGrad)" stroke="#60a5fa" stroke-width="1.5" rx="3"/>
  <text x="${boxX + rearW / 2}" y="${boxY + 28}" text-anchor="middle" fill="#e2e8f0" font-size="12" font-weight="600" font-family="Segoe UI, sans-serif">${rearLabel}</text>
  <text x="${boxX + rearW / 2}" y="${boxY + 44}" text-anchor="middle" fill="#94a3b8" font-size="10" font-family="Segoe UI, sans-serif">${fmtVol(c1.volumeCuFt)} ${volLabel}</text>
  <text x="${boxX + rearW / 2}" y="${boxY + 58}" text-anchor="middle" fill="#94a3b8" font-size="10" font-family="Segoe UI, sans-serif">Fb ${c1.fbHz} Hz</text>

  <line x1="${dividerX}" y1="${boxY + 4}" x2="${dividerX}" y2="${boxY + boxH - 4}" stroke="#94a3b8" stroke-width="2"/>

  <rect x="${dividerX + 6}" y="${boxY + 6}" width="${frontW - 12}" height="${boxH - 12}" fill="url(#frontGrad)" stroke="#34d399" stroke-width="1.5" rx="3"/>
  <text x="${dividerX + frontW / 2}" y="${boxY + 28}" text-anchor="middle" fill="#e2e8f0" font-size="12" font-weight="600" font-family="Segoe UI, sans-serif">${frontLabel}</text>
  <text x="${dividerX + frontW / 2}" y="${boxY + 44}" text-anchor="middle" fill="#94a3b8" font-size="10" font-family="Segoe UI, sans-serif">${fmtVol(c2.volumeCuFt)} ${volLabel}</text>
  <text x="${dividerX + frontW / 2}" y="${boxY + 58}" text-anchor="middle" fill="#94a3b8" font-size="10" font-family="Segoe UI, sans-serif">Fb ${c2.fbHz} Hz</text>`
}

function driverOnDivider(dividerX, boxY, boxH) {
  return `
  <rect x="${dividerX - 16}" y="${boxY + boxH / 2 - 30}" width="32" height="60" fill="#334155" stroke="#cbd5e1" stroke-width="1.5" rx="4"/>
  <circle cx="${dividerX}" cy="${boxY + boxH / 2}" r="11" fill="#0f172a" stroke="#e2e8f0" stroke-width="1.5"/>
  <text x="${dividerX}" y="${boxY + boxH / 2 + 4}" text-anchor="middle" fill="#e2e8f0" font-size="8" font-weight="600" font-family="Segoe UI, sans-serif">DRV</text>`
}

function portBadge(x, y, label, color) {
  return `
  <circle cx="${x}" cy="${y}" r="12" fill="${color}" opacity="0.9"/>
  <text x="${x}" y="${y + 4}" text-anchor="middle" fill="#0f172a" font-size="9" font-weight="700" font-family="Segoe UI, sans-serif">${label}</text>`
}

function renderPortRoutes(config, ctx) {
  const { dividerX, frontW } = ctx
  if (config.p1Route === 'fourthSealed') {
    const p2Port = straightPortGraphic(BOX_X + BOX_W - 22, BOX_Y + 44, BOX_H - 60, '#34d399', 'right')
    return `
    <text x="${BOX_X + (dividerX - BOX_X) / 2}" y="${BOX_Y + BOX_H - 16}" text-anchor="middle" fill="#94a3b8" font-size="9" font-family="Segoe UI, sans-serif">SEALED</text>
    ${p2Port}
    <path d="M ${BOX_X + BOX_W - 10} ${BOX_Y + 50} L ${CABIN_X + 30} ${BOX_Y + 50}" stroke="#34d399" stroke-width="2" stroke-dasharray="5 3" fill="none" marker-end="url(#arrowGreen)" opacity="0.8"/>`
  }
  if (config.p1Route === 'seriesP1') {
    const p2Port = straightPortGraphic(BOX_X + BOX_W - 22, BOX_Y + 44, BOX_H - 60, '#34d399', 'right')
    return `
    <rect x="${dividerX - 6}" y="${BOX_Y + BOX_H / 2 + 18}" width="${frontW * 0.5}" height="14" fill="#60a5fa" opacity="0.7" rx="3"/>
    <path d="M ${dividerX + frontW * 0.45} ${BOX_Y + BOX_H / 2 - 16} L ${dividerX + frontW - 24} ${BOX_Y + BOX_H / 2 - 16}"
      stroke="#60a5fa" stroke-width="2" fill="none" marker-end="url(#arrowBlue)"/>
    ${p2Port}
    <path d="M ${BOX_X + BOX_W - 10} ${BOX_Y + 50} L ${CABIN_X + 30} ${BOX_Y + 50}" stroke="#34d399" stroke-width="2" stroke-dasharray="5 3" fill="none" marker-end="url(#arrowGreen)" opacity="0.8"/>`
  }
  const p1Port = straightPortGraphic(BOX_X + 18, BOX_Y + 50, BOX_H - 70, '#60a5fa', 'left')
  const p2Port = straightPortGraphic(BOX_X + BOX_W - 22, BOX_Y + 44, BOX_H - 60, '#34d399', 'right')
  return `
  ${p1Port}
  <path d="M ${BOX_X + 24} ${BOX_Y + BOX_H / 2} L ${CABIN_X + 20} ${BOX_Y + BOX_H / 2}" stroke="#60a5fa" stroke-width="2" stroke-dasharray="5 3" fill="none" marker-end="url(#arrowBlue)" opacity="0.8"/>
  ${p2Port}
  <path d="M ${BOX_X + BOX_W - 10} ${BOX_Y + 50} L ${CABIN_X + 30} ${BOX_Y + 50}" stroke="#34d399" stroke-width="2" stroke-dasharray="5 3" fill="none" marker-end="url(#arrowGreen)" opacity="0.8"/>`
}

function straightPortGraphic(x, y, h, color, side) {
  const flare = side === 'right'
    ? `${x + 6},${y - 8} ${x + 18},${y + 2} ${x - 4},${y + 2}`
    : `${x + 6},${y - 8} ${x + 14},${y + 2} ${x - 2},${y + 2}`
  return `<rect x="${x}" y="${y}" width="14" height="${h}" fill="${color}" opacity="0.75" rx="2"/>
    <polygon points="${flare}" fill="${color}"/>`
}

function foldedPortGraphic(x, y, w, h, color) {
  return `<path d="M ${x} ${y} L ${x + w} ${y} L ${x + w} ${y + h} L ${x + w / 2} ${y + h} L ${x + w / 2} ${y + h / 2} L ${x} ${y + h / 2} Z"
    fill="${color}" opacity="0.55" stroke="${color}" stroke-width="1.5"/>`
}

function legendPanel(y, info) {
  const {
    c1, c2, fmtLen, fmtVol, volLabel, lenLabel, config, orderType, doorTuningAnalysis, fmtArea
  } = info
  const p1Type = orderType === 'series' ? 'Internal (0.614×r)' : orderType === 'fourth' ? 'Sealed rear' : 'External (0.732×r)'
  const p2Type = 'External (0.732×r)'
  const volRatio =
    c1.volumeCuFt > 0
      ? `Front:Rear vol ${(c2.volumeCuFt / c1.volumeCuFt).toFixed(1)}:1`
      : ''

  const p1Legend = orderType === 'fourth'
    ? `<text x="${BOX_X + 56}" y="${y + 44}" fill="#e2e8f0" font-size="11" font-family="Segoe UI, sans-serif">Sealed · ${fmtVol(c1.volumeCuFt)} ${volLabel} net</text>
       <text x="${BOX_X + 56}" y="${y + 60}" fill="#94a3b8" font-size="10" font-family="Segoe UI, sans-serif">${config.p1Dest}</text>`
    : `<text x="${BOX_X + 56}" y="${y + 44}" fill="#e2e8f0" font-size="11" font-family="Segoe UI, sans-serif">${fmtLen(c1.portLengthIn)} ${lenLabel} · Fb ${c1.fbHz} Hz · ${p1Type}</text>
       <text x="${BOX_X + 56}" y="${y + 60}" fill="#94a3b8" font-size="10" font-family="Segoe UI, sans-serif">${config.p1Dest}</text>`

  return `
  <rect x="${BOX_X}" y="${y}" width="${SVG_W - BOX_X - 24}" height="150" fill="#1a2332" stroke="#334155" stroke-width="1" rx="6"/>
  <text x="${BOX_X + 16}" y="${y + 22}" fill="#94a3b8" font-size="11" font-weight="600" font-family="Segoe UI, sans-serif">LEGEND</text>

  <circle cx="${BOX_X + 36}" cy="${y + 48}" r="10" fill="#60a5fa"/>
  <text x="${BOX_X + 36}" y="${y + 52}" text-anchor="middle" fill="#0f172a" font-size="8" font-weight="700" font-family="Segoe UI, sans-serif">${orderType === 'fourth' ? 'S' : 'P1'}</text>
  ${p1Legend}

  <circle cx="${BOX_X + 36}" cy="${y + 88}" r="10" fill="#34d399"/>
  <text x="${BOX_X + 36}" y="${y + 92}" text-anchor="middle" fill="#0f172a" font-size="8" font-weight="700" font-family="Segoe UI, sans-serif">${orderType === 'fourth' ? 'P' : 'P2'}</text>
  <text x="${BOX_X + 56}" y="${y + 84}" fill="#e2e8f0" font-size="11" font-family="Segoe UI, sans-serif">${fmtLen(c2.portLengthIn)} ${lenLabel} · Fb ${c2.fbHz} Hz · ${p2Type}</text>
  <text x="${BOX_X + 56}" y="${y + 100}" fill="#94a3b8" font-size="10" font-family="Segoe UI, sans-serif">${config.p2Dest}</text>

  ${doorTuningLegend(y, doorTuningAnalysis, fmtLen, fmtArea || ((sqIn) => `${sqIn.toFixed(0)} sq in`), lenLabel)}

  <line x1="${BOX_X + 16}" y1="${y + 118}" x2="${SVG_W - 40}" y2="${y + 118}" stroke="#334155" stroke-width="1"/>

  <text x="${BOX_X + 34}" y="${y + 137}" fill="#64748b" font-size="10" font-family="Segoe UI, sans-serif">Rear net: ${fmtVol(c1.volumeCuFt)} ${volLabel} · Front net: ${fmtVol(c2.volumeCuFt)} ${volLabel}${volRatio ? ` · ${volRatio}` : ''}</text>`
}
