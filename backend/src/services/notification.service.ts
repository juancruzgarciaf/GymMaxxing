import { pool } from "../db";

export type NotificationType = "training_like" | "training_comment" | "new_follower";

type Queryable = {
  query: <T = any>(text: string, params?: unknown[]) => Promise<{ rows: T[]; rowCount?: number }>;
};

type NotificationRow = {
  id_notificacion: number;
  usuario_id: number;
  actor_id: number | null;
  actor_username: string | null;
  tipo: NotificationType;
  titulo: string;
  mensaje: string;
  referencia_tipo: string | null;
  referencia_id: number | null;
  leida: boolean;
  fecha_creacion: string;
  fecha_lectura: string | null;
};

type NotificationPreferenceRow = {
  usuario_id: number;
  email: string | null;
  recibir_en_app: boolean;
  recibir_por_email: boolean;
  notificar_like_entrenamiento: boolean;
  notificar_comentario_entrenamiento: boolean;
  notificar_nuevo_seguidor: boolean;
  fecha_actualizacion: string;
};

export type NotificationItem = NotificationRow;

export type NotificationPreferences = {
  usuario_id: number;
  email: string | null;
  email_disponible: boolean;
  recibir_en_app: boolean;
  recibir_por_email: boolean;
  notificar_like_entrenamiento: boolean;
  notificar_comentario_entrenamiento: boolean;
  notificar_nuevo_seguidor: boolean;
  fecha_actualizacion: string;
};

export type NotificationPreferencesInput = Partial<
  Pick<
    NotificationPreferences,
    | "recibir_en_app"
    | "recibir_por_email"
    | "notificar_like_entrenamiento"
    | "notificar_comentario_entrenamiento"
    | "notificar_nuevo_seguidor"
  >
>;

type CreateNotificationInput = {
  usuario_id: number;
  actor_id?: number | null;
  tipo: NotificationType;
  titulo: string;
  mensaje: string;
  referencia_tipo?: string | null;
  referencia_id?: number | null;
};

let notificationTablesReady = false;

const mapPreferences = (row: NotificationPreferenceRow): NotificationPreferences => ({
  usuario_id: row.usuario_id,
  email: row.email,
  email_disponible: Boolean(row.email),
  recibir_en_app: row.recibir_en_app,
  recibir_por_email: row.recibir_por_email,
  notificar_like_entrenamiento: row.notificar_like_entrenamiento,
  notificar_comentario_entrenamiento: row.notificar_comentario_entrenamiento,
  notificar_nuevo_seguidor: row.notificar_nuevo_seguidor,
  fecha_actualizacion: row.fecha_actualizacion,
});

const ensureNotificationTables = async (queryable: Queryable = pool) => {
  if (notificationTablesReady) {
    return;
  }

  await queryable.query(
    `CREATE TABLE IF NOT EXISTS notificacion (
       id_notificacion SERIAL PRIMARY KEY,
       usuario_id INT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
       actor_id INT REFERENCES usuario(id) ON DELETE SET NULL,
       tipo VARCHAR(40) NOT NULL,
       titulo TEXT NOT NULL,
       mensaje TEXT NOT NULL,
       referencia_tipo VARCHAR(40),
       referencia_id INT,
       leida BOOLEAN NOT NULL DEFAULT FALSE,
       fecha_creacion TIMESTAMP NOT NULL DEFAULT NOW(),
       fecha_lectura TIMESTAMP
     )`
  );

  await queryable.query(
    `CREATE TABLE IF NOT EXISTS preferencia_notificacion_usuario (
       usuario_id INT PRIMARY KEY REFERENCES usuario(id) ON DELETE CASCADE,
       recibir_en_app BOOLEAN NOT NULL DEFAULT TRUE,
       recibir_por_email BOOLEAN NOT NULL DEFAULT FALSE,
       notificar_like_entrenamiento BOOLEAN NOT NULL DEFAULT TRUE,
       notificar_comentario_entrenamiento BOOLEAN NOT NULL DEFAULT TRUE,
       notificar_nuevo_seguidor BOOLEAN NOT NULL DEFAULT TRUE,
       fecha_actualizacion TIMESTAMP NOT NULL DEFAULT NOW()
     )`
  );

  await queryable.query(
    `CREATE INDEX IF NOT EXISTS idx_notificacion_usuario_fecha
     ON notificacion(usuario_id, fecha_creacion DESC)`
  );

  await queryable.query(
    `CREATE INDEX IF NOT EXISTS idx_notificacion_usuario_leida
     ON notificacion(usuario_id, leida)`
  );

  await queryable.query(
    `DO $$
     BEGIN
       IF NOT EXISTS (
         SELECT 1
         FROM pg_constraint
         WHERE conname = 'notificacion_tipo_check'
           AND conrelid = 'notificacion'::regclass
       ) THEN
         ALTER TABLE notificacion
         ADD CONSTRAINT notificacion_tipo_check
         CHECK (tipo IN ('training_like', 'training_comment', 'new_follower'));
       END IF;
     END $$`
  );

  notificationTablesReady = true;
};

