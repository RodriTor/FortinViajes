// SERVICE de autenticación (RN12): registro, ingreso y sesión.
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { Database } from "../db.js";
import { AppError } from "../errors.js";
import type { Role } from "../business/constants.js";
import { requireObject } from "../business/validation.js";
import { UserRecord, UserRepository } from "../repositories/userRepository.js";

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// Hash de relleno para que el login tarde parecido exista o no el email (evita enumerar usuarios).
const DUMMY_HASH = bcrypt.hashSync("relleno-no-es-una-clave", 10);

export function toPublicUser(u: UserRecord): PublicUser {
  return { id: u.id, name: u.name, email: u.email, role: u.role };
}

export class AuthService {
  constructor(private db: Database, private users: UserRepository, private jwtSecret: string) {}

  sign(user: PublicUser): string {
    return jwt.sign({ sub: user.id }, this.jwtSecret, { expiresIn: "7d" });
  }

  /** Devuelve el id del usuario del token, o lanza 401 (RN12: sesión vencida o inválida). */
  verify(token: string): string {
    try {
      const payload = jwt.verify(token, this.jwtSecret) as jwt.JwtPayload;
      if (typeof payload.sub !== "string") throw new Error("sin sub");
      return payload.sub;
    } catch (e) {
      const expired = e instanceof jwt.TokenExpiredError;
      throw new AppError(401, expired ? "La sesión venció. Volvé a ingresar." : "Sesión inválida. Volvé a ingresar.");
    }
  }

  async register(data: unknown): Promise<{ user: PublicUser; token: string }> {
    const body = requireObject(data);
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (name.length < 2 || name.length > 100) throw new AppError(400, "El nombre debe tener entre 2 y 100 caracteres");
    if (!EMAIL_RE.test(email) || email.length > 255) throw new AppError(400, "El email no es válido");
    if (password.length < 8) throw new AppError(400, "La contraseña debe tener al menos 8 caracteres");
    if (Buffer.byteLength(password) > 72) throw new AppError(400, "La contraseña no puede superar los 72 caracteres");

    if (await this.users.findByEmail(this.db, email)) throw new AppError(409, "Ya existe una cuenta con ese email");
    const passwordHash = await bcrypt.hash(password, 12);
    try {
      const user = toPublicUser(await this.users.create(this.db, { name, email, passwordHash }));
      return { user, token: this.sign(user) };
    } catch (e: any) {
      if (e?.code === "23505") throw new AppError(409, "Ya existe una cuenta con ese email");
      throw e;
    }
  }

  async login(data: unknown): Promise<{ user: PublicUser; token: string }> {
    const body = requireObject(data);
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const record = email ? await this.users.findByEmail(this.db, email) : null;
    const ok = await bcrypt.compare(password, record?.passwordHash ?? DUMMY_HASH);
    if (!record || !ok) throw new AppError(401, "Email o contraseña incorrectos");
    const user = toPublicUser(record);
    return { user, token: this.sign(user) };
  }

  async me(userId: string): Promise<PublicUser> {
    const record = await this.users.findById(this.db, userId);
    if (!record) throw new AppError(401, "Sesión inválida. Volvé a ingresar.");
    return toPublicUser(record);
  }
}
