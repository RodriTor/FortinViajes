// SERVICE de pasajeros: acá vive la FUNCIONALIDAD PRINCIPAL (anotar, cancelar, registrar pagos).
// Reglas: RN1–RN5, RN8–RN12 y RN16. No sabe nada de HTTP; el SQL está en los repositorios.
import type { Database } from "../db.js";
import { AppError } from "../errors.js";
import { MAX_ACTIVE_TRIPS_PER_USER, MAX_SEATS_PER_USER_PER_TRIP, REGISTRATION_CLOSE_HOURS } from "../business/constants.js";
import { parsePassengerFields } from "../business/passengerRules.js";
import { amountPaid, parsePayment } from "../business/payments.js";
import { cancellationPolicy, isRegistrationOpen } from "../business/policies.js";
import { argentinaDayRange } from "../business/time.js";
import { assertEditableForPassengers, statusAfterCapacityChange } from "../business/tripRules.js";
import { isUuid, requireObject } from "../business/validation.js";
import { PassengerRecord, PassengerRepository } from "../repositories/passengerRepository.js";
import { TripRepository } from "../repositories/tripRepository.js";
import type { PublicUser } from "./authService.js";
import { toTripDto } from "./tripService.js";

export function toPassengerDto(p: PassengerRecord, ticketPrice: number) {
  return {
    id: p.id,
    tripId: p.tripId,
    name: p.name,
    dni: p.dni,
    phone: p.phone,
    memberNumber: p.memberNumber,
    paymentStatus: p.paymentStatus,
    depositAmount: p.depositAmount,
    amountPaid: amountPaid(p.paymentStatus, p.depositAmount, ticketPrice),
    status: p.status,
    refundAmount: p.refundAmount,
    retainedAmount: p.retainedAmount,
    cancelledAt: p.cancelledAt ? p.cancelledAt.toISOString() : null,
    createdAt: p.createdAt.toISOString(),
    addedByOrganizer: p.userId === null
  };
}

const NOT_FOUND_TRIP = "Viaje no encontrado";
const NOT_FOUND_PASSENGER = "Pasajero no encontrado";

export class PassengerService {
  constructor(
    protected db: Database,
    protected trips: TripRepository,
    protected passengers: PassengerRepository,
    protected clock: () => Date = () => new Date()
  ) {}

  /** HU3: anotar un pasajero. Todo ocurre en una transacción con bloqueos para ser seguro ante concurrencia. */
  async addPassenger(actor: PublicUser, tripId: string, data: unknown) {
    if (!isUuid(tripId)) throw new AppError(404, NOT_FOUND_TRIP);
    const body = requireObject(data);
    const isAdmin = actor.role === "ADMIN";
    const fields = parsePassengerFields(body); // RN2 (400)

    // RN5: el hincha no registra pagos.
    if (!isAdmin && ((body.paymentStatus !== undefined && body.paymentStatus !== "Pendiente") || (body.depositAmount !== undefined && body.depositAmount !== null))) {
      throw new AppError(403, "Solo el organizador puede registrar pagos");
    }

    const now = this.clock();
    try {
      return await this.db.tx(async (tx) => {
        // Orden de bloqueos fijo (usuario → DNI → viaje) para evitar deadlocks.
        if (!isAdmin) await this.passengers.lock(tx, `user:${actor.id}`);
        await this.passengers.lock(tx, `dni:${fields.dni}`);

        const trip = await this.trips.findById(tx, tripId, { forUpdate: true });
        if (!trip) throw new AppError(404, NOT_FOUND_TRIP);

        const payment = isAdmin
          ? parsePayment(body, trip.ticketPrice, "Pendiente") // RN4 (400)
          : ({ paymentStatus: "Pendiente", depositAmount: null } as const);

        assertEditableForPassengers(trip.status, "add"); // RN6
        if (!isRegistrationOpen(trip.departureAt, now, isAdmin)) { // RN8
          throw new AppError(409, isAdmin
            ? "El viaje ya salió: no se pueden agregar pasajeros"
            : `La inscripción ya cerró: se cierra ${REGISTRATION_CLOSE_HOURS} horas antes de la salida`);
        }
        if (await this.passengers.existsActiveDni(tx, tripId, fields.dni)) { // RN3
          throw new AppError(409, "Ese DNI ya está anotado en este viaje");
        }
        const active = await this.passengers.countActiveByTrip(tx, tripId);
        if (active >= trip.capacity) throw new AppError(409, "El micro está completo, no hay asientos disponibles"); // RN1

        if (!isAdmin) { // RN10
          const mine = await this.passengers.countActiveByUserInTrip(tx, tripId, actor.id);
          if (mine >= MAX_SEATS_PER_USER_PER_TRIP) {
            throw new AppError(409, `Ya anotaste ${MAX_SEATS_PER_USER_PER_TRIP} lugares en este viaje (el máximo por persona)`);
          }
          const otherTrips = await this.passengers.countFutureTripsOfUser(tx, actor.id, now, tripId);
          if (otherTrips >= MAX_ACTIVE_TRIPS_PER_USER) {
            throw new AppError(409, `Ya tenés lugares en ${MAX_ACTIVE_TRIPS_PER_USER} viajes futuros. Cancelá uno antes de anotarte en otro`);
          }
        }

        const day = argentinaDayRange(trip.departureAt); // RN11
        if (await this.passengers.existsActiveDniInOtherTripBetween(tx, fields.dni, day.from, day.to, tripId)) {
          throw new AppError(409, "Ese DNI ya está anotado en otro viaje que sale el mismo día");
        }

        const passenger = await this.passengers.insert(tx, { tripId, userId: isAdmin ? null : actor.id, fields, payment });

        // RN6: al llenarse el micro, el viaje pasa a Completo.
        const newStatus = statusAfterCapacityChange(trip.status, active + 1, trip.capacity);
        if (newStatus !== trip.status) await this.trips.updateStatus(tx, tripId, newStatus);

        const updated = (await this.trips.findById(tx, tripId))!;
        return { passenger: toPassengerDto(passenger, trip.ticketPrice), trip: toTripDto(updated) };
      });
    } catch (e: any) {
      // Red de seguridad: si la base rechazó por su cuenta (carrera extrema), se devuelve el mismo mensaje claro.
      if (e?.code === "FV001") throw new AppError(409, "El micro está completo, no hay asientos disponibles");
      if (e?.code === "23505" && e?.constraint === "passengers_trip_dni_active_uq") throw new AppError(409, "Ese DNI ya está anotado en este viaje");
      throw e;
    }
  }

  /** HU4: cancelar un lugar. El hincha solo cancela los suyos (RN9, RN12); el organizador cualquiera. */
  async cancelPassenger(actor: PublicUser, tripId: string, passengerId: string) {
    if (!isUuid(tripId)) throw new AppError(404, NOT_FOUND_TRIP);
    if (!isUuid(passengerId)) throw new AppError(404, NOT_FOUND_PASSENGER);
    const isAdmin = actor.role === "ADMIN";
    const now = this.clock();

    return this.db.tx(async (tx) => {
      const trip = await this.trips.findById(tx, tripId, { forUpdate: true });
      if (!trip) throw new AppError(404, NOT_FOUND_TRIP);
      const p = await this.passengers.findById(tx, passengerId);
      // RN12: si no es suyo, se responde como si no existiera.
      if (!p || p.tripId !== tripId || (!isAdmin && p.userId !== actor.id)) throw new AppError(404, NOT_FOUND_PASSENGER);
      if (p.status !== "ACTIVO") throw new AppError(409, "Ese lugar ya estaba cancelado");
      assertEditableForPassengers(trip.status, "cancel");

      const decision = cancellationPolicy({ departureAt: trip.departureAt, now, isAdmin, amountPaid: amountPaid(p.paymentStatus, p.depositAmount, trip.ticketPrice) });
      if (!decision.allowed) throw new AppError(409, decision.reason);

      const cancelled = await this.passengers.markCancelled(tx, p.id, decision.refund, decision.retained, now);

      // RN6: al liberarse un lugar, un viaje Completo vuelve a Abierto.
      const active = await this.passengers.countActiveByTrip(tx, tripId);
      const newStatus = statusAfterCapacityChange(trip.status, active, trip.capacity);
      if (newStatus !== trip.status) await this.trips.updateStatus(tx, tripId, newStatus);

      const updated = (await this.trips.findById(tx, tripId))!;
      return { passenger: toPassengerDto(cancelled, trip.ticketPrice), trip: toTripDto(updated), refund: decision.refund, retained: decision.retained };
    });
  }

  /** HU6: el organizador registra o corrige el pago (RN4, RN5). */
  async updatePayment(tripId: string, passengerId: string, data: unknown) {
    if (!isUuid(tripId)) throw new AppError(404, NOT_FOUND_TRIP);
    if (!isUuid(passengerId)) throw new AppError(404, NOT_FOUND_PASSENGER);
    return this.db.tx(async (tx) => {
      const trip = await this.trips.findById(tx, tripId, { forUpdate: true });
      if (!trip) throw new AppError(404, NOT_FOUND_TRIP);
      const p = await this.passengers.findById(tx, passengerId);
      if (!p || p.tripId !== tripId) throw new AppError(404, NOT_FOUND_PASSENGER);
      if (p.status !== "ACTIVO") throw new AppError(409, "No se puede registrar un pago de un lugar cancelado");
      const payment = parsePayment(data, trip.ticketPrice, null);
      const updated = await this.passengers.updatePayment(tx, p.id, payment);
      return { passenger: toPassengerDto(updated, trip.ticketPrice) };
    });
  }

  /** RN13: lista (y búsqueda) de pasajeros de un viaje. Solo el organizador (lo exige la ruta). */
  async listPassengers(tripId: string, q?: unknown) {
    if (!isUuid(tripId)) throw new AppError(404, NOT_FOUND_TRIP);
    const trip = await this.trips.findById(this.db, tripId);
    if (!trip) throw new AppError(404, NOT_FOUND_TRIP);
    const query = typeof q === "string" ? q.trim().slice(0, 100) : "";
    const list = await this.passengers.findByTrip(this.db, tripId, query || undefined);
    return { passengers: list.map((p) => toPassengerDto(p, trip.ticketPrice)) };
  }

  /** HU4/RN12: "Mis lugares". Incluye una vista previa de la política de cancelación calculada por el servidor. */
  async myPassengers(actor: PublicUser) {
    const now = this.clock();
    const list = await this.passengers.findByUser(this.db, actor.id);
    return {
      passengers: list.map((p) => {
        const dto = toPassengerDto(p, p.trip.ticketPrice);
        const editable = p.trip.status === "Abierto" || p.trip.status === "Completo";
        const cancellation =
          p.status === "ACTIVO" && editable
            ? cancellationPolicy({ departureAt: p.trip.departureAt, now, isAdmin: false, amountPaid: dto.amountPaid })
            : null;
        return {
          ...dto,
          trip: {
            id: p.tripId,
            rival: p.trip.rival,
            stadium: p.trip.stadium,
            departureDateTime: p.trip.departureAt.toISOString(),
            meetingPoint: p.trip.meetingPoint,
            ticketPrice: p.trip.ticketPrice,
            status: p.trip.status
          },
          cancellation
        };
      })
    };
  }
}
