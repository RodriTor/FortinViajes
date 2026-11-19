// REPOSITORY de pasajeros: único lugar que conoce el SQL de la tabla passengers.
import type { Queryable } from "../db.js";
import type { PassengerStatus, PaymentStatus, TripStatus } from "../business/constants.js";
import type { PassengerFields } from "../business/passengerRules.js";
import type { PaymentInput } from "../business/payments.js";

export interface PassengerRecord {
  id: string;
  tripId: string;
  userId: string | null;
  name: string;
  dni: string;
  phone: string;
  memberNumber: string;
  paymentStatus: PaymentStatus;
  depositAmount: number | null;
  status: PassengerStatus;
  refundAmount: number;
  retainedAmount: number;
  cancelledAt: Date | null;
  createdAt: Date;
}

export interface MyPassengerRecord extends PassengerRecord {
  trip: { rival: string; stadium: string; departureAt: Date; meetingPoint: string; ticketPrice: number; status: TripStatus };
}

const COLUMNS = `p.id, p.trip_id, p.user_id, p.name, p.dni, p.phone, p.member_number, p.payment_status, p.deposit_amount,
                 p.status, p.refund_amount, p.retained_amount, p.cancelled_at, p.created_at`;

function map(row: any): PassengerRecord {
  return {
    id: row.id,
    tripId: row.trip_id,
    userId: row.user_id,
    name: row.name,
    dni: row.dni,
    phone: row.phone,
    memberNumber: row.member_number,
    paymentStatus: row.payment_status,
    depositAmount: row.deposit_amount === null ? null : Number(row.deposit_amount),
    status: row.status,
    refundAmount: Number(row.refund_amount),
    retainedAmount: Number(row.retained_amount),
    cancelledAt: row.cancelled_at,
    createdAt: row.created_at
  };
}

const escapeLike = (s: string) => s.replace(/[\\%_]/g, "\\$&");

export class PassengerRepository {
  async findById(db: Queryable, id: string): Promise<PassengerRecord | null> {
    const r = await db.query(`SELECT ${COLUMNS} FROM passengers p WHERE p.id = $1`, [id]);
    return r.rows[0] ? map(r.rows[0]) : null;
  }

  /** RN13: `q` filtra por nombre, DNI o número de socio, sin distinguir mayúsculas. */
  async findByTrip(db: Queryable, tripId: string, q?: string): Promise<PassengerRecord[]> {
    const params: unknown[] = [tripId];
    let filter = "";
    if (q) {
      params.push(`%${escapeLike(q)}%`);
      filter = `AND (p.name ILIKE $2 OR p.dni ILIKE $2 OR p.member_number ILIKE $2)`;
    }
    const r = await db.query(`SELECT ${COLUMNS} FROM passengers p WHERE p.trip_id = $1 ${filter} ORDER BY p.created_at ASC, p.id ASC`, params);
    return r.rows.map(map);
  }

  async findActiveByTrip(db: Queryable, tripId: string): Promise<PassengerRecord[]> {
    const r = await db.query(`SELECT ${COLUMNS} FROM passengers p WHERE p.trip_id = $1 AND p.status = 'ACTIVO' ORDER BY p.created_at ASC`, [tripId]);
    return r.rows.map(map);
  }

  async countActiveByTrip(db: Queryable, tripId: string): Promise<number> {
    const r = await db.query("SELECT COUNT(*)::int AS n FROM passengers WHERE trip_id = $1 AND status = 'ACTIVO'", [tripId]);
    return r.rows[0].n;
  }

  async countActiveByUserInTrip(db: Queryable, tripId: string, userId: string): Promise<number> {
    const r = await db.query("SELECT COUNT(*)::int AS n FROM passengers WHERE trip_id = $1 AND user_id = $2 AND status = 'ACTIVO'", [tripId, userId]);
    return r.rows[0].n;
  }

  /** RN10: viajes futuros (Abierto/Completo) distintos donde el usuario tiene lugares activos, sin contar `excludeTripId`. */
  async countFutureTripsOfUser(db: Queryable, userId: string, now: Date, excludeTripId: string): Promise<number> {
    const r = await db.query(
      `SELECT COUNT(DISTINCT p.trip_id)::int AS n
       FROM passengers p JOIN trips t ON t.id = p.trip_id
       WHERE p.user_id = $1 AND p.status = 'ACTIVO' AND t.status IN ('Abierto', 'Completo')
         AND t.departure_at > $2 AND t.id <> $3`,
      [userId, now, excludeTripId]
    );
    return r.rows[0].n;
  }

  async existsActiveDni(db: Queryable, tripId: string, dni: string): Promise<boolean> {
    const r = await db.query("SELECT 1 FROM passengers WHERE trip_id = $1 AND dni = $2 AND status = 'ACTIVO'", [tripId, dni]);
    return (r.rowCount ?? 0) > 0;
  }

  /** RN11: ¿el DNI está activo en otro viaje cuya salida cae en [from, to)? */
  async existsActiveDniInOtherTripBetween(db: Queryable, dni: string, from: Date, to: Date, excludeTripId: string): Promise<boolean> {
    const r = await db.query(
      `SELECT 1 FROM passengers p JOIN trips t ON t.id = p.trip_id
       WHERE p.dni = $1 AND p.status = 'ACTIVO' AND t.id <> $4 AND t.departure_at >= $2 AND t.departure_at < $3
       LIMIT 1`,
      [dni, from, to, excludeTripId]
    );
    return (r.rowCount ?? 0) > 0;
  }

  async insert(db: Queryable, data: { tripId: string; userId: string | null; fields: PassengerFields; payment: PaymentInput }): Promise<PassengerRecord> {
    const { tripId, userId, fields, payment } = data;
    const r = await db.query(
      `INSERT INTO passengers (trip_id, user_id, name, dni, phone, member_number, payment_status, deposit_amount)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING ${COLUMNS.replace(/p\./g, "")}`,
      [tripId, userId, fields.name, fields.dni, fields.phone, fields.memberNumber, payment.paymentStatus, payment.depositAmount]
    );
    return map(r.rows[0]);
  }

  async updatePayment(db: Queryable, id: string, payment: PaymentInput): Promise<PassengerRecord> {
    const r = await db.query(
      `UPDATE passengers p SET payment_status = $2, deposit_amount = $3 WHERE p.id = $1 RETURNING ${COLUMNS}`,
      [id, payment.paymentStatus, payment.depositAmount]
    );
    return map(r.rows[0]);
  }

  async markCancelled(db: Queryable, id: string, refund: number, retained: number, now: Date): Promise<PassengerRecord> {
    const r = await db.query(
      `UPDATE passengers p SET status = 'CANCELADO', refund_amount = $2, retained_amount = $3, cancelled_at = $4
       WHERE p.id = $1 RETURNING ${COLUMNS}`,
      [id, refund, retained, now]
    );
    return map(r.rows[0]);
  }

  /** "Mis lugares": los pasajeros que anotó este usuario, con datos del viaje. */
  async findByUser(db: Queryable, userId: string): Promise<MyPassengerRecord[]> {
    const r = await db.query(
      `SELECT ${COLUMNS}, t.rival AS t_rival, t.stadium AS t_stadium, t.departure_at AS t_departure_at,
              t.meeting_point AS t_meeting_point, t.ticket_price AS t_ticket_price, t.status AS t_status
       FROM passengers p JOIN trips t ON t.id = p.trip_id
       WHERE p.user_id = $1 ORDER BY t.departure_at DESC, p.created_at ASC`,
      [userId]
    );
    return r.rows.map((row) => ({
      ...map(row),
      trip: { rival: row.t_rival, stadium: row.t_stadium, departureAt: row.t_departure_at, meetingPoint: row.t_meeting_point, ticketPrice: Number(row.t_ticket_price), status: row.t_status }
    }));
  }
}
