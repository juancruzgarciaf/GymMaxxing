console.log("ENTRÓ AL CONTROLLER");
import { Request, Response } from "express";
import { pool } from "../db";

export const crearUsuario = async (req: Request, res: Response) => {
  console.log("ENTRÓ AL CONTROLLER");

  try {
    const {
      username,
      email,
      password,
      edad,
      peso,
      altura,
      nacionalidad,
      nivel_entrenamiento,
      objetivo_entrenamiento,
      tipo_usuario,
    } = req.body;

    if (!email || !password || !username || !tipo_usuario) {
      return res.status(400).json({
        error: "Faltan campos obligatorios",
      });
    }

    // 🔍 Verificar si existe
    const existente = await pool.query(
      "SELECT id FROM usuario WHERE email = $1",
      [email]
    );

    if (existente.rows.length > 0) {
      return res.status(400).json({
        error: "El usuario ya existe",
      });
    }

    // 💣 IMPORTANTE: nulls en vez de undefined
    const result = await pool.query(
      `INSERT INTO usuario 
      (username, email, password, edad, peso, altura, nacionalidad, nivel_entrenamiento, objetivo_entrenamiento, tipo_usuario)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING *`,
      [
        username,
        email,
        password,
        edad ?? null,
        peso ?? null,
        altura ?? null,
        nacionalidad ?? null,
        nivel_entrenamiento ?? null,
        objetivo_entrenamiento ?? null,
        tipo_usuario,
      ]
    );

    return res.json(result.rows[0]);

  } catch (error) {
    console.error("ERROR REAL:", error);
    return res.status(500).json({
      error: "Error creando usuario",
    });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: "Email y password son obligatorios",
      });
    }

    const result = await pool.query(
      "SELECT * FROM usuario WHERE email = $1",
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Usuario no encontrado",
      });
    }

    const usuario = result.rows[0];

    // validar contraseña
    if (usuario.password !== password) {
      return res.status(401).json({
        error: "Contraseña incorrecta",
      });
    }

    res.json({
      mensaje: "Login exitoso",
      usuario,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Error en login",
    });
  }
};
export const actualizarUsuario = async (req: Request, res: Response) => {
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
export const getUsuarios = async (req: Request, res: Response) => {
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