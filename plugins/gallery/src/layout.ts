/** CSS-only justified rows: each item grows in proportion to its aspect ratio. */
export const ROW_HEIGHT = 220
export const ROW_HEIGHT_MOBILE = 140

export const aspect = (w: number, h: number) => Math.round((w / h) * 10000) / 10000

/** flex-grow and flex-basis (px) of an item for a target row height. */
export function itemFlex(w: number, h: number, rowHeight = ROW_HEIGHT) {
  const ar = aspect(w, h)
  return { grow: Math.round(ar * 100), basis: Math.round(ar * rowHeight) }
}

/** The `sizes` attribute: the width an item has at the target row heights. */
export function sizesAttr(w: number, h: number) {
  const ar = w / h
  return `(max-width: 640px) ${Math.round(ar * ROW_HEIGHT_MOBILE)}px, ${Math.round(ar * ROW_HEIGHT)}px`
}
