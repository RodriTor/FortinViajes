// Arma la app: conecta Repository → Service → Controller → Routes.
import cors from "cors";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import type { Config } from "./config.js";
import type { Database } from "./db.js";
import { AppError } from "./errors.js";
import { createAuthMiddleware } from "./middleware/auth.js";
import { UserRepository } from "./repositories/userRepository.js";
import { AuthService } from "./services/authService.js";
import { AuthController } from "./controllers/authController.js";
import { PassengerRepository } from "./repositories/passengerRepository.js";
import { TripRepository } from "./repositories/tripRepository.js";
import { TripService } from "./services/tripService.js";
import { TripController } from "./controllers/tripController.js";
import { createTripRoutes } from "./routes/tripRoutes.js";
import { PassengerService } from "./services/passengerService.js";
import { PassengerController } from "./controllers/passengerController.js";
import { createPassengerRoutes } from "./routes/passengerRoutes.js";
import { createAuthRoutes } from "./routes/authRoutes.js";

export function createApp(db: Database, config: Config, clock: () => Date = () => new Date()) {
  const app = express();
  app.set("trust proxy", 1); // Render/Netlify están detrás de un proxy
  app.use(helmet());
  app.use(
    cors({
      origin: (origin, callback) => callback(null, !origin || config.frontendUrls.includes(origin)),
      methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"]
    })
  );
  app.use(express.json({ limit: "20kb" }));

  const userRepo = new UserRepository();
  const authService = new AuthService(db, userRepo, config.jwtSecret);
  const { requireAuth, requireAdmin } = createAuthMiddleware(authService);
  const tripRepo = new TripRepository();
  const passengerRepo = new PassengerRepository();
  const tripService = new TripService(db, tripRepo, passengerRepo, clock);
  const passengerService = new PassengerService(db, tripRepo, passengerRepo, clock);

  const api = express.Router();
  api.get("/health", async (_req, res) => {
    try {
      await db.query("SELECT 1");
      res.json({ status: "ok", service: "FortínViajes API", database: "ok" });
    } catch {
      res.status(503).json({ status: "error", service: "FortínViajes API", database: "error" });
    }
  });
  api.use("/auth", rateLimit({ windowMs: 15 * 60 * 1000, limit: config.authRateLimit, standardHeaders: true, legacyHeaders: false, message: { error: "Demasiados intentos. Probá de nuevo en unos minutos." } }));
  api.use("/auth", createAuthRoutes(new AuthController(authService), requireAuth));
  api.use("/trips", createTripRoutes(new TripController(tripService), requireAuth, requireAdmin));
  api.use("/", createPassengerRoutes(new PassengerController(passengerService), requireAuth, requireAdmin));
  app.use("/api", api);

  app.use("/api", (_req, _res, next) => next(new AppError(404, "Ruta no encontrada")));

  // Manejo de errores central: convierte AppError en respuesta HTTP y oculta detalles internos.
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err instanceof AppError) return res.status(err.status).json({ error: err.message });
    if (err?.type === "entity.parse.failed") return res.status(400).json({ error: "JSON inválido" });
    if (err?.type === "entity.too.large") return res.status(413).json({ error: "El cuerpo de la solicitud es demasiado grande" });
    console.error(err);
    res.status(500).json({ error: "Ocurrió un error interno. Intentá nuevamente." });
  });

  return app;
}
