// RN12: autenticación por JWT y autorización por rol. El rol se lee de la base en cada pedido,
// así que promover o dar de baja a un usuario tiene efecto inmediato.
import type { NextFunction, Request, Response } from "express";
import { AppError } from "../errors.js";
import type { AuthService, PublicUser } from "../services/authService.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: PublicUser;
    }
  }
}

export function createAuthMiddleware(auth: AuthService) {
  const requireAuth = async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const header = req.headers.authorization ?? "";
      const token = header.replace(/^Bearer\s+/i, "");
      if (!token) throw new AppError(401, "Iniciá sesión para continuar");
      req.user = await auth.me(auth.verify(token));
      next();
    } catch (e) {
      next(e);
    }
  };

  const requireAdmin = (req: Request, _res: Response, next: NextFunction) => {
    if (req.user?.role !== "ADMIN") return next(new AppError(403, "Se requiere permiso de organizador"));
    next();
  };

  return { requireAuth, requireAdmin };
}
