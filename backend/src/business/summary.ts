// RN15: resumen económico del viaje. Evolución de la función pura calculateTripSummary de los TP anteriores.
import { PaymentStatus, PassengerStatus } from "./constants.js";
import { amountPaid } from "./payments.js";
import { round2 } from "./validation.js";

export interface SummaryPassenger {
  status: PassengerStatus;
  paymentStatus: PaymentStatus;
  depositAmount: number | null;
  refundAmount: number;
  retainedAmount: number;
}

export interface TripSummary {
  seatsOccupied: number;
  seatsAvailable: number;
  totalPaid: number;
  totalPending: number;
  totalRetained: number;
  totalRefunded: number;
  isFull: boolean;
  byPaymentStatus: Record<PaymentStatus, number>;
}

export function calculateTripSummary(passengers: SummaryPassenger[] = [], capacity = 0, ticketPrice = 0): TripSummary {
  const safeCapacity = Math.max(0, Number(capacity) || 0);
  const safePrice = Math.max(0, Number(ticketPrice) || 0);
  const list = Array.isArray(passengers) ? passengers : [];

  const summary: TripSummary = {
    seatsOccupied: 0, seatsAvailable: 0, totalPaid: 0, totalPending: 0,
    totalRetained: 0, totalRefunded: 0, isFull: false,
    byPaymentStatus: { Pendiente: 0, Señado: 0, Pagado: 0 }
  };

  for (const p of list) {
    if (p.status === "CANCELADO") {
      summary.totalRetained += p.retainedAmount;
      summary.totalRefunded += p.refundAmount;
      continue;
    }
    const paid = amountPaid(p.paymentStatus, p.depositAmount, safePrice);
    summary.seatsOccupied += 1;
    summary.totalPaid += paid;
    summary.totalPending += safePrice - paid;
    summary.byPaymentStatus[p.paymentStatus] += 1;
  }

  summary.seatsAvailable = Math.max(0, safeCapacity - summary.seatsOccupied);
  summary.isFull = safeCapacity > 0 && summary.seatsOccupied >= safeCapacity;
  summary.totalPaid = round2(summary.totalPaid);
  summary.totalPending = round2(summary.totalPending);
  summary.totalRetained = round2(summary.totalRetained);
  summary.totalRefunded = round2(summary.totalRefunded);
  return summary;
}
