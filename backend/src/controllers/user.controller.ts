import { Request, Response } from "express";
import * as userService from "../services/user.service";

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
    const id = Number(req.params.id);

    if (Number.isNaN(id)) {
      return res.status(400).json({
        error: "id inválido",
      });
    }

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

    const usuario = await userService.updateUser(id, {
      username,
      email,
      edad,
      peso,
      altura,
      nacionalidad,
      nivel_entrenamiento,
      objetivo_entrenamiento,
      tipo_usuario,
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
    const viewerId =
      typeof viewerIdRaw === "string" && viewerIdRaw.trim()
        ? Number(viewerIdRaw)
        : undefined;

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

    const followers = await userService.getFollowers(userId);
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

    const following = await userService.getFollowing(userId);
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

    const profile = await userService.getUserProfile(profileId, viewerId);

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

    if (Number.isNaN(userId)) {
      return res.status(400).json({
        error: "id inválido",
      });
    }

    const feed = await userService.getFeed(userId);
    return res.json(feed);
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Error obteniendo feed",
    });
  }
};
