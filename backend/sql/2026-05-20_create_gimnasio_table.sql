CREATE TABLE IF NOT EXISTS gimnasio (
  id_gimnasio SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  direccion TEXT,
  latitud DOUBLE PRECISION NOT NULL,
  longitud DOUBLE PRECISION NOT NULL,
  descripcion TEXT,
  imagen_url TEXT,
  google_place_id TEXT UNIQUE,
  fecha_creacion TIMESTAMP DEFAULT NOW()
);
