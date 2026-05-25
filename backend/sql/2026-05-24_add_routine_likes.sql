CREATE TABLE IF NOT EXISTS rutina_like (
  id_like SERIAL PRIMARY KEY,
  rutina_id INT NOT NULL REFERENCES rutina(id_rutina) ON DELETE CASCADE,
  usuario_id INT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  fecha TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (rutina_id, usuario_id)
);

CREATE INDEX IF NOT EXISTS idx_rutina_like_rutina
  ON rutina_like(rutina_id);

CREATE INDEX IF NOT EXISTS idx_rutina_like_usuario
  ON rutina_like(usuario_id);
