/** 73.418 → "1:13.42" */
export function formatRaceTime(seconds: number): string {
  // Round first, so 59.996 becomes "1:00.00" rather than "0:60.00".
  const total = Math.round(seconds * 100) / 100
  const minutes = Math.floor(total / 60)
  const rest = (total - minutes * 60).toFixed(2).padStart(5, '0')
  return `${minutes}:${rest}`
}

/** Gap behind the winner: 0.314 → "+0.31" */
export function formatGap(seconds: number): string {
  return `+${seconds.toFixed(2)}`
}

/** Readable text colour on a silk: board ink on light silks, rail white on dark ones. */
export function contrastColor(hex: string): string {
  const n = parseInt(hex.slice(1), 16)
  const luminance = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255
  return luminance > 0.6 ? '#14211A' : '#F7F7F2'
}
