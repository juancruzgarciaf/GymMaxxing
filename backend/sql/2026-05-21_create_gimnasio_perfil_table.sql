CREATE TABLE IF NOT EXISTS gimnasio_perfil (
  usuario_id INT PRIMARY KEY REFERENCES usuario(id) ON DELETE CASCADE,
  nombre_gimnasio TEXT,
  telefono TEXT,
  sitio_web TEXT,
  instagram TEXT,
  descripcion_corta TEXT,
  tipo_gimnasio TEXT,
  direccion TEXT,
  ciudad TEXT,
  provincia TEXT,
  pais TEXT,
  google_maps_url TEXT,
  horarios JSONB NOT NULL DEFAULT '{}'::jsonb,
  horarios_feriados JSONB NOT NULL DEFAULT '{}'::jsonb,
  servicios TEXT[] NOT NULL DEFAULT '{}',
  fecha_actualizacion TIMESTAMP DEFAULT NOW()
);
