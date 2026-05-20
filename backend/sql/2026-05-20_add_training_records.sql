CREATE TABLE IF NOT EXISTS usuario_ejercicio_record (
  usuario_id INT NOT NULL,
  ejercicio_id INT NOT NULL,
  mejor_volumen DOUBLE PRECISION NOT NULL DEFAULT 0,
  mejor_peso DOUBLE PRECISION NOT NULL DEFAULT 0,
  mejor_1rm DOUBLE PRECISION NOT NULL DEFAULT 0,
  fecha_actualizacion TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (usuario_id, ejercicio_id)
);

CREATE TABLE IF NOT EXISTS sesion_record_evaluacion (
  sesion_id INT PRIMARY KEY,
  usuario_id INT NOT NULL,
  fecha TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS serie_record_trofeo (
  id_trofeo SERIAL PRIMARY KEY,
  sesion_id INT NOT NULL,
  usuario_id INT NOT NULL,
  ejercicio_id INT NOT NULL,
  orden INT NOT NULL,
  tipo_record VARCHAR(20) NOT NULL,
  valor_anterior DOUBLE PRECISION NOT NULL DEFAULT 0,
  valor_nuevo DOUBLE PRECISION NOT NULL,
  fecha TIMESTAMP DEFAULT NOW(),
  UNIQUE (sesion_id, ejercicio_id, orden, tipo_record)
);

ALTER TABLE serie_record_trofeo
DROP CONSTRAINT IF EXISTS serie_record_trofeo_tipo_record_check;

ALTER TABLE serie_record_trofeo
ADD CONSTRAINT serie_record_trofeo_tipo_record_check
CHECK (tipo_record IN ('volumen', 'peso', '1rm'));
