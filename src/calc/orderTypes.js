export const ORDER_TYPES = {
  PARALLEL: 'parallel',
  SERIES: 'series',
  PORTED: 'ported',
  FOURTH: 'fourth'
}

export function isSixthOrder(orderType) {
  return orderType === ORDER_TYPES.PARALLEL || orderType === ORDER_TYPES.SERIES
}

export function isPorted(orderType) {
  return orderType === ORDER_TYPES.PORTED
}

export function isFourth(orderType) {
  return orderType === ORDER_TYPES.FOURTH
}

export function showChamber2(orderType) {
  return !isPorted(orderType)
}

export function chamber1Sealed(orderType) {
  return isFourth(orderType)
}

export function chamber1HasPort(orderType) {
  return !isFourth(orderType)
}

export function orderTypeLabel(orderType) {
  switch (orderType) {
    case ORDER_TYPES.PARALLEL:
      return 'Parallel'
    case ORDER_TYPES.SERIES:
      return 'Series'
    case ORDER_TYPES.PORTED:
      return 'Ported'
    case ORDER_TYPES.FOURTH:
      return '4th-Order Bandpass'
    default:
      return 'Series'
  }
}

export function orderTypeSubtitle(orderType) {
  switch (orderType) {
    case ORDER_TYPES.PARALLEL:
      return 'Parallel 6th Order Bandpass — Low Frequency Wall Design'
    case ORDER_TYPES.SERIES:
      return 'Series 6th Order Bandpass — Low Frequency Wall Design'
    case ORDER_TYPES.PORTED:
      return 'Ported Enclosure — Single Chamber Vented to Cabin'
    case ORDER_TYPES.FOURTH:
      return '4th Order Bandpass — Sealed Rear, Ported Front'
    default:
      return 'Series 6th Order Bandpass — Low Frequency Wall Design'
  }
}

export function primaryTuningFb(orderType, fb1, fb2) {
  if (isPorted(orderType)) return fb1
  if (isFourth(orderType)) return fb2
  return fb2
}
