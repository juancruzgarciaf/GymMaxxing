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

    if (error instanceof Error) {
      if (
        error.message.includes('"status":"RESOURCE_EXHAUSTED"') ||
        error.message.includes('"code":429') ||
        error.message.toLowerCase().includes("quota exceeded")
      ) {
        return res.status(429).json({
          error: "Se agotó la cuota de Gemini para esta API key. Espera un poco o usa otra key/proyecto con cuota disponible.",
        });
      }

      if (
        error.message.includes('"status":"UNAVAILABLE"') ||
        error.message.includes('"code":503') ||
        error.message.includes("high demand") ||
        error.message.includes("fetch failed") ||
        error.message.includes("ECONNRESET") ||
        error.message.includes("ENOTFOUND") ||
        error.message.includes("ETIMEDOUT")
      ) {
        return res.status(503).json({
          error: "No se pudo conectar con Gemini en este momento. Intenta de nuevo en unos minutos.",
        });
      }

      if (
        error.message.includes("GEMINI_API_KEY") ||
        error.message.includes("Gemini no esta configurado")
      ) {
        return res.status(503).json({
          error: "Gemini no esta configurado en el backend",
        });
      }

      if (
        error.message.includes("Solo hago rutinas") ||
        error.message.includes("no parece una rutina")
      ) {
        return res.status(400).json({
          error: "Solo hago rutinas. Pedime una rutina o entrenamiento y la armo.",
        });
      }

      if (
        error.message.includes("Gemini devolvio un JSON invalido") ||
        error.message.includes("Gemini no devolvio contenido") ||
        error.message.includes("Unexpected end of JSON input") ||
        error.message.includes("Unterminated string in JSON")
      ) {
        return res.status(502).json({
          error: "Gemini devolvio una respuesta invalida para la rutina",
        });
      }

      if (
        error.message.includes("no contiene ejercicios validos") ||
        error.message.includes("No se pudo crear la rutina generada por Gemini") ||
        error.message.includes("No hay ejercicios cargados en GymMaxxing") ||
        error.message.includes("No se pudo crear una rutina valida de GymMaxxing")
      ) {
        return res.status(422).json({
          error: error.message.includes("No hay ejercicios cargados en GymMaxxing")
            ? "No hay ejercicios cargados en GymMaxxing todavía. Carga ejercicios primero para poder generar rutinas con Gemini."
            : error.message.includes("No se pudo crear una rutina valida de GymMaxxing")
            ? "No se pudo convertir el pedido en una rutina valida con el catalogo actual de GymMaxxing."
            : "Gemini devolvio ejercicios que no coinciden bien con el catalogo de GymMaxxing. Intenta de nuevo con un pedido mas concreto.",
        });
      }
    }

    return res.status(500).json({
      error: "Error generando rutina estructurada con Gemini",
    });
  }
};
