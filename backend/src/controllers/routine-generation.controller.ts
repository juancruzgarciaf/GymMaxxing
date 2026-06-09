import { Request, Response } from "express";
import {
  generateRoutineDraftFromPrompt,
  type GenerateRoutineDraftInput,
} from "../services/routine-generation.service";

const parseOptionalString = (value: unknown) => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const parseOptionalPositiveInt = (value: unknown) => {
  if (value == null || value === "") {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
};

export const generateRoutineDraft = async (req: Request, res: Response) => {
  try {
    const authUser = req.authUser;

    if (!authUser) {
      return res.status(401).json({
        error: "No autorizado",
      });
    }

    const prompt = parseOptionalString(req.body.prompt);
    if (!prompt) {
      return res.status(400).json({
        error: "prompt es obligatorio",
      });
    }

    const objetivo = parseOptionalString(req.body.objetivo) ?? undefined;
    const diasPorSemana = parseOptionalPositiveInt(req.body.dias_por_semana);

    if (diasPorSemana === null) {
      return res.status(400).json({
        error: "dias_por_semana debe ser un entero positivo",
      });
    }

    const payload: GenerateRoutineDraftInput = {
      usuarioId: authUser.id,
      prompt,
    };

    if (objetivo) {
      payload.objetivo = objetivo;
    }

    if (diasPorSemana != null) {
      payload.diasPorSemana = diasPorSemana;
    }

    const result = await generateRoutineDraftFromPrompt(payload);
    return res.json(result);
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Error generando borrador de rutina",
    });
  }
};
