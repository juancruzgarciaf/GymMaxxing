import { pool } from "../db";

// =========================
// RUTINA
// =========================

export const crearRutina = async (data: any) => {
  const {
    nombre,
    descripcion,
    duracion_estimada,
    creador_id,
    id_carpeta,
  } = data;

  const result = await pool.query(
    `INSERT INTO rutina (nombre, descripcion, duracion_estimada, fecha_creacion, creador_id, id_carpeta)
     VALUES ($1, $2, $3, NOW(), $4, $5)
     RETURNING *`,
    [
      nombre,
      descripcion ?? null,
      duracion_estimada ?? null,
      creador_id,
      id_carpeta ?? null,
    ]
  );

  return result.rows[0];
};

export const getRutinas = async () => {
  const result = await pool.query(
    `SELECT * FROM rutina ORDER BY fecha_creacion DESC`
  );
  return result.rows;
};

export const getRutinaPorId = async (id: string) => {
  const result = await pool.query(
    `SELECT * FROM rutina WHERE id_rutina = $1`,
    [id]
  );
  return result.rows[0];
};

export const updateRutina = async (id: string, data: any) => {
  const {
    nombre,
    descripcion,
    duracion_estimada,
    creador_id,
    id_carpeta,
  } = data;

  const result = await pool.query(
    `UPDATE rutina
     SET nombre = $1,
         descripcion = $2,
         duracion_estimada = $3,
         creador_id = $4,
         id_carpeta = $5
     WHERE id_rutina = $6
     RETURNING *`,
    [
      nombre,
      descripcion ?? null,
      duracion_estimada ?? null,
      creador_id,
      id_carpeta ?? null,
      id,
    ]
  );

  return result.rows[0];
};

export const deleteRutina = async (id: string) => {
  await pool.query(`DELETE FROM rutina WHERE id_rutina = $1`, [id]);
};

// =========================
// RUTINA_EJERCICIO
// =========================

export const agregarEjercicioARutina = async (data: any) => {
  const {
    id_rutina,
    id_ejercicio,
    series,
    repeticiones,
    descanso,
    orden,
  } = data;

  const result = await pool.query(
    `INSERT INTO rutinaejercicio
     (id_ejercicio, id_rutina, series, repeticiones, descanso, orden)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      id_ejercicio,
      id_rutina,
      series,
      repeticiones,
      descanso,
      orden,
    ]
  );

  return result.rows[0];
};

export const getEjerciciosDeRutina = async (id_rutina: string) => {
  const result = await pool.query(
    `SELECT re.*, e.nombre, e.descripcion, e.grupo_muscular, e.tipo_disciplina
     FROM rutinaejercicio re
     JOIN ejercicio e ON e.id_ejercicio = re.id_ejercicio
     WHERE re.id_rutina = $1
     ORDER BY re.orden ASC`,
    [id_rutina]
  );

  return result.rows;
};

export const updateEjercicioDeRutina = async (
  id_rutina: string,
  id_ejercicio: string,
  data: any
) => {
  const { series, repeticiones, descanso, orden } = data;

  const result = await pool.query(
    `UPDATE rutinaejercicio
     SET series = $1,
         repeticiones = $2,
         descanso = $3,
         orden = $4
     WHERE id_rutina = $5 AND id_ejercicio = $6
     RETURNING *`,
    [series, repeticiones, descanso, orden, id_rutina, id_ejercicio]
  );

  return result.rows[0];
};

export const deleteEjercicioDeRutina = async (
  id_rutina: string,
  id_ejercicio: string
) => {
  await pool.query(
    `DELETE FROM rutinaejercicio
     WHERE id_rutina = $1 AND id_ejercicio = $2`,
    [id_rutina, id_ejercicio]
  );
};