import { Request, Response } from "express";
import * as rutinaService from "../services/rutina.service";

// =========================
// RUTINA
// =========================

export const crearRutina = async (req: Request, res: Response) => {
  try {
    const { nombre, creador_id } = req.body;

    if (!nombre || !creador_id) {
      return res.status(400).json({
        error: "nombre y creador_id son obligatorios",
      });
    }

    const rutina = await rutinaService.crearRutina(req.body);
    return res.status(201).json(rutina);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Error creando rutina" });
  }
};

export const getRutinas = async (_req: Request, res: Response) => {
  try {
    const rutinas = await rutinaService.getRutinas();
    return res.json(rutinas);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Error obteniendo rutinas" });
  }
};

export const getRutinaPorId = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id || Array.isArray(id)) {
      return res.status(400).json({ error: "id inválido" });
    }

    const rutina = await rutinaService.getRutinaPorId(id);

    if (!rutina) {
      return res.status(404).json({ error: "Rutina no encontrada" });
    }

    return res.json(rutina);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Error obteniendo rutina" });
  }
};

export const updateRutina = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id || Array.isArray(id)) {
      return res.status(400).json({ error: "id inválido" });
    }

    const rutina = await rutinaService.updateRutina(id, req.body);

    if (!rutina) {
      return res.status(404).json({ error: "Rutina no encontrada" });
    }

    return res.json(rutina);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Error actualizando rutina" });
  }
};

export const deleteRutina = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id || Array.isArray(id)) {
      return res.status(400).json({ error: "id inválido" });
    }

    await rutinaService.deleteRutina(id);
    return res.json({ mensaje: "Rutina eliminada" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Error eliminando rutina" });
  }
};

// =========================
// RUTINA_EJERCICIO
// =========================

export const agregarEjercicioARutina = async (
  req: Request,
  res: Response
) => {
  try {
    const {
      id_rutina,
      id_ejercicio,
      series,
      repeticiones,
      descanso,
      orden,
    } = req.body;

    if (
      !id_rutina ||
      !id_ejercicio ||
      series == null ||
      repeticiones == null ||
      descanso == null ||
      orden == null
    ) {
      return res.status(400).json({
        error:
          "id_rutina, id_ejercicio, series, repeticiones, descanso y orden son obligatorios",
      });
    }

    const relacion = await rutinaService.agregarEjercicioARutina(req.body);
    return res.status(201).json(relacion);
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Error agregando ejercicio a rutina",
    });
  }
};

export const getEjerciciosDeRutina = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id || Array.isArray(id)) {
      return res.status(400).json({ error: "id inválido" });
    }

    const ejercicios = await rutinaService.getEjerciciosDeRutina(id);
    return res.json(ejercicios);
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Error obteniendo ejercicios de la rutina",
    });
  }
};

export const updateEjercicioDeRutina = async (
  req: Request,
  res: Response
) => {
  try {
    const { id_rutina, id_ejercicio } = req.params;

    if (
      !id_rutina ||
      Array.isArray(id_rutina) ||
      !id_ejercicio ||
      Array.isArray(id_ejercicio)
    ) {
      return res.status(400).json({
        error: "id_rutina e id_ejercicio inválidos",
      });
    }

    const relacion = await rutinaService.updateEjercicioDeRutina(
      id_rutina,
      id_ejercicio,
      req.body
    );

    if (!relacion) {
      return res.status(404).json({
        error: "Ejercicio de rutina no encontrado",
      });
    }

    return res.json(relacion);
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Error actualizando ejercicio de rutina",
    });
  }
};

export const deleteEjercicioDeRutina = async (
  req: Request,
  res: Response
) => {
  try {
    const { id_rutina, id_ejercicio } = req.params;

    if (
      !id_rutina ||
      Array.isArray(id_rutina) ||
      !id_ejercicio ||
      Array.isArray(id_ejercicio)
    ) {
      return res.status(400).json({
        error: "id_rutina e id_ejercicio inválidos",
      });
    }

    await rutinaService.deleteEjercicioDeRutina(id_rutina, id_ejercicio);

    return res.json({
      mensaje: "Ejercicio eliminado de la rutina",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Error eliminando ejercicio de rutina",
    });
  }
};