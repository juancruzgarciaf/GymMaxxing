import { pool } from "../db";

export type GimnasioMapa = {
  id: string;
  nombre: string;
  direccion: string | null;
  latitud: number;
  longitud: number;
  descripcion: string | null;
  imagenUrl: string | null;
  origen: "local";
  distanciaMetros: number;
};

type LocalGymRow = {
  id_gimnasio: number;
  nombre: string;
  direccion: string | null;
  latitud: number;
  longitud: number;
  descripcion: string | null;
  imagen_url: string | null;
  distancia_metros: number;
};

const DEFAULT_RADIUS_METERS = 15000;
const LEGACY_SPORTCLUB_PILAR_ADDRESS = "Av. Lagomarsino 905, Ruta 8 y Guido, Pilar, Buenos Aires";

let gimnasioTableReady = false;
let gimnasioSeedReady = false;

const seedGimnasios = [
  {
    nombre: "SportClub Pilar",
    direccion: "Shopping Las Palmas del Pilar Ruta Panamericana Km 50, Pilar",
    latitud: -34.4462642,
    longitud: -58.868823,
    descripcion: "Gimnasio en Pilar.",
  },
  {
    nombre: "SportClub Paseo Champagnat",
    direccion: "Shopping Paseo Champagnat, Panamericana Km 54, Pilar, Buenos Aires",
    latitud: -34.4495113,
    longitud: -58.9156222,
    descripcion: "Gimnasio en Paseo Champagnat, Pilar.",
  },
  {
    nombre: "Megatlon Pilar",
    direccion: "Panamericana Km 49,5, Pilar, Buenos Aires",
    latitud: -34.4492,
    longitud: -58.8725,
    descripcion: "Gimnasio en Pilar.",
  },
  {
    nombre: "Atlas Gym Pilar",
    direccion: "11 de Septiembre 529, Pilar, Buenos Aires",
    latitud: -34.4583,
    longitud: -58.9136,
    descripcion: "Gimnasio en Pilar Centro.",
  },
  {
    nombre: "Pilar Fitness",
    direccion: "B1629GNI El Rincón 699-799, GNI, B1629 Pilar Centro, Provincia de Buenos Aires",
    latitud: -34.4595,
    longitud: -58.9129,
    descripcion: "Gimnasio en Pilar Centro.",
  },
  {
    nombre: "Megatlon Distrito Arcos",
    direccion: "Godoy Cruz 2626, Palermo, Ciudad Autonoma de Buenos Aires",
    latitud: -34.5793909,
    longitud: -58.4260635,
    descripcion: "Gimnasio en Palermo.",
  },
  {
    nombre: "SportClub Unicenter",
    direccion: "Parana 3745, Martinez, Buenos Aires",
    latitud: -34.5081,
    longitud: -58.5239,
    descripcion: "Gimnasio en Unicenter, zona norte.",
  },
];

export const ensureGimnasioTable = async () => {
  if (gimnasioTableReady) {
    return;
  }

  await pool.query(
    `CREATE TABLE IF NOT EXISTS gimnasio (
       id_gimnasio SERIAL PRIMARY KEY,
       nombre TEXT NOT NULL,
       direccion TEXT,
       latitud DOUBLE PRECISION NOT NULL,
       longitud DOUBLE PRECISION NOT NULL,
       descripcion TEXT,
       imagen_url TEXT,
       fecha_creacion TIMESTAMP DEFAULT NOW()
     )`
  );

  gimnasioTableReady = true;
};

const toNumber = (value: number) => Number(value);

export const seedGimnasiosIfMissing = async () => {
  if (gimnasioSeedReady) {
    return;
  }

  await ensureGimnasioTable();

  await pool.query(
    `DELETE FROM gimnasio
     WHERE LOWER(nombre) = LOWER($1)
       AND direccion = $2`,
    ["SportClub Pilar", LEGACY_SPORTCLUB_PILAR_ADDRESS]
  );

  const sportClubPilarSeed = seedGimnasios.find((gym) => gym.nombre === "SportClub Pilar");

  if (sportClubPilarSeed) {
    await pool.query(
      `UPDATE gimnasio
       SET direccion = $2,
           latitud = $3,
           longitud = $4,
           descripcion = COALESCE(descripcion, $5)
       WHERE LOWER(nombre) = LOWER($1)`,
      [
        sportClubPilarSeed.nombre,
        sportClubPilarSeed.direccion,
        sportClubPilarSeed.latitud,
        sportClubPilarSeed.longitud,
        sportClubPilarSeed.descripcion,
      ]
    );
  }

  for (const gym of seedGimnasios) {
    await pool.query(
      `INSERT INTO gimnasio (nombre, direccion, latitud, longitud, descripcion)
       SELECT $1, $2, $3, $4, $5
       WHERE NOT EXISTS (
         SELECT 1
         FROM gimnasio
         WHERE LOWER(nombre) = LOWER($1)
       )`,
      [
        gym.nombre,
        gym.direccion,
        gym.latitud,
        gym.longitud,
        gym.descripcion,
      ]
    );
  }

  gimnasioSeedReady = true;
};

export const getGimnasiosCercanos = async (
  lat: number,
  lng: number,
  radiusMeters = DEFAULT_RADIUS_METERS
): Promise<GimnasioMapa[]> => {
  await seedGimnasiosIfMissing();

  const result = await pool.query<LocalGymRow>(
    `WITH gimnasios_con_distancia AS (
       SELECT id_gimnasio,
              nombre,
              direccion,
              latitud,
              longitud,
              descripcion,
              imagen_url,
              (
                6371000 * 2 * ASIN(
                  SQRT(
                    POWER(SIN(RADIANS((latitud - $1) / 2)), 2) +
                    COS(RADIANS($1)) * COS(RADIANS(latitud)) *
                    POWER(SIN(RADIANS((longitud - $2) / 2)), 2)
                  )
                )
              ) AS distancia_metros
       FROM gimnasio
     )
     SELECT id_gimnasio,
            nombre,
            direccion,
            latitud,
            longitud,
            descripcion,
            imagen_url,
            distancia_metros
     FROM gimnasios_con_distancia
     WHERE distancia_metros <= $3
     ORDER BY distancia_metros ASC`,
    [lat, lng, radiusMeters]
  );

  return result.rows.map((row) => ({
    id: `local-${row.id_gimnasio}`,
    nombre: row.nombre,
    direccion: row.direccion,
    latitud: toNumber(row.latitud),
    longitud: toNumber(row.longitud),
    descripcion: row.descripcion,
    imagenUrl: row.imagen_url,
    origen: "local",
    distanciaMetros: toNumber(row.distancia_metros),
  }));
};
