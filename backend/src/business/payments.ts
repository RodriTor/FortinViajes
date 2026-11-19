// RN4 y RN5: estados de pago y montos.
import { AppError } from "../errors.js";
import { DEFAULT_DEPOSIT_RATIO, PAYMENT_STATUSES, PaymentStatus } from "./constants.js";
import { requireObject, round2 } from "./validation.js";

export interface PaymentInput {
  paymentStatus: PaymentStatus;
  depositAmount: number | null;
}

/**
 * Valida el estado de pago y la seña. `fallbackStatus` se usa si el cuerpo no trae estado
 * (alta de pasajero); en la actualización de pago el estado es obligatorio (fallbackStatus = null).
 */
export function parsePayment(data: unknown, ticketPrice: number, fallbackStatus: PaymentStatus | null): PaymentInput {
  const body = requireObject(data);
  const status = body.paymentStatus === undefined ? fallbackStatus : body.paymentStatus;
  if (typeof status !== "string" || !(PAYMENT_STATUSES as readonly string[]).includes(status)) {
    throw new AppError(400, `El estado de pago debe ser: ${PAYMENT_STATUSES.join(", ")}`);
  }
  const paymentStatus = status as PaymentStatus;
  const hasDeposit = body.depositAmount !== undefined && body.depositAmount !== null;

  if (paymentStatus !== "Señado") {
    if (hasDeposit) throw new AppError(400, "La seña solo se informa cuando el estado de pago es Señado");
    return { paymentStatus, depositAmount: null };
  }

  const deposit = hasDeposit ? body.depositAmount : round2(ticketPrice * DEFAULT_DEPOSIT_RATIO);
  if (typeof deposit !== "number" || !Number.isFinite(deposit) || deposit <= 0 || deposit >= ticketPrice) {
    throw new AppError(400, "La seña debe ser un número mayor a 0 y menor al precio del pasaje (si abonó todo, usá Pagado)");
  }
  return { paymentStatus, depositAmount: round2(deposit) };
}

/** Monto abonado según estado: Pendiente = 0, Señado = seña, Pagado = precio completo. */
export function amountPaid(paymentStatus: PaymentStatus, depositAmount: number | null, ticketPrice: number): number {
  if (paymentStatus === "Pagado") return ticketPrice;
  if (paymentStatus === "Señado") return round2(depositAmount ?? ticketPrice * DEFAULT_DEPOSIT_RATIO);
  return 0;
}
