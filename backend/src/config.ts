import "dotenv/config";

export interface Config {
  port: number;
  databaseUrl: string;
  jwtSecret: string;
  frontendUrls: string[];
  isProduction: boolean;
  authRateLimit: number;
}

const DEV_SECRET = "solo-desarrollo-no-usar-en-produccion";

/** Lee y valida las variables de entorno. En producción exige un JWT_SECRET propio y largo. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const isProduction = env.NODE_ENV === "production";
  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) throw new Error("Falta configurar DATABASE_URL.");

  let jwtSecret = env.JWT_SECRET;
  if (!jwtSecret) {
    if (isProduction) throw new Error("Falta configurar JWT_SECRET en producción.");
    console.warn("[config] JWT_SECRET no definido: usando un secreto de desarrollo.");
    jwtSecret = DEV_SECRET;
  }
  if (isProduction && jwtSecret.length < 32) throw new Error("JWT_SECRET debe tener al menos 32 caracteres en producción.");

  return {
    port: Number(env.PORT || 3000),
    databaseUrl,
    jwtSecret,
    frontendUrls: (env.FRONTEND_URL || "http://localhost:5173").split(",").map((s) => s.trim().replace(/\/+$/, "")).filter(Boolean),
    isProduction,
    authRateLimit: Number(env.AUTH_RATE_LIMIT || 30)
  };
}
