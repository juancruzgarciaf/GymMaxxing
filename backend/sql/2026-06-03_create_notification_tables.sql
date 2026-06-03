CREATE TABLE IF NOT EXISTS notificacion (
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
  fecha_lectura TIMESTAMP,
  CONSTRAINT notificacion_tipo_check
    CHECK (tipo IN ('training_like', 'training_comment', 'new_follower'))
);

CREATE INDEX IF NOT EXISTS idx_notificacion_usuario_fecha
  ON notificacion(usuario_id, fecha_creacion DESC);

CREATE INDEX IF NOT EXISTS idx_notificacion_usuario_leida
  ON notificacion(usuario_id, leida);

CREATE TABLE IF NOT EXISTS preferencia_notificacion_usuario (
  usuario_id INT PRIMARY KEY REFERENCES usuario(id) ON DELETE CASCADE,
  recibir_en_app BOOLEAN NOT NULL DEFAULT TRUE,
  recibir_por_email BOOLEAN NOT NULL DEFAULT FALSE,
  notificar_like_entrenamiento BOOLEAN NOT NULL DEFAULT TRUE,
  notificar_comentario_entrenamiento BOOLEAN NOT NULL DEFAULT TRUE,
  notificar_nuevo_seguidor BOOLEAN NOT NULL DEFAULT TRUE,
  fecha_actualizacion TIMESTAMP NOT NULL DEFAULT NOW()
);
