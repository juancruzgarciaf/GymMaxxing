import { Request, Response } from "express";
import * as entrenamientoService from "../services/entrenamiento.service";

// =========================
// SESION_ENTRENAMIENTO
// =========================

export const iniciarSesionEntrenamiento = async (
  req: Request,
  res: Response
) => {
  try {
    const { usuario_id, rutina_id } = req.body;

    if (!usuario_id || !rutina_id) {
      return res.status(400).json({
        error: "usuario_id y rutina_id son obligatorios",
      });
    }

    const sesion = await entrenamientoService.iniciarSesionEntrenamiento(
      req.body
    );

    return res.status(201).json(sesion);
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Error iniciando sesión de entrenamiento",
    });
  }
};

export const getSesionPorId = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id || Array.isArray(id)) {
      return res.status(400).json({
        error: "id inválido",
      });
    }

    const sesion = await entrenamientoService.getSesionPorId(id);

    if (!sesion) {
      return res.status(404).json({
        error: "Sesión no encontrada",
      });
    }

    return res.json(sesion);
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Error obteniendo sesión",
    });
  }
};

// =========================
// SERIE
// =========================

export const registrarSerie = async (req: Request, res: Response) => {
  try {
    const { repeticiones, orden, ejercicio_id, sesion_id } = req.body;

    if (
      repeticiones == null ||
      orden == null ||
      !ejercicio_id ||
      !sesion_id
    ) {
      return res.status(400).json({
        error:
          "repeticiones, orden, ejercicio_id y sesion_id son obligatorios",
      });
    }

    const serie = await entrenamientoService.registrarSerie(req.body);
    return res.status(201).json(serie);
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Error registrando serie",
    });
  }
};

export const getSeriesDeSesion = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id || Array.isArray(id)) {
      return res.status(400).json({
        error: "id inválido",
      });
    }

    const series = await entrenamientoService.getSeriesDeSesion(id);
    return res.json(series);
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Error obteniendo series de la sesión",
    });
  }
};

export const finalizarSesion = async (req: Request, res: Response) => {
  try {
    const { sesion_id } = req.body;

    if (!sesion_id) {
      return res.status(400).json({
        error: "sesion_id es obligatorio",
      });
    }

    const resultado = await entrenamientoService.finalizarSesion(sesion_id);
    return res.json(resultado);
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Error finalizando sesión",
    });
  }
};