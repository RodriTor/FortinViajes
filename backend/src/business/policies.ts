// RN8 (cierre de inscripción) y RN9 (cancelación y reintegro).
import { FULL_REFUND_HOURS, MIN_CANCEL_HOURS, REGISTRATION_CLOSE_HOURS } from "./constants.js";
import { hoursUntil } from "./time.js";

/** RN8: el hincha puede anotarse hasta 3 h antes (inclusive); el organizador hasta la salida. */
export function isRegistrationOpen(departureAt: Date, now: Date, isAdmin: boolean): boolean {
  const hours = hoursUntil(departureAt, now);
  return isAdmin ? hours > 0 : hours >= REGISTRATION_CLOSE_HOURS;
}

export type CancellationDecision =
  | { allowed: true; refund: number; retained: number }
  | { allowed: false; reason: string };

/** RN9: decide si se puede cancelar y qué pasa con lo abonado. */
export function cancellationPolicy(params: { departureAt: Date; now: Date; isAdmin: boolean; amountPaid: number }): CancellationDecision {
  const { departureAt, now, isAdmin, amountPaid } = params;
  if (isAdmin) return { allowed: true, refund: amountPaid, retained: 0 };
  const hours = hoursUntil(departureAt, now);
  if (hours < MIN_CANCEL_HOURS) {
    return {
      allowed: false,
      reason: `Faltan menos de ${MIN_CANCEL_HOURS} horas para la salida: ya no podés cancelar desde la app, contactá al organizador`
    };
  }
  if (hours >= FULL_REFUND_HOURS) return { allowed: true, refund: amountPaid, retained: 0 };
  return { allowed: true, refund: 0, retained: amountPaid };
}
