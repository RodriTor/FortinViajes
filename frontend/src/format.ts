const TZ = "America/Argentina/Buenos_Aires";
export const money = (n: number) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);
export const dateLong = (iso: string) => new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "long", timeZone: TZ }).format(new Date(iso));
export const timeOnly = (iso: string) => new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: TZ }).format(new Date(iso));
export const dateTime = (iso: string) => `${dateLong(iso)}, ${timeOnly(iso)} h`;
export const dayNumber = (iso: string) => new Intl.DateTimeFormat("es-AR", { day: "numeric", timeZone: TZ }).format(new Date(iso));
export const monthShort = (iso: string) => new Intl.DateTimeFormat("es-AR", { month: "short", timeZone: TZ }).format(new Date(iso)).replace(".", "");
