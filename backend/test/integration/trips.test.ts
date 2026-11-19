import { test, describe, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createContext, Ctx, HOUR, SKIP_REASON, TEST_DATABASE_URL } from "./helpers.js";

describe("HU1 / HU5 — viajes", { skip: TEST_DATABASE_URL ? false : SKIP_REASON }, () => {
  let ctx: Ctx;
  let adminToken: string;
  before(async () => { ctx = await createContext(); });
  after(async () => { await ctx.close(); });
  beforeEach(async () => { await ctx.reset(); adminToken = await ctx.admin(); });

  const body = { rival: "San Lorenzo", stadium: "Estadio José Amalfitani", departureDateTime: "2026-12-01T18:00", meetingPoint: "Sede Liniers", ticketPrice: 10000, capacity: 2 };

  test("RN7: el organizador crea un viaje; nace Abierto con todos los cupos libres; 18:00 sin zona = horario argentino", async () => {
    const r = await ctx.call("POST", "/trips", { token: adminToken, body });
    assert.equal(r.status, 201);
    assert.equal(r.body.trip.status, "Abierto");
    assert.equal(r.body.trip.seatsAvailable, 2);
    assert.equal(r.body.trip.departureDateTime, "2026-12-01T21:00:00.000Z");
  });

  test("RN7: se guardan la competición y el horario del partido, y se devuelven en el listado público", async () => {
    const r = await ctx.call("POST", "/trips", { token: adminToken, body: { ...body, competition: "Octavos de final", matchDateTime: "2026-12-01T20:00" } });
    assert.equal(r.status, 201);
    assert.equal(r.body.trip.competition, "Octavos de final");
    assert.equal(r.body.trip.matchDateTime, "2026-12-01T23:00:00.000Z");
    const list = (await ctx.call("GET", "/trips")).body.trips[0];
    assert.equal(list.competition, "Octavos de final");
    assert.equal((await ctx.call("POST", "/trips", { token: adminToken, body: { ...body, matchDateTime: "2026-12-01T17:00" } })).status, 400);
    const plain = await ctx.call("POST", "/trips", { token: adminToken, body });
    assert.equal(plain.body.trip.matchDateTime, null);
  });

  test("RN12: un hincha no crea viajes (403) y sin sesión es 401", async () => {
    const u = await ctx.register("Hincha", "h@test.com");
    assert.equal((await ctx.call("POST", "/trips", { token: u.token, body })).status, 403);
    assert.equal((await ctx.call("POST", "/trips", { body })).status, 401);
  });

  test("RN7: datos inválidos (400)", async () => {
    for (const over of [{ rival: "" }, { stadium: " " }, { capacity: 0 }, { ticketPrice: -1 }, { departureDateTime: "2026-11-01T10:00" }, { departureDateTime: "mañana" }]) {
      assert.equal((await ctx.call("POST", "/trips", { token: adminToken, body: { ...body, ...over } })).status, 400, JSON.stringify(over));
    }
  });

  test("HU1: el listado es público, ordenado por fecha y filtra por rival", async () => {
    await ctx.createTrip(adminToken, { rival: "Boca", departureDateTime: new Date(ctx.now.getTime() + 200 * HOUR).toISOString() });
    await ctx.createTrip(adminToken, { rival: "San Lorenzo" });
    const all = await ctx.call("GET", "/trips");
    assert.equal(all.status, 200);
    assert.deepEqual(all.body.trips.map((t: any) => t.rival), ["San Lorenzo", "Boca"]);
    const filtered = await ctx.call("GET", "/trips?q=boc");
    assert.deepEqual(filtered.body.trips.map((t: any) => t.rival), ["Boca"]);
    assert.equal((await ctx.call("GET", "/trips?q=%25")).body.trips.length, 0); // el % no es comodín
    assert.equal((await ctx.call("GET", "/trips?status=Inventado")).status, 400);
  });

  test("RN12: el listado y el detalle públicos no exponen pasajeros ni montos recaudados", async () => {
    const trip = await ctx.createTrip(adminToken);
    const u = await ctx.register("Hincha", "h@test.com");
    await ctx.addPassenger(u.token, trip.id, { dni: "30111222", phone: "1155551234" });
    const text = JSON.stringify([(await ctx.call("GET", "/trips")).body, (await ctx.call("GET", `/trips/${trip.id}`)).body]);
    assert.equal(text.includes("30111222"), false);
    assert.equal(text.includes("1155551234"), false);
    assert.equal(text.includes("passengers"), false);
    assert.equal((await ctx.call("GET", `/trips/${trip.id}`)).body.trip.seatsOccupied, 1);
  });

  test("detalle de viaje inexistente o con id mal formado: 404", async () => {
    assert.equal((await ctx.call("GET", "/trips/no-existe")).status, 404);
    assert.equal((await ctx.call("GET", "/trips/00000000-0000-4000-8000-000000000000")).status, 404);
  });

  test("RN6: no se puede iniciar un viaje sin pasajeros (409)", async () => {
    const trip = await ctx.createTrip(adminToken);
    assert.equal((await ctx.call("PATCH", `/trips/${trip.id}/status`, { token: adminToken, body: { status: "En Viaje" } })).status, 409);
  });

  test("RN6: Abierto → En Viaje → Finalizado; Finalizado es definitivo; Abierto/Completo no se fijan a mano", async () => {
    const trip = await ctx.createTrip(adminToken);
    const u = await ctx.register("Hincha", "h@test.com");
    await ctx.addPassenger(u.token, trip.id);
    const patch = (status: string) => ctx.call("PATCH", `/trips/${trip.id}/status`, { token: adminToken, body: { status } });
    assert.equal((await patch("Finalizado")).status, 409); // no se salta En Viaje
    assert.equal((await patch("Abierto")).status, 400);
    assert.equal((await patch("En Viaje")).body.trip.status, "En Viaje");
    assert.equal((await patch("Cancelado")).status, 409); // ya salió
    assert.equal((await patch("Finalizado")).body.trip.status, "Finalizado");
    assert.equal((await patch("En Viaje")).status, 409);
  });

  test("RN12: un hincha no cambia el estado de un viaje (403)", async () => {
    const trip = await ctx.createTrip(adminToken);
    const u = await ctx.register("Hincha", "h@test.com");
    assert.equal((await ctx.call("PATCH", `/trips/${trip.id}/status`, { token: u.token, body: { status: "Cancelado" } })).status, 403);
  });

  test("RN6 / HU5: cancelar un viaje cancela a todos con reintegro total de lo abonado", async () => {
    const trip = await ctx.createTrip(adminToken, { capacity: 3 });
    const u = await ctx.register("Hincha", "h@test.com");
    const a = await ctx.addPassenger(u.token, trip.id);
    await ctx.addPassenger(u.token, trip.id);
    await ctx.call("PATCH", `/trips/${trip.id}/passengers/${a.body.passenger.id}/payment`, { token: adminToken, body: { paymentStatus: "Pagado" } });

    const r = await ctx.call("PATCH", `/trips/${trip.id}/status`, { token: adminToken, body: { status: "Cancelado" } });
    assert.equal(r.body.trip.status, "Cancelado");
    assert.equal(r.body.trip.seatsOccupied, 0);

    const list = await ctx.call("GET", `/trips/${trip.id}/passengers`, { token: adminToken });
    assert.ok(list.body.passengers.every((p: any) => p.status === "CANCELADO"));
    const summary = (await ctx.call("GET", `/trips/${trip.id}/summary`, { token: adminToken })).body.summary;
    assert.equal(summary.totalRefunded, 10000);
    assert.equal(summary.totalRetained, 0);
    // y ya no admite altas (409)
    assert.equal((await ctx.addPassenger(u.token, trip.id)).status, 409);
  });
});
