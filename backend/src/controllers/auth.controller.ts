import { Request, Response } from "express";
import { pool } from "../db";

/*
  primero mira si vino lo mínimo necesario,
  después consulta la base para evitar cosas raras,
  y recién ahí devuelve una respuesta clara al front.
*/

// REGISTER
export const register = async (req: Request, res: Response) => {
  /*
    Registro de usuario:
    1. Saca del body todos los datos que podrían venir del formulario.
    2. Revisa que estén los campos que sí o sí hacen falta.
    3. Busca por email para no crear duplicados.
    4. Si no existe, inserta el usuario.
    5. Los datos opcionales, si no vienen, van como null para que la DB no reviente.
    6. Devuelve el usuario recién creado.

    O sea: este endpoint hace de filtro antes de meter mano en la tabla.
  */
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
  /*
    Login bien directo:
    1. Pide email y password.
    2. Si falta alguno, corta ahí nomás.
    3. Busca el usuario por email.
    4. Si no existe, responde 404.
    5. Si existe pero la contraseña no coincide, responde 401.
    6. Si está todo bien, devuelve el usuario.

    En resumen: primero comprueba que el usuario exista y después valida la credencial.
  */
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
