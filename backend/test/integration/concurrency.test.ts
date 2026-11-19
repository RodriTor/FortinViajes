import { test, describe, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createContext, Ctx, SKIP_REASON, TEST_DATABASE_URL } from "./helpers.js";

// RN1, RN3, RN10: la protección ante solicitudes simultáneas vive en PostgreSQL (bloqueos + trigger + índice único).
describe("Concurrencia — cupo, DNI y límites", { skip: TEST_DATABASE_URL ? false : SKIP_REASON }, () => {
  let ctx: Ctx;
  let adminToken: string;
  before(async () => { ctx = await createContext(); });
  after(async () => { await ctx.close(); });
  beforeEach(async () => { await ctx.reset(); adminToken = await ctx.admin(); });

  const activeCount = async (tripId: string) => (await ctx.db.query("SELECT COUNT(*)::int AS n FROM passengers WHERE trip_id = $1 AND status = 'ACTIVO'", [tripId])).rows[0].n;

  test("RN1: 10 hinchas distintos se anotan a la vez en un micro de 3 lugares: entran exactamente 3", async () => {
    const trip = await ctx.createTrip(adminToken, { capacity: 3 });
    const users = await Promise.all(Array.from({ length: 10 }, (_, i) => ctx.register(`Hincha ${i}`, `h${i}@test.com`)));
    const results = await Promise.all(users.map((u, i) => ctx.addPassenger(u.token, trip.id, { dni: String(30000100 + i) })));
    const statuses = results.map((r) => r.status).sort();
    assert.deepEqual(statuses, [201, 201, 201, 409, 409, 409, 409, 409, 409, 409]);
    assert.equal(await activeCount(trip.id), 3);
    assert.equal((await ctx.call("GET", `/trips/${trip.id}`)).body.trip.status, "Completo");
  });

  test("RN3: el mismo DNI enviado 6 veces a la vez por distintos usuarios: se anota una sola vez", async () => {
    const trip = await ctx.createTrip(adminToken, { capacity: 10 });
    const users = await Promise.all(Array.from({ length: 6 }, (_, i) => ctx.register(`Hincha ${i}`, `h${i}@test.com`)));
    const results = await Promise.all(users.map((u) => ctx.addPassenger(u.token, trip.id, { dni: "30111222" })));
    assert.equal(results.filter((r) => r.status === 201).length, 1);
    assert.equal(results.filter((r) => r.status === 409).length, 5);
    assert.equal(await activeCount(trip.id), 1);
  });

  test("RN10: un mismo hincha pidiendo 8 lugares a la vez en un micro grande: solo obtiene 4", async () => {
    const trip = await ctx.createTrip(adminToken, { capacity: 20 });
    const u = await ctx.register("Acaparador", "acaparador@test.com");
    const results = await Promise.all(Array.from({ length: 8 }, (_, i) => ctx.addPassenger(u.token, trip.id, { dni: String(30000200 + i) })));
    assert.equal(results.filter((r) => r.status === 201).length, 4);
    assert.equal(await activeCount(trip.id), 4);
  });

  test("RN10: un mismo hincha anotándose a la vez en 5 viajes distintos: solo entra en 3", async () => {
    const trips = [];
    for (let i = 0; i < 5; i++) trips.push(await ctx.createTrip(adminToken, { rival: `Rival ${i}`, departureDateTime: new Date(ctx.now.getTime() + (100 + i * 48) * 3_600_000).toISOString(), capacity: 5 }));
    const u = await ctx.register("Viajero", "viajero@test.com");
    const results = await Promise.all(trips.map((t, i) => ctx.addPassenger(u.token, t.id, { dni: String(30000300 + i) })));
    assert.equal(results.filter((r) => r.status === 201).length, 3);
  });

  test("RN1: la base rechaza por sí sola un alta que supere la capacidad (trigger), aunque se salte la API", async () => {
    const trip = await ctx.createTrip(adminToken, { capacity: 1 });
    await ctx.db.query("INSERT INTO passengers (trip_id, name, dni) VALUES ($1, 'A', '30111222')", [trip.id]);
    await assert.rejects(
      () => ctx.db.query("INSERT INTO passengers (trip_id, name, dni) VALUES ($1, 'B', '30111223')", [trip.id]),
      (e: any) => e.code === "FV001"
    );
  });

  test("RN3: la base rechaza por sí sola un DNI repetido activo (índice único parcial)", async () => {
    const trip = await ctx.createTrip(adminToken, { capacity: 5 });
    await ctx.db.query("INSERT INTO passengers (trip_id, name, dni) VALUES ($1, 'A', '30111222')", [trip.id]);
    await assert.rejects(
      () => ctx.db.query("INSERT INTO passengers (trip_id, name, dni) VALUES ($1, 'B', '30111222')", [trip.id]),
      (e: any) => e.code === "23505"
    );
  });

  test("RN16: la base rechaza DNI mal formados y estados inválidos (CHECK)", async () => {
    const trip = await ctx.createTrip(adminToken, { capacity: 5 });
    await assert.rejects(() => ctx.db.query("INSERT INTO passengers (trip_id, name, dni) VALUES ($1, 'A', 'abc')", [trip.id]), (e: any) => e.code === "23514");
    await assert.rejects(() => ctx.db.query("INSERT INTO passengers (trip_id, name, dni, payment_status) VALUES ($1, 'A', '30111222', 'Nada')", [trip.id]), (e: any) => e.code === "23514");
  });
});
