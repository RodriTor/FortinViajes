import { RequestHandler, Router } from "express";
import { asyncHandler } from "../http.js";
import type { TripController } from "../controllers/tripController.js";

export function createTripRoutes(controller: TripController, requireAuth: RequestHandler, requireAdmin: RequestHandler) {
  const router = Router();
  router.get("/", asyncHandler(controller.list));
  router.post("/", requireAuth, requireAdmin, asyncHandler(controller.create));
  router.get("/:id", asyncHandler(controller.get));
  router.patch("/:id/status", requireAuth, requireAdmin, asyncHandler(controller.changeStatus));
  return router;
}
