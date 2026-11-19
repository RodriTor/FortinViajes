import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { isUuid, round2 } from "../../src/business/validation.js";

describe("RN16 — integridad", () => {
  test("isUuid reconoce UUID válidos y rechaza lo demás", () => {
    assert.equal(isUuid("beaaa2e2-c975-467d-9d4b-0389173c49ea"), true);
    for (const v of ["no-existe", "", "123", undefined, null, 5, "beaaa2e2-c975-467d-9d4b-0389173c49e"]) assert.equal(isUuid(v), false);
  });
  test("round2 redondea a centavos", () => {
    assert.equal(round2(1.005), 1.01);
    assert.equal(round2(10000 * 0.5), 5000);
  });
});
