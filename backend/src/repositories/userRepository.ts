// REPOSITORY de usuarios: único lugar que conoce el SQL de la tabla users.
import type { Queryable } from "../db.js";
import type { Role } from "../business/constants.js";

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
  createdAt: Date;
}

const COLUMNS = `id, name, email, password_hash AS "passwordHash", role, created_at AS "createdAt"`;

export class UserRepository {
  async findByEmail(db: Queryable, email: string): Promise<UserRecord | null> {
    const r = await db.query<UserRecord>(`SELECT ${COLUMNS} FROM users WHERE email = $1`, [email]);
    return r.rows[0] ?? null;
  }

  async findById(db: Queryable, id: string): Promise<UserRecord | null> {
    const r = await db.query<UserRecord>(`SELECT ${COLUMNS} FROM users WHERE id = $1`, [id]);
    return r.rows[0] ?? null;
  }

  /** Siempre crea rol USER: el organizador se promueve por fuera de la API pública (RN12). */
  async create(db: Queryable, data: { name: string; email: string; passwordHash: string }): Promise<UserRecord> {
    const r = await db.query<UserRecord>(
      `INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING ${COLUMNS}`,
      [data.name, data.email, data.passwordHash]
    );
    return r.rows[0];
  }

  async upsertAdmin(db: Queryable, data: { name: string; email: string; passwordHash: string }): Promise<UserRecord> {
    const r = await db.query<UserRecord>(
      `INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, 'ADMIN')
       ON CONFLICT (email) DO UPDATE SET role = 'ADMIN', password_hash = EXCLUDED.password_hash, name = EXCLUDED.name
       RETURNING ${COLUMNS}`,
      [data.name, data.email, data.passwordHash]
    );
    return r.rows[0];
  }
}
