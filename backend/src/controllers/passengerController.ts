// CONTROLLER de pasajeros: recibe la petición HTTP, llama al Service y devuelve la respuesta. Sin reglas de negocio.
import type { Request, Response } from "express";
import type { PassengerService } from "../services/passengerService.js";

export class PassengerController {
  constructor(private service: PassengerService) {}

  add = async (req: Request, res: Response) => {
    res.status(201).json(await this.service.addPassenger(req.user!, req.params.tripId, req.body));
  };

  cancel = async (req: Request, res: Response) => {
    res.json(await this.service.cancelPassenger(req.user!, req.params.tripId, req.params.passengerId));
  };

  updatePayment = async (req: Request, res: Response) => {
    res.json(await this.service.updatePayment(req.params.tripId, req.params.passengerId, req.body));
  };
}
