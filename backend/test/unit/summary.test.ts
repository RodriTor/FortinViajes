import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { calculateTripSummary, SummaryPassenger } from "../../src/business/summary.js";

const p = (over: Partial<SummaryPassenger> = {}): SummaryPassenger => ({ status: "ACTIVO", paymentStatus: "Pendiente", depositAmount: null, refundAmount: 0, retainedAmount: 0, ...over });

describe("RN15 — resumen económico", () => {
  test("viaje vacío", () => {
    assert.deepEqual(calculateTripSummary([], 10, 10000), {
      seatsOccupied: 0, seatsAvailable: 10, totalPaid: 0, totalPending: 0, totalRetained: 0, totalRefunded: 0, isFull: false,
      byPaymentStatus: { Pendiente: 0, Señado: 0, Pagado: 0 }
    });
  });
  test("mezcla de pagos: Pendiente, Señado (con y sin monto) y Pagado", () => {
    const s = calculateTripSummary([p(), p({ paymentStatus: "Señado", depositAmount: 3000 }), p({ paymentStatus: "Señado" }), p({ paymentStatus: "Pagado" })], 10, 10000);
    assert.equal(s.seatsOccupied, 4);
    assert.equal(s.seatsAvailable, 6);
    assert.equal(s.totalPaid, 18000); // 0 + 3000 + 5000 + 10000
    assert.equal(s.totalPending, 22000); // 40000 - 18000
    assert.deepEqual(s.byPaymentStatus, { Pendiente: 1, Señado: 2, Pagado: 1 });
  });
  test("los cancelados no ocupan cupo ni suman recaudado, pero sí retenido/reintegrado", () => {
    const s = calculateTripSummary([p({ paymentStatus: "Pagado" }), p({ status: "CANCELADO", paymentStatus: "Pagado", retainedAmount: 10000 }), p({ status: "CANCELADO", paymentStatus: "Señado", refundAmount: 5000 })], 2, 10000);
    assert.equal(s.seatsOccupied, 1);
    assert.equal(s.totalPaid, 10000);
    assert.equal(s.totalRetained, 10000);
    assert.equal(s.totalRefunded, 5000);
    assert.equal(s.isFull, false);
  });
  test("isFull cuando se ocupa toda la capacidad", () => {
    assert.equal(calculateTripSummary([p(), p()], 2, 100).isFull, true);
  });
  test("entradas inválidas no rompen la función", () => {
    assert.equal(calculateTripSummary(undefined, -5, NaN as any).seatsAvailable, 0);
    assert.equal(calculateTripSummary("x" as any, 3, 10).seatsAvailable, 3);
  });
});
