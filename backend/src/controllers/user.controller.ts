import { Request, Response } from "express";
import { pool } from "../db";

// ACTUALIZAR USUARIO
export const updateUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const {
      username,
      email,
      edad,
      peso,
      altura,
      nacionalidad,
      nivel_entrenamiento,
      objetivo_entrenamiento,
      tipo_usuario,
    } = req.body;

    const result = await pool.query(
      `UPDATE usuario SET
        username = $1,
        email = $2,
        edad = $3,
        peso = $4,
        altura = $5,
        nacionalidad = $6,
        nivel_entrenamiento = $7,
        objetivo_entrenamiento = $8,
        tipo_usuario = $9
      WHERE id = $10
      RETURNING *`,
      [
        username,
        email,
        edad ?? null,
        peso ?? null,
        altura ?? null,
        nacionalidad ?? null,
        nivel_entrenamiento ?? null,
        objetivo_entrenamiento ?? null,
        tipo_usuario,
        id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Usuario no encontrado",
      });
    }

    res.json(result.rows[0]);

  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Error actualizando usuario",
    });
  }
};

// GET TODOS
export const getUsuarios = async (_req: Request, res: Response) => {
  try {
    const result = await pool.query("SELECT * FROM usuario");
    res.json(result.rows);

  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Error obteniendo usuarios",
    });
  }
};

// GET POR ID
export const getUsuarioPorId = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      "SELECT * FROM usuario WHERE id = $1",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Usuario no encontrado",
      });
    }

    res.json(result.rows[0]);

  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Error obteniendo usuario",
    });
  }
};