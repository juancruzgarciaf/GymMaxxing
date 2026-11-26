import cors from "cors";
import express from "express";
import path from "path";
import { pool } from "./db";
import { isBucketStorageEnabled, serveUploadFromBucket } from "./utils/storage";

import authRoutes from "./routes/auth.routes";
import userRoutes from "./routes/user.routes";
import rutinaRoutes from "./routes/rutina.routes";
import entrenamientoRoutes from "./routes/entrenamiento.routes";
import ejercicioRoutes from "./routes/ejercicio.routes";
import gimnasioRoutes from "./routes/gimnasio.routes";
import notificationRoutes from "./routes/notification.routes";
import routineGenerationRoutes from "./routes/routine-generation.routes";
import subscriptionRoutes from "./routes/subscription.routes";
import musicaRoutes from "./routes/musica.routes";
import { ensureMusicColumns } from "./services/musica.service";


const app = express();

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.resolve(__dirname, "../uploads")));
// Lo que no está en la carpeta local (fotos subidas al bucket) se busca en el bucket.
app.get("/uploads/*splat", serveUploadFromBucket);

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
app.use("/musica", musicaRoutes);

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

// Antes de escuchar, nos aseguramos de que existan las columnas de música
// (playlist de Spotify y canción de Apple) en entrenamientos y rutinas.
const startServer = () => app.listen(3000, () => {
  console.log("Servidor corriendo en http://localhost:3000");
  console.log(
    isBucketStorageEnabled
      ? "Fotos: bucket de Railway"
      : "Fotos: carpeta local backend/uploads (configurá BUCKET_* en el .env para usar el bucket)"
  );
});

ensureMusicColumns()
  .catch((err) => console.error("ERROR COLUMNAS MUSICA:", err))
  .finally(startServer);
