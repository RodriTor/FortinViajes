// SERVICE de viajes: acá viven las REGLAS DE NEGOCIO de RN6 y RN7. No sabe nada de HTTP ni de SQL.
import type { Database } from "../db.js";
import { AppError } from "../errors.js";
import { TRIP_STATUSES } from "../business/constants.js";
import { amountPaid } from "../business/payments.js";
import { calculateTripSummary } from "../business/summary.js";
import { assertManualTransition, parseTripInput } from "../business/tripRules.js";
import { isUuid } from "../business/validation.js";
import { PassengerRepository } from "../repositories/passengerRepository.js";
import { TripRecord, TripRepository } from "../repositories/tripRepository.js";

/** Lo que se expone de un viaje: datos públicos + cupos (sin pasajeros ni montos). */
export function toTripDto(t: TripRecord) {
  return {
    id: t.id,
    rival: t.rival,
    stadium: t.stadium,
    departureDateTime: t.departureAt.toISOString(),
    meetingPoint: t.meetingPoint,
    competition: t.competition,
    matchDateTime: t.matchAt ? t.matchAt.toISOString() : null,
    ticketPrice: t.ticketPrice,
    capacity: t.capacity,
    status: t.status,
    seatsOccupied: t.seatsOccupied,
    seatsAvailable: Math.max(0, t.capacity - t.seatsOccupied)
  };
}

export class TripService {
  constructor(
    private db: Database,
    private trips: TripRepository,
    private passengers: PassengerRepository,
    private clock: () => Date = () => new Date()
  ) {}

  async listTrips(filters: { q?: unknown; status?: unknown } = {}) {
    const q = typeof filters.q === "string" ? filters.q.trim().slice(0, 100) : "";
    let status: string | undefined;
    if (typeof filters.status === "string" && filters.status) {
      if (!(TRIP_STATUSES as readonly string[]).includes(filters.status)) throw new AppError(400, `El estado debe ser uno de: ${TRIP_STATUSES.join(", ")}`);
      status = filters.status;
    }
    return (await this.trips.findAll(this.db, { q: q || undefined, status })).map(toTripDto);
  }

  async getTrip(id: string) {
    return toTripDto(await this.requireTrip(id));
  }

  /** Busca un viaje o lanza 404. Un id que no es UUID se trata como inexistente (RN16). */
  async requireTrip(id: string): Promise<TripRecord> {
    const trip = isUuid(id) ? await this.trips.findById(this.db, id) : null;
    if (!trip) throw new AppError(404, "Viaje no encontrado");
    return trip;
  }

  async createTrip(createdBy: string, data: unknown) {
    const input = parseTripInput(data, this.clock());
    const id = await this.trips.create(this.db, input, createdBy);
    return toTripDto((await this.trips.findById(this.db, id))!);
  }

  /** RN6: cambio manual de estado. Cancelar un viaje cancela a todos los pasajeros con reintegro total. */
  async changeStatus(tripId: string, newStatus: unknown) {
    if (!isUuid(tripId)) throw new AppError(404, "Viaje no encontrado");
    const now = this.clock();
    await this.db.tx(async (tx) => {
      const trip = await this.trips.findById(tx, tripId, { forUpdate: true });
      if (!trip) throw new AppError(404, "Viaje no encontrado");
      const active = await this.passengers.findActiveByTrip(tx, tripId);
      const target = assertManualTransition(trip.status, newStatus, active.length);
      if (target === "Cancelado") {
        for (const p of active) {
          await this.passengers.markCancelled(tx, p.id, amountPaid(p.paymentStatus, p.depositAmount, trip.ticketPrice), 0, now);
        }
      }
      await this.trips.updateStatus(tx, tripId, target);
    });
    return this.getTrip(tripId);
  }

  /** RN15: resumen económico. Solo el organizador (lo exige la ruta). */
  async getSummary(tripId: string) {
    const trip = await this.requireTrip(tripId);
    const list = await this.passengers.findByTrip(this.db, tripId);
    return { summary: calculateTripSummary(list, trip.capacity, trip.ticketPrice) };
  }
}
