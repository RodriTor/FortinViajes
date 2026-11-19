// Acceso a PostgreSQL. Los repositorios reciben un `Queryable` (el pool o una conexión dentro de una transacción).
import pg from "pg";

export interface Queryable {
  query<R extends pg.QueryResultRow = any>(text: string, params?: unknown[]): Promise<pg.QueryResult<R>>;
}

export class Database implements Queryable {
  readonly pool: pg.Pool;

  constructor(connectionString: string, isProduction = false) {
    // Neon ya incluye ?sslmode=require en su cadena; si falta y estamos en producción, se exige TLS.
    const ssl = isProduction && !/sslmode=/.test(connectionString) ? { rejectUnauthorized: true } : undefined;
    this.pool = new pg.Pool({ connectionString, ssl, max: 10, connectionTimeoutMillis: 10_000 });
  }

  query<R extends pg.QueryResultRow = any>(text: string, params?: unknown[]) {
    return this.pool.query<R>(text, params as any[]);
  }

  /** Ejecuta `fn` dentro de una transacción: COMMIT si termina bien, ROLLBACK si lanza. */
  async tx<T>(fn: (tx: Queryable) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await fn(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  close() {
    return this.pool.end();
  }
}
