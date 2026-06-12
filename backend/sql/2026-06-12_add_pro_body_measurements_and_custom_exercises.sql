CREATE TABLE IF NOT EXISTS medida_corporal (
  id_medida SERIAL PRIMARY KEY,
  usuario_id INT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  peso NUMERIC(7, 2),
  cintura NUMERIC(7, 2),
  pecho NUMERIC(7, 2),
  brazo NUMERIC(7, 2),
  cadera NUMERIC(7, 2),
  muslo NUMERIC(7, 2),
  nota VARCHAR(240),
  fecha_creacion TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT medida_corporal_usuario_fecha_unique UNIQUE (usuario_id, fecha),
  CONSTRAINT medida_corporal_valores_positivos CHECK (
    (peso IS NULL OR peso > 0) AND
    (cintura IS NULL OR cintura > 0) AND
    (pecho IS NULL OR pecho > 0) AND
    (brazo IS NULL OR brazo > 0) AND
    (cadera IS NULL OR cadera > 0) AND
    (muslo IS NULL OR muslo > 0)
  )
);

CREATE INDEX IF NOT EXISTS idx_medida_corporal_usuario_fecha
  ON medida_corporal(usuario_id, fecha DESC);

ALTER TABLE ejercicio
  ADD COLUMN IF NOT EXISTS creador_id INT REFERENCES usuario(id) ON DELETE CASCADE;

ALTER TABLE ejercicio
  ADD COLUMN IF NOT EXISTS es_personalizado BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_ejercicio_creador_personalizado
  ON ejercicio(creador_id, es_personalizado);
