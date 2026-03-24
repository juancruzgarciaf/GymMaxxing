import { Pool } from "pg";

export const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "gymmaxxing_db",
  password: "26062011",
  port: 5432,
});