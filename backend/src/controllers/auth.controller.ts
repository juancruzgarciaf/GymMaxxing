import { Request, Response } from "express";
import { pool } from "../db";

// REGISTER
export const register = async (req: Request, res: Response) => {
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

    // Verificar si existe
    const existente = await pool.query(
      "SELECT id FROM usuario WHERE email = $1",
      [email]
    );

    if (existente.rows.length > 0) {
      return res.status(400).json({
        error: "El usuario ya existe",
      });
    }

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
    console.error("ERROR REGISTER:", error);
    return res.status(500).json({
      error: "Error creando usuario",
    });
  }
};

// LOGIN
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
    console.error("ERROR LOGIN:", error);
    res.status(500).json({
      error: "Error en login",
    });
  }
};