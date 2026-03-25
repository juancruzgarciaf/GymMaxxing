import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import usuarioRoutes from "./routes/usuario.routes";

dotenv.config();


const app = express();
app.use(cors());
app.use(express.json());

app.use(usuarioRoutes);

app.listen(3000, () => {
  console.log("Servidor corriendo en http://localhost:3000");
});

import { pool } from "./db";

pool.query("SELECT NOW()")
  .then(res => console.log("DB OK:", res.rows))
  .catch(err => console.error("DB ERROR:", err));