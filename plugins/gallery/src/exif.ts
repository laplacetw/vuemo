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

/**
 * `DateTimeOriginal` ("2025:04:12 17:03:00", unrevived) as an ISO string. The EXIF date is a wall-clock time. With an
 * `OffsetTimeOriginal` ("+09:00") it is an exact instant; without one the wall-clock time is stored as if it were UTC,
 * so the result does not depend on the time zone of the machine that runs the CLI.
 */
export function takenAtFrom(raw: Record<string, any> | undefined | null): string | undefined {
  const v = raw?.DateTimeOriginal
  let d: Date | undefined
  if (typeof v === 'string') {
    const m = /^(\d{4})[:\-](\d{2})[:\-](\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(v.trim())
    if (!m) return undefined
    const [y, mo, da, h, mi, s] = m.slice(1).map(Number)
    d = new Date(Date.UTC(y, mo - 1, da, h, mi, s))
    const off = typeof raw?.OffsetTimeOriginal === 'string' ? /^([+-])(\d{2}):?(\d{2})$/.exec(raw.OffsetTimeOriginal.trim()) : null
    if (off) d = new Date(+d - (off[1] === '-' ? -1 : 1) * (Number(off[2]) * 60 + Number(off[3])) * 60000)
  } else if (v instanceof Date) {
    // a revived date is built in local time: read its wall-clock fields back
    d = new Date(Date.UTC(v.getFullYear(), v.getMonth(), v.getDate(), v.getHours(), v.getMinutes(), v.getSeconds()))
  }
  return d && !Number.isNaN(+d) && d.getUTCFullYear() > 1 ? d.toISOString() : undefined
}
