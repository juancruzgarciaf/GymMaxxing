-- =========================================================
-- Re-sincroniza los ejercicios de las 8 rutinas oficiales
-- (creadas por admin@gmail.com) con el catalogo oficial de
-- 32 ejercicios de 2026-06-15_sync_official_exercises.sql.
--
-- Por que: el seed de abril vinculaba ejercicios con nombres
-- viejos ("Sentadilla trasera", "Face pull", ...). Despues
-- sync_official_exercises reescribio los ids 1..32 con otros
-- nombres, asi que en una base nueva las rutinas oficiales
-- quedaban con ejercicios que no correspondian
-- (ej: "Legs (PPL)" con Press banca y Dominadas).
--
-- Correr DESPUES de 2026-06-15_sync_official_exercises.sql.
-- Idempotente.
-- =========================================================
BEGIN;

WITH admin_user AS (
  SELECT id
  FROM usuario
  WHERE LOWER(email) = LOWER('admin@gmail.com')
  LIMIT 1
)
DELETE FROM rutinaejercicio re
USING rutina r, admin_user a
WHERE re.id_rutina = r.id_rutina
  AND r.creador_id = a.id
  AND r.nombre LIKE 'Oficial - %';

WITH admin_user AS (
  SELECT id
  FROM usuario
  WHERE LOWER(email) = LOWER('admin@gmail.com')
  LIMIT 1
),
plan(rutina_nombre, ejercicio_nombre, series, repeticiones, descanso, orden) AS (
  VALUES
    -- Full Body A
    ('Oficial - Full Body A (Inicio)', 'Sentadilla', 4, 6, 150, 1),
    ('Oficial - Full Body A (Inicio)', 'Press banca', 4, 6, 150, 2),
    ('Oficial - Full Body A (Inicio)', 'Remo con mancuerna', 3, 10, 90, 3),
    ('Oficial - Full Body A (Inicio)', 'Peso muerto', 3, 8, 120, 4),
    ('Oficial - Full Body A (Inicio)', 'Elevaciones laterales', 3, 15, 60, 5),
    ('Oficial - Full Body A (Inicio)', 'Plancha', 3, 1, 45, 6),

    -- Upper A
    ('Oficial - Upper A (Upper/Lower)', 'Press banca', 4, 6, 150, 1),
    ('Oficial - Upper A (Upper/Lower)', 'Dominadas', 4, 8, 120, 2),
    ('Oficial - Upper A (Upper/Lower)', 'Press militar', 3, 8, 120, 3),
    ('Oficial - Upper A (Upper/Lower)', 'Remo con barra', 3, 8, 120, 4),
    ('Oficial - Upper A (Upper/Lower)', 'Extensión de tríceps en polea', 3, 12, 75, 5),
    ('Oficial - Upper A (Upper/Lower)', 'Curl bíceps con barra', 3, 12, 75, 6),

    -- Lower A
    ('Oficial - Lower A (Upper/Lower)', 'Sentadilla', 4, 6, 150, 1),
    ('Oficial - Lower A (Upper/Lower)', 'Peso muerto', 4, 8, 150, 2),
    ('Oficial - Lower A (Upper/Lower)', 'Prensa de piernas', 3, 12, 90, 3),
    ('Oficial - Lower A (Upper/Lower)', 'Curl femoral', 3, 12, 75, 4),
    ('Oficial - Lower A (Upper/Lower)', 'Zancadas', 3, 10, 75, 5),
    ('Oficial - Lower A (Upper/Lower)', 'Plancha', 3, 1, 45, 6),

    -- Push
    ('Oficial - Push (PPL)', 'Press banca', 4, 6, 150, 1),
    ('Oficial - Push (PPL)', 'Press inclinado', 3, 8, 120, 2),
    ('Oficial - Push (PPL)', 'Press militar', 3, 8, 120, 3),
    ('Oficial - Push (PPL)', 'Elevaciones laterales', 3, 15, 60, 4),
    ('Oficial - Push (PPL)', 'Fondos en paralelas', 3, 10, 90, 5),
    ('Oficial - Push (PPL)', 'Extensión de tríceps en polea', 3, 12, 75, 6),

    -- Pull
    ('Oficial - Pull (PPL)', 'Dominadas', 4, 8, 120, 1),
    ('Oficial - Pull (PPL)', 'Remo con barra', 4, 8, 120, 2),
    ('Oficial - Pull (PPL)', 'Jalón al pecho', 3, 10, 90, 3),
    ('Oficial - Pull (PPL)', 'Pájaros', 3, 15, 60, 4),
    ('Oficial - Pull (PPL)', 'Curl bíceps con barra', 3, 10, 75, 5),
    ('Oficial - Pull (PPL)', 'Curl martillo', 2, 12, 60, 6),

    -- Legs
    ('Oficial - Legs (PPL)', 'Sentadilla', 4, 6, 150, 1),
    ('Oficial - Legs (PPL)', 'Prensa de piernas', 4, 10, 120, 2),
    ('Oficial - Legs (PPL)', 'Peso muerto', 3, 8, 120, 3),
    ('Oficial - Legs (PPL)', 'Zancadas', 3, 10, 90, 4),
    ('Oficial - Legs (PPL)', 'Curl femoral', 3, 12, 75, 5),

    -- Dia Pecho y Triceps
    ('Oficial - Dia Pecho y Triceps', 'Press banca', 4, 6, 150, 1),
    ('Oficial - Dia Pecho y Triceps', 'Press inclinado', 3, 8, 120, 2),
    ('Oficial - Dia Pecho y Triceps', 'Aperturas con mancuernas', 3, 12, 75, 3),
    ('Oficial - Dia Pecho y Triceps', 'Fondos en paralelas', 3, 10, 90, 4),
    ('Oficial - Dia Pecho y Triceps', 'Press francés', 3, 10, 75, 5),
    ('Oficial - Dia Pecho y Triceps', 'Extensión de tríceps en polea', 3, 12, 75, 6),

    -- Dia Espalda y Biceps
    ('Oficial - Dia Espalda y Biceps', 'Dominadas', 4, 8, 120, 1),
    ('Oficial - Dia Espalda y Biceps', 'Remo con barra', 4, 8, 120, 2),
    ('Oficial - Dia Espalda y Biceps', 'Jalón al pecho', 3, 10, 90, 3),
    ('Oficial - Dia Espalda y Biceps', 'Remo con mancuerna', 3, 10, 90, 4),
    ('Oficial - Dia Espalda y Biceps', 'Curl bíceps con barra', 3, 10, 75, 5),
    ('Oficial - Dia Espalda y Biceps', 'Curl martillo', 3, 12, 60, 6)
)
INSERT INTO rutinaejercicio (id_ejercicio, id_rutina, series, repeticiones, descanso, orden)
SELECT e.id_ejercicio, r.id_rutina, p.series, p.repeticiones, p.descanso, p.orden
FROM plan p
JOIN admin_user a ON TRUE
JOIN rutina r
  ON r.creador_id = a.id
 AND LOWER(r.nombre) = LOWER(p.rutina_nombre)
JOIN ejercicio e
  ON LOWER(e.nombre) = LOWER(p.ejercicio_nombre)
 AND COALESCE(e.es_personalizado, FALSE) = FALSE;

COMMIT;
