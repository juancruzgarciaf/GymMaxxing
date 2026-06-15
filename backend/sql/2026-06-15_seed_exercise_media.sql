BEGIN;

UPDATE ejercicio
SET imagen_url = '/uploads/exercises/1781549948823-109425487.mp4'
WHERE LOWER(nombre) IN (
  'curl biceps barra',
  'curl biceps con barra',
  'curl bíceps barra',
  'curl bíceps con barra'
);

COMMIT;
