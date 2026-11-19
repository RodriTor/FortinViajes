// CONTROLLER de viajes: recibe la petición HTTP, llama al Service y devuelve la respuesta. Sin reglas de negocio.
import type { Request, Response } from "express";
import type { TripService } from "../services/tripService.js";

export class TripController {
  constructor(private service: TripService) {}

  list = async (req: Request, res: Response) => {
    res.json({ trips: await this.service.listTrips({ q: req.query.q, status: req.query.status }) });
  };

  get = async (req: Request, res: Response) => {
    res.json({ trip: await this.service.getTrip(req.params.id) });
  };

  create = async (req: Request, res: Response) => {
    res.status(201).json({ trip: await this.service.createTrip(req.user!.id, req.body) });
  };

  changeStatus = async (req: Request, res: Response) => {
    res.json({ trip: await this.service.changeStatus(req.params.id, req.body?.status) });
  };

  summary = async (req: Request, res: Response) => {
    res.json(await this.service.getSummary(req.params.id));
  };
}
