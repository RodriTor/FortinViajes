// Reglas de viajes: RN6 (estados) y RN7 (creación).
import { AppError } from "../errors.js";
import { MAX_CAPACITY, MAX_PRICE, TripStatus } from "./constants.js";
import { parseDepartureDateTime } from "./time.js";
import { requireObject, round2, trimmedString } from "./validation.js";

export interface TripInput {
  rival: string;
  stadium: string;
  departureAt: Date;
  meetingPoint: string;
  ticketPrice: number;
  capacity: number;
}

/** RN7: valida y normaliza los datos de un viaje nuevo. */
export function parseTripInput(data: unknown, now: Date = new Date()): TripInput {
  const body = requireObject(data);
  const rival = trimmedString(body.rival);
  const stadium = trimmedString(body.stadium);
  const meetingPoint = body.meetingPoint === undefined || body.meetingPoint === null ? "" : trimmedString(body.meetingPoint);

  if (!rival) throw new AppError(400, "El rival es obligatorio");
  if (rival.length > 120) throw new AppError(400, "El rival no puede superar los 120 caracteres");
  if (!stadium) throw new AppError(400, "El estadio es obligatorio");
  if (stadium.length > 160) throw new AppError(400, "El estadio no puede superar los 160 caracteres");
  if (meetingPoint.length > 160) throw new AppError(400, "El punto de encuentro no puede superar los 160 caracteres");

  const departureAt = parseDepartureDateTime(body.departureDateTime);
  if (departureAt.getTime() <= now.getTime()) {
    throw new AppError(400, "La fecha y hora de salida debe ser futura");
  }

  const { capacity, ticketPrice } = body;
  if (typeof capacity !== "number" || !Number.isInteger(capacity) || capacity < 1 || capacity > MAX_CAPACITY) {
    throw new AppError(400, `La capacidad debe ser un número entero entre 1 y ${MAX_CAPACITY}`);
  }
  if (typeof ticketPrice !== "number" || !Number.isFinite(ticketPrice) || ticketPrice < 0 || ticketPrice > MAX_PRICE) {
    throw new AppError(400, "El precio del pasaje debe ser un número mayor o igual a 0");
  }

  return { rival, stadium, departureAt, meetingPoint, ticketPrice: round2(ticketPrice), capacity };
}

/** Estados en los que se pueden agregar o cancelar pasajeros. */
export function isEditableStatus(status: TripStatus): boolean {
  return status === "Abierto" || status === "Completo";
}

/** RN6: mensaje claro de por qué un viaje no admite cambios de pasajeros. */
export function assertEditableForPassengers(status: TripStatus): void {
  if (!isEditableStatus(status)) {
    throw new AppError(409, `No se pueden modificar pasajeros de un viaje ${status}`);
  }
}

const MANUAL_TARGETS: TripStatus[] = ["En Viaje", "Finalizado", "Cancelado"];
const ALLOWED_TRANSITIONS: Record<TripStatus, TripStatus[]> = {
  Abierto: ["En Viaje", "Cancelado"],
  Completo: ["En Viaje", "Cancelado"],
  "En Viaje": ["Finalizado"],
  Finalizado: [],
  Cancelado: []
};

/** RN6: valida un cambio manual de estado pedido por el organizador. */
export function assertManualTransition(from: TripStatus, to: unknown, activePassengers: number): TripStatus {
  if (typeof to !== "string" || !(["Abierto", "Completo", ...MANUAL_TARGETS] as string[]).includes(to)) {
    throw new AppError(400, `El estado debe ser uno de: ${MANUAL_TARGETS.join(", ")}`);
  }
  if (to === "Abierto" || to === "Completo") {
    throw new AppError(400, "Los estados Abierto y Completo se calculan solos según el cupo");
  }
  const target = to as TripStatus;
  if (!ALLOWED_TRANSITIONS[from].includes(target)) {
    throw new AppError(409, `No se puede pasar un viaje ${from} a ${target}`);
  }
  if (target === "En Viaje" && activePassengers < 1) {
    throw new AppError(409, "No se puede iniciar un viaje sin pasajeros anotados");
  }
  return target;
}

/** RN6: Abierto ↔ Completo automático según cupo. */
export function statusAfterCapacityChange(current: TripStatus, activePassengers: number, capacity: number): TripStatus {
  if (current === "Abierto" && activePassengers >= capacity) return "Completo";
  if (current === "Completo" && activePassengers < capacity) return "Abierto";
  return current;
}
