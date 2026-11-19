import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { argentinaDayKey, hoursUntil, parseDepartureDateTime } from "../../src/business/time.js";

describe("RN14 — zona horaria argentina", () => {
  test("una fecha sin zona se interpreta como horario argentino (UTC-3)", () => {
    assert.equal(parseDepartureDateTime("2026-12-01T18:00").toISOString(), "2026-12-01T21:00:00.000Z");
    assert.equal(parseDepartureDateTime("2026-12-01T18:00:00").toISOString(), "2026-12-01T21:00:00.000Z");
  });
  test("una fecha con zona explícita se respeta", () => {
    assert.equal(parseDepartureDateTime("2026-12-01T21:00:00Z").toISOString(), "2026-12-01T21:00:00.000Z");
    assert.equal(parseDepartureDateTime("2026-12-01T18:00:00-03:00").toISOString(), "2026-12-01T21:00:00.000Z");
  });
  test("rechaza fechas imposibles, vacías o de otro tipo (400)", () => {
    for (const bad of ["2026-02-31T10:00", "2026-13-01T10:00", "2026-12-01T25:00", "2026-12-01T10:60", "hola", "", undefined, null, 123]) {
      assert.throws(() => parseDepartureDateTime(bad), (e: any) => e.status === 400, String(bad));
    }
  });
  test("el día argentino cambia a las 00:00 de UTC-3, no de UTC", () => {
    assert.equal(argentinaDayKey(new Date("2026-12-02T02:59:00Z")), "2026-12-01"); // 23:59 en Argentina
    assert.equal(argentinaDayKey(new Date("2026-12-02T03:00:00Z")), "2026-12-02"); // 00:00 en Argentina
  });
  test("hoursUntil devuelve horas con decimales y negativo si ya pasó", () => {
    const now = new Date("2026-12-01T12:00:00Z");
    assert.equal(hoursUntil(new Date("2026-12-01T13:30:00Z"), now), 1.5);
    assert.equal(hoursUntil(new Date("2026-12-01T11:00:00Z"), now), -1);
  });
});

describe("RN11 — rango del día argentino", () => {
  test("cubre de 00:00 a 24:00 en UTC-3", async () => {
    const { argentinaDayRange } = await import("../../src/business/time.js");
    const r = argentinaDayRange(new Date("2026-12-01T21:00:00Z"));
    assert.equal(r.from.toISOString(), "2026-12-01T03:00:00.000Z");
    assert.equal(r.to.toISOString(), "2026-12-02T03:00:00.000Z");
  });
});
