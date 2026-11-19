// Utilidades para los tests de integración: base PostgreSQL real, app Express real y reloj controlable.
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import jwt from "jsonwebtoken";
import { createApp } from "../../src/app.js";
import type { Config } from "../../src/config.js";
import { Database } from "../../src/db.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
export const SKIP_REASON = "Definí TEST_DATABASE_URL (una base de datos vacía y exclusiva para tests) para correr los tests de integración";
export const JWT_SECRET = "secreto-solo-para-tests-0123456789abcdef";
export const HOUR = 3_600_000;

export interface Ctx {
  db: Database;
  server: Server;
  now: Date;
  setNow(d: Date): void;
  reset(): Promise<void>;
  close(): Promise<void>;
  call(method: string, urlPath: string, opts?: { token?: string; body?: unknown; raw?: string }): Promise<{ status: number; body: any }>;
  register(name: string, email: string): Promise<{ token: string; id: string }>;
  admin(): Promise<string>;
  createTrip(adminToken: string, over?: Record<string, unknown>): Promise<any>;
  addPassenger(token: string, tripId: string, over?: Record<string, unknown>): Promise<{ status: number; body: any }>;
}

export async function createContext(): Promise<Ctx> {
  const url = TEST_DATABASE_URL!;
  // Los tests borran todo el contenido: nunca correrlos contra una base que no sea de pruebas.
  const dbName = (/\/([^/?]+)(?:\?|$)/.exec(url.replace(/^[a-z]+:\/\/[^/]*/i, "")) ?? [])[1] ?? url.replace(/^[a-z]+:\/\/[^/]*\//i, "").split("?")[0];
  if (!/test/i.test(dbName)) throw new Error(`TEST_DATABASE_URL apunta a "${dbName}": el nombre debe incluir "test" para evitar borrar datos reales.`);

  const db = new Database(url);
  const schema = fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../sql/schema.sql"), "utf-8");
  await db.query(schema);

  const config: Config = { port: 0, databaseUrl: url, jwtSecret: JWT_SECRET, frontendUrls: ["http://localhost:5173"], isProduction: false, authRateLimit: 100000 };
  const ctx = { now: new Date("2026-11-18T12:00:00Z") } as Ctx;
  const app = createApp(db, config, () => ctx.now);
  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  let counter = 0;

  Object.assign(ctx, {
    db,
    server,
    setNow(d: Date) { ctx.now = d; },
    async reset() {
      await db.query("TRUNCATE passengers, trips, users CASCADE");
      ctx.now = new Date("2026-11-18T12:00:00Z");
    },
    async close() {
      await new Promise<void>((r) => server.close(() => r()));
      await db.close();
    },
    async call(method: string, urlPath: string, opts: { token?: string; body?: unknown; raw?: string } = {}) {
      const res = await fetch(base + urlPath, {
        method,
        headers: { "Content-Type": "application/json", ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}) },
        body: opts.raw ?? (opts.body === undefined ? undefined : JSON.stringify(opts.body))
      });
      const text = await res.text();
      let body: any = null;
      try { body = text ? JSON.parse(text) : null; } catch { body = text; }
      return { status: res.status, body };
    },
    async register(name: string, email: string) {
      const r = await ctx.call("POST", "/auth/register", { body: { name, email, password: "clave-segura-123" } });
      if (r.status !== 201) throw new Error(`register falló: ${JSON.stringify(r.body)}`);
      return { token: r.body.token as string, id: r.body.user.id as string };
    },
    async admin() {
      const u = await ctx.register("Organizador", `org${++counter}@test.com`);
      await db.query("UPDATE users SET role = 'ADMIN' WHERE id = $1", [u.id]);
      return u.token;
    },
    async createTrip(adminToken: string, over: Record<string, unknown> = {}) {
      const r = await ctx.call("POST", "/trips", {
        token: adminToken,
        body: { rival: "San Lorenzo", stadium: "Estadio José Amalfitani", departureDateTime: new Date(ctx.now.getTime() + 100 * HOUR).toISOString(), meetingPoint: "Sede Liniers", ticketPrice: 10000, capacity: 2, ...over }
      });
      if (r.status !== 201) throw new Error(`createTrip falló: ${JSON.stringify(r.body)}`);
      return r.body.trip;
    },
    async addPassenger(token: string, tripId: string, over: Record<string, unknown> = {}) {
      return ctx.call("POST", `/trips/${tripId}/passengers`, { token, body: { name: "Lucas", dni: String(30000000 + ++counter), ...over } });
    }
  });
  return ctx;
}

/** Token con una fecha de vencimiento ya pasada, firmado con el mismo secreto. */
export function expiredToken(userId: string): string {
  return jwt.sign({ sub: userId, exp: Math.floor(Date.now() / 1000) - 60 }, JWT_SECRET);
}
