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

type RutinaRow = {
  id_rutina: number;
  nombre: string;
  descripcion: string | null;
  duracion_estimada: number | null;
  fecha_creacion: string | null;
  creador_id: number;
  id_carpeta: number | null;
  save_count: number;
  copy_count: number;
};

type RutinaMetricSummary = {
  save_count: number;
  copy_count: number;
};

type RutinaMetricSupport = {
  has_save: boolean;
  has_copy: boolean;
};

type DiscoverRutinaRow = RutinaRow & {
  creador_username: string;
  total_ejercicios: number;
  grupos_musculares: string[];
  creador_seguido: boolean;
};

type DiscoverRutinasFilters = {
  viewerId?: number;
  q?: string;
  gruposMusculares?: string[];
  orden?: string;
  excludeFollowing?: boolean;
  soloAdmin?: boolean;
  adminId?: number;
  adminEmail?: string;
  tipoCreador?: string;
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

const getRutinaMetricsSupport = async (): Promise<RutinaMetricSupport> => {
  const result = await pool.query<RutinaMetricSupport>(
    `SELECT
       to_regclass('public.rutina_guardado') IS NOT NULL AS has_save,
       to_regclass('public.rutina_copia') IS NOT NULL AS has_copy`
  );

  return (
    result.rows[0] ?? {
      has_save: false,
      has_copy: false,
    }
  );
};

const buildRutinaSelectSql = (alias: string, support: RutinaMetricSupport) => `
  SELECT ${alias}.id_rutina,
         ${alias}.nombre,
         ${alias}.descripcion,
         ${alias}.duracion_estimada,
         ${alias}.fecha_creacion,
         ${alias}.creador_id,
         ${alias}.id_carpeta,
         ${
           support.has_save
             ? `(SELECT COUNT(*)::int FROM rutina_guardado rg WHERE rg.rutina_id = ${alias}.id_rutina)`
             : `0::int`
         } AS save_count,
         ${
           support.has_copy
             ? `(SELECT COUNT(*)::int FROM rutina_copia rc WHERE rc.rutina_id = ${alias}.id_rutina)`
             : `0::int`
         } AS copy_count
  FROM rutina ${alias}
`;

const getRutinaMetricSummary = async (
  id_rutina: string,
  support?: RutinaMetricSupport
): Promise<RutinaMetricSummary> => {
  const resolvedSupport = support ?? (await getRutinaMetricsSupport());
  const usesParams = resolvedSupport.has_save || resolvedSupport.has_copy;
  const result = await pool.query<RutinaMetricSummary>(
    `SELECT
       ${
         resolvedSupport.has_save
           ? `(SELECT COUNT(*)::int FROM rutina_guardado rg WHERE rg.rutina_id = $1)`
           : `0::int`
       } AS save_count,
       ${
         resolvedSupport.has_copy
           ? `(SELECT COUNT(*)::int FROM rutina_copia rc WHERE rc.rutina_id = $1)`
           : `0::int`
       } AS copy_count`,
    usesParams ? [id_rutina] : []
  );

  return (
    result.rows[0] ?? {
      save_count: 0,
      copy_count: 0,
    }
  );
};

const recordRutinaMetric = async (
  id_rutina: string,
  usuario_id: number,
  metric: "save" | "copy"
) => {
  const rutina = await getRutinaPorId(id_rutina);
  if (!rutina) {
    return null;
  }

  const support = await getRutinaMetricsSupport();
  const tableName =
    metric === "save"
      ? support.has_save
        ? "rutina_guardado"
        : null
      : support.has_copy
        ? "rutina_copia"
        : null;

  if (tableName) {
    await pool.query(
      `INSERT INTO ${tableName} (rutina_id, usuario_id, fecha)
       VALUES ($1, $2, NOW())
       ON CONFLICT (rutina_id, usuario_id) DO NOTHING`,
      [id_rutina, usuario_id]
    );
  }

  return getRutinaMetricSummary(id_rutina, support);
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

  const result = await pool.query<RutinaRow>(
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

  return result.rows[0]
    ? {
        ...result.rows[0],
        save_count: 0,
        copy_count: 0,
      }
    : null;
};

export const getRutinas = async (creadorId?: number) => {
  const support = await getRutinaMetricsSupport();
  const baseSql = buildRutinaSelectSql("r", support);
  const result = await pool.query<RutinaRow>(
    creadorId == null
      ? `${baseSql}
         ORDER BY r.fecha_creacion DESC`
      : `${baseSql}
         WHERE r.creador_id = $1
         ORDER BY r.fecha_creacion DESC`,
    creadorId == null ? [] : [creadorId]
  );
  return result.rows;
};

const getUsuarioIdByEmail = async (email: string) => {
  const result = await pool.query<{ id: number }>(
    `SELECT id
     FROM usuario
     WHERE LOWER(email) = LOWER($1)
     LIMIT 1`,
    [email]
  );

  return result.rows[0]?.id ?? null;
};

const getDiscoverOrderSql = (orden: string | undefined) => {
  switch (orden) {
    case "populares":
      return "ORDER BY (r.save_count + r.copy_count) DESC, r.fecha_creacion DESC";
    case "copiadas":
      return "ORDER BY r.copy_count DESC, r.fecha_creacion DESC";
    case "guardadas":
      return "ORDER BY r.save_count DESC, r.fecha_creacion DESC";
    case "random":
      return "ORDER BY RANDOM()";
    case "recientes":
    default:
      return "ORDER BY r.fecha_creacion DESC";
  }
};

export const getDiscoverRutinas = async (filters: DiscoverRutinasFilters) => {
  const support = await getRutinaMetricsSupport();
  const params: Array<number | string | string[]> = [];
  const whereClauses: string[] = ["TRUE"];

  const {
    viewerId,
    q,
    gruposMusculares,
    orden,
    excludeFollowing,
    soloAdmin,
    adminId,
    adminEmail,
    tipoCreador,
  } = filters;

  const resolvedAdminId =
    adminId ?? (await getUsuarioIdByEmail(adminEmail ?? "admin@gmail.com"));

  if (viewerId != null) {
    params.push(viewerId);
    whereClauses.push(`r.creador_id <> $${params.length}`);
  }

  if (excludeFollowing && viewerId != null) {
    params.push(viewerId);
    whereClauses.push(`NOT EXISTS (
      SELECT 1
      FROM seguimientousuario su
      WHERE su.id_seguidor = $${params.length}
        AND su.id_seguido = r.creador_id
    )`);

    if (!soloAdmin && resolvedAdminId != null) {
      params.push(resolvedAdminId);
      whereClauses.push(`r.creador_id <> $${params.length}`);
    }
  }

  if (soloAdmin) {
    if (resolvedAdminId == null) {
      whereClauses.push("FALSE");
    } else {
      params.push(resolvedAdminId);
      whereClauses.push(`r.creador_id = $${params.length}`);
    }
  }

  if (q) {
    params.push(`%${q}%`);
    whereClauses.push(`r.nombre ILIKE $${params.length}`);
  }

  if (tipoCreador) {
    params.push(tipoCreador);
    whereClauses.push(`LOWER(u.tipo_usuario) = LOWER($${params.length})`);

    // Las rutinas oficiales (admin@gmail.com) no deben contaminar filtros
    // de creadores comunes, entrenadores o gimnasios.
    if (!soloAdmin && resolvedAdminId != null) {
      params.push(resolvedAdminId);
      whereClauses.push(`r.creador_id <> $${params.length}`);
    }
  }

  if (gruposMusculares && gruposMusculares.length > 0) {
    params.push(gruposMusculares);
    whereClauses.push(`EXISTS (
      SELECT 1
      FROM rutinaejercicio re
      JOIN ejercicio e ON e.id_ejercicio = re.id_ejercicio
      WHERE re.id_rutina = r.id_rutina
        AND e.grupo_muscular = ANY($${params.length}::text[])
    )`);
  }

  const viewerFollowSql =
    viewerId == null
      ? "FALSE AS creador_seguido"
      : (() => {
          params.push(viewerId);
          return `EXISTS (
            SELECT 1
            FROM seguimientousuario su
            WHERE su.id_seguidor = $${params.length}
              AND su.id_seguido = r.creador_id
          ) AS creador_seguido`;
        })();

  const result = await pool.query<DiscoverRutinaRow>(
    `SELECT r.id_rutina,
            r.nombre,
            r.descripcion,
            r.duracion_estimada,
            r.fecha_creacion,
            r.creador_id,
            r.id_carpeta,
            r.save_count,
            r.copy_count,
            u.username AS creador_username,
            (
              SELECT COUNT(*)::int
              FROM rutinaejercicio re
              WHERE re.id_rutina = r.id_rutina
            ) AS total_ejercicios,
            COALESCE((
              SELECT ARRAY_AGG(DISTINCT e.grupo_muscular ORDER BY e.grupo_muscular)
              FROM rutinaejercicio re
              JOIN ejercicio e ON e.id_ejercicio = re.id_ejercicio
              WHERE re.id_rutina = r.id_rutina
            ), ARRAY[]::text[]) AS grupos_musculares,
            ${viewerFollowSql}
     FROM (
       ${buildRutinaSelectSql("base", support)}
     ) r
     JOIN usuario u ON u.id = r.creador_id
     WHERE ${whereClauses.join(" AND ")}
     ${getDiscoverOrderSql(orden)}
     LIMIT 80`,
    params
  );

  return result.rows;
};

export const getRutinaPorId = async (id: string) => {
  const support = await getRutinaMetricsSupport();
  const result = await pool.query<RutinaRow>(
    `${buildRutinaSelectSql("r", support)}
     WHERE r.id_rutina = $1`,
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

  const result = await pool.query<RutinaRow>(
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

  return result.rows[0] ? getRutinaPorId(String(result.rows[0].id_rutina)) : null;
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

export const recordRutinaSave = async (id_rutina: string, usuario_id: number) =>
  recordRutinaMetric(id_rutina, usuario_id, "save");

export const recordRutinaCopy = async (id_rutina: string, usuario_id: number) =>
  recordRutinaMetric(id_rutina, usuario_id, "copy");

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
