BEGIN;

-- =========================================================
-- Seed oficial de rutinas GymMaxxing
-- - Crea (si no existe) el usuario admin@gmail.com
-- - Crea ejercicios base (si faltan)
-- - Crea rutinas oficiales (si faltan)
-- - Vincula ejercicios a cada rutina oficial (si faltan)
-- =========================================================

INSERT INTO usuario (
  username,
  email,
  password,
  tipo_usuario,
  edad,
  peso,
  altura,
  nacionalidad,
  nivel_entrenamiento,
  objetivo_entrenamiento
)
SELECT
  'GymMaxxing Admin',
  'admin@gmail.com',
  'admin123',
  'entrenador',
  NULL,
  NULL,
  NULL,
  NULL,
  'intermedio',
  'hipertrofia'
WHERE NOT EXISTS (
  SELECT 1
  FROM usuario u
  WHERE LOWER(u.email) = LOWER('admin@gmail.com')
);

WITH ejercicios_seed(nombre, descripcion, grupo_muscular, tipo_disciplina) AS (
  VALUES
    ('Press banca', 'Compuesto principal de pecho con barra', 'Pecho', 'Musculacion'),
    ('Press inclinado mancuernas', 'Press de pecho con enfasis en porcion clavicular', 'Pecho', 'Musculacion'),
    ('Aperturas en polea', 'Aislamiento de pecho en recorrido controlado', 'Pecho', 'Musculacion'),
    ('Fondos en paralelas', 'Compuesto de empuje para pecho y triceps', 'Pecho', 'Calistenia'),
    ('Dominadas pronas', 'Tiron vertical para espalda alta y dorsal', 'Espalda', 'Calistenia'),
    ('Jalon al pecho', 'Tiron vertical guiado para dorsal', 'Espalda', 'Musculacion'),
    ('Remo con barra', 'Tiron horizontal para espalda media', 'Espalda', 'Musculacion'),
    ('Remo en polea', 'Tiron horizontal en maquina o polea', 'Espalda', 'Musculacion'),
    ('Face pull', 'Trabajo de deltoides posterior y escapulas', 'Hombros', 'Musculacion'),
    ('Sentadilla trasera', 'Compuesto principal de piernas', 'Piernas', 'Musculacion'),
    ('Prensa de piernas', 'Empuje de piernas en maquina', 'Piernas', 'Musculacion'),
    ('Peso muerto rumano', 'Trabajo de cadena posterior y femoral', 'Piernas', 'Musculacion'),
    ('Hip thrust', 'Extension de cadera para gluteos', 'Gluteos', 'Musculacion'),
    ('Curl femoral tumbado', 'Aislamiento de femoral', 'Piernas', 'Musculacion'),
    ('Extension de cuadriceps', 'Aislamiento de cuadriceps', 'Piernas', 'Musculacion'),
    ('Elevaciones de talones', 'Trabajo de gemelos', 'Piernas', 'Musculacion'),
    ('Press militar', 'Compuesto de hombros', 'Hombros', 'Musculacion'),
    ('Elevaciones laterales', 'Aislamiento de deltoides lateral', 'Hombros', 'Musculacion'),
    ('Curl biceps barra', 'Aislamiento de biceps con barra', 'Biceps', 'Musculacion'),
    ('Curl martillo', 'Aislamiento de biceps y braquial', 'Biceps', 'Musculacion'),
    ('Extension triceps polea', 'Aislamiento de triceps en polea', 'Triceps', 'Musculacion'),
    ('Press frances', 'Aislamiento de triceps con barra o mancuernas', 'Triceps', 'Musculacion'),
    ('Plancha frontal', 'Estabilidad de core en isometria', 'Core', 'Calistenia')
)
INSERT INTO ejercicio (nombre, descripcion, grupo_muscular, tipo_disciplina)
SELECT e.nombre, e.descripcion, e.grupo_muscular, e.tipo_disciplina
FROM ejercicios_seed e
WHERE NOT EXISTS (
  SELECT 1
  FROM ejercicio ex
  WHERE LOWER(ex.nombre) = LOWER(e.nombre)
);

WITH admin_user AS (
  SELECT id
  FROM usuario
  WHERE LOWER(email) = LOWER('admin@gmail.com')
  LIMIT 1
),
rutinas_seed(nombre, descripcion, duracion_estimada) AS (
  VALUES
    ('Oficial - Full Body A (Inicio)', 'Base para principiantes: patron sentadilla, empuje, tiron y core.', 60),
    ('Oficial - Upper A (Upper/Lower)', 'Dia de torso con foco en empuje y tiron balanceado.', 70),
    ('Oficial - Lower A (Upper/Lower)', 'Dia de piernas con foco en fuerza base y posterior.', 70),
    ('Oficial - Push (PPL)', 'Empuje: pecho, hombros y triceps.', 75),
    ('Oficial - Pull (PPL)', 'Tiron: espalda, deltoides posterior y biceps.', 75),
    ('Oficial - Legs (PPL)', 'Piernas completas con enfasis en cuadriceps y gluteo.', 80),
    ('Oficial - Dia Pecho y Triceps', 'Division por musculo para volumen de torso anterior.', 65),
    ('Oficial - Dia Espalda y Biceps', 'Division por musculo para volumen de tiron.', 65)
)
INSERT INTO rutina (
  nombre,
  descripcion,
  duracion_estimada,
  fecha_creacion,
  creador_id,
  id_carpeta
)
SELECT
  r.nombre,
  r.descripcion,
  r.duracion_estimada,
  NOW(),
  a.id,
  NULL
FROM rutinas_seed r
CROSS JOIN admin_user a
WHERE NOT EXISTS (
  SELECT 1
  FROM rutina ru
  WHERE ru.creador_id = a.id
    AND LOWER(ru.nombre) = LOWER(r.nombre)
);

