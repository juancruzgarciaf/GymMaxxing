import { Request, Response } from "express";
import * as notificationService from "../services/notification.service";

const parsePositiveInt = (value: unknown) => {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const parseOptionalBoolean = (value: unknown) => {
  if (value == null) {
    return undefined;
  }

  if (typeof value !== "boolean") {
    return null;
  }

  return value;
};

const isBooleanValue = (value: boolean | null | undefined): value is boolean =>
  typeof value === "boolean";

export const getNotifications = async (req: Request, res: Response) => {
  try {
    const authUser = req.authUser;

    if (!authUser) {
      return res.status(401).json({
        error: "No autorizado",
      });
    }

    const limit = parsePositiveInt(
      typeof req.query.limit === "string" ? req.query.limit : undefined
    );
    const offsetRaw = typeof req.query.offset === "string" ? req.query.offset : undefined;
    const offset =
      offsetRaw == null || offsetRaw.trim() === ""
        ? 0
        : Number.isInteger(Number(offsetRaw)) && Number(offsetRaw) >= 0
          ? Number(offsetRaw)
          : null;

    if ((req.query.limit != null && limit == null) || offset == null) {
      return res.status(400).json({
        error: "limit u offset invalidos",
      });
    }

    const options: { limit?: number; offset?: number } = {};
    if (limit != null) {
      options.limit = limit;
    }
    if (offset != null) {
      options.offset = offset;
    }

    const result = await notificationService.listNotifications(authUser.id, options);

    return res.json(result);
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Error obteniendo notificaciones",
    });
  }
};

export const markNotificationAsRead = async (req: Request, res: Response) => {
  try {
    const authUser = req.authUser;

    if (!authUser) {
      return res.status(401).json({
        error: "No autorizado",
      });
    }

    const notificationId = parsePositiveInt(req.params.id);

    if (notificationId == null) {
      return res.status(400).json({
        error: "id invalido",
      });
    }

    const notification = await notificationService.markNotificationAsRead(authUser.id, notificationId);

    if (!notification) {
      return res.status(404).json({
        error: "Notificacion no encontrada",
      });
    }

    return res.json(notification);
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Error marcando notificacion como leida",
    });
  }
};

export const markAllNotificationsAsRead = async (req: Request, res: Response) => {
  try {
    const authUser = req.authUser;

    if (!authUser) {
      return res.status(401).json({
        error: "No autorizado",
      });
    }

    const result = await notificationService.markAllNotificationsAsRead(authUser.id);
    return res.json(result);
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Error marcando notificaciones como leidas",
    });
  }
};

export const getNotificationPreferences = async (req: Request, res: Response) => {
  try {
    const authUser = req.authUser;

    if (!authUser) {
      return res.status(401).json({
        error: "No autorizado",
      });
    }

    const preferences = await notificationService.getNotificationPreferences(authUser.id);

    if (!preferences) {
      return res.status(404).json({
        error: "Usuario no encontrado",
      });
    }

    return res.json(preferences);
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Error obteniendo preferencias de notificacion",
    });
  }
};

export const updateNotificationPreferences = async (req: Request, res: Response) => {
  try {
    const authUser = req.authUser;

    if (!authUser) {
      return res.status(401).json({
        error: "No autorizado",
      });
    }

    const rawPayload = {
      recibir_en_app: parseOptionalBoolean(req.body.recibir_en_app),
      recibir_por_email: parseOptionalBoolean(req.body.recibir_por_email),
      notificar_like_entrenamiento: parseOptionalBoolean(req.body.notificar_like_entrenamiento),
      notificar_comentario_entrenamiento: parseOptionalBoolean(req.body.notificar_comentario_entrenamiento),
      notificar_nuevo_seguidor: parseOptionalBoolean(req.body.notificar_nuevo_seguidor),
    };

    const invalidField = Object.entries(rawPayload).find(([, value]) => value === null)?.[0];
    if (invalidField) {
      return res.status(400).json({
        error: `${invalidField} debe ser boolean`,
      });
    }

    const payload: notificationService.NotificationPreferencesInput = {};
    if (isBooleanValue(rawPayload.recibir_en_app)) {
      payload.recibir_en_app = rawPayload.recibir_en_app;
    }
    if (isBooleanValue(rawPayload.recibir_por_email)) {
      payload.recibir_por_email = rawPayload.recibir_por_email;
    }
    if (isBooleanValue(rawPayload.notificar_like_entrenamiento)) {
      payload.notificar_like_entrenamiento = rawPayload.notificar_like_entrenamiento;
    }
    if (isBooleanValue(rawPayload.notificar_comentario_entrenamiento)) {
      payload.notificar_comentario_entrenamiento = rawPayload.notificar_comentario_entrenamiento;
    }
    if (isBooleanValue(rawPayload.notificar_nuevo_seguidor)) {
      payload.notificar_nuevo_seguidor = rawPayload.notificar_nuevo_seguidor;
    }

    const preferences = await notificationService.updateNotificationPreferences(authUser.id, payload);

    if (!preferences) {
      return res.status(404).json({
        error: "Usuario no encontrado",
      });
    }

    return res.json(preferences);
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Error actualizando preferencias de notificacion",
    });
  }
};
