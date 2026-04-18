import cors from "cors";
import express from "express";
import { pool } from "./db";

import authRoutes from "./routes/auth.routes";
import userRoutes from "./routes/user.routes";
import rutinaRoutes from "./routes/rutina.routes";
import entrenamientoRoutes from "./routes/entrenamiento.routes";
import ejercicioRoutes from "./routes/ejercicio.routes";


const app = express();

app.use(cors());
app.use(express.json());

// rutas
app.use("/auth", authRoutes);
app.use("/users", userRoutes);
app.use("/rutinas", rutinaRoutes);
app.use("/entrenamientos", entrenamientoRoutes);
app.use("/ejercicios", ejercicioRoutes);

// test DB
pool.query("SELECT NOW()")
  .then((res) => console.log("DB OK:", res.rows))
  .catch((err) => console.error("DB ERROR:", err));

app.listen(3000, () => {
  console.log("Servidor corriendo en http://localhost:3000");
});
