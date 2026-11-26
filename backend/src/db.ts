import "dotenv/config";
import { Pool } from "pg";

// Las fechas se guardan en columnas TIMESTAMP (sin zona horaria) con NOW().
// Si Node y Postgres usan zonas distintas (por ejemplo, la base de Railway corre en UTC
// y la compu en Argentina), node-postgres lee esas fechas corridas 3 horas y, por ejemplo,
// el inicio de un entrenamiento queda "en el futuro" y el cronómetro se queda en 00:00.
// Por eso fijamos la misma zona horaria en Node y en cada conexión a la base.
export const APP_TIMEZONE = process.env.APP_TIMEZONE?.trim() || "America/Argentina/Buenos_Aires";
process.env.TZ = APP_TIMEZONE;

const getEnv = (key: string) => {
  const value = process.env[key];

  if (!value) {
    throw new Error(`Falta configurar ${key} en backend/.env`);
  }

  return value;
};

const dbPort = Number(getEnv("DB_PORT"));

if (Number.isNaN(dbPort)) {
  throw new Error("DB_PORT debe ser un numero valido en backend/.env");
}

export const pool = new Pool({
  user: getEnv("DB_USER"),
  host: getEnv("DB_HOST"),
  database: getEnv("DB_NAME"),
  password: getEnv("DB_PASSWORD"),
  port: dbPort,
  options: `-c timezone=${APP_TIMEZONE}`,
});
