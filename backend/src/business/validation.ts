import { AppError } from "../errors.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// RN16: los identificadores son UUID. Un id mal formado se trata como "no existe".
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function requireObject(data: unknown): Record<string, unknown> {
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    throw new AppError(400, "El cuerpo de la solicitud debe ser un objeto JSON");
  }
  return data as Record<string, unknown>;
}

export function trimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
