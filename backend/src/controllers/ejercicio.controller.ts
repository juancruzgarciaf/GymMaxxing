import { Request, Response } from "express";
import { pool } from "../db";

export const getEjercicios = async (_req: Request, res: Response) => {
  try {
    const result = await pool.query("SELECT * FROM ejercicio");
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al obtener ejercicios" });
  }
};