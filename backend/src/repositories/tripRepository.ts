// REPOSITORY de viajes: único lugar que conoce el SQL de la tabla trips.
import type { Queryable } from "../db.js";
import type { TripStatus } from "../business/constants.js";
import type { TripInput } from "../business/tripRules.js";

export interface TripRecord {
  id: string;
  rival: string;
  stadium: string;
  departureAt: Date;
  meetingPoint: string;
  ticketPrice: number;
  capacity: number;
  status: TripStatus;
  seatsOccupied: number;
}

const SELECT = `
  SELECT t.id, t.rival, t.stadium, t.departure_at, t.meeting_point, t.ticket_price, t.capacity, t.status,
         (SELECT COUNT(*) FROM passengers p WHERE p.trip_id = t.id AND p.status = 'ACTIVO')::int AS seats_occupied
  FROM trips t`;

function map(row: any): TripRecord {
  return {
    id: row.id,
    rival: row.rival,
    stadium: row.stadium,
    departureAt: row.departure_at,
    meetingPoint: row.meeting_point,
    ticketPrice: Number(row.ticket_price),
    capacity: row.capacity,
    status: row.status,
    seatsOccupied: row.seats_occupied
  };
}

const escapeLike = (s: string) => s.replace(/[\\%_]/g, "\\$&");

export class TripRepository {
  async findAll(db: Queryable, filters: { q?: string; status?: string } = {}): Promise<TripRecord[]> {
    const where: string[] = [];
    const params: unknown[] = [];
    if (filters.q) {
      params.push(`%${escapeLike(filters.q)}%`);
      where.push(`(t.rival ILIKE $${params.length} OR t.stadium ILIKE $${params.length})`);
    }
    if (filters.status) {
      params.push(filters.status);
      where.push(`t.status = $${params.length}`);
    }
    const sql = `${SELECT} ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY t.departure_at ASC, t.id ASC`;
    return (await db.query(sql, params)).rows.map(map);
  }

  /** Con `forUpdate` bloquea la fila hasta el fin de la transacción (serializa cambios sobre el viaje, RN1). */
  async findById(db: Queryable, id: string, opts: { forUpdate?: boolean } = {}): Promise<TripRecord | null> {
    if (opts.forUpdate) {
      // FOR UPDATE no admite subconsultas agregadas en la misma consulta: se bloquea primero y se lee después.
      const locked = await db.query("SELECT id FROM trips WHERE id = $1 FOR UPDATE", [id]);
      if (!locked.rowCount) return null;
    }
    const r = await db.query(`${SELECT} WHERE t.id = $1`, [id]);
    return r.rows[0] ? map(r.rows[0]) : null;
  }

  async create(db: Queryable, input: TripInput, createdBy: string): Promise<string> {
    const r = await db.query(
      `INSERT INTO trips (rival, stadium, departure_at, meeting_point, ticket_price, capacity, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [input.rival, input.stadium, input.departureAt, input.meetingPoint, input.ticketPrice, input.capacity, createdBy]
    );
    return r.rows[0].id;
  }

  async updateStatus(db: Queryable, id: string, status: TripStatus): Promise<void> {
    await db.query("UPDATE trips SET status = $2, updated_at = NOW() WHERE id = $1", [id, status]);
  }
}
