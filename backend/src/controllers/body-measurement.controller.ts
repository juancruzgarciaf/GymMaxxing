import { Request, Response } from "express";
import {
  BodyMeasurementInput,
  deleteBodyMeasurement,
  listBodyMeasurements,
  saveBodyMeasurement,
} from "../services/body-measurement.service";

const parseOptionalNumber = (value: unknown) => {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : Number.NaN;
};

export const getMyBodyMeasurements = async (req: Request, res: Response) => {
  try {
    return res.json(await listBodyMeasurements(req.authUser!.id));
  } catch (error) {
    console.error("ERROR GET BODY MEASUREMENTS:", error);
    return res.status(500).json({ error: "No se pudieron obtener las medidas" });
  }
};

export const upsertMyBodyMeasurement = async (req: Request, res: Response) => {
  try {
    const input: BodyMeasurementInput = {
      fecha: typeof req.body.fecha === "string" ? req.body.fecha : undefined,
      nota: typeof req.body.nota === "string" ? req.body.nota : null,
    };

    for (const field of ["peso", "cintura", "pecho", "brazo", "cadera", "muslo"] as const) {
      const value = parseOptionalNumber(req.body[field]);
      if (Number.isNaN(value)) {
        return res.status(400).json({ error: `${field} debe ser mayor a cero` });
      }
      input[field] = value;
    }

    return res.status(201).json(await saveBodyMeasurement(req.authUser!.id, input));
  } catch (error) {
    console.error("ERROR SAVE BODY MEASUREMENT:", error);
    return res.status(400).json({
      error: error instanceof Error ? error.message : "No se pudo guardar la medida",
    });
  }
};

export const removeMyBodyMeasurement = async (req: Request, res: Response) => {
  try {
    const measurementId = Number(req.params.id);
    if (!Number.isInteger(measurementId) || measurementId <= 0) {
      return res.status(400).json({ error: "id invalido" });
    }
    if (!(await deleteBodyMeasurement(req.authUser!.id, measurementId))) {
      return res.status(404).json({ error: "Medida no encontrada" });
    }
    return res.json({ deleted: true });
  } catch (error) {
    console.error("ERROR DELETE BODY MEASUREMENT:", error);
    return res.status(500).json({ error: "No se pudo borrar la medida" });
  }
};
