import { RequestHandler, Router } from "express";
import { asyncHandler } from "../http.js";
import type { PassengerController } from "../controllers/passengerController.js";

/** Rutas de pasajeros. Se montan en la raíz de /api porque cuelgan de /trips/:tripId y de /passengers. */
export function createPassengerRoutes(controller: PassengerController, requireAuth: RequestHandler, requireAdmin: RequestHandler) {
  const router = Router();
  router.post("/trips/:tripId/passengers", requireAuth, asyncHandler(controller.add));
  router.patch("/trips/:tripId/passengers/:passengerId/cancel", requireAuth, asyncHandler(controller.cancel));
  router.patch("/trips/:tripId/passengers/:passengerId/payment", requireAuth, requireAdmin, asyncHandler(controller.updatePayment));
  return router;
}
