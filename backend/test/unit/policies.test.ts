import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { cancellationPolicy, isRegistrationOpen } from "../../src/business/policies.js";

const departure = new Date("2026-12-01T21:00:00Z");
const before = (hours: number, minutes = 0) => new Date(departure.getTime() - (hours * 60 + minutes) * 60000);

describe("RN8 — cierre de inscripción", () => {
  test("el hincha puede anotarse hasta 3 h antes, inclusive", () => {
    assert.equal(isRegistrationOpen(departure, before(3), false), true);
    assert.equal(isRegistrationOpen(departure, before(2, 59), false), false);
    assert.equal(isRegistrationOpen(departure, before(48), false), true);
  });
  test("el organizador puede anotar hasta la salida", () => {
    assert.equal(isRegistrationOpen(departure, before(0, 1), true), true);
    assert.equal(isRegistrationOpen(departure, before(1), true), true);
    assert.equal(isRegistrationOpen(departure, before(0), true), false);
    assert.equal(isRegistrationOpen(departure, before(-1), true), false);
  });
});

describe("RN9 — cancelación y reintegro", () => {
  test("24 h exactas: reintegro total", () => {
    assert.deepEqual(cancellationPolicy({ departureAt: departure, now: before(24), isAdmin: false, amountPaid: 5000 }), { allowed: true, refund: 5000, retained: 0 });
  });
  test("23 h 59 min: se retiene lo abonado", () => {
    assert.deepEqual(cancellationPolicy({ departureAt: departure, now: before(23, 59), isAdmin: false, amountPaid: 5000 }), { allowed: true, refund: 0, retained: 5000 });
  });
  test("6 h exactas: se puede cancelar (con retención)", () => {
    assert.deepEqual(cancellationPolicy({ departureAt: departure, now: before(6), isAdmin: false, amountPaid: 5000 }), { allowed: true, refund: 0, retained: 5000 });
  });
  test("5 h 59 min y salida pasada: no se puede cancelar", () => {
    for (const now of [before(5, 59), before(0, 1), before(-2)]) {
      const r = cancellationPolicy({ departureAt: departure, now, isAdmin: false, amountPaid: 5000 });
      assert.equal(r.allowed, false);
    }
  });
  test("si no abonó nada, no hay reintegro ni retención", () => {
    assert.deepEqual(cancellationPolicy({ departureAt: departure, now: before(10), isAdmin: false, amountPaid: 0 }), { allowed: true, refund: 0, retained: 0 });
  });
  test("el organizador siempre puede cancelar con reintegro total", () => {
    assert.deepEqual(cancellationPolicy({ departureAt: departure, now: before(1), isAdmin: true, amountPaid: 10000 }), { allowed: true, refund: 10000, retained: 0 });
  });
});
