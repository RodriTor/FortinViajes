// Crea (o promueve) un organizador. Uso:
//   npm run create-admin -w backend -- organizador@mail.com "ClaveSegura123" "Nombre Apellido"
// o con variables ADMIN_EMAIL, ADMIN_PASSWORD y ADMIN_NAME. Requiere DATABASE_URL.
import bcrypt from "bcryptjs";
import { loadConfig } from "../config.js";
import { Database } from "../db.js";
import { UserRepository } from "../repositories/userRepository.js";

const [argEmail, argPassword, argName] = process.argv.slice(2);
const email = (argEmail ?? process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
const password = argPassword ?? process.env.ADMIN_PASSWORD ?? "";
const name = (argName ?? process.env.ADMIN_NAME ?? "Organizador").trim();

if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || password.length < 8) {
  console.error('Uso: npm run create-admin -w backend -- <email> <contraseña de 8+ caracteres> ["Nombre"]');
  process.exit(1);
}

const config = loadConfig();
const db = new Database(config.databaseUrl, config.isProduction);
try {
  const user = await new UserRepository().upsertAdmin(db, { name, email, passwordHash: await bcrypt.hash(password, 12) });
  console.log(`Organizador listo: ${user.email} (rol ${user.role})`);
} finally {
  await db.close();
}
