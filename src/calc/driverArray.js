const STANDARD_SD = {
  8: 32.0,
  10: 54.0,
  12: 78.0,
  15: 125.0,
  18: 185.0,
  21: 250.0,
  24: 345.0
}

export function estimateSd(diameterIn) {
  if (!diameterIn || diameterIn <= 0) return 0

  if (STANDARD_SD[diameterIn]) {
    return STANDARD_SD[diameterIn]
  }

  const effectiveRadius = (diameterIn / 2) * 0.8
  return Math.PI * effectiveRadius ** 2
}

export function calculateDriverArray(sizeIn, count) {
  const singleSdSqIn = estimateSd(sizeIn)
  const driverCount = Math.max(1, count || 1)
  const totalSdSqIn = singleSdSqIn * driverCount

  return {
    sizeIn,
    count: driverCount,
    singleSdSqIn,
    totalSdSqIn,
    isStandardSize: Boolean(STANDARD_SD[sizeIn])
  }
}

export function getPortRatioWarning(portAreaSqIn, totalSdSqIn) {
  if (!portAreaSqIn || !totalSdSqIn || totalSdSqIn <= 0) {
    return null
  }

  const ratio = portAreaSqIn / totalSdSqIn
  const ratioText = `${ratio.toFixed(2)}:1`

  if (ratio < 0.5) {
    return {
      ratio,
      level: 'red',
      message: `${ratioText} — severe port compression likely`
    }
  }
  if (ratio < 0.75) {
    return {
      ratio,
      level: 'amber',
      message: `${ratioText} — acceptable for standard setups, may compress under extreme load`
    }
  }
  return {
    ratio,
    level: 'green',
    message: `${ratioText} — excellent airflow support`
  }
}

export function getPortRatioWarnings(portArea1, portArea2, totalSdSqIn) {
  return {
    port1: getPortRatioWarning(portArea1, totalSdSqIn),
    port2: getPortRatioWarning(portArea2, totalSdSqIn)
  }
}
