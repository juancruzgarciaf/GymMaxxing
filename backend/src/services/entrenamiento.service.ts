import { pool } from "../db";

// =========================
// SESION_ENTRENAMIENTO
// =========================

export const iniciarSesionEntrenamiento = async (data: any) => {
  const { descripcion, gimnasio_id, usuario_id, rutina_id } = data;

  const result = await pool.query(
    `INSERT INTO sesionentrenamiento
     (fecha, descripcion, gimnasio_id, usuario_id, rutina_id)
     VALUES (NOW(), $1, $2, $3, $4)
     RETURNING *`,
    [
      descripcion ?? null,
      gimnasio_id ?? null,
      usuario_id,
      rutina_id,
    ]
  );

  return result.rows[0];
};

export const getSesionPorId = async (id_sesion: string) => {
  const result = await pool.query(
    `SELECT * FROM sesionentrenamiento WHERE id_sesion = $1`,
    [id_sesion]
  );

  return result.rows[0];
};

// =========================
// SERIE
// =========================

export const registrarSerie = async (data: any) => {
  const {
    repeticiones,
    peso,
    descanso,
    orden,
    ejercicio_id,
    sesion_id,
  } = data;

  const result = await pool.query(
    `INSERT INTO serie
     (repeticiones, peso, descanso, orden, ejercicio_id, sesion_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      repeticiones,
      peso ?? null,
      descanso ?? null,
      orden,
      ejercicio_id,
      sesion_id,
    ]
  );

  return result.rows[0];
};

export const getSeriesDeSesion = async (sesion_id: string) => {
  const result = await pool.query(
    `SELECT s.*, e.nombre, e.descripcion, e.grupo_muscular, e.tipo_disciplina
     FROM serie s
     JOIN ejercicio e ON e.id_ejercicio = s.ejercicio_id
     WHERE s.sesion_id = $1
     ORDER BY s.orden ASC`,
    [sesion_id]
  );

  return result.rows;
};

// esto simula “finalizar” aunque tu DER no tenga fecha_fin.
// podemos dejarlo como cierre lógico devolviendo la sesión y sus series.
export const finalizarSesion = async (sesion_id: string) => {
  const sesion = await getSesionPorId(sesion_id);
  const series = await getSeriesDeSesion(sesion_id);

  return {
    sesion,
    series,
    estado: "finalizada",
  };
};