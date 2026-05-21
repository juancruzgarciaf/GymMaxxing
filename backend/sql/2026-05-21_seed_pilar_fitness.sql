INSERT INTO gimnasio (nombre, direccion, latitud, longitud, descripcion)
SELECT
  'Pilar Fitness',
  'B1629GNI El Rincón 699-799, GNI, B1629 Pilar Centro, Provincia de Buenos Aires',
  -34.4595,
  -58.9129,
  'Gimnasio en Pilar Centro.'
WHERE NOT EXISTS (
  SELECT 1
  FROM gimnasio
  WHERE LOWER(nombre) = LOWER('Pilar Fitness')
    AND direccion = 'B1629GNI El Rincón 699-799, GNI, B1629 Pilar Centro, Provincia de Buenos Aires'
);
