// RN2: datos del pasajero.
import { AppError } from "../errors.js";
import { requireObject } from "./validation.js";

export interface PassengerFields {
  name: string;
  dni: string;
  phone: string;
  memberNumber: string;
}

const PHONE_RE = /^[0-9 +()-]{6,20}$/;
const MEMBER_RE = /^[0-9]{1,10}$/;

function optionalString(value: unknown, label: string): string {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string" && typeof value !== "number") throw new AppError(400, `${label} no es válido`);
  return String(value).trim();
}

export function parsePassengerFields(data: unknown): PassengerFields {
  const body = requireObject(data);
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) throw new AppError(400, "El nombre es obligatorio");
  if (name.length < 2 || name.length > 100) throw new AppError(400, "El nombre debe tener entre 2 y 100 caracteres");

  const dniRaw = typeof body.dni === "number" ? String(body.dni) : typeof body.dni === "string" ? body.dni.trim() : "";
  if (!/^\d{7,8}$/.test(dniRaw)) throw new AppError(400, "El DNI debe tener 7 u 8 dígitos");

  const phone = optionalString(body.phone, "El teléfono");
  if (phone && !PHONE_RE.test(phone)) throw new AppError(400, "El teléfono debe tener entre 6 y 20 caracteres (números, espacios, +, -, paréntesis)");

  const memberNumber = optionalString(body.memberNumber, "El número de socio");
  if (memberNumber && !MEMBER_RE.test(memberNumber)) throw new AppError(400, "El número de socio debe tener solo dígitos (hasta 10)");

  return { name, dni: dniRaw, phone, memberNumber };
}
