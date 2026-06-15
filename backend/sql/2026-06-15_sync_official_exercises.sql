BEGIN;

-- Preserve references from official exercises that no longer have their own ID.
UPDATE serie
SET ejercicio_id = 23
WHERE ejercicio_id = 33;

UPDATE serie
SET ejercicio_id = 10
WHERE ejercicio_id = 34;

DELETE FROM rutinaejercicio source
USING rutinaejercicio target
WHERE source.id_ejercicio = 33
  AND target.id_rutina = source.id_rutina
  AND target.id_ejercicio = 23;

UPDATE rutinaejercicio
SET id_ejercicio = 23
WHERE id_ejercicio = 33;

DELETE FROM rutinaejercicio source
USING rutinaejercicio target
WHERE source.id_ejercicio = 34
  AND target.id_rutina = source.id_rutina
  AND target.id_ejercicio = 10;

UPDATE rutinaejercicio
SET id_ejercicio = 10
WHERE id_ejercicio = 34;

DELETE FROM ejercicio
WHERE COALESCE(es_personalizado, FALSE) = FALSE
  AND id_ejercicio NOT BETWEEN 1 AND 32;

INSERT INTO ejercicio (
  id_ejercicio,
  nombre,
  descripcion,
  grupo_muscular,
  tipo_disciplina,
  creador_id,
  es_personalizado,
  imagen_url
)
VALUES
  (1, 'Press banca', 'Ejercicio compuesto con barra para pecho', 'Pecho', 'Musculación', NULL, FALSE, NULL),
  (2, 'Press inclinado', 'Enfocado en la parte superior del pecho', 'Pecho', 'Musculación', NULL, FALSE, NULL),
  (3, 'Aperturas con mancuernas', 'Ejercicio analítico para estirar el pecho', 'Pecho', 'Musculación', NULL, FALSE, NULL),
  (4, 'Fondos en paralelas', 'Trabaja pecho y tríceps', 'Pecho', 'Calistenia', NULL, FALSE, NULL),
  (5, 'Dominadas', 'Ejercicio en barra para espalda', 'Espalda', 'Calistenia', NULL, FALSE, NULL),
  (6, 'Jalón al pecho', 'Simulación de dominadas en polea', 'Espalda', 'Musculación', NULL, FALSE, NULL),
  (7, 'Remo con barra', 'Ejercicio de espalda media', 'Espalda', 'Musculación', NULL, FALSE, NULL),
  (8, 'Remo con mancuerna', 'Remo unilateral para espalda', 'Espalda', 'Musculación', NULL, FALSE, NULL),
  (9, 'Sentadilla', 'Ejercicio base de piernas', 'Piernas', 'Musculación', NULL, FALSE, NULL),
  (10, 'Prensa de piernas', 'Trabajo de cuádriceps en máquina', 'Piernas', 'Musculación', NULL, FALSE, NULL),
  (11, 'Peso muerto', 'Ejercicio compuesto de cadena posterior', 'Piernas', 'Musculación', NULL, FALSE, NULL),
  (12, 'Zancadas', 'Ejercicio unilateral de piernas', 'Piernas', 'Musculación', NULL, FALSE, NULL),
  (13, 'Curl femoral', 'Trabajo de isquiotibiales', 'Piernas', 'Musculación', NULL, FALSE, NULL),
  (14, 'Press militar', 'Ejercicio principal de hombros', 'Hombros', 'Musculación', NULL, FALSE, NULL),
  (15, 'Elevaciones laterales', 'Aísla el deltoide lateral', 'Hombros', 'Musculación', NULL, FALSE, NULL),
  (16, 'Pájaros', 'Trabaja deltoide posterior', 'Hombros', 'Musculación', NULL, FALSE, NULL),
  (17, 'Curl bíceps con barra', 'Ejercicio básico de bíceps', 'Bíceps', 'Musculación', NULL, FALSE, NULL),
  (18, 'Curl martillo', 'Trabaja bíceps y braquial', 'Bíceps', 'Musculación', NULL, FALSE, NULL),
  (19, 'Extensión de tríceps en polea', 'Aislamiento de tríceps', 'Tríceps', 'Musculación', NULL, FALSE, NULL),
  (20, 'Press francés', 'Ejercicio de tríceps con barra', 'Tríceps', 'Musculación', NULL, FALSE, NULL),
  (21, 'Crunch abdominal', 'Ejercicio básico de abdomen', 'Core', 'Musculación', NULL, FALSE, NULL),
  (22, 'Elevaciones de piernas', 'Trabaja abdomen inferior', 'Core', 'Musculación', NULL, FALSE, NULL),
  (23, 'Plancha', 'Ejercicio isométrico de core', 'Core', 'Calistenia', NULL, FALSE, NULL),
  (24, 'Cinta', 'Ejercicio cardiovascular caminando o corriendo', 'Cardio', 'Cardio', NULL, FALSE, NULL),
  (25, 'Bicicleta', 'Ejercicio cardiovascular en bici fija', 'Cardio', 'Cardio', NULL, FALSE, NULL),
  (26, 'Elíptico', 'Ejercicio cardiovascular de bajo impacto', 'Cardio', 'Cardio', NULL, FALSE, NULL),
  (27, 'RopeMaxxing', 'Una vez sola.', 'LooksMaxxing', 'Ascending', NULL, FALSE, NULL),
  (28, 'BoneSmashing', 'Grab a hummer', 'LooksMaxxing', 'Ascending', NULL, FALSE, NULL),
  (29, 'HeightMaxxing', 'FRAUD.', 'LooksMaxxing', 'Ascending', NULL, FALSE, NULL),
  (30, 'JesterMaxxing', 'Joker.', 'LooksMaxxing', 'Ascending', NULL, FALSE, NULL),
  (31, 'FoidMaxxing', 'foid.', 'LooksMaxxing', 'Ascending', NULL, FALSE, NULL),
  (32, 'GoonMaxxing', 'Jerk 4 KIrk.', 'LooksMaxxing', 'Ascending', NULL, FALSE, NULL)
ON CONFLICT (id_ejercicio) DO UPDATE
SET nombre = EXCLUDED.nombre,
    descripcion = EXCLUDED.descripcion,
    grupo_muscular = EXCLUDED.grupo_muscular,
    tipo_disciplina = EXCLUDED.tipo_disciplina,
    creador_id = NULL,
    es_personalizado = FALSE,
    imagen_url = CASE
      WHEN ejercicio.nombre = EXCLUDED.nombre THEN ejercicio.imagen_url
      ELSE NULL
    END;

SELECT setval(
  pg_get_serial_sequence('ejercicio', 'id_ejercicio'),
  GREATEST((SELECT COALESCE(MAX(id_ejercicio), 1) FROM ejercicio), 1),
  TRUE
);

COMMIT;
