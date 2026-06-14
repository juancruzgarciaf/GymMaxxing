import { Request, Response } from "express";
import * as userService from "../services/user.service";
import { USERNAME_MAX_LENGTH } from "../utils/textLimits";
import { isUserPro } from "../services/subscription.service";
import { pool } from "../db";
import { uploadedFileUrl } from "../middleware/upload.middleware";

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
    2. Validar que haya token y que ese token sea del mismo usuario.
    3. Leer del body los datos nuevos.
    4. Ejecutar un UPDATE con todos esos campos.
    5. Si no hay filas, el id no existía.
  */
  try {
    const id = Number(req.params.id);
    const authUser = req.authUser;

    if (Number.isNaN(id)) {
      return res.status(400).json({
        error: "id inválido",
      });
    }

    if (!authUser) {
      return res.status(401).json({
        error: "No autorizado",
      });
    }

    if (authUser.id !== id) {
      return res.status(403).json({
        error: "Solo podes modificar tu propio usuario",
      });
    }

    const {
      username,
      email,
      edad,
      peso,
      altura,
      genero,
      nacionalidad,
      nivel_entrenamiento,
      objetivo_entrenamiento,
      tipo_usuario,
      foto_perfil_url,
      gimnasio_perfil,
    } = req.body;

    const cleanUsername = typeof username === "string" ? username.trim() : "";
    const cleanEmail = typeof email === "string" ? email.trim() : "";
    const cleanProfilePhotoUrl =
      typeof foto_perfil_url === "string" && foto_perfil_url.trim()
        ? foto_perfil_url.trim()
        : null;

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

    if (await userService.isUsernameTaken(cleanUsername, id)) {
      return res.status(400).json({
        error: "El username ya esta en uso",
      });
    }

    if (await userService.isEmailTaken(cleanEmail, id)) {
      return res.status(400).json({
        error: "El email ya esta en uso",
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

    const usuario = await userService.updateUser(id, {
      username: cleanUsername,
      email: cleanEmail,
      edad,
      peso,
      altura,
      genero: cleanGenero,
      nacionalidad,
      nivel_entrenamiento,
      objetivo_entrenamiento,
      tipo_usuario,
      foto_perfil_url: cleanProfilePhotoUrl,
      gimnasio_perfil,
    });

    if (!usuario) {
      return res.status(404).json({
        error: "Usuario no encontrado",
      });
    }

    res.json(usuario);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Error actualizando usuario",
    });
  }
};

export const uploadProfilePhoto = async (req: Request, res: Response) => {
  try {
    const userId = Number(req.params.id);

    if (!Number.isInteger(userId) || !req.authUser || req.authUser.id !== userId) {
      return res.status(403).json({ error: "Solo podes cambiar tu propia foto" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "Selecciona una imagen" });
    }

    const photoUrl = uploadedFileUrl("profiles", req.file.filename);
    const result = await pool.query(
      `UPDATE usuario
       SET foto_perfil_url = $2
       WHERE id = $1
       RETURNING id, username, foto_perfil_url`,
      [userId, photoUrl],
    );

    return res.json(result.rows[0]);
  } catch (error) {
    console.error("ERROR UPLOAD PROFILE PHOTO:", error);
    return res.status(500).json({ error: "No se pudo guardar la foto de perfil" });
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
    const usuarios = await userService.getUsuarios();
    res.json(usuarios);

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
    const id = Number(req.params.id);

    if (Number.isNaN(id)) {
      return res.status(400).json({
        error: "id inválido",
      });
    }

    const usuario = await userService.getUsuarioPorId(id);

    if (!usuario) {
      return res.status(404).json({
        error: "Usuario no encontrado",
      });
    }

    res.json(usuario);

  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Error obteniendo usuario",
    });
  }
};

export const searchUsers = async (req: Request, res: Response) => {
  try {
    const q =
      typeof req.query.q === "string" ? req.query.q.trim() : "";

    if (!q) {
      return res.status(400).json({
        error: "q es obligatorio",
      });
    }

    const viewerIdRaw = req.query.viewer_id;
    const viewerId = req.authUser?.id ??
      (typeof viewerIdRaw === "string" && viewerIdRaw.trim()
        ? Number(viewerIdRaw)
        : undefined);

    if (viewerIdRaw != null && (viewerId == null || Number.isNaN(viewerId))) {
      return res.status(400).json({
        error: "viewer_id inválido",
      });
    }

    const usuarios = await userService.searchUsers(q, viewerId);
    return res.json(usuarios);
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Error buscando usuarios",
    });
  }
};

export const getTrends = async (req: Request, res: Response) => {
  try {
    const viewerIdRaw = req.query.viewer_id;
    const viewerId =
      typeof viewerIdRaw === "string" && viewerIdRaw.trim()
        ? Number(viewerIdRaw)
        : undefined;

    if (viewerIdRaw != null && (viewerId == null || Number.isNaN(viewerId))) {
      return res.status(400).json({
        error: "viewer_id inválido",
      });
    }

    const trends = await userService.getTrends(viewerId);
    return res.json(trends);
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Error obteniendo tendencias",
    });
  }
};

export const followUser = async (req: Request, res: Response) => {
  try {
    const seguidoId = Number(req.params.id);
    const seguidorId = Number(req.body.seguidor_id);

    if (Number.isNaN(seguidoId) || Number.isNaN(seguidorId)) {
      return res.status(400).json({
        error: "id y seguidor_id son obligatorios",
      });
    }

    const result = await userService.followUser(seguidorId, seguidoId);

    if ("error" in result) {
      const status =
        result.error === "Usuario no encontrado"
          ? 404
          : 400;

      return res.status(status).json({
        error: result.error,
      });
    }

    return res.status(201).json({
      mensaje: "Usuario seguido correctamente",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Error siguiendo usuario",
    });
  }
};

export const unfollowUser = async (req: Request, res: Response) => {
  try {
    const seguidoId = Number(req.params.id);
    const seguidorId = Number(req.body.seguidor_id);

    if (Number.isNaN(seguidoId) || Number.isNaN(seguidorId)) {
      return res.status(400).json({
        error: "id y seguidor_id son obligatorios",
      });
    }

    const result = await userService.unfollowUser(seguidorId, seguidoId);

    if (!result.deleted) {
      return res.status(404).json({
        error: "La relación de seguimiento no existe",
      });
    }

    return res.json({
      mensaje: "Usuario dejado de seguir correctamente",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Error dejando de seguir usuario",
    });
  }
};

export const getFollowers = async (req: Request, res: Response) => {
  try {
    const userId = Number(req.params.id);

    if (Number.isNaN(userId)) {
      return res.status(400).json({
        error: "id inválido",
      });
    }

    const viewerIdRaw = req.query.viewer_id;
    const viewerId =
      typeof viewerIdRaw === "string" && viewerIdRaw.trim()
        ? Number(viewerIdRaw)
        : undefined;

    if (viewerIdRaw != null && (viewerId == null || Number.isNaN(viewerId))) {
      return res.status(400).json({
        error: "viewer_id inválido",
      });
    }

    const followers = await userService.getFollowers(userId, viewerId);
    return res.json(followers);
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Error obteniendo seguidores",
    });
  }
};

export const getFollowing = async (req: Request, res: Response) => {
  try {
    const userId = Number(req.params.id);

    if (Number.isNaN(userId)) {
      return res.status(400).json({
        error: "id inválido",
      });
    }

    const viewerIdRaw = req.query.viewer_id;
    const viewerId =
      typeof viewerIdRaw === "string" && viewerIdRaw.trim()
        ? Number(viewerIdRaw)
        : undefined;

    if (viewerIdRaw != null && (viewerId == null || Number.isNaN(viewerId))) {
      return res.status(400).json({
        error: "viewer_id inválido",
      });
    }

    const following = await userService.getFollowing(userId, viewerId);
    return res.json(following);
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Error obteniendo seguidos",
    });
  }
};

export const getUserProfile = async (req: Request, res: Response) => {
  try {
    const profileId = Number(req.params.id);

    if (Number.isNaN(profileId)) {
      return res.status(400).json({
        error: "id inválido",
      });
    }

    const viewerIdRaw = req.query.viewer_id;
    const viewerId =
      typeof viewerIdRaw === "string" && viewerIdRaw.trim()
        ? Number(viewerIdRaw)
        : undefined;

    if (viewerIdRaw != null && (viewerId == null || Number.isNaN(viewerId))) {
      return res.status(400).json({
        error: "viewer_id inválido",
      });
    }

    const fullHistory =
      viewerId !== profileId || (req.authUser ? await isUserPro(req.authUser.id) : true);
    const profile = await userService.getUserProfile(profileId, viewerId, fullHistory);

    if (!profile) {
      return res.status(404).json({
        error: "Usuario no encontrado",
      });
    }

    return res.json(profile);
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Error obteniendo perfil",
    });
  }
};

export const getUserProfileByUsername = async (req: Request, res: Response) => {
  try {
    const usernameParam = req.params.username;
    const username = typeof usernameParam === "string" ? usernameParam.trim() : "";

    if (!username) {
      return res.status(400).json({
        error: "username invalido",
      });
    }

    const viewerIdRaw = req.query.viewer_id;
    const viewerId = req.authUser?.id ??
      (typeof viewerIdRaw === "string" && viewerIdRaw.trim()
        ? Number(viewerIdRaw)
        : undefined);

    if (viewerIdRaw != null && (viewerId == null || Number.isNaN(viewerId))) {
      return res.status(400).json({
        error: "viewer_id inválido",
      });
    }

    const profileUser = await userService.getUserProfileByUsername(username, viewerId, true);
    const fullHistory =
      !profileUser?.is_own_profile ||
      (req.authUser ? await isUserPro(req.authUser.id) : true);
    const profile = fullHistory
      ? profileUser
      : await userService.getUserProfileByUsername(username, viewerId, false);

    if (!profile) {
      return res.status(404).json({
        error: "Usuario no encontrado",
      });
    }

    return res.json(profile);
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Error obteniendo perfil",
    });
  }
};

