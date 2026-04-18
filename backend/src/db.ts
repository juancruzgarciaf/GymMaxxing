import "dotenv/config";
import { Pool } from "pg";

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
});
