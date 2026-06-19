import { DEFAULT_BRACING_PERCENT } from './volumeAccounting.js'
import { isPorted } from './orderTypes.js'

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

/** Built gross volumes per chamber (no B-pillar fit checks). */
export function estimateGrossVolumes(
  orderType,
  netVol1,
  portVol1,
  netVol2,
  portVol2,
  driverDisplacementCuFt,
  bracingPercent = DEFAULT_BRACING_PERCENT
) {
  const ported = isPorted(orderType)
  const driverShare1 = ported ? driverDisplacementCuFt : driverDisplacementCuFt / 2
  const driverShare2 = ported ? 0 : driverDisplacementCuFt / 2

  const gross1 = estimateGrossVolumeCuFt(netVol1, portVol1, driverShare1, bracingPercent)
  const gross2 = ported
    ? 0
    : estimateGrossVolumeCuFt(netVol2, portVol2, driverShare2, bracingPercent)

  return {
    grossVolume1CuFt: gross1,
    grossVolume2CuFt: gross2,
    totalGrossCuFt: ported ? gross1 : gross1 + gross2,
    warnings: []
  }
}

export function computeEffectiveCabinCuFt(vehicleInteriorCuFt, totalBoxGrossCuFt, ampRackCuFt) {
  const vehicle = vehicleInteriorCuFt || 0
  const box = totalBoxGrossCuFt || 0
  const amp = ampRackCuFt || 0
  return Math.max(0, vehicle - box - amp)
}
