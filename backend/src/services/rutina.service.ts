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

const CANDIDATE_NAME_COLUMNS = ["nombre", "name", "titulo"] as const;

const quoteIdent = (identifier: string) => `"${identifier.replace(/"/g, "\"\"")}"`;

type CarpetaTableInfo = {
  tableName: string;
  idColumn: string;
  nameColumn: string;
  parentColumn: string | null;
  hasUsuarioColumn: boolean;
};

const resolveCarpetaTableByFk = async () => {
  const result = await pool.query<{ table_name: string; id_column: string }>(
    `SELECT target_table.relname AS table_name,
            target_col.attname AS id_column
     FROM pg_constraint c
     JOIN pg_class source_table ON source_table.oid = c.conrelid
     JOIN pg_class target_table ON target_table.oid = c.confrelid
     JOIN unnest(c.conkey) WITH ORDINALITY AS src(attnum, ord) ON true
     JOIN unnest(c.confkey) WITH ORDINALITY AS tgt(attnum, ord) ON src.ord = tgt.ord
     JOIN pg_attribute source_col
       ON source_col.attrelid = source_table.oid
      AND source_col.attnum = src.attnum
     JOIN pg_attribute target_col
       ON target_col.attrelid = target_table.oid
      AND target_col.attnum = tgt.attnum
     WHERE c.contype = 'f'
       AND source_table.relname = 'rutina'
       AND source_col.attname = 'id_carpeta'
     LIMIT 1`
  );

  return result.rows[0] ?? null;
};

const resolveCarpetaTableByCandidates = async () => {
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

const getTableColumns = async (tableName: string) => {
  const result = await pool.query<{ column_name: string }>(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = $1`,
    [tableName]
  );
  return result.rows.map((row) => row.column_name);
};

const resolveCarpetaTable = async (): Promise<CarpetaTableInfo | null> => {
  const byFk = await resolveCarpetaTableByFk();
  const tableName = byFk?.table_name ?? (await resolveCarpetaTableByCandidates());
  if (!tableName) {
    return null;
  }

  const columns = await getTableColumns(tableName);
  if (columns.length === 0) {
    return null;
  }

  const idColumn =
    byFk?.id_column ??
    columns.find((column) => column === "id_carpeta") ??
    columns.find((column) => column.startsWith("id_")) ??
    null;

  const nameColumn =
    CANDIDATE_NAME_COLUMNS.find((column) => columns.includes(column)) ?? null;

  if (!idColumn || !nameColumn) {
    return null;
  }

  const availableColumns = new Set(columns);
  const parentColumn =
    CANDIDATE_PARENT_COLUMNS.find((column) => availableColumns.has(column)) ?? null;
  const hasUsuarioColumn = availableColumns.has("usuario_id");

  return {
    tableName,
    idColumn,
    nameColumn,
    parentColumn,
    hasUsuarioColumn,
  };
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

export const getRutinas = async (creadorId?: number) => {
  const result = await pool.query(
    creadorId == null
      ? `SELECT * FROM rutina ORDER BY fecha_creacion DESC`
      : `SELECT *
         FROM rutina
         WHERE creador_id = $1
         ORDER BY fecha_creacion DESC`,
    creadorId == null ? [] : [creadorId]
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
       AND ($4::int IS NULL OR creador_id = $4)
     RETURNING *`,
    [
      nombre,
      descripcion ?? null,
      duracion_estimada ?? null,
      creador_id ?? null,
      id_carpeta ?? null,
      id,
    ]
  );

  return result.rows[0];
};

export const deleteRutina = async (id: string, creadorId?: number) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const rutinaResult = await client.query(
      creadorId == null
        ? `SELECT *
           FROM rutina
           WHERE id_rutina = $1
           FOR UPDATE`
        : `SELECT *
           FROM rutina
           WHERE id_rutina = $1
             AND creador_id = $2
           FOR UPDATE`,
      creadorId == null ? [id] : [id, creadorId]
    );

    const rutina = rutinaResult.rows[0] ?? null;

    if (!rutina) {
      await client.query("ROLLBACK");
      return null;
    }

    await client.query(
      `UPDATE sesionentrenamiento
       SET rutina_id = NULL,
           nombre_rutina_snapshot = COALESCE(NULLIF(nombre_rutina_snapshot, ''), $2)
       WHERE rutina_id = $1`,
      [id, rutina.nombre ?? null]
    );

    const deleteResult = await client.query(
      `DELETE FROM rutina
       WHERE id_rutina = $1
       RETURNING *`,
      [id]
    );

    await client.query("COMMIT");
    return deleteResult.rows[0] ?? null;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

export const getCarpetasRutina = async (usuarioId?: number) => {
  const tableInfo = await resolveCarpetaTable();
  if (!tableInfo) {
    return [];
  }

  const parentSelect = tableInfo.parentColumn
    ? `${quoteIdent(tableInfo.parentColumn)} AS id_carpeta_padre`
    : "NULL::integer AS id_carpeta_padre";

  const params: number[] = [];
  const whereSql =
    usuarioId != null && tableInfo.hasUsuarioColumn
      ? (() => {
          params.push(usuarioId);
          return `WHERE ${quoteIdent("usuario_id")} = $1`;
        })()
      : "";

  const result = await pool.query(
    `SELECT ${quoteIdent(tableInfo.idColumn)} AS id_carpeta,
            ${quoteIdent(tableInfo.nameColumn)} AS nombre,
            ${parentSelect}
     FROM ${quoteIdent(tableInfo.tableName)}
     ${whereSql}
     ORDER BY ${quoteIdent(tableInfo.nameColumn)} ASC`,
    params
  );

  return result.rows;
};

export const crearCarpetaRutina = async (data: any) => {
  const tableInfo = await resolveCarpetaTable();
  if (!tableInfo) {
    throw new Error("No existe tabla de carpetas de rutina en la base de datos");
  }

  const { nombre, id_carpeta_padre, usuario_id } = data;

  if (tableInfo.hasUsuarioColumn && (usuario_id == null || Number.isNaN(Number(usuario_id)))) {
    throw new Error("usuario_id es obligatorio para crear carpeta");
  }

  const insertColumns: string[] = [quoteIdent(tableInfo.nameColumn)];
  const insertValues: any[] = [nombre];

  if (tableInfo.parentColumn) {
    insertColumns.push(quoteIdent(tableInfo.parentColumn));
    insertValues.push(id_carpeta_padre ?? null);
  }

  if (tableInfo.hasUsuarioColumn) {
    insertColumns.push(quoteIdent("usuario_id"));
    insertValues.push(Number(usuario_id));
  }

  const placeholders = insertValues.map((_, index) => `$${index + 1}`).join(", ");
  const parentSelect = tableInfo.parentColumn
    ? `${quoteIdent(tableInfo.parentColumn)} AS id_carpeta_padre`
    : "NULL::integer AS id_carpeta_padre";

  const result = await pool.query(
    `INSERT INTO ${quoteIdent(tableInfo.tableName)} (${insertColumns.join(", ")})
     VALUES (${placeholders})
     RETURNING ${quoteIdent(tableInfo.idColumn)} AS id_carpeta,
               ${quoteIdent(tableInfo.nameColumn)} AS nombre,
               ${parentSelect}`,
    insertValues
  );

  return result.rows[0];
};

export const updateCarpetaRutina = async (id: string, data: any) => {
  const tableInfo = await resolveCarpetaTable();
  if (!tableInfo) {
    throw new Error("No existe tabla de carpetas de rutina en la base de datos");
  }

  const { nombre, usuario_id } = data;
  if (!nombre || typeof nombre !== "string" || !nombre.trim()) {
    throw new Error("nombre es obligatorio");
  }

  const whereClauses = [`${quoteIdent(tableInfo.idColumn)} = $2`];
  const params: any[] = [nombre.trim(), Number(id)];

  if (tableInfo.hasUsuarioColumn) {
    if (usuario_id == null || Number.isNaN(Number(usuario_id))) {
      throw new Error("usuario_id es obligatorio para actualizar carpeta");
    }
    whereClauses.push(`${quoteIdent("usuario_id")} = $3`);
    params.push(Number(usuario_id));
  }

  const parentSelect = tableInfo.parentColumn
    ? `${quoteIdent(tableInfo.parentColumn)} AS id_carpeta_padre`
    : "NULL::integer AS id_carpeta_padre";

  const result = await pool.query(
    `UPDATE ${quoteIdent(tableInfo.tableName)}
     SET ${quoteIdent(tableInfo.nameColumn)} = $1
     WHERE ${whereClauses.join(" AND ")}
     RETURNING ${quoteIdent(tableInfo.idColumn)} AS id_carpeta,
               ${quoteIdent(tableInfo.nameColumn)} AS nombre,
               ${parentSelect}`,
    params
  );

  return result.rows[0] ?? null;
};

export const deleteCarpetaRutina = async (id: string, data: any) => {
  const tableInfo = await resolveCarpetaTable();
  if (!tableInfo) {
    throw new Error("No existe tabla de carpetas de rutina en la base de datos");
  }

  const { usuario_id } = data;
  const whereClauses = [`${quoteIdent(tableInfo.idColumn)} = $1`];
  const params: any[] = [Number(id)];

  if (tableInfo.hasUsuarioColumn) {
    if (usuario_id == null || Number.isNaN(Number(usuario_id))) {
      throw new Error("usuario_id es obligatorio para eliminar carpeta");
    }
    whereClauses.push(`${quoteIdent("usuario_id")} = $2`);
    params.push(Number(usuario_id));
  }

  await pool.query(`UPDATE rutina SET id_carpeta = NULL WHERE id_carpeta = $1`, [Number(id)]);

  if (tableInfo.parentColumn) {
    await pool.query(
      `UPDATE ${quoteIdent(tableInfo.tableName)}
       SET ${quoteIdent(tableInfo.parentColumn)} = NULL
       WHERE ${quoteIdent(tableInfo.parentColumn)} = $1`,
      [Number(id)]
    );
  }

  const result = await pool.query(
    `DELETE FROM ${quoteIdent(tableInfo.tableName)}
     WHERE ${whereClauses.join(" AND ")}
     RETURNING ${quoteIdent(tableInfo.idColumn)} AS id_carpeta`,
    params
  );

  return result.rows[0] ?? null;
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
