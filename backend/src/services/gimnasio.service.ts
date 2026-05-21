import { pool } from "../db";

export type GimnasioMapa = {
  id: string;
  nombre: string;
  direccion: string | null;
  latitud: number;
  longitud: number;
  descripcion: string | null;
  imagenUrl: string | null;
  origen: "local" | "google";
  placeId?: string | null;
};

type LocalGymRow = {
  id_gimnasio: number;
  nombre: string;
  direccion: string | null;
  latitud: number;
  longitud: number;
  descripcion: string | null;
  imagen_url: string | null;
  google_place_id: string | null;
};

type GooglePlace = {
  id?: string;
  displayName?: {
    text?: string;
  };
  formattedAddress?: string;
  location?: {
    latitude?: number;
    longitude?: number;
  };
};

const DEFAULT_RADIUS_METERS = 3000;

let gimnasioTableReady = false;

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
       google_place_id TEXT UNIQUE,
       fecha_creacion TIMESTAMP DEFAULT NOW()
     )`
  );

  gimnasioTableReady = true;
};

const toNumber = (value: number) => Number(value);

const getLocalGymsNearby = async (
  lat: number,
  lng: number,
  radiusMeters = DEFAULT_RADIUS_METERS
): Promise<GimnasioMapa[]> => {
  await ensureGimnasioTable();

  const result = await pool.query<LocalGymRow>(
    `SELECT id_gimnasio,
            nombre,
            direccion,
            latitud,
            longitud,
            descripcion,
            imagen_url,
            google_place_id
     FROM gimnasio
     WHERE (
       6371000 * 2 * ASIN(
         SQRT(
           POWER(SIN(RADIANS((latitud - $1) / 2)), 2) +
           COS(RADIANS($1)) * COS(RADIANS(latitud)) *
           POWER(SIN(RADIANS((longitud - $2) / 2)), 2)
         )
       )
     ) <= $3
     ORDER BY (
       6371000 * 2 * ASIN(
         SQRT(
           POWER(SIN(RADIANS((latitud - $1) / 2)), 2) +
           COS(RADIANS($1)) * COS(RADIANS(latitud)) *
           POWER(SIN(RADIANS((longitud - $2) / 2)), 2)
         )
       )
     ) ASC`,
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
    placeId: row.google_place_id,
  }));
};

const getGoogleGymsNearby = async (
  lat: number,
  lng: number,
  apiKey: string,
  radiusMeters = DEFAULT_RADIUS_METERS
): Promise<GimnasioMapa[]> => {
  const response = await fetch("https://places.googleapis.com/v1/places:searchNearby", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location",
    },
    body: JSON.stringify({
      includedTypes: ["gym"],
      maxResultCount: 20,
      locationRestriction: {
        circle: {
          center: {
            latitude: lat,
            longitude: lng,
          },
          radius: radiusMeters,
        },
      },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Google Places no pudo buscar gimnasios cercanos");
  }

  const data = (await response.json()) as { places?: GooglePlace[] };

  return (data.places ?? [])
    .map((place): GimnasioMapa | null => {
      const latitude = place.location?.latitude;
      const longitude = place.location?.longitude;
      const id = place.id;

      if (!id || latitude == null || longitude == null) {
        return null;
      }

      return {
        id,
        nombre: place.displayName?.text ?? "Gimnasio",
        direccion: place.formattedAddress ?? null,
        latitud: latitude,
        longitud: longitude,
        descripcion: null,
        imagenUrl: null,
        origen: "google",
        placeId: id,
      };
    })
    .filter((gym): gym is GimnasioMapa => gym != null);
};

export const getGimnasiosCercanos = async (lat: number, lng: number) => {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;

  if (!apiKey) {
    const error = new Error("Falta configurar GOOGLE_PLACES_API_KEY en backend/.env");
    error.name = "MissingGooglePlacesApiKey";
    throw error;
  }

  const [localGyms, googleGyms] = await Promise.all([
    getLocalGymsNearby(lat, lng),
    getGoogleGymsNearby(lat, lng, apiKey),
  ]);

  const localPlaceIds = new Set(
    localGyms.map((gym) => gym.placeId).filter((placeId): placeId is string => Boolean(placeId))
  );
  const filteredGoogleGyms = googleGyms.filter((gym) => !localPlaceIds.has(gym.placeId ?? ""));

  return [...localGyms, ...filteredGoogleGyms];
};
