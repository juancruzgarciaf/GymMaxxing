import { Request, Response } from "express";
import * as gimnasioService from "../services/gimnasio.service";

export const getGimnasiosCercanos = async (req: Request, res: Response) => {
  try {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);

    if (req.query.lat == null || req.query.lng == null) {
      return res.status(400).json({
        error: "lat y lng son obligatorios",
      });
    }

    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return res.status(400).json({
        error: "lat y lng deben ser numeros validos",
      });
    }

    const gimnasios = await gimnasioService.getGimnasiosCercanos(lat, lng);
    return res.json(gimnasios);
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Error obteniendo gimnasios cercanos",
    });
  }
};
