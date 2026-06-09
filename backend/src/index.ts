import cors from "cors";
import express from "express";
import { pool } from "./db";

import authRoutes from "./routes/auth.routes";
import userRoutes from "./routes/user.routes";
import rutinaRoutes from "./routes/rutina.routes";
import entrenamientoRoutes from "./routes/entrenamiento.routes";
import ejercicioRoutes from "./routes/ejercicio.routes";
import gimnasioRoutes from "./routes/gimnasio.routes";
import notificationRoutes from "./routes/notification.routes";
import routineGenerationRoutes from "./routes/routine-generation.routes";
import subscriptionRoutes from "./routes/subscription.routes";


const app = express();

app.use(cors());
app.use(express.json());

// rutas
app.use("/auth", authRoutes);
app.use("/users", userRoutes);
app.use("/rutinas", rutinaRoutes);
app.use("/entrenamientos", entrenamientoRoutes);
app.use("/ejercicios", ejercicioRoutes);
app.use("/gimnasios", gimnasioRoutes);
app.use("/notificaciones", notificationRoutes);
app.use("/rutinas/generar", routineGenerationRoutes);
app.use("/suscripciones", subscriptionRoutes);

// En desarrollo, Mercado Pago necesita una URL publica y luego volvemos al Vite local.
app.get("/pro", (req, res) => {
  const queryIndex = req.originalUrl.indexOf("?");
  const query = queryIndex >= 0 ? req.originalUrl.slice(queryIndex) : "";
  res.redirect(`http://localhost:5173/pro${query}`);
});

// test DB
pool.query("SELECT NOW()")
  .then((res) => console.log("DB OK:", res.rows))
  .catch((err) => console.error("DB ERROR:", err));

app.listen(3000, () => {
  console.log("Servidor corriendo en http://localhost:3000");
});
