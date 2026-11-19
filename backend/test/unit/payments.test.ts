import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { amountPaid, parsePayment } from "../../src/business/payments.js";

const bad = (e: any) => e.status === 400;

describe("RN4 — estados de pago y seña", () => {
  test("Pendiente por defecto al anotar", () => {
    assert.deepEqual(parsePayment({}, 10000, "Pendiente"), { paymentStatus: "Pendiente", depositAmount: null });
  });
  test("Señado sin monto toma el 50% del precio", () => {
    assert.deepEqual(parsePayment({ paymentStatus: "Señado" }, 10000, "Pendiente"), { paymentStatus: "Señado", depositAmount: 5000 });
  });
  test("Señado con monto válido", () => {
    assert.equal(parsePayment({ paymentStatus: "Señado", depositAmount: 3000 }, 10000, null).depositAmount, 3000);
  });
  test("la seña debe ser mayor a 0 y menor al precio (400)", () => {
    for (const depositAmount of [0, -5, 10000, 10001, "500", NaN]) {
      assert.throws(() => parsePayment({ paymentStatus: "Señado", depositAmount }, 10000, null), bad, String(depositAmount));
    }
  });
  test("con precio 0 no existe la seña (400)", () => {
    assert.throws(() => parsePayment({ paymentStatus: "Señado" }, 0, null), bad);
  });
  test("la seña solo se informa con estado Señado (400)", () => {
    assert.throws(() => parsePayment({ paymentStatus: "Pagado", depositAmount: 500 }, 10000, null), bad);
    assert.throws(() => parsePayment({ paymentStatus: "Pendiente", depositAmount: 500 }, 10000, null), bad);
  });
  test("estado de pago inválido o ausente al actualizar (400)", () => {
    assert.throws(() => parsePayment({ paymentStatus: "Nada" }, 10000, null), bad);
    assert.throws(() => parsePayment({}, 10000, null), bad);
  });
  test("monto abonado según estado", () => {
    assert.equal(amountPaid("Pendiente", null, 10000), 0);
    assert.equal(amountPaid("Pagado", null, 10000), 10000);
    assert.equal(amountPaid("Señado", 3000, 10000), 3000);
    assert.equal(amountPaid("Señado", null, 10000), 5000);
  });
});
