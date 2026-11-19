import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { parsePassengerFields } from "../../src/business/passengerRules.js";

const bad = (e: any) => e.status === 400;

describe("RN2 — datos del pasajero", () => {
  test("acepta datos mínimos y normaliza", () => {
    assert.deepEqual(parsePassengerFields({ name: "  Lucas ", dni: "30111222" }), { name: "Lucas", dni: "30111222", phone: "", memberNumber: "" });
  });
  test("acepta DNI de 7 y de 8 dígitos, también como número", () => {
    assert.equal(parsePassengerFields({ name: "Ana", dni: "9123456" }).dni, "9123456");
    assert.equal(parsePassengerFields({ name: "Ana", dni: 30111222 }).dni, "30111222");
  });
  test("rechaza DNI con letras, de 6 o de 9 dígitos, vacío o ausente", () => {
    for (const dni of ["abc", "123456", "123456789", "30.111.222", "", undefined, null]) {
      assert.throws(() => parsePassengerFields({ name: "Ana", dni }), bad, String(dni));
    }
  });
  test("rechaza nombre vacío, de una letra o de más de 100", () => {
    for (const name of ["", "  ", "A", "x".repeat(101), undefined, 5]) {
      assert.throws(() => parsePassengerFields({ name, dni: "30111222" }), bad, String(name));
    }
  });
  test("teléfono opcional con formato válido", () => {
    assert.equal(parsePassengerFields({ name: "Ana", dni: "30111222", phone: "+54 11 5555-1234" }).phone, "+54 11 5555-1234");
    assert.throws(() => parsePassengerFields({ name: "Ana", dni: "30111222", phone: "abc" }), bad);
    assert.throws(() => parsePassengerFields({ name: "Ana", dni: "30111222", phone: "123" }), bad);
  });
  test("número de socio opcional, solo dígitos", () => {
    assert.equal(parsePassengerFields({ name: "Ana", dni: "30111222", memberNumber: "12345" }).memberNumber, "12345");
    assert.throws(() => parsePassengerFields({ name: "Ana", dni: "30111222", memberNumber: "A12" }), bad);
    assert.throws(() => parsePassengerFields({ name: "Ana", dni: "30111222", memberNumber: "12345678901" }), bad);
  });
});