WITH admin_user AS (
  SELECT id
  FROM usuario
  WHERE LOWER(email) = LOWER('admin@gmail.com')
  LIMIT 1
),
plan(rutina_nombre, ejercicio_nombre, series, repeticiones, descanso, orden) AS (
  VALUES
    -- Full Body A
    ('Oficial - Full Body A (Inicio)', 'Sentadilla trasera', 4, 6, 150, 1),
    ('Oficial - Full Body A (Inicio)', 'Press banca', 4, 6, 150, 2),
    ('Oficial - Full Body A (Inicio)', 'Remo en polea', 3, 10, 90, 3),
    ('Oficial - Full Body A (Inicio)', 'Peso muerto rumano', 3, 10, 120, 4),
    ('Oficial - Full Body A (Inicio)', 'Elevaciones laterales', 3, 15, 60, 5),
    ('Oficial - Full Body A (Inicio)', 'Plancha frontal', 3, 1, 45, 6),

    -- Upper A
    ('Oficial - Upper A (Upper/Lower)', 'Press banca', 4, 6, 150, 1),
    ('Oficial - Upper A (Upper/Lower)', 'Dominadas pronas', 4, 8, 120, 2),
    ('Oficial - Upper A (Upper/Lower)', 'Press militar', 3, 8, 120, 3),
    ('Oficial - Upper A (Upper/Lower)', 'Remo con barra', 3, 8, 120, 4),
    ('Oficial - Upper A (Upper/Lower)', 'Extension triceps polea', 3, 12, 75, 5),
    ('Oficial - Upper A (Upper/Lower)', 'Curl biceps barra', 3, 12, 75, 6),

    -- Lower A
    ('Oficial - Lower A (Upper/Lower)', 'Sentadilla trasera', 4, 6, 150, 1),
    ('Oficial - Lower A (Upper/Lower)', 'Peso muerto rumano', 4, 8, 150, 2),
    ('Oficial - Lower A (Upper/Lower)', 'Prensa de piernas', 3, 12, 90, 3),
    ('Oficial - Lower A (Upper/Lower)', 'Curl femoral tumbado', 3, 12, 75, 4),
    ('Oficial - Lower A (Upper/Lower)', 'Elevaciones de talones', 4, 15, 60, 5),
    ('Oficial - Lower A (Upper/Lower)', 'Plancha frontal', 3, 1, 45, 6),

    -- Push
    ('Oficial - Push (PPL)', 'Press banca', 4, 6, 150, 1),
    ('Oficial - Push (PPL)', 'Press inclinado mancuernas', 3, 8, 120, 2),
    ('Oficial - Push (PPL)', 'Press militar', 3, 8, 120, 3),
    ('Oficial - Push (PPL)', 'Elevaciones laterales', 3, 15, 60, 4),
    ('Oficial - Push (PPL)', 'Fondos en paralelas', 3, 10, 90, 5),
    ('Oficial - Push (PPL)', 'Extension triceps polea', 3, 12, 75, 6),

    -- Pull
    ('Oficial - Pull (PPL)', 'Dominadas pronas', 4, 8, 120, 1),
    ('Oficial - Pull (PPL)', 'Remo con barra', 4, 8, 120, 2),
    ('Oficial - Pull (PPL)', 'Jalon al pecho', 3, 10, 90, 3),
    ('Oficial - Pull (PPL)', 'Face pull', 3, 15, 60, 4),
    ('Oficial - Pull (PPL)', 'Curl biceps barra', 3, 10, 75, 5),
    ('Oficial - Pull (PPL)', 'Curl martillo', 2, 12, 60, 6),

    -- Legs
    ('Oficial - Legs (PPL)', 'Sentadilla trasera', 4, 6, 150, 1),
    ('Oficial - Legs (PPL)', 'Prensa de piernas', 4, 10, 120, 2),
    ('Oficial - Legs (PPL)', 'Peso muerto rumano', 3, 8, 120, 3),
    ('Oficial - Legs (PPL)', 'Hip thrust', 3, 10, 90, 4),
    ('Oficial - Legs (PPL)', 'Extension de cuadriceps', 3, 12, 75, 5),
    ('Oficial - Legs (PPL)', 'Curl femoral tumbado', 3, 12, 75, 6),
    ('Oficial - Legs (PPL)', 'Elevaciones de talones', 4, 15, 60, 7),

    -- Dia Pecho y Triceps
    ('Oficial - Dia Pecho y Triceps', 'Press banca', 4, 6, 150, 1),
    ('Oficial - Dia Pecho y Triceps', 'Press inclinado mancuernas', 3, 8, 120, 2),
    ('Oficial - Dia Pecho y Triceps', 'Aperturas en polea', 3, 12, 75, 3),
    ('Oficial - Dia Pecho y Triceps', 'Fondos en paralelas', 3, 10, 90, 4),
    ('Oficial - Dia Pecho y Triceps', 'Press frances', 3, 10, 75, 5),
    ('Oficial - Dia Pecho y Triceps', 'Extension triceps polea', 3, 12, 75, 6),

    -- Dia Espalda y Biceps
    ('Oficial - Dia Espalda y Biceps', 'Dominadas pronas', 4, 8, 120, 1),
    ('Oficial - Dia Espalda y Biceps', 'Remo con barra', 4, 8, 120, 2),
    ('Oficial - Dia Espalda y Biceps', 'Jalon al pecho', 3, 10, 90, 3),
    ('Oficial - Dia Espalda y Biceps', 'Remo en polea', 3, 10, 90, 4),
    ('Oficial - Dia Espalda y Biceps', 'Curl biceps barra', 3, 10, 75, 5),
    ('Oficial - Dia Espalda y Biceps', 'Curl martillo', 3, 12, 60, 6)
)
INSERT INTO rutinaejercicio (
  id_ejercicio,
  id_rutina,
  series,
  repeticiones,
  descanso,
  orden
)
SELECT
  e.id_ejercicio,
  r.id_rutina,
  p.series,
  p.repeticiones,
  p.descanso,
  p.orden
FROM plan p
JOIN admin_user a ON TRUE
JOIN rutina r
  ON r.creador_id = a.id
 AND LOWER(r.nombre) = LOWER(p.rutina_nombre)
JOIN ejercicio e
  ON LOWER(e.nombre) = LOWER(p.ejercicio_nombre)
WHERE NOT EXISTS (
  SELECT 1
  FROM rutinaejercicio re
  WHERE re.id_rutina = r.id_rutina
    AND re.id_ejercicio = e.id_ejercicio
);

COMMIT;
