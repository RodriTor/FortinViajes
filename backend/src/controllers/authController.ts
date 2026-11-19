// CONTROLLER: recibe la petición HTTP, llama al Service y devuelve la respuesta. Sin reglas de negocio.
import type { Request, Response } from "express";
import type { AuthService } from "../services/authService.js";

export class AuthController {
  constructor(private service: AuthService) {}

  register = async (req: Request, res: Response) => {
    res.status(201).json(await this.service.register(req.body));
  };

  login = async (req: Request, res: Response) => {
    res.json(await this.service.login(req.body));
  };

  me = async (req: Request, res: Response) => {
    res.json({ user: req.user });
  };
}
