import { test, describe, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createContext, Ctx, HOUR, SKIP_REASON, TEST_DATABASE_URL } from "./helpers.js";

describe("HU3 / HU4 / HU6 — pasajeros", { skip: TEST_DATABASE_URL ? false : SKIP_REASON }, () => {
  let ctx: Ctx;
  let adminToken: string;
  let user: { token: string; id: string };
  before(async () => { ctx = await createContext(); });
  after(async () => { await ctx.close(); });
  beforeEach(async () => {
    await ctx.reset();
    adminToken = await ctx.admin();
    user = await ctx.register("Hincha", "hincha@test.com");
  });

  const departureIn = (hours: number) => new Date(ctx.now.getTime() + hours * HOUR).toISOString();
  const moveClockTo = (departure: string, hoursBefore: number) => ctx.setNow(new Date(new Date(departure).getTime() - hoursBefore * HOUR));
  const get = (tripId: string) => ctx.call("GET", `/trips/${tripId}`).then((r) => r.body.trip);

  describe("alta de pasajeros", () => {
    test("HU3: un hincha se anota y queda Pendiente (RN2, RN5)", async () => {
      const trip = await ctx.createTrip(adminToken);
      const r = await ctx.addPassenger(user.token, trip.id, { name: "  Lucas  ", dni: "30111222", phone: "11 5555-1234", memberNumber: "12345" });
      assert.equal(r.status, 201);
      assert.equal(r.body.passenger.name, "Lucas");
      assert.equal(r.body.passenger.paymentStatus, "Pendiente");
      assert.equal(r.body.passenger.amountPaid, 0);
      assert.equal(r.body.trip.seatsOccupied, 1);
    });

    test("sin sesión: 401; viaje inexistente o id mal formado: 404", async () => {
      const trip = await ctx.createTrip(adminToken);
      assert.equal((await ctx.call("POST", `/trips/${trip.id}/passengers`, { body: { name: "A", dni: "30111222" } })).status, 401);
      assert.equal((await ctx.addPassenger(user.token, "00000000-0000-4000-8000-000000000000")).status, 404);
      assert.equal((await ctx.addPassenger(user.token, "no-existe")).status, 404);
    });

    test("RN2: datos inválidos (400)", async () => {
      const trip = await ctx.createTrip(adminToken);
      for (const over of [{ name: "" }, { dni: "abc" }, { dni: "123456" }, { dni: "123456789" }, { phone: "x" }, { memberNumber: "A1" }]) {
        assert.equal((await ctx.addPassenger(user.token, trip.id, over)).status, 400, JSON.stringify(over));
      }
    });

    test("RN3: el mismo DNI no se repite en el mismo viaje (409), aunque cambie otra persona", async () => {
      const trip = await ctx.createTrip(adminToken, { capacity: 5 });
      const other = await ctx.register("Otro", "otro@test.com");
      assert.equal((await ctx.addPassenger(user.token, trip.id, { dni: "30111222" })).status, 201);
      const dup = await ctx.addPassenger(other.token, trip.id, { dni: "30111222" });
      assert.equal(dup.status, 409);
      assert.match(dup.body.error, /DNI/);
    });

    test("RN3: un DNI cancelado puede volver a anotarse", async () => {
      const trip = await ctx.createTrip(adminToken);
      const a = await ctx.addPassenger(user.token, trip.id, { dni: "30111222" });
      await ctx.call("PATCH", `/trips/${trip.id}/passengers/${a.body.passenger.id}/cancel`, { token: user.token });
      assert.equal((await ctx.addPassenger(user.token, trip.id, { dni: "30111222" })).status, 201);
    });

    test("RN1 + RN6: no se supera la capacidad (409); al llenarse pasa a Completo", async () => {
      const trip = await ctx.createTrip(adminToken, { capacity: 2 });
      const o1 = await ctx.register("Uno", "uno@test.com");
      const o2 = await ctx.register("Dos", "dos@test.com");
      const o3 = await ctx.register("Tres", "tres@test.com");
      assert.equal((await ctx.addPassenger(o1.token, trip.id)).status, 201);
      assert.equal((await get(trip.id)).status, "Abierto");
      assert.equal((await ctx.addPassenger(o2.token, trip.id)).status, 201);
      assert.equal((await get(trip.id)).status, "Completo");
      const full = await ctx.addPassenger(o3.token, trip.id);
      assert.equal(full.status, 409);
      assert.match(full.body.error, /completo/);
      assert.equal((await get(trip.id)).seatsOccupied, 2);
    });

    test("RN6: al cancelar un lugar, el viaje Completo vuelve a Abierto y el cupo se puede reusar", async () => {
      const trip = await ctx.createTrip(adminToken, { capacity: 1 });
      const a = await ctx.addPassenger(user.token, trip.id);
      assert.equal((await get(trip.id)).status, "Completo");
      const c = await ctx.call("PATCH", `/trips/${trip.id}/passengers/${a.body.passenger.id}/cancel`, { token: user.token });
      assert.equal(c.body.trip.status, "Abierto");
      const o = await ctx.register("Otro", "otro@test.com");
      assert.equal((await ctx.addPassenger(o.token, trip.id)).status, 201);
    });

    test("RN6: no se agregan pasajeros a viajes En Viaje, Finalizado ni Cancelado (409)", async () => {
      for (const target of ["En Viaje", "Finalizado", "Cancelado"]) {
        await ctx.reset();
        adminToken = await ctx.admin();
        user = await ctx.register("Hincha", "hincha@test.com");
        const trip = await ctx.createTrip(adminToken, { capacity: 5 });
        await ctx.addPassenger(user.token, trip.id);
        const steps = target === "Finalizado" ? ["En Viaje", "Finalizado"] : [target];
        for (const status of steps) await ctx.call("PATCH", `/trips/${trip.id}/status`, { token: adminToken, body: { status } });
        const r = await ctx.addPassenger(user.token, trip.id);
        assert.equal(r.status, 409, target);
        assert.match(r.body.error, new RegExp(target));
      }
    });
  });

  describe("RN8 — cierre de inscripción", () => {
    test("el hincha puede anotarse con 3 h exactas y no con 2 h 59 min", async () => {
      const departure = departureIn(100);
      const trip = await ctx.createTrip(adminToken, { departureDateTime: departure, capacity: 5 });
      moveClockTo(departure, 3);
      assert.equal((await ctx.addPassenger(user.token, trip.id)).status, 201);
      ctx.setNow(new Date(new Date(departure).getTime() - (3 * 60 - 1) * 60000));
      const r = await ctx.addPassenger(user.token, trip.id);
      assert.equal(r.status, 409);
      assert.match(r.body.error, /inscripción/);
    });

    test("el organizador puede anotar hasta la salida, pero no después", async () => {
      const departure = departureIn(100);
      const trip = await ctx.createTrip(adminToken, { departureDateTime: departure, capacity: 5 });
      ctx.setNow(new Date(new Date(departure).getTime() - 30 * 60000));
      assert.equal((await ctx.addPassenger(adminToken, trip.id)).status, 201);
      ctx.setNow(new Date(new Date(departure).getTime() + 60000));
      assert.equal((await ctx.addPassenger(adminToken, trip.id)).status, 409);
    });
  });

  describe("RN10 / RN11 — límites por persona", () => {
    test("RN10: máximo 4 lugares por hincha en un mismo viaje (el organizador no tiene tope)", async () => {
      const trip = await ctx.createTrip(adminToken, { capacity: 10 });
      for (let i = 0; i < 4; i++) assert.equal((await ctx.addPassenger(user.token, trip.id)).status, 201);
      const fifth = await ctx.addPassenger(user.token, trip.id);
      assert.equal(fifth.status, 409);
      assert.match(fifth.body.error, /máximo/);
      assert.equal((await ctx.addPassenger(adminToken, trip.id)).status, 201);
    });

    test("RN10: máximo 3 viajes futuros activos; cancelar uno libera el cupo del límite", async () => {
      const trips = [];
      for (let i = 0; i < 4; i++) trips.push(await ctx.createTrip(adminToken, { rival: `Rival ${i}`, departureDateTime: departureIn(100 + i * 48), capacity: 5 }));
      const added = [];
      for (let i = 0; i < 3; i++) {
        const r = await ctx.addPassenger(user.token, trips[i].id);
        assert.equal(r.status, 201);
        added.push(r.body.passenger.id);
      }
      const fourth = await ctx.addPassenger(user.token, trips[3].id);
      assert.equal(fourth.status, 409);
      assert.match(fourth.body.error, /3 viajes/);
      // seguir sumando acompañantes en un viaje donde ya está anotado sí se puede
      assert.equal((await ctx.addPassenger(user.token, trips[0].id)).status, 201);
      await ctx.call("PATCH", `/trips/${trips[0].id}/passengers/${added[0]}/cancel`, { token: user.token });
      // sigue teniendo un lugar activo en trips[0] (el acompañante), así que todavía cuenta
      assert.equal((await ctx.addPassenger(user.token, trips[3].id)).status, 409);
    });

    test("RN11: el mismo DNI no puede estar en dos viajes que salen el mismo día argentino (409)", async () => {
      const a = await ctx.createTrip(adminToken, { departureDateTime: "2026-12-05T10:00:00-03:00", capacity: 5 });
      const b = await ctx.createTrip(adminToken, { departureDateTime: "2026-12-05T23:30:00-03:00", capacity: 5 });
      const next = await ctx.createTrip(adminToken, { departureDateTime: "2026-12-06T00:30:00-03:00", capacity: 5 });
      assert.equal((await ctx.addPassenger(user.token, a.id, { dni: "30111222" })).status, 201);
      const clash = await ctx.addPassenger(user.token, b.id, { dni: "30111222" });
      assert.equal(clash.status, 409);
      assert.match(clash.body.error, /mismo día/);
      // 00:30 del día siguiente en Argentina (03:30 UTC) es otro día
      assert.equal((await ctx.addPassenger(user.token, next.id, { dni: "30111222" })).status, 201);
      // otro DNI el mismo día no tiene problema
      assert.equal((await ctx.addPassenger(user.token, b.id, { dni: "30111999" })).status, 201);
    });
  });

  describe("RN4 / RN5 — pagos", () => {
    test("RN5: un hincha no puede registrar pagos al anotarse (403)", async () => {
      const trip = await ctx.createTrip(adminToken);
      assert.equal((await ctx.addPassenger(user.token, trip.id, { paymentStatus: "Pagado" })).status, 403);
      assert.equal((await ctx.addPassenger(user.token, trip.id, { depositAmount: 100 })).status, 403);
      assert.equal((await ctx.addPassenger(user.token, trip.id, { paymentStatus: "Pendiente" })).status, 201);
    });

    test("RN5: el hincha no puede cambiar pagos (403) y el organizador sí", async () => {
      const trip = await ctx.createTrip(adminToken);
      const a = await ctx.addPassenger(user.token, trip.id);
      const url = `/trips/${trip.id}/passengers/${a.body.passenger.id}/payment`;
      assert.equal((await ctx.call("PATCH", url, { token: user.token, body: { paymentStatus: "Pagado" } })).status, 403);
      const r = await ctx.call("PATCH", url, { token: adminToken, body: { paymentStatus: "Pagado" } });
      assert.equal(r.status, 200);
      assert.equal(r.body.passenger.amountPaid, 10000);
    });

    test("RN4: seña con monto, seña por defecto (50%) y validaciones", async () => {
      const trip = await ctx.createTrip(adminToken, { capacity: 5 });
      const a = await ctx.addPassenger(user.token, trip.id);
      const url = `/trips/${trip.id}/passengers/${a.body.passenger.id}/payment`;
      const pay = (body: unknown) => ctx.call("PATCH", url, { token: adminToken, body });
      assert.equal((await pay({ paymentStatus: "Señado" })).body.passenger.amountPaid, 5000);
      assert.equal((await pay({ paymentStatus: "Señado", depositAmount: 3000 })).body.passenger.depositAmount, 3000);
      assert.equal((await pay({ paymentStatus: "Señado", depositAmount: 10001 })).status, 400);
      assert.equal((await pay({ paymentStatus: "Señado", depositAmount: 10000 })).status, 400);
      assert.equal((await pay({ paymentStatus: "Señado", depositAmount: 0 })).status, 400);
      assert.equal((await pay({ paymentStatus: "Nada" })).status, 400);
      assert.equal((await pay({})).status, 400);
      const back = await pay({ paymentStatus: "Pendiente" });
      assert.equal(back.body.passenger.amountPaid, 0);
      assert.equal(back.body.passenger.depositAmount, null);
    });

    test("el organizador anota con pago: queda cargado por el organizador y sin usuario dueño", async () => {
      const trip = await ctx.createTrip(adminToken);
      const r = await ctx.addPassenger(adminToken, trip.id, { paymentStatus: "Señado", depositAmount: 4000 });
      assert.equal(r.status, 201);
      assert.equal(r.body.passenger.addedByOrganizer, true);
      assert.equal(r.body.passenger.amountPaid, 4000);
      assert.equal((await ctx.addPassenger(adminToken, trip.id, { paymentStatus: "Señado", depositAmount: 99999 })).status, 400);
    });

    test("no se registra pago de un lugar cancelado (409) ni de pasajeros de otro viaje (404)", async () => {
      const trip = await ctx.createTrip(adminToken, { capacity: 5 });
      const other = await ctx.createTrip(adminToken, { capacity: 5, rival: "Boca", departureDateTime: departureIn(300) });
      const a = await ctx.addPassenger(user.token, trip.id);
      await ctx.call("PATCH", `/trips/${trip.id}/passengers/${a.body.passenger.id}/cancel`, { token: user.token });
      assert.equal((await ctx.call("PATCH", `/trips/${trip.id}/passengers/${a.body.passenger.id}/payment`, { token: adminToken, body: { paymentStatus: "Pagado" } })).status, 409);
      assert.equal((await ctx.call("PATCH", `/trips/${other.id}/passengers/${a.body.passenger.id}/payment`, { token: adminToken, body: { paymentStatus: "Pagado" } })).status, 404);
    });
  });

  describe("RN9 — cancelación y reintegro", () => {
    async function setup(price = 10000, payment?: Record<string, unknown>) {
      const departure = departureIn(100);
      const trip = await ctx.createTrip(adminToken, { departureDateTime: departure, ticketPrice: price, capacity: 5 });
      const p = await ctx.addPassenger(user.token, trip.id);
      if (payment) await ctx.call("PATCH", `/trips/${trip.id}/passengers/${p.body.passenger.id}/payment`, { token: adminToken, body: payment });
      return { trip, departure, id: p.body.passenger.id as string, url: `/trips/${trip.id}/passengers/${p.body.passenger.id}/cancel` };
    }

    test("24 h exactas: reintegro del 100% de lo abonado", async () => {
      const { departure, url } = await setup(10000, { paymentStatus: "Señado", depositAmount: 4000 });
      moveClockTo(departure, 24);
      const r = await ctx.call("PATCH", url, { token: user.token });
      assert.equal(r.status, 200);
      assert.equal(r.body.passenger.status, "CANCELADO");
      assert.equal(r.body.refund, 4000);
      assert.equal(r.body.retained, 0);
    });

    test("23 h 59 min: se cancela pero se retiene lo abonado", async () => {
      const { departure, url } = await setup(10000, { paymentStatus: "Pagado" });
      ctx.setNow(new Date(new Date(departure).getTime() - (24 * 60 - 1) * 60000));
      const r = await ctx.call("PATCH", url, { token: user.token });
      assert.equal(r.status, 200);
      assert.equal(r.body.refund, 0);
      assert.equal(r.body.retained, 10000);
    });

    test("6 h exactas: se puede; 5 h 59 min: 409", async () => {
      const a = await setup();
      moveClockTo(a.departure, 6);
      assert.equal((await ctx.call("PATCH", a.url, { token: user.token })).status, 200);
      await ctx.reset(); adminToken = await ctx.admin(); user = await ctx.register("Hincha", "hincha@test.com");
      const b = await setup();
      ctx.setNow(new Date(new Date(b.departure).getTime() - (6 * 60 - 1) * 60000));
      const r = await ctx.call("PATCH", b.url, { token: user.token });
      assert.equal(r.status, 409);
      assert.match(r.body.error, /6 horas/);
    });

    test("el organizador cancela con menos de 6 h y siempre con reintegro total", async () => {
      const { departure, url } = await setup(10000, { paymentStatus: "Pagado" });
      moveClockTo(departure, 1);
      const r = await ctx.call("PATCH", url, { token: adminToken });
      assert.equal(r.status, 200);
      assert.equal(r.body.refund, 10000);
    });

    test("RN12: un hincha no cancela lugares ajenos (404) y no se cancela dos veces (409)", async () => {
      const { url } = await setup();
      const stranger = await ctx.register("Intruso", "intruso@test.com");
      assert.equal((await ctx.call("PATCH", url, { token: stranger.token })).status, 404);
      assert.equal((await ctx.call("PATCH", url, { token: user.token })).status, 200);
      assert.equal((await ctx.call("PATCH", url, { token: user.token })).status, 409);
      assert.equal((await ctx.call("PATCH", url)).status, 401);
    });

    test("RN6: no se cancelan lugares de un viaje En Viaje (409)", async () => {
      const { trip, url } = await setup();
      await ctx.call("PATCH", `/trips/${trip.id}/status`, { token: adminToken, body: { status: "En Viaje" } });
      assert.equal((await ctx.call("PATCH", url, { token: user.token })).status, 409);
    });
  });

  describe("HU4 / HU6 — consultas y resumen", () => {
    test("RN12: Mis lugares muestra solo los míos y la vista previa de cancelación calculada por el servidor", async () => {
      const departure = departureIn(100);
      const trip = await ctx.createTrip(adminToken, { departureDateTime: departure, capacity: 5 });
      const stranger = await ctx.register("Otro", "otro@test.com");
      const mine = await ctx.addPassenger(user.token, trip.id, { name: "Lucas Mío" });
      await ctx.addPassenger(stranger.token, trip.id, { name: "Ajeno" });
      await ctx.call("PATCH", `/trips/${trip.id}/passengers/${mine.body.passenger.id}/payment`, { token: adminToken, body: { paymentStatus: "Pagado" } });

      const r = await ctx.call("GET", "/passengers/mine", { token: user.token });
      assert.equal(r.status, 200);
      assert.deepEqual(r.body.passengers.map((p: any) => p.name), ["Lucas Mío"]);
      assert.deepEqual(r.body.passengers[0].cancellation, { allowed: true, refund: 10000, retained: 0 });
      assert.equal(r.body.passengers[0].trip.rival, "San Lorenzo");

      moveClockTo(departure, 12);
      const later = await ctx.call("GET", "/passengers/mine", { token: user.token });
      assert.deepEqual(later.body.passengers[0].cancellation, { allowed: true, refund: 0, retained: 10000 });
      moveClockTo(departure, 2);
      assert.equal((await ctx.call("GET", "/passengers/mine", { token: user.token })).body.passengers[0].cancellation.allowed, false);
      assert.equal((await ctx.call("GET", "/passengers/mine")).status, 401);
    });

    test("RN12: la lista de pasajeros y el resumen son solo del organizador (403/401)", async () => {
      const trip = await ctx.createTrip(adminToken);
      assert.equal((await ctx.call("GET", `/trips/${trip.id}/passengers`, { token: user.token })).status, 403);
      assert.equal((await ctx.call("GET", `/trips/${trip.id}/summary`, { token: user.token })).status, 403);
      assert.equal((await ctx.call("GET", `/trips/${trip.id}/passengers`)).status, 401);
      assert.equal((await ctx.call("GET", `/trips/${trip.id}/passengers`, { token: adminToken })).status, 200);
      assert.equal((await ctx.call("GET", `/trips/nope/passengers`, { token: adminToken })).status, 404);
    });

    test("RN13: búsqueda por nombre, DNI o número de socio, sin distinguir mayúsculas", async () => {
      const trip = await ctx.createTrip(adminToken, { capacity: 10 });
      await ctx.addPassenger(user.token, trip.id, { name: "Lucas Pérez", dni: "30111222", memberNumber: "777" });
      await ctx.addPassenger(user.token, trip.id, { name: "Ana Gómez", dni: "28999888", memberNumber: "555" });
      const q = async (text: string) => (await ctx.call("GET", `/trips/${trip.id}/passengers?q=${encodeURIComponent(text)}`, { token: adminToken })).body.passengers.map((p: any) => p.name);
      assert.deepEqual(await q("LUCAS"), ["Lucas Pérez"]);
      assert.deepEqual(await q("28999"), ["Ana Gómez"]);
      assert.deepEqual(await q("555"), ["Ana Gómez"]);
      assert.deepEqual(await q("gómez"), ["Ana Gómez"]);
      assert.deepEqual(await q(""), ["Lucas Pérez", "Ana Gómez"]);
      assert.deepEqual(await q("zzz"), []);
      assert.deepEqual(await q("%"), []); // el % no es comodín
    });

    test("RN15: el resumen refleja pagos, pendientes, retenidos y reintegrados", async () => {
      const departure = departureIn(100);
      const trip = await ctx.createTrip(adminToken, { departureDateTime: departure, capacity: 4, ticketPrice: 10000 });
      const ids: string[] = [];
      for (let i = 0; i < 4; i++) ids.push((await ctx.addPassenger(user.token, trip.id)).body.passenger.id);
      const pay = (i: number, body: unknown) => ctx.call("PATCH", `/trips/${trip.id}/passengers/${ids[i]}/payment`, { token: adminToken, body });
      await pay(0, { paymentStatus: "Pagado" });
      await pay(1, { paymentStatus: "Señado", depositAmount: 3000 });
      await pay(2, { paymentStatus: "Pagado" });
      // el pasajero 2 cancela con menos de 24 h: se retienen 10000; el 3 (Pendiente) cancela sin movimiento de dinero
      moveClockTo(departure, 10);
      await ctx.call("PATCH", `/trips/${trip.id}/passengers/${ids[2]}/cancel`, { token: user.token });
      await ctx.call("PATCH", `/trips/${trip.id}/passengers/${ids[3]}/cancel`, { token: user.token });

      const s = (await ctx.call("GET", `/trips/${trip.id}/summary`, { token: adminToken })).body.summary;
      assert.equal(s.seatsOccupied, 2);
      assert.equal(s.seatsAvailable, 2);
      assert.equal(s.totalPaid, 13000); // 10000 + 3000
      assert.equal(s.totalPending, 7000); // 2 × 10000 − 13000
      assert.equal(s.totalRetained, 10000);
      assert.equal(s.totalRefunded, 0);
      assert.equal(s.isFull, false);
      assert.deepEqual(s.byPaymentStatus, { Pendiente: 0, Señado: 1, Pagado: 1 });
    });
  });
});
