import { Pool } from "pg";

export const pool = new Pool({
  user: "postgres",
  host: "127.0.0.1",
  database: "gymmaxxing_db",
  password: "1234",
  port: 5432,
});