import { test, describe, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createContext, Ctx, expiredToken, SKIP_REASON, TEST_DATABASE_URL } from "./helpers.js";

describe("HU2 / RN12 — autenticación", { skip: TEST_DATABASE_URL ? false : SKIP_REASON }, () => {
  let ctx: Ctx;
  before(async () => { ctx = await createContext(); });
  after(async () => { await ctx.close(); });
  beforeEach(async () => { await ctx.reset(); });

  const valid = { name: "Lucas", email: "Lucas@Mail.com", password: "12345678" };

  test("registro válido: 201, rol USER, email en minúsculas y sin hash en la respuesta", async () => {
    const r = await ctx.call("POST", "/auth/register", { body: valid });
    assert.equal(r.status, 201);
    assert.equal(r.body.user.role, "USER");
    assert.equal(r.body.user.email, "lucas@mail.com");
    assert.ok(r.body.token);
    assert.equal(JSON.stringify(r.body).includes("password"), false);
  });

  test("registro duplicado (aunque cambie la capitalización): 409", async () => {
    await ctx.call("POST", "/auth/register", { body: valid });
    const r = await ctx.call("POST", "/auth/register", { body: { ...valid, email: "LUCAS@mail.com" } });
    assert.equal(r.status, 409);
  });

  test("registro inválido: nombre corto, email mal formado, contraseña corta (400)", async () => {
    for (const body of [{ ...valid, name: "L" }, { ...valid, email: "no-es-mail" }, { ...valid, password: "1234567" }, {}]) {
      assert.equal((await ctx.call("POST", "/auth/register", { body })).status, 400, JSON.stringify(body));
    }
  });

  test("RN12: el registro público nunca crea un organizador, aunque se envíe role: ADMIN", async () => {
    const r = await ctx.call("POST", "/auth/register", { body: { ...valid, role: "ADMIN" } });
    assert.equal(r.body.user.role, "USER");
  });

  test("login correcto devuelve token; contraseña o email incorrectos: 401", async () => {
    await ctx.call("POST", "/auth/register", { body: valid });
    const ok = await ctx.call("POST", "/auth/login", { body: { email: "lucas@mail.com", password: "12345678" } });
    assert.equal(ok.status, 200);
    assert.ok(ok.body.token);
    assert.equal((await ctx.call("POST", "/auth/login", { body: { email: "lucas@mail.com", password: "otra-clave" } })).status, 401);
    assert.equal((await ctx.call("POST", "/auth/login", { body: { email: "nadie@mail.com", password: "12345678" } })).status, 401);
  });

  test("/auth/me con token válido; sin token, inválido o vencido: 401", async () => {
    const u = await ctx.register("Lucas", "lucas@mail.com");
    const me = await ctx.call("GET", "/auth/me", { token: u.token });
    assert.equal(me.status, 200);
    assert.equal(me.body.user.email, "lucas@mail.com");
    assert.equal((await ctx.call("GET", "/auth/me")).status, 401);
    assert.equal((await ctx.call("GET", "/auth/me", { token: "basura" })).status, 401);
    const expired = await ctx.call("GET", "/auth/me", { token: expiredToken(u.id) });
    assert.equal(expired.status, 401);
    assert.match(expired.body.error, /venció/);
  });

  test("un token de un usuario que ya no existe deja de servir (401)", async () => {
    const u = await ctx.register("Lucas", "lucas@mail.com");
    await ctx.db.query("DELETE FROM users WHERE id = $1", [u.id]);
    assert.equal((await ctx.call("GET", "/auth/me", { token: u.token })).status, 401);
  });

  test("JSON mal formado: 400 y ruta inexistente: 404", async () => {
    assert.equal((await ctx.call("POST", "/auth/register", { raw: "{mal" })).status, 400);
    assert.equal((await ctx.call("GET", "/no-existe")).status, 404);
  });

  test("health responde ok con la base conectada", async () => {
    const r = await ctx.call("GET", "/health");
    assert.deepEqual(r.body, { status: "ok", service: "FortínViajes API", database: "ok" });
  });
});
