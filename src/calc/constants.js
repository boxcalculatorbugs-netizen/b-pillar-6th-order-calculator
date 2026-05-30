export const SPEED_OF_SOUND_IN_SEC = 13504 // inches per second
export const CU_FT_TO_CU_IN = 1728
export const END_CORRECTION_FLANGED = 0.732 // flush with wall / external port
export const END_CORRECTION_FREE = 0.614 // free-standing internal port (series rear)
export const END_CORRECTION_FACTOR = END_CORRECTION_FLANGED

/** Rectangular slot port — k × equivalent radius by shared boundary count (0–3). */
export const END_CORRECTION_K_BY_COMMON_WALLS = {
  0: 1.346,
  1: 1.582,
  2: 1.8,
  3: 2.05
}
export const CABIN_BOOST_DB_PER_OCTAVE = 12
export const CABIN_SLOPE_CLOSED = 12
export const CABIN_SLOPE_OPEN = 3
export const CABIN_LEAK_SLOPE_DEGRADATION_PER_SQIN = 0.2
export const DEFAULT_CABIN_LEAKAGE_AREA_SQIN = 15
export const PORT_VELOCITY_AMBER_MPS = 25
export const PORT_VELOCITY_RED_MPS = 35
export const MPS_TO_INPS = 39.3701
export const SQ_IN_TO_SQ_CM = 6.4516
export const CU_FT_TO_LITERS = 28.3168
export const IN_TO_MM = 25.4

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

export function round(value, decimals = 2) {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}
