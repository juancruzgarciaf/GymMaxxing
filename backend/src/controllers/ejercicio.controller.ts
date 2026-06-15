import { Request, Response } from "express";
import fs from "fs/promises";
import path from "path";
import { pool } from "../db";
import { isUserPro } from "../services/subscription.service";
import { uploadedFileUrl } from "../middleware/upload.middleware";

export const getEjercicios = async (req: Request, res: Response) => {
  try {
    const userId = req.authUser?.id;
    const result = await pool.query(
      `SELECT e.*
       FROM ejercicio e
       WHERE COALESCE(e.es_personalizado, FALSE) = FALSE
          OR ($1::int IS NOT NULL AND e.creador_id = $1)
       ORDER BY e.es_personalizado ASC, e.nombre ASC`,
      [userId ?? null],
    );
    return res.json(result.rows);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Error al obtener ejercicios" });
  }
};

export const getMisEjerciciosPersonalizados = async (
  req: Request,
  res: Response,
) => {
  try {
    const [result, pro] = await Promise.all([
      pool.query(
        `SELECT *
         FROM ejercicio
         WHERE creador_id = $1 AND es_personalizado = TRUE
         ORDER BY nombre ASC`,
        [req.authUser!.id],
      ),
      isUserPro(req.authUser!.id),
    ]);

    return res.json({
      items: result.rows,
      count: result.rowCount ?? 0,
      limit: pro ? null : 10,
      isPro: pro,
    });
  } catch (error) {
    console.error("ERROR GET CUSTOM EXERCISES:", error);
    return res.status(500).json({ error: "No se pudieron obtener tus ejercicios" });
  }
};

export const crearEjercicioPersonalizado = async (
  req: Request,
  res: Response,
) => {
  try {
    const nombre = typeof req.body.nombre === "string" ? req.body.nombre.trim() : "";
    const descripcion =
      typeof req.body.descripcion === "string" ? req.body.descripcion.trim() : "";
    const grupoMuscular =
      typeof req.body.grupo_muscular === "string"
        ? req.body.grupo_muscular.trim()
        : "";
    const tipoDisciplina =
      typeof req.body.tipo_disciplina === "string"
        ? req.body.tipo_disciplina.trim()
        : "";

    if (!nombre || !grupoMuscular) {
      return res.status(400).json({
        error: "nombre y grupo_muscular son obligatorios",
      });
    }

    const result = await pool.query(
      `INSERT INTO ejercicio
         (nombre, descripcion, grupo_muscular, tipo_disciplina, creador_id, es_personalizado)
       VALUES ($1, $2, $3, $4, $5, TRUE)
       RETURNING *`,
      [
        nombre,
        descripcion || null,
        grupoMuscular,
        tipoDisciplina || "Personalizado",
        req.authUser!.id,
      ],
    );
    return res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("ERROR CREATE CUSTOM EXERCISE:", error);
    return res.status(500).json({ error: "No se pudo crear el ejercicio" });
  }
};

export const borrarEjercicioPersonalizado = async (
  req: Request,
  res: Response,
) => {
  try {
    const exerciseId = Number(req.params.id);
    if (!Number.isInteger(exerciseId) || exerciseId <= 0) {
      return res.status(400).json({ error: "id invalido" });
    }
    const result = await pool.query(
      `DELETE FROM ejercicio
       WHERE id_ejercicio = $1
         AND creador_id = $2
         AND es_personalizado = TRUE
       RETURNING id_ejercicio`,
      [exerciseId, req.authUser!.id],
    );
    if (result.rowCount !== 1) {
      return res.status(404).json({ error: "Ejercicio no encontrado" });
    }
    return res.json({ deleted: true });
  } catch (error) {
    console.error("ERROR DELETE CUSTOM EXERCISE:", error);
    return res.status(409).json({
      error: "No se puede borrar un ejercicio que ya esta siendo utilizado",
    });
  }
};

export const uploadExerciseImage = async (req: Request, res: Response) => {
  try {
    const exerciseId = Number(req.params.id);
    if (!Number.isInteger(exerciseId) || !req.authUser) {
      return res.status(400).json({ error: "Ejercicio invalido" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "Selecciona una imagen" });
    }

    const exerciseResult = await pool.query(
      `SELECT id_ejercicio, creador_id
       FROM ejercicio
       WHERE id_ejercicio = $1`,
      [exerciseId],
    );
    const exercise = exerciseResult.rows[0];

    if (!exercise) {
      return res.status(404).json({ error: "Ejercicio no encontrado" });
    }

    const isOfficialAdmin = req.authUser.email.trim().toLowerCase() === "admin@gmail.com";
    const isCreator = Number(exercise.creador_id) === req.authUser.id;
    if (!isOfficialAdmin && !isCreator) {
      return res.status(403).json({
        error: "Solo el creador o el administrador puede cambiar esta imagen",
      });
    }

    const imageUrl = uploadedFileUrl("exercises", req.file.filename);
    const result = await pool.query(
      `UPDATE ejercicio
       SET imagen_url = $2
       WHERE id_ejercicio = $1
       RETURNING *`,
      [exerciseId, imageUrl],
    );

    return res.json(result.rows[0]);
  } catch (error) {
    console.error("ERROR UPLOAD EXERCISE IMAGE:", error);
    return res.status(500).json({ error: "No se pudo guardar la imagen" });
  }
};

export const deleteExerciseImage = async (req: Request, res: Response) => {
  try {
    const exerciseId = Number(req.params.id);
    if (!Number.isInteger(exerciseId) || !req.authUser) {
      return res.status(400).json({ error: "Ejercicio invalido" });
    }

    const exerciseResult = await pool.query(
      `SELECT id_ejercicio, creador_id, imagen_url
       FROM ejercicio
       WHERE id_ejercicio = $1`,
      [exerciseId],
    );
    const exercise = exerciseResult.rows[0];

    if (!exercise) {
      return res.status(404).json({ error: "Ejercicio no encontrado" });
    }

    const isOfficialAdmin = req.authUser.email.trim().toLowerCase() === "admin@gmail.com";
    const isCreator = Number(exercise.creador_id) === req.authUser.id;
    if (!isOfficialAdmin && !isCreator) {
      return res.status(403).json({
        error: "Solo el creador o el administrador puede eliminar esta imagen",
      });
    }

    await pool.query(
      `UPDATE ejercicio
       SET imagen_url = NULL
       WHERE id_ejercicio = $1`,
      [exerciseId],
    );

    const imageUrl = typeof exercise.imagen_url === "string" ? exercise.imagen_url : "";
    if (imageUrl.startsWith("/uploads/exercises/")) {
      const uploadsDirectory = path.resolve(__dirname, "../../uploads/exercises");
      const filename = path.basename(imageUrl);
      const filePath = path.resolve(uploadsDirectory, filename);

      if (path.dirname(filePath) === uploadsDirectory) {
        await fs.unlink(filePath).catch((error: NodeJS.ErrnoException) => {
          if (error.code !== "ENOENT") throw error;
        });
      }
    }

    return res.json({ deleted: true, imagen_url: null });
  } catch (error) {
    console.error("ERROR DELETE EXERCISE IMAGE:", error);
    return res.status(500).json({ error: "No se pudo eliminar la imagen" });
  }
};
