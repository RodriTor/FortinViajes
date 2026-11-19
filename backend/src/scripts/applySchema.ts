// Aplica backend/sql/schema.sql a la base de DATABASE_URL (idempotente).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "../config.js";
import { Database } from "../db.js";

const config = loadConfig();
const db = new Database(config.databaseUrl, config.isProduction);
const sql = fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../sql/schema.sql"), "utf-8");
try {
  await db.query(sql);
  console.log("Esquema aplicado correctamente.");
} finally {
  await db.close();
}
