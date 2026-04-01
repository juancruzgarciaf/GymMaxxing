import { Request, Response } from "express";
import { pool } from "../db";

/*
  Este controller se encarga del CRUD más básico de usuarios.
  Acá el controller hace de intermediario entre la request y la base:
  toma datos, ejecuta la query y traduce el resultado a respuestas HTTP entendibles.
*/

// ACTUALIZAR USUARIO
export const updateUser = async (req: Request, res: Response) => {
  /*
    Acá la lógica es:
    1. Agarrar el id que viene por URL para saber qué usuario tocar.
    2. Leer del body los datos nuevos.
    3. Ejecutar un UPDATE con todos esos campos.
    4. Mandar null en los opcionales si no vinieron, así queda explícito qué guardar.
    5. Si la query no devolvió filas, significa que ese id no existía.
    6. Si todo salió bien, devuelve el usuario ya actualizado.

    Ojo: este endpoint pisa los campos con lo que le manden.
  */
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
  /*
    Este es el listado general.
    No espera nada raro: va a la tabla usuario, trae todo y lo devuelve.
    Sirve como endpoint simple de consulta, sin filtros ni vueltas.
  */
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
  /*
    Acá se busca un usuario puntual:
    1. Toma el id de la URL.
    2. Consulta la base con ese id.
    3. Si no encuentra nada, responde 404.
    4. Si lo encuentra, devuelve esa fila sola.

    Básicamente evita que el front tenga que filtrar un listado entero por su cuenta.
  */
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
