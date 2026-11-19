import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { assertEditableForPassengers, assertManualTransition, parseTripInput, statusAfterCapacityChange } from "../../src/business/tripRules.js";

const now = new Date("2026-11-18T12:00:00Z");
const valid = { rival: "San Lorenzo", stadium: "Estadio José Amalfitani", departureDateTime: "2026-12-01T18:00:00", meetingPoint: "Sede Liniers", ticketPrice: 10000, capacity: 2 };
const status = (e: any) => e.status === 400;

describe("RN7 — creación de viaje", () => {
  test("acepta un viaje válido y normaliza los textos", () => {
    const t = parseTripInput({ ...valid, rival: "  San Lorenzo  " }, now);
    assert.equal(t.rival, "San Lorenzo");
    assert.equal(t.departureAt.toISOString(), "2026-12-01T21:00:00.000Z");
    assert.equal(t.capacity, 2);
  });
  test("el punto de encuentro es opcional", () => {
    assert.equal(parseTripInput({ ...valid, meetingPoint: undefined }, now).meetingPoint, "");
  });
  test("el precio puede ser 0", () => {
    assert.equal(parseTripInput({ ...valid, ticketPrice: 0 }, now).ticketPrice, 0);
  });
  test("exige rival, estadio y fecha (400)", () => {
    assert.throws(() => parseTripInput({ ...valid, rival: " " }, now), status);
    assert.throws(() => parseTripInput({ ...valid, stadium: "" }, now), status);
    assert.throws(() => parseTripInput({ ...valid, departureDateTime: undefined }, now), status);
  });
  test("rechaza una salida en el pasado (400)", () => {
    assert.throws(() => parseTripInput({ ...valid, departureDateTime: "2026-11-01T18:00:00" }, now), status);
  });
  test("capacidad: entero entre 1 y 100 (400)", () => {
    for (const capacity of [0, -1, 101, 1.5, "10", undefined]) {
      assert.throws(() => parseTripInput({ ...valid, capacity }, now), status, String(capacity));
    }
    assert.equal(parseTripInput({ ...valid, capacity: 100 }, now).capacity, 100);
  });
  test("precio: número no negativo (400)", () => {
    for (const ticketPrice of [-1, "100", undefined, NaN, Infinity]) {
      assert.throws(() => parseTripInput({ ...valid, ticketPrice }, now), status, String(ticketPrice));
    }
  });
  test("el cuerpo debe ser un objeto (400)", () => {
    assert.throws(() => parseTripInput(null, now), status);
    assert.throws(() => parseTripInput([], now), status);
  });
});

describe("RN6 — estados del viaje", () => {
  test("Abierto pasa a Completo al llenarse y vuelve a Abierto al liberarse", () => {
    assert.equal(statusAfterCapacityChange("Abierto", 2, 2), "Completo");
    assert.equal(statusAfterCapacityChange("Abierto", 1, 2), "Abierto");
    assert.equal(statusAfterCapacityChange("Completo", 1, 2), "Abierto");
    assert.equal(statusAfterCapacityChange("Completo", 2, 2), "Completo");
  });
  test("los estados En Viaje, Finalizado y Cancelado no cambian por cupo", () => {
    for (const s of ["En Viaje", "Finalizado", "Cancelado"] as const) assert.equal(statusAfterCapacityChange(s, 0, 2), s);
  });
  test("transiciones permitidas", () => {
    assert.equal(assertManualTransition("Abierto", "En Viaje", 1), "En Viaje");
    assert.equal(assertManualTransition("Completo", "En Viaje", 2), "En Viaje");
    assert.equal(assertManualTransition("En Viaje", "Finalizado", 2), "Finalizado");
    assert.equal(assertManualTransition("Abierto", "Cancelado", 0), "Cancelado");
    assert.equal(assertManualTransition("Completo", "Cancelado", 2), "Cancelado");
  });
  test("transiciones prohibidas (409)", () => {
    const conflict = (e: any) => e.status === 409;
    assert.throws(() => assertManualTransition("Abierto", "Finalizado", 1), conflict);
    assert.throws(() => assertManualTransition("En Viaje", "Cancelado", 1), conflict);
    assert.throws(() => assertManualTransition("Finalizado", "En Viaje", 1), conflict);
    assert.throws(() => assertManualTransition("Cancelado", "En Viaje", 1), conflict);
  });
  test("no se puede iniciar un viaje sin pasajeros (409)", () => {
    assert.throws(() => assertManualTransition("Abierto", "En Viaje", 0), (e: any) => e.status === 409);
  });
  test("Abierto y Completo no se fijan a mano, y un estado desconocido es 400", () => {
    assert.throws(() => assertManualTransition("Completo", "Abierto", 1), status);
    assert.throws(() => assertManualTransition("Abierto", "Completo", 1), status);
    assert.throws(() => assertManualTransition("Abierto", "Volando", 1), status);
    assert.throws(() => assertManualTransition("Abierto", undefined, 1), status);
  });
  test("solo Abierto y Completo admiten cambios de pasajeros", () => {
    assert.doesNotThrow(() => assertEditableForPassengers("Abierto"));
    assert.doesNotThrow(() => assertEditableForPassengers("Completo"));
    for (const s of ["En Viaje", "Finalizado", "Cancelado"] as const) {
      assert.throws(() => assertEditableForPassengers(s), (e: any) => e.status === 409);
    }
  });
});
