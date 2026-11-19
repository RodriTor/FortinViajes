// RN14: las fechas se guardan en UTC; las reglas de día/hora usan horario argentino (UTC-3, sin horario de verano).
import { AppError } from "../errors.js";

export const HOUR_MS = 60 * 60 * 1000;
const AR_OFFSET_MS = -3 * HOUR_MS;

const DATE_TIME_RE = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(Z|[+-]\d{2}:\d{2})?$/;
const INVALID_DATE_MSG = "La fecha y hora de salida es obligatoria y debe ser válida";

/**
 * Interpreta la fecha de salida. Si no trae zona horaria ("2026-12-01T18:00"), se asume horario argentino.
 * Rechaza fechas imposibles (ej. 31 de febrero), que Date.parse aceptaría "corriéndolas" al mes siguiente.
 */
export function parseDepartureDateTime(value: unknown): Date {
  if (typeof value !== "string") throw new AppError(400, INVALID_DATE_MSG);
  const m = DATE_TIME_RE.exec(value.trim());
  if (!m) throw new AppError(400, INVALID_DATE_MSG);
  const [, y, mo, d, h, mi, s = "00", zone] = m;
  const year = Number(y), month = Number(mo), day = Number(d), hour = Number(h), minute = Number(mi), second = Number(s);
  const calendar = new Date(Date.UTC(year, month - 1, day));
  const validCalendar = calendar.getUTCFullYear() === year && calendar.getUTCMonth() === month - 1 && calendar.getUTCDate() === day;
  if (!validCalendar || hour > 23 || minute > 59 || second > 59) throw new AppError(400, INVALID_DATE_MSG);
  const iso = `${y}-${mo}-${d}T${h}:${mi}:${String(second).padStart(2, "0")}${zone ?? "-03:00"}`;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) throw new AppError(400, INVALID_DATE_MSG);
  return date;
}

/** Día calendario argentino (YYYY-MM-DD) de un instante. Sirve para RN11. */
export function argentinaDayKey(date: Date): string {
  return new Date(date.getTime() + AR_OFFSET_MS).toISOString().slice(0, 10);
}

/** Horas (con decimales) que faltan desde `now` hasta `target`. Negativo si ya pasó. */
export function hoursUntil(target: Date, now: Date): number {
  return (target.getTime() - now.getTime()) / HOUR_MS;
}

/** Rango UTC [from, to) que cubre el día calendario argentino del instante dado (RN11). */
export function argentinaDayRange(date: Date): { from: Date; to: Date } {
  const from = new Date(`${argentinaDayKey(date)}T00:00:00-03:00`);
  return { from, to: new Date(from.getTime() + 24 * HOUR_MS) };
}
