UPDATE gimnasio
SET direccion = 'Shopping Las Palmas del Pilar Ruta Panamericana Km 50, Pilar',
    latitud = -34.4462642,
    longitud = -58.868823
WHERE LOWER(nombre) = LOWER('SportClub Pilar');
