CREATE TABLE IF NOT EXISTS rutina_guardado (
  id_guardado SERIAL PRIMARY KEY,
  rutina_id INT NOT NULL REFERENCES rutina(id_rutina) ON DELETE CASCADE,
  usuario_id INT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  fecha TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (rutina_id, usuario_id)
);

CREATE TABLE IF NOT EXISTS rutina_copia (
  id_copia SERIAL PRIMARY KEY,
  rutina_id INT NOT NULL REFERENCES rutina(id_rutina) ON DELETE CASCADE,
  usuario_id INT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  fecha TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (rutina_id, usuario_id)
);

CREATE INDEX IF NOT EXISTS idx_rutina_guardado_rutina
  ON rutina_guardado(rutina_id);

CREATE INDEX IF NOT EXISTS idx_rutina_copia_rutina
  ON rutina_copia(rutina_id);
