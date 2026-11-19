import { RequestHandler, Router } from "express";
import { asyncHandler } from "../http.js";
import type { AuthController } from "../controllers/authController.js";

export function createAuthRoutes(controller: AuthController, requireAuth: RequestHandler) {
  const router = Router();
  router.post("/register", asyncHandler(controller.register));
  router.post("/login", asyncHandler(controller.login));
  router.get("/me", requireAuth, asyncHandler(controller.me));
  return router;
}
