import { NextFunction, Request, Response } from "express";
import { getRutinaCreadorId } from "../services/rutina.service";

/*
  Solo el creador de una rutina puede editarla, borrarla o tocar sus ejercicios.
  Va siempre después de requireAuth: el usuario sale del token, no del body,
  así nadie puede hacerse pasar por otro mandando otro creador_id.

  El id de la rutina puede venir como :id, como :id_rutina o en el body (id_rutina).
*/
export const requireRutinaOwner = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawId = req.params.id ?? req.params.id_rutina ?? req.body?.id_rutina;
    const idRutina = Number(rawId);

    if (!Number.isInteger(idRutina) || idRutina <= 0) {
      return res.status(400).json({ error: "id de rutina inválido" });
    }

    if (!req.authUser) {
      return res.status(401).json({ error: "Token requerido" });
    }

    const creadorId = await getRutinaCreadorId(idRutina);

    if (creadorId == null) {
      return res.status(404).json({ error: "Rutina no encontrada" });
    }

    if (Number(creadorId) !== Number(req.authUser.id)) {
      return res.status(403).json({ error: "No tenés permiso para modificar esta rutina" });
    }

    return next();
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Error verificando permisos de la rutina" });
  }
};