export const getFeed = async (req: Request, res: Response) => {
  try {
    const userId = Number(req.params.id);
    const page = Number(req.query.page ?? 1);
    const pageSize = Number(req.query.pageSize ?? 10);

    if (Number.isNaN(userId)) {
      return res.status(400).json({
        error: "id inválido",
      });
    }

    if (!Number.isFinite(page) || !Number.isFinite(pageSize)) {
      return res.status(400).json({
        error: "paginación inválida",
      });
    }

    const feed = await userService.getFeed(userId, page, pageSize);
    return res.json(feed);
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Error obteniendo Inicio",
    });
  }
};

export const searchUserTrainings = async (req: Request, res: Response) => {
  try {
    const userId = Number(req.params.id);

    if (Number.isNaN(userId)) {
      return res.status(400).json({
        error: "id inválido",
      });
    }

    const viewerIdRaw = req.query.viewer_id;
    const viewerId = req.authUser?.id ??
      (typeof viewerIdRaw === "string" && viewerIdRaw.trim()
        ? Number(viewerIdRaw)
        : undefined);

    if (viewerIdRaw != null && (viewerId == null || Number.isNaN(viewerId))) {
      return res.status(400).json({
        error: "viewer_id inválido",
      });
    }

    const queryRaw = req.query.q;
    const q =
      typeof queryRaw === "string" && queryRaw.trim()
        ? queryRaw.trim()
        : undefined;

    const grupoRaw = req.query.grupo_muscular;
    const gruposMusculares =
      typeof grupoRaw === "string" && grupoRaw.trim()
        ? grupoRaw
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean)
        : undefined;
    const tipoDisciplinaRaw = req.query.tipo_disciplina;
    const tiposDisciplina =
      typeof tipoDisciplinaRaw === "string" && tipoDisciplinaRaw.trim()
        ? tipoDisciplinaRaw
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean)
        : undefined;

    const minDurationRaw = req.query.duracion_min;
    const maxDurationRaw = req.query.duracion_max;
    const minDurationMinutes =
      typeof minDurationRaw === "string" && minDurationRaw.trim()
        ? Number(minDurationRaw)
        : undefined;
    const maxDurationMinutes =
      typeof maxDurationRaw === "string" && maxDurationRaw.trim()
        ? Number(maxDurationRaw)
        : undefined;

    if (
      (minDurationRaw != null && (minDurationMinutes == null || Number.isNaN(minDurationMinutes))) ||
      (maxDurationRaw != null && (maxDurationMinutes == null || Number.isNaN(maxDurationMinutes)))
    ) {
      return res.status(400).json({
        error: "duración inválida",
      });
    }

    const filters: Parameters<typeof userService.searchUserTrainings>[2] = {};

    if (q != null) {
      filters.q = q;
    }

    if (gruposMusculares != null) {
      filters.gruposMusculares = gruposMusculares;
    }

    if (tiposDisciplina != null) {
      filters.tiposDisciplina = tiposDisciplina;
    }

    if (minDurationMinutes != null) {
      filters.minDurationSeconds = Math.max(0, Math.floor(minDurationMinutes * 60));
    }

    if (maxDurationMinutes != null) {
      filters.maxDurationSeconds = Math.max(0, Math.floor(maxDurationMinutes * 60));
    }

    if (
      viewerId === userId &&
      req.authUser &&
      !(await isUserPro(req.authUser.id))
    ) {
      const earliest = new Date();
      earliest.setDate(earliest.getDate() - 90);
      filters.earliestDate = earliest.toISOString();
    }

    const result = await userService.searchUserTrainings(userId, viewerId, filters);

    return res.json(result);
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Error buscando entrenamientos",
    });
  }
};

export const getSuggestedUsers = async (req: Request, res: Response) => {
  try {
    const userId = Number(req.params.id);
    const limit = Number(req.query.limit ?? 5);

    if (Number.isNaN(userId)) {
      return res.status(400).json({
        error: "id inválido",
      });
    }

    if (!Number.isFinite(limit)) {
      return res.status(400).json({
        error: "limit inválido",
      });
    }

    const suggestions = await userService.getSuggestedUsers(userId, limit);
    return res.json(suggestions);
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Error obteniendo sugerencias",
    });
  }
};
