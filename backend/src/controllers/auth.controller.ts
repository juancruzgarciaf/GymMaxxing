import { Request, Response } from "express";
import { pool } from "../db";
import { USERNAME_MAX_LENGTH } from "../utils/textLimits";
import { createAuthToken } from "../utils/token";

const sanitizeUser = <T extends { password?: string }>(user: T) => {
  const { password: _password, ...safeUser } = user;
  return safeUser;
};

type GoogleTokenInfo = {
  aud?: string;
  email?: string;
  email_verified?: boolean | string;
  name?: string;
  sub?: string;
  error_description?: string;
};

const GOOGLE_TOKENINFO_URL = "https://oauth2.googleapis.com/tokeninfo";

const normalizeGoogleUsername = (value: string) => {
  const normalized = value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 24);

  return normalized || "google_user";
};

const buildUniqueGoogleUsername = async (email: string, fallbackName?: string) => {
  const emailName = email.split("@")[0] || "google_user";
  const base = normalizeGoogleUsername(fallbackName?.trim() || emailName);
  let candidate = base;
  let suffix = 1;

  while (true) {
    const existing = await pool.query(
      "SELECT 1 FROM usuario WHERE LOWER(username) = LOWER($1) LIMIT 1",
      [candidate]
    );

    if (existing.rows.length === 0) {
      return candidate;
    }

    suffix += 1;
    candidate = `${base}_${suffix}`;
  }
};

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
      genero,
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

    const cleanUsername = String(username).trim();
    const cleanEmail = String(email).trim();

    if (!cleanUsername || !cleanEmail) {
      return res.status(400).json({
        error: "username y email son obligatorios",
      });
    }

    if (cleanUsername.length > USERNAME_MAX_LENGTH) {
      return res.status(400).json({
        error: `El username no puede superar ${USERNAME_MAX_LENGTH} caracteres`,
      });
    }

    // Verificar si existe
    const existente = await pool.query<{ email_exists: boolean; username_exists: boolean }>(
      `SELECT
         EXISTS(SELECT 1 FROM usuario WHERE LOWER(email) = LOWER($1)) AS email_exists,
         EXISTS(SELECT 1 FROM usuario WHERE LOWER(username) = LOWER($2)) AS username_exists`,
      [cleanEmail, cleanUsername]
    );

    if (existente.rows[0]?.email_exists) {
      return res.status(400).json({
        error: "El usuario ya existe",
      });
    }

    if (existente.rows[0]?.username_exists) {
      return res.status(400).json({
        error: "El username ya esta en uso",
      });
    }

    const cleanGenero =
      typeof genero === "string" && genero.trim()
        ? genero.trim().toLowerCase()
        : null;

    if (cleanGenero != null && !["hombre", "mujer"].includes(cleanGenero)) {
      return res.status(400).json({
        error: "genero debe ser hombre o mujer",
      });
    }

    const result = await pool.query(
      `INSERT INTO usuario 
      (username, email, password, edad, peso, altura, genero, nacionalidad, nivel_entrenamiento, objetivo_entrenamiento, tipo_usuario)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      RETURNING *`,
      [
        cleanUsername,
        cleanEmail,
        password,
        edad ?? null,
        peso ?? null,
        altura ?? null,
        cleanGenero,
        nacionalidad ?? null,
        nivel_entrenamiento ?? null,
        objetivo_entrenamiento ?? null,
        tipo_usuario,
      ]
    );

    const usuario = sanitizeUser(result.rows[0]);
    const token = createAuthToken({
      id: usuario.id,
      email: usuario.email,
      username: usuario.username,
      tipo_usuario: usuario.tipo_usuario,
    });

    return res.json({
      id: usuario.id,
      usuario,
      token,
    });

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

    const safeUser = sanitizeUser(usuario);
    const token = createAuthToken({
      id: safeUser.id,
      email: safeUser.email,
      username: safeUser.username,
      tipo_usuario: safeUser.tipo_usuario,
    });

    res.json({
      mensaje: "Login exitoso",
      usuario: safeUser,
      token,
    });

  } catch (error) {
    console.error("ERROR LOGIN:", error);
    res.status(500).json({
      error: "Error en login",
    });
  }
};

export const googleLogin = async (req: Request, res: Response) => {
  try {
    const { credential } = req.body;

    if (!credential || typeof credential !== "string") {
      return res.status(400).json({
        error: "Falta la credencial de Google",
      });
    }

    const googleClientId = process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_OAUTH_CLIENT_ID;

    if (!googleClientId) {
      return res.status(500).json({
        error: "Falta configurar GOOGLE_CLIENT_ID en el backend",
      });
    }

    const tokenRes = await fetch(
      `${GOOGLE_TOKENINFO_URL}?id_token=${encodeURIComponent(credential)}`
    );
    const tokenInfo = (await tokenRes.json()) as GoogleTokenInfo;

    if (!tokenRes.ok) {
      return res.status(401).json({
        error: tokenInfo.error_description || "Token de Google invalido",
      });
    }

    const emailVerified =
      tokenInfo.email_verified === true || tokenInfo.email_verified === "true";

    if (tokenInfo.aud !== googleClientId || !tokenInfo.email || !emailVerified) {
      return res.status(401).json({
        error: "No se pudo validar la cuenta de Google",
      });
    }

    const cleanEmail = tokenInfo.email.trim().toLowerCase();
    const existingUser = await pool.query(
      "SELECT * FROM usuario WHERE LOWER(email) = LOWER($1) LIMIT 1",
      [cleanEmail]
    );

    const userRow =
      existingUser.rows[0] ??
      (
        await pool.query(
          `INSERT INTO usuario 
          (username, email, password, edad, peso, altura, genero, nacionalidad, nivel_entrenamiento, objetivo_entrenamiento, tipo_usuario)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
          RETURNING *`,
          [
            await buildUniqueGoogleUsername(cleanEmail, tokenInfo.name),
            cleanEmail,
            `google:${tokenInfo.sub || cleanEmail}`,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            "usuario",
          ]
        )
      ).rows[0];

    const usuario = sanitizeUser(userRow);
    const token = createAuthToken({
      id: usuario.id,
      email: usuario.email,
      username: usuario.username,
      tipo_usuario: usuario.tipo_usuario,
    });

    return res.json({
      mensaje: "Login con Google exitoso",
      usuario,
      token,
    });
  } catch (error) {
    console.error("ERROR GOOGLE LOGIN:", error);
    return res.status(500).json({
      error: "Error iniciando sesion con Google",
    });
  }
};
