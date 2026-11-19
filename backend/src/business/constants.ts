// Constantes de negocio (ver docs/spec.md). Un solo lugar para no repetir números mágicos.

export const TRIP_STATUSES = ["Abierto", "Completo", "En Viaje", "Finalizado", "Cancelado"] as const;
export type TripStatus = (typeof TRIP_STATUSES)[number];

export const PAYMENT_STATUSES = ["Pendiente", "Señado", "Pagado"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export type PassengerStatus = "ACTIVO" | "CANCELADO";
export type Role = "USER" | "ADMIN";

export const DEFAULT_DEPOSIT_RATIO = 0.5; // RN4
export const REGISTRATION_CLOSE_HOURS = 3; // RN8
export const FULL_REFUND_HOURS = 24; // RN9
export const MIN_CANCEL_HOURS = 6; // RN9
export const MAX_SEATS_PER_USER_PER_TRIP = 4; // RN10
export const MAX_ACTIVE_TRIPS_PER_USER = 3; // RN10
export const MAX_CAPACITY = 100; // RN7
export const MAX_PRICE = 99_999_999; // numeric(12,2) con margen
