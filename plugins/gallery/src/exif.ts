import type { ExifInfo } from './types'

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 100) / 100 : undefined)

/** Allow-list: only these fields leave the file. GPS and everything else is dropped. */
export function pickExif(raw: Record<string, any> | undefined | null): ExifInfo | undefined {
  if (!raw) return undefined
  const make = typeof raw.Make === 'string' ? raw.Make.trim() : ''
  const model = typeof raw.Model === 'string' ? raw.Model.trim() : ''
  const camera = model.toLowerCase().startsWith(make.toLowerCase()) ? model : `${make} ${model}`.trim()
  const t = typeof raw.ExposureTime === 'number' && raw.ExposureTime > 0 ? raw.ExposureTime : undefined
  const out: ExifInfo = {
    camera: camera || undefined,
    lens: typeof raw.LensModel === 'string' && raw.LensModel.trim() ? raw.LensModel.trim() : undefined,
    focal: num(raw.FocalLength),
    aperture: num(raw.FNumber),
    iso: num(raw.ISO),
    exposure: t ? (t >= 1 ? `${t}s` : `1/${Math.round(1 / t)}`) : undefined
  }
  const entries = Object.entries(out).filter(([, v]) => v !== undefined)
  return entries.length ? (Object.fromEntries(entries) as ExifInfo) : undefined
}
