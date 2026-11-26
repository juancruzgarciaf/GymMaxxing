-- =========================================================
-- GymMaxxing - Esquema base
--
-- Este archivo crea las tablas "core" que el resto de las
-- migraciones de backend/sql/ asumen que ya existen.
-- Antes no estaba en el repo (la base se habia creado a mano),
-- asi que una base nueva no se podia levantar desde cero.
--
-- Reconstruido a partir de las queries del backend.
-- Es idempotente: se puede correr sobre una base existente.
--
-- Orden para una base nueva:
--   1. este archivo
--   2. el resto de backend/sql/*.sql en orden alfabetico
--   (o directamente: backend/sql/setup_db.sh)
-- =========================================================

CREATE TABLE IF NOT EXISTS usuario (
  id SERIAL PRIMARY KEY,
  username VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password TEXT NOT NULL,
  edad INT,
  peso NUMERIC(6, 2),
  altura NUMERIC(6, 2),
  nacionalidad VARCHAR(100),
  nivel_entrenamiento VARCHAR(50),
  objetivo_entrenamiento VARCHAR(100),
  tipo_usuario VARCHAR(30) NOT NULL DEFAULT 'usuario'
);

CREATE TABLE IF NOT EXISTS carpeta_rutina (
  id_carpeta SERIAL PRIMARY KEY,
  nombre VARCHAR(120) NOT NULL,
  id_carpeta_padre INT REFERENCES carpeta_rutina(id_carpeta) ON DELETE CASCADE,
  usuario_id INT REFERENCES usuario(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS rutina (
  id_rutina SERIAL PRIMARY KEY,
  nombre VARCHAR(200) NOT NULL,
  descripcion TEXT,
  duracion_estimada INT,
  fecha_creacion TIMESTAMP NOT NULL DEFAULT NOW(),
  creador_id INT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  id_carpeta INT REFERENCES carpeta_rutina(id_carpeta) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS ejercicio (
  id_ejercicio SERIAL PRIMARY KEY,
  nombre VARCHAR(200) NOT NULL,
  descripcion TEXT,
  grupo_muscular VARCHAR(100),
  tipo_disciplina VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS rutinaejercicio (
  id_rutina INT NOT NULL REFERENCES rutina(id_rutina) ON DELETE CASCADE,
  id_ejercicio INT NOT NULL REFERENCES ejercicio(id_ejercicio) ON DELETE CASCADE,
  series INT,
  repeticiones INT,
  descanso INT,
  orden INT NOT NULL DEFAULT 1,
  PRIMARY KEY (id_rutina, id_ejercicio, orden)
);

CREATE TABLE IF NOT EXISTS sesionentrenamiento (
  id_sesion SERIAL PRIMARY KEY,
  fecha TIMESTAMP NOT NULL DEFAULT NOW(),
  fecha_inicio TIMESTAMP,
  fecha_fin TIMESTAMP,
  duracion_segundos INT,
  volumen_total NUMERIC(12, 2),
  descripcion TEXT,
  estado VARCHAR(20) NOT NULL DEFAULT 'en_curso',
  nombre_rutina_snapshot VARCHAR(200),
  -- gimnasio_id: sin FK porque la tabla gimnasio se crea en una migracion posterior
  gimnasio_id INT,
  usuario_id INT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  rutina_id INT REFERENCES rutina(id_rutina) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_sesion_usuario_fecha
  ON sesionentrenamiento(usuario_id, fecha DESC);

CREATE TABLE IF NOT EXISTS serie (
  id_serie SERIAL PRIMARY KEY,
  sesion_id INT NOT NULL REFERENCES sesionentrenamiento(id_sesion) ON DELETE CASCADE,
  ejercicio_id INT NOT NULL REFERENCES ejercicio(id_ejercicio) ON DELETE CASCADE,
  repeticiones INT NOT NULL DEFAULT 0,
  peso NUMERIC(8, 2),
  descanso INT,
  orden INT NOT NULL DEFAULT 1,
  nota_ejercicio TEXT
);

CREATE INDEX IF NOT EXISTS idx_serie_sesion ON serie(sesion_id);

CREATE TABLE IF NOT EXISTS seguimientousuario (
  id_seguidor INT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  id_seguido INT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  fecha TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id_seguidor, id_seguido),
  CHECK (id_seguidor <> id_seguido)
);

CREATE TABLE IF NOT EXISTS sesion_like (
  sesion_id INT NOT NULL REFERENCES sesionentrenamiento(id_sesion) ON DELETE CASCADE,
  usuario_id INT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  fecha TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (sesion_id, usuario_id)
);

CREATE TABLE IF NOT EXISTS sesion_comentario (
  id_comentario SERIAL PRIMARY KEY,
  sesion_id INT NOT NULL REFERENCES sesionentrenamiento(id_sesion) ON DELETE CASCADE,
  usuario_id INT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  contenido TEXT NOT NULL,
  fecha TIMESTAMP NOT NULL DEFAULT NOW()
);
