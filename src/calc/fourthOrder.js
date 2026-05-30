import { litersToCuFt } from './tsModel.js'

export const FOURTH_ORDER_QTS_TARGET_MIN = 0.29
export const FOURTH_ORDER_QTS_TARGET_MAX = 0.3

export const FOURTH_ORDER_LOW_FCB_GUIDE = [
  'How to get a low sealed resonance (Fcb): Fcb = Fs × √(1 + Vas/Vr). Fcb cannot go below Fs — driver specs matter more than box size alone.',
  'Low Fs — primary lever. Pick subs with the lowest free-air resonance that fit your power and excursion goals.',
  'Low Cms (stiff suspension) — Cms is mechanical compliance (m/N). Lower Cms means a stiffer cone/suspension, lower Vas, and a smaller √(1 + Vas/Vr) multiplier, so Fcb stays closer to Fs in a given Vr.',
  'Low Qts — target ~0.29–0.30 for 4th-order builds. Qts does not change Fcb, but sets Qtc (= Qts × √(1 + Vas/Vr)) for sealed-rear damping and control.',
  'Size Vr — a larger sealed rear pulls Fcb down toward Fs, but with diminishing returns. Match a low-Fs / low-Cms / ~0.29–0.30 Qts driver to enough Vr so Fcb ≤ your front F2 target.'
]

export const FOURTH_ORDER_LOW_FCB_GUIDE_TEXT = FOURTH_ORDER_LOW_FCB_GUIDE.join(' ')

export const FIGHTING_BOX_DISCLAIMER =
  '4th-order bandpass is sub-dependent for low-end extension. Fcb is above your front tuning F2 — the driver is fighting the box. Enlarging Vr only pulls Fcb toward Fs; it never goes below Fs. Box volume alone will not fix this — change the driver (lower Fs, lower Cms/stiffer suspension, Qts ~0.29–0.30) or lower F2. Verify in WinISD/Hornresp before building.'

export function hasFourthOrderTsParams(ts) {
  return Boolean(ts?.Fs && ts?.Vas && ts?.Qts)
}

export function vasToCuFt(vas, unit = 'cuft') {
  if (!vas || vas <= 0) return 0
  return unit === 'liters' ? litersToCuFt(vas) : vas
}

export function calculateSealedChamber(fs, vasCuFt, qts, vrCuFt) {
  if (!fs || !qts || vrCuFt <= 0 || vasCuFt <= 0) {
    return { fcbHz: fs || 0, qtc: qts || 0, complianceRatio: 0, valid: false }
  }

  const complianceRatio = vasCuFt / vrCuFt
  const multiplier = Math.sqrt(1 + complianceRatio)

  return {
    fcbHz: fs * multiplier,
    qtc: qts * multiplier,
    complianceRatio,
    valid: true
  }
}

export function analyzeFourthOrderRatio(vfCuFt, vrCuFt) {
  if (!vrCuFt || vrCuFt <= 0 || !vfCuFt || vfCuFt <= 0) {
    return {
      volumeRatio: 0,
      profile: 'Invalid — enter Vf and Vr net volumes.',
      profileLevel: 'red',
      profileKey: 'invalid'
    }
  }

  const ratio = vfCuFt / vrCuFt

  if (ratio < 1.5) {
    return {
      volumeRatio: ratio,
      profile:
        'Wide bandwidth, flat response. Good for musical daily driving, lower peak SPL.',
      profileLevel: 'green',
      profileKey: 'wide'
    }
  }

  if (ratio < 2.5) {
    return {
      volumeRatio: ratio,
      profile: 'Standard Street Banger. Noticeable peak at tuning, moderate bandwidth.',
      profileLevel: 'green',
      profileKey: 'street'
    }
  }

  return {
    volumeRatio: ratio,
    profile: 'SPL Burp Box. Extremely peaky, high output at tuning, narrow bandwidth.',
    profileLevel: 'amber',
    profileKey: 'burp'
  }
}

export function analyzeFourthOrderCompatibility({
  fs,
  vas,
  vasUnit = 'cuft',
  qts,
  vrCuFt,
  vfCuFt,
  f2Hz,
  driverCount = 1
}) {
  const missingTs = !hasFourthOrderTsParams({ Fs: fs, Vas: vas, Qts: qts })
  const vasSingleCuFt = vasToCuFt(vas, vasUnit)
  const vasTotalCuFt = vasSingleCuFt * Math.max(1, driverCount || 1)
  const sealed = calculateSealedChamber(fs, vasTotalCuFt, qts, vrCuFt)
  const ratio = analyzeFourthOrderRatio(vfCuFt, vrCuFt)

  const fightingBox =
    sealed.valid && f2Hz > 0 && sealed.fcbHz > f2Hz

  const compatible =
    sealed.valid && f2Hz > 0 && !fightingBox

  const qtcNotes = []
  if (sealed.valid && qts) {
    if (qts > FOURTH_ORDER_QTS_TARGET_MAX + 0.02) {
      qtcNotes.push(
        `Qts ${qts.toFixed(3)} is above the typical 4th-order target (~0.29–0.30).`
      )
    } else if (qts < FOURTH_ORDER_QTS_TARGET_MIN - 0.02) {
      qtcNotes.push(
        `Qts ${qts.toFixed(3)} is below the typical 4th-order target (~0.29–0.30) — verify control and power handling.`
      )
    }
  }

  let compatibilityMessage = ''
  let compatibilityLevel = 'neutral'

  if (missingTs) {
    compatibilityMessage = 'Enter Fs, Vas, and Qts for Fcb / compatibility analysis.'
    compatibilityLevel = 'neutral'
  } else if (!sealed.valid) {
    compatibilityMessage = 'Enter sealed rear net volume (Vr) to compute Fcb.'
    compatibilityLevel = 'neutral'
  } else if (fightingBox) {
    compatibilityMessage = `Fcb (${sealed.fcbHz.toFixed(1)} Hz) is above front tuning F2 (${f2Hz.toFixed(1)} Hz) — driver is fighting the sealed rear. Low extension is driver-limited; a larger Vr cannot push Fcb below Fs.`
    compatibilityLevel = 'red'
  } else if (compatible) {
    compatibilityMessage = `Fcb (${sealed.fcbHz.toFixed(1)} Hz) ≤ F2 (${f2Hz.toFixed(1)} Hz) — sealed rear is not blocking front tuning target.`
    compatibilityLevel = 'green'
  } else if (sealed.valid) {
    compatibilityMessage = `Fcb ${sealed.fcbHz.toFixed(1)} Hz · Qtc ${sealed.qtc.toFixed(3)} (enter F2 to compare compatibility).`
    compatibilityLevel = 'green'
  }

  return {
    missingTs,
    fcbHz: sealed.fcbHz,
    qtc: sealed.qtc,
    complianceRatio: sealed.complianceRatio,
    vasTotalCuFt,
    volumeRatio: ratio.volumeRatio,
    profile: ratio.profile,
    profileLevel: ratio.profileLevel,
    profileKey: ratio.profileKey,
    fightingBox,
    compatible,
    compatibilityMessage,
    compatibilityLevel,
    disclaimer: fightingBox ? FIGHTING_BOX_DISCLAIMER : '',
    driverGuide: !missingTs && sealed.valid ? FOURTH_ORDER_LOW_FCB_GUIDE : [],
    qtcNotes
  }
}
