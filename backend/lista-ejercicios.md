id_ejercicio INT PRIMARY KEY,
nombre TEXT,
descripcion TEXT,
grupo_muscular TEXT,
tipo_disciplina TEXT

import { Pool } from "pg";
import * as dotenv from "dotenv";

dotenv.config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: Number(process.env.DB_PORT),
});

const ejercicios = [
  [1, "Press banca", "Ejercicio compuesto con barra para pecho", "Pecho", "Musculación"],
  [2, "Press inclinado", "Enfocado en la parte superior del pecho", "Pecho", "Musculación"],
  [3, "Aperturas con mancuernas", "Ejercicio analítico para estirar el pecho", "Pecho", "Musculación"],
  [4, "Fondos en paralelas", "Trabaja pecho y tríceps", "Pecho", "Calistenia"],
  [5, "Dominadas", "Ejercicio en barra para espalda", "Espalda", "Calistenia"],
  [6, "Jalón al pecho", "Simulación de dominadas en polea", "Espalda", "Musculación"],
  [7, "Remo con barra", "Ejercicio de espalda media", "Espalda", "Musculación"],
  [8, "Remo con mancuerna", "Remo unilateral para espalda", "Espalda", "Musculación"],
  [9, "Sentadilla", "Ejercicio base de piernas", "Piernas", "Musculación"],
  [10, "Prensa de piernas", "Trabajo de cuádriceps en máquina", "Piernas", "Musculación"],
  [11, "Peso muerto", "Ejercicio compuesto de cadena posterior", "Piernas", "Musculación"],
  [12, "Zancadas", "Ejercicio unilateral de piernas", "Piernas", "Musculación"],
  [13, "Curl femoral", "Trabajo de isquiotibiales", "Piernas", "Musculación"],
  [14, "Press militar", "Ejercicio principal de hombros", "Hombros", "Musculación"],
  [15, "Elevaciones laterales", "Aísla el deltoide lateral", "Hombros", "Musculación"],
  [16, "Pájaros", "Trabaja deltoide posterior", "Hombros", "Musculación"],
  [17, "Curl bíceps con barra", "Ejercicio básico de bíceps", "Bíceps", "Musculación"],
  [18, "Curl martillo", "Trabaja bíceps y braquial", "Bíceps", "Musculación"],
  [19, "Extensión de tríceps en polea", "Aislamiento de tríceps", "Tríceps", "Musculación"],
  [20, "Press francés", "Ejercicio de tríceps con barra", "Tríceps", "Musculación"],
  [21, "Crunch abdominal", "Ejercicio básico de abdomen", "Core", "Musculación"],
  [22, "Elevaciones de piernas", "Trabaja abdomen inferior", "Core", "Musculación"],
  [23, "Plancha", "Ejercicio isométrico de core", "Core", "Calistenia"],
  [24, "Cinta", "Ejercicio cardiovascular caminando o corriendo", "Cardio", "Cardio"],
  [25, "Bicicleta", "Ejercicio cardiovascular en bici fija", "Cardio", "Cardio"],
  [26, "Elíptico", "Ejercicio cardiovascular de bajo impacto", "Cardio", "Cardio"],
];

async function seed() {
  try {
    console.log("Conectando a la DB...");
    await pool.connect();

    console.log("Insertando ejercicios...");

    for (const ejercicio of ejercicios) {
      await pool.query(
        `INSERT INTO ejercicios (id_ejercicio, nombre, descripcion, grupo_muscular, tipo_disciplina)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id_ejercicio) DO NOTHING`,
        ejercicio
      );
    }

    console.log("✅ Datos insertados correctamente");
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await pool.end();
  }
}

seed();