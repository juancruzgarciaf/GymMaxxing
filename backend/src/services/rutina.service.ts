import { pool } from "../db";

const CANDIDATE_CARPETA_TABLES = [
  "carpeta_rutina",
  "carpeta",
  "rutina_carpeta",
  "carpetarutina",
] as const;

const CANDIDATE_PARENT_COLUMNS = [
  "id_carpeta_padre",
  "id_padre",
  "carpeta_padre",
  "parent_id",
] as const;

const quoteIdent = (identifier: string) => `"${identifier.replace(/"/g, "\"\"")}"`;

const resolveCarpetaTable = async () => {
  const values = [...CANDIDATE_CARPETA_TABLES];
  const placeholders = values.map((_, index) => `$${index + 1}`).join(", ");
  const result = await pool.query<{ relname: string }>(
    `SELECT relname
     FROM pg_class
     WHERE relkind = 'r'
       AND relname IN (${placeholders})
     ORDER BY array_position(ARRAY[${placeholders}]::text[], relname)
     LIMIT 1`,
    values
  );

  return result.rows[0]?.relname ?? null;
};

const resolveParentColumn = async (tableName: string) => {
  const result = await pool.query<{ column_name: string }>(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = $1`,
    [tableName]
  );

  const availableColumns = new Set(result.rows.map((row) => row.column_name));
  return CANDIDATE_PARENT_COLUMNS.find((column) => availableColumns.has(column)) ?? null;
};

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

export const getCarpetasRutina = async () => {
  const tableName = await resolveCarpetaTable();
  if (!tableName) {
    return [];
  }

  const parentColumn = await resolveParentColumn(tableName);
  const parentSelect = parentColumn
    ? `${quoteIdent(parentColumn)} AS id_carpeta_padre`
    : "NULL::integer AS id_carpeta_padre";

  const result = await pool.query(
    `SELECT id_carpeta, nombre, ${parentSelect}
     FROM ${quoteIdent(tableName)}
     ORDER BY nombre ASC`
  );

  return result.rows;
};

export const crearCarpetaRutina = async (data: any) => {
  const tableName = await resolveCarpetaTable();
  if (!tableName) {
    throw new Error("No existe tabla de carpetas de rutina en la base de datos");
  }

  const { nombre, id_carpeta_padre } = data;
  const parentColumn = await resolveParentColumn(tableName);

  if (parentColumn) {
    const result = await pool.query(
      `INSERT INTO ${quoteIdent(tableName)} (nombre, ${quoteIdent(parentColumn)})
       VALUES ($1, $2)
       RETURNING id_carpeta, nombre, ${quoteIdent(parentColumn)} AS id_carpeta_padre`,
      [nombre, id_carpeta_padre ?? null]
    );
    return result.rows[0];
  }

  const result = await pool.query(
    `INSERT INTO ${quoteIdent(tableName)} (nombre)
     VALUES ($1)
     RETURNING id_carpeta, nombre, NULL::integer AS id_carpeta_padre`,
    [nombre]
  );
  return result.rows[0];
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