const ensurePreferenceRow = async (usuarioId: number, queryable: Queryable = pool) => {
  await ensureNotificationTables(queryable);
  await queryable.query(
    `INSERT INTO preferencia_notificacion_usuario (usuario_id)
     VALUES ($1)
     ON CONFLICT (usuario_id) DO NOTHING`,
    [usuarioId]
  );
};

const getPreferencesRow = async (
  usuarioId: number,
  queryable: Queryable = pool
): Promise<NotificationPreferenceRow | null> => {
  await ensurePreferenceRow(usuarioId, queryable);

  const result = await queryable.query<NotificationPreferenceRow>(
    `SELECT pnu.usuario_id,
            NULLIF(TRIM(u.email), '') AS email,
            pnu.recibir_en_app,
            pnu.recibir_por_email,
            pnu.notificar_like_entrenamiento,
            pnu.notificar_comentario_entrenamiento,
            pnu.notificar_nuevo_seguidor,
            pnu.fecha_actualizacion::text AS fecha_actualizacion
     FROM preferencia_notificacion_usuario pnu
     JOIN usuario u ON u.id = pnu.usuario_id
     WHERE pnu.usuario_id = $1`,
    [usuarioId]
  );

  return result.rows[0] ?? null;
};

const getPreferenceColumnForType = (tipo: NotificationType) => {
  switch (tipo) {
    case "training_like":
      return "notificar_like_entrenamiento";
    case "training_comment":
      return "notificar_comentario_entrenamiento";
    case "new_follower":
      return "notificar_nuevo_seguidor";
    default:
      return null;
  }
};

export const listNotifications = async (
  usuarioId: number,
  options?: { limit?: number; offset?: number }
) => {
  await ensureNotificationTables();

  const limit = Math.min(Math.max(options?.limit ?? 50, 1), 100);
  const offset = Math.max(options?.offset ?? 0, 0);

  const [itemsResult, unreadResult] = await Promise.all([
    pool.query<NotificationRow>(
      `SELECT n.id_notificacion,
              n.usuario_id,
              n.actor_id,
              actor.username AS actor_username,
              n.tipo,
              n.titulo,
              n.mensaje,
              n.referencia_tipo,
              n.referencia_id,
              n.leida,
              n.fecha_creacion::text AS fecha_creacion,
              n.fecha_lectura::text AS fecha_lectura
       FROM notificacion n
       LEFT JOIN usuario actor ON actor.id = n.actor_id
       WHERE n.usuario_id = $1
       ORDER BY n.fecha_creacion DESC, n.id_notificacion DESC
       LIMIT $2
       OFFSET $3`,
      [usuarioId, limit, offset]
    ),
    pool.query<{ unread_count: number }>(
      `SELECT COUNT(*)::int AS unread_count
       FROM notificacion
       WHERE usuario_id = $1
         AND leida = FALSE`,
      [usuarioId]
    ),
  ]);

  return {
    items: itemsResult.rows,
    unread_count: unreadResult.rows[0]?.unread_count ?? 0,
  };
};

export const markNotificationAsRead = async (usuarioId: number, notificationId: number) => {
  await ensureNotificationTables();

  const result = await pool.query<NotificationRow>(
    `UPDATE notificacion
     SET leida = TRUE,
         fecha_lectura = COALESCE(fecha_lectura, NOW())
     WHERE id_notificacion = $1
       AND usuario_id = $2
     RETURNING id_notificacion,
               usuario_id,
               actor_id,
               NULL::text AS actor_username,
               tipo,
               titulo,
               mensaje,
               referencia_tipo,
               referencia_id,
               leida,
               fecha_creacion::text AS fecha_creacion,
               fecha_lectura::text AS fecha_lectura`,
    [notificationId, usuarioId]
  );

  return result.rows[0] ?? null;
};

export const markAllNotificationsAsRead = async (usuarioId: number) => {
  await ensureNotificationTables();

  const result = await pool.query(
    `UPDATE notificacion
     SET leida = TRUE,
         fecha_lectura = COALESCE(fecha_lectura, NOW())
     WHERE usuario_id = $1
       AND leida = FALSE`,
    [usuarioId]
  );

  return {
    updated_count: result.rowCount ?? 0,
  };
};

export const getNotificationPreferences = async (usuarioId: number) => {
  const row = await getPreferencesRow(usuarioId);
  return row ? mapPreferences(row) : null;
};

export const updateNotificationPreferences = async (
  usuarioId: number,
  input: NotificationPreferencesInput
) => {
  await ensurePreferenceRow(usuarioId);

  const current = await getPreferencesRow(usuarioId);
  if (!current) {
    return null;
  }

  await pool.query(
    `UPDATE preferencia_notificacion_usuario
     SET recibir_en_app = $2,
         recibir_por_email = $3,
         notificar_like_entrenamiento = $4,
         notificar_comentario_entrenamiento = $5,
         notificar_nuevo_seguidor = $6,
         fecha_actualizacion = NOW()
     WHERE usuario_id = $1`,
    [
      usuarioId,
      input.recibir_en_app ?? current.recibir_en_app,
      input.recibir_por_email ?? current.recibir_por_email,
      input.notificar_like_entrenamiento ?? current.notificar_like_entrenamiento,
      input.notificar_comentario_entrenamiento ?? current.notificar_comentario_entrenamiento,
      input.notificar_nuevo_seguidor ?? current.notificar_nuevo_seguidor,
    ]
  );

  const updated = await getPreferencesRow(usuarioId);
  return updated ? mapPreferences(updated) : null;
};

export const isNotificationEnabledForUser = async (usuarioId: number, tipo: NotificationType) => {
  const row = await getPreferencesRow(usuarioId);
  if (!row || !row.recibir_en_app) {
    return false;
  }

  const column = getPreferenceColumnForType(tipo);
  if (!column) {
    return false;
  }

  return Boolean(row[column]);
};

export const createNotification = async (input: CreateNotificationInput) => {
  await ensureNotificationTables();

  if (input.actor_id != null && input.actor_id === input.usuario_id) {
    return null;
  }

  const result = await pool.query<NotificationRow>(
    `INSERT INTO notificacion
     (
       usuario_id,
       actor_id,
       tipo,
       titulo,
       mensaje,
       referencia_tipo,
       referencia_id
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id_notificacion,
               usuario_id,
               actor_id,
               NULL::text AS actor_username,
               tipo,
               titulo,
               mensaje,
               referencia_tipo,
               referencia_id,
               leida,
               fecha_creacion::text AS fecha_creacion,
               fecha_lectura::text AS fecha_lectura`,
    [
      input.usuario_id,
      input.actor_id ?? null,
      input.tipo,
      input.titulo.trim(),
      input.mensaje.trim(),
      input.referencia_tipo ?? null,
      input.referencia_id ?? null,
    ]
  );

  return result.rows[0] ?? null;
};

export const createNotificationIfAllowed = async (input: CreateNotificationInput) => {
  const enabled = await isNotificationEnabledForUser(input.usuario_id, input.tipo);

  if (!enabled) {
    return null;
  }

  return createNotification(input);
};
