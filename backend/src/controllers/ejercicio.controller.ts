import { Request, Response } from "express";
import { pool } from "../db";

/*
  Este controller por ahora está re simple:
  solo expone la lectura de ejercicios.
  No transforma demasiado la data, solo la pide a la base y la devuelve.
*/

export const getEjercicios = async (_req: Request, res: Response) => {
  /*
    Hace un SELECT de toda la tabla ejercicio.
    Si sale bien, devuelve el array completo.
    Si algo falla en la consulta, responde con error 500.

    Es el típico endpoint de "traeme todo lo disponible".
  */
  try {
    const result = await pool.query("SELECT * FROM ejercicio");
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al obtener ejercicios" });
  }
};
