import { pool } from "../db";

export type BodyMeasurementInput = {
  fecha?: string;
  peso?: number | null;
  cintura?: number | null;
  pecho?: number | null;
  brazo?: number | null;
  cadera?: number | null;
  muslo?: number | null;
  nota?: string | null;
};

export const listBodyMeasurements = async (userId: number) => {
  const result = await pool.query(
    `SELECT id_medida, usuario_id, fecha::text,
            peso::float, cintura::float, pecho::float, brazo::float,
            cadera::float, muslo::float, nota, fecha_creacion::text
     FROM medida_corporal
     WHERE usuario_id = $1
     ORDER BY fecha ASC, id_medida ASC`,
    [userId],
  );
  return result.rows;
};

export const saveBodyMeasurement = async (
  userId: number,
  input: BodyMeasurementInput,
) => {
  const values = [
    input.peso,
    input.cintura,
    input.pecho,
    input.brazo,
    input.cadera,
    input.muslo,
  ];
  if (!values.some((value) => value != null)) {
    throw new Error("Ingresa al menos una medida corporal");
  }

  const result = await pool.query(
    `INSERT INTO medida_corporal
       (usuario_id, fecha, peso, cintura, pecho, brazo, cadera, muslo, nota)
     VALUES ($1, COALESCE($2::date, CURRENT_DATE), $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (usuario_id, fecha)
     DO UPDATE SET peso = EXCLUDED.peso,
                   cintura = EXCLUDED.cintura,
                   pecho = EXCLUDED.pecho,
                   brazo = EXCLUDED.brazo,
                   cadera = EXCLUDED.cadera,
                   muslo = EXCLUDED.muslo,
                   nota = EXCLUDED.nota
     RETURNING id_medida, usuario_id, fecha::text,
               peso::float, cintura::float, pecho::float, brazo::float,
               cadera::float, muslo::float, nota, fecha_creacion::text`,
    [
      userId,
      input.fecha ?? null,
      input.peso ?? null,
      input.cintura ?? null,
      input.pecho ?? null,
      input.brazo ?? null,
      input.cadera ?? null,
      input.muslo ?? null,
      input.nota?.trim() || null,
    ],
  );
  return result.rows[0];
};

export const deleteBodyMeasurement = async (
  userId: number,
  measurementId: number,
) => {
  const result = await pool.query(
    `DELETE FROM medida_corporal
     WHERE id_medida = $1 AND usuario_id = $2
     RETURNING id_medida`,
    [measurementId, userId],
  );
  return result.rowCount === 1;
};
