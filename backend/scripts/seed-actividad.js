/*
  Seed de actividad para la demo de GymMaxxing.

  1. A cada influencer le crea N entrenamientos finalizados (por defecto 3), todos distintos:
     tipo de día (Push, Pull, Piernas, Upper, Full Body...), ejercicios, series, pesos,
     duración, fecha, gimnasio y descripción se sortean.
  2. Los usuarios de relleno (@seed.gymmaxxing.test) que siguen a cada influencer
     les dan like y comentan esos entrenamientos, en cantidades distintas.

  Uso (desde la carpeta backend):
    node scripts/seed-actividad.js             -> simulación: muestra el plan, no escribe nada
    node scripts/seed-actividad.js --apply     -> crea entrenamientos, likes y comentarios
    node scripts/seed-actividad.js --clean     -> borra todo lo que creó este script

  Opciones:
    --por-usuario=3          entrenamientos por influencer
    --con-coach              también le crea entrenamientos al coach
    --exclude=user1,user2    usernames que no deben recibir entrenamientos

  Requiere haber corrido antes scripts/seed-followers.js --apply.
  Likes y comentarios se insertan directo en la base: no generan notificaciones.
*/
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
const TZ = process.env.APP_TIMEZONE?.trim() || "America/Argentina/Buenos_Aires";
process.env.TZ = TZ; // igual que src/db.ts, para que las fechas no queden corridas 3 horas
const { Pool } = require("pg");

const SEED_DOMAIN = "seed.gymmaxxing.test";
const args = process.argv.slice(2);
const getArg = (name) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split("=").slice(1).join("=") : undefined;
};
const APPLY = args.includes("--apply");
const CLEAN = args.includes("--clean");
const CON_COACH = args.includes("--con-coach");
const POR_USUARIO = Number(getArg("por-usuario") ?? 3);
const EXCLUDE = (getArg("exclude") ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: Number(process.env.DB_PORT),
  options: `-c timezone=${TZ}`,
});

// ---------- helpers ----------
const rand = (min, max) => min + Math.random() * (max - min);
const randInt = (min, max) => Math.floor(rand(min, max + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const chance = (p) => Math.random() < p;
const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const sample = (arr, n) => shuffle(arr).slice(0, n);
const roundTo = (x, step) => Math.max(step, Math.round(x / step) * step);
const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;

// ---------- catálogo (nombres del catálogo oficial) ----------
// base = peso de trabajo típico (kg) de alguien avanzado; null = peso corporal
const EJ = {
  "Press banca": { g: "pecho", base: 95, step: 2.5, reps: [5, 10], comp: true },
  "Press inclinado": { g: "pecho", base: 80, step: 2.5, reps: [6, 10], comp: true },
  "Aperturas con mancuernas": { g: "pecho", base: 22, step: 2, reps: [10, 15] },
  "Fondos en paralelas": { g: "pecho", base: null, reps: [8, 15] },
  "Dominadas": { g: "espalda", base: null, reps: [6, 12] },
  "Jalón al pecho": { g: "espalda", base: 70, step: 2.5, reps: [8, 12] },
  "Remo con barra": { g: "espalda", base: 80, step: 2.5, reps: [6, 10], comp: true },
  "Remo con mancuerna": { g: "espalda", base: 36, step: 2, reps: [8, 12] },
  "Sentadilla": { g: "piernas", base: 130, step: 2.5, reps: [4, 10], comp: true },
  "Prensa de piernas": { g: "piernas", base: 230, step: 10, reps: [8, 15] },
  "Peso muerto": { g: "piernas", base: 160, step: 2.5, reps: [3, 8], comp: true },
  "Zancadas": { g: "piernas", base: 24, step: 2, reps: [8, 12] },
  "Curl femoral": { g: "piernas", base: 50, step: 2.5, reps: [10, 15] },
  "Press militar": { g: "hombros", base: 57.5, step: 2.5, reps: [5, 10], comp: true },
  "Elevaciones laterales": { g: "hombros", base: 12, step: 2, reps: [12, 20] },
  "Pájaros": { g: "hombros", base: 10, step: 2, reps: [12, 20] },
  "Curl bíceps con barra": { g: "biceps", base: 40, step: 2.5, reps: [8, 12] },
  "Curl martillo": { g: "biceps", base: 18, step: 2, reps: [8, 12] },
  "Extensión de tríceps en polea": { g: "triceps", base: 30, step: 2.5, reps: [10, 15] },
  "Press francés": { g: "triceps", base: 35, step: 2.5, reps: [8, 12] },
  "Crunch abdominal": { g: "core", base: null, reps: [15, 25] },
  "Elevaciones de piernas": { g: "core", base: null, reps: [10, 20] },
};
const CARDIO = {
  "Cinta": { kmPorMin: [0.1, 0.17] },
  "Bicicleta": { kmPorMin: [0.3, 0.45] },
  "Elíptico": { kmPorMin: null },
};
const byGroup = (g) => Object.keys(EJ).filter((n) => EJ[n].g === g);

// tipo de día -> [grupo, cantidad de ejercicios]
const PLANTILLAS = [
  { nombre: "Push", slots: [["pecho", 2], ["hombros", [1, 2]], ["triceps", [1, 2]]], tag: "push" },
  { nombre: "Pull", slots: [["espalda", 3], ["biceps", [1, 2]], ["hombros", [0, 1]]], tag: "pull" },
  { nombre: "Piernas", slots: [["piernas", [4, 5]], ["core", [0, 1]]], tag: "legs" },
  { nombre: "Upper", slots: [["pecho", [1, 2]], ["espalda", 2], ["hombros", 1], ["biceps", [0, 1]], ["triceps", [0, 1]]], tag: "upper" },
  { nombre: "Full Body", slots: [["piernas", 2], ["pecho", 1], ["espalda", 1], ["hombros", 1]], tag: "full" },
  { nombre: "Pecho y tríceps", slots: [["pecho", 3], ["triceps", 2]], tag: "push" },
  { nombre: "Espalda y bíceps", slots: [["espalda", 3], ["biceps", 2]], tag: "pull" },
  { nombre: "Hombros y brazos", slots: [["hombros", 3], ["biceps", 1], ["triceps", 1]], tag: "arms" },
];

const DESCRIPCIONES = {
  push: ["Push day 🔥", "Pecho on fire", "Hoy tocaba empujar", "Banca pesada, buen día", "Pump de pecho asegurado 💪"],
  pull: ["Pull day", "Espalda ancha no se hace sola", "Remos y dominadas, lo de siempre", "Buena sesión de espalda 🦍"],
  legs: ["Leg day, sin excusas 🦵", "Hoy no camino más", "Piernas destruidas", "Sentadilla pesada, cabeza fría", "Nunca saltees piernas"],
  upper: ["Upper rápido pero intenso", "Torso completo", "Upper day ✅"],
  full: ["Full body antes del laburo", "Full body, todo el cuerpo trabajado", "Sesión corta pero completa"],
  arms: ["Brazos y hombros 💣", "Día de pump", "Hombros 3D en proceso"],
  general: ["Constancia > motivación", "Otro día más", "Dale que va", "Volviendo de a poco", "Gran sesión", "Sin días libres 😤"],
};

const COMENTARIOS = {
  general: ["Bestia 🔥", "Qué máquina", "Tremendo", "Crack 💪", "Inspiración total", "Esto es constancia", "Qué nivel",
    "Vamos!!", "Animal", "Una bestia como siempre", "Qué disciplina", "Me motivaste a ir hoy", "Mañana copio esta rutina",
    "Fuaa", "Bestial", "Monstruo", "Qué buena sesión", "Inhumano", "Grande!", "Sos un ejemplo", "Así se hace 👏",
    "Qué fuerza", "Esto es otro nivel", "Ídolo", "Excelente rutina", "Uff tremendo volumen"],
  push: ["Ese press banca 😳", "Qué pecho bro", "Cuánto tiempo te llevó llegar a ese peso en banca?", "Push day perfecto"],
  pull: ["Esas dominadas 🔥", "Espalda de otro planeta", "Cómo hacés los remos, con straps?", "La espalda no miente"],
  legs: ["Respeto por no saltear piernas", "Esa sentadilla es una locura", "Mañana no bajás las escaleras 😂", "Peso muerto de bestia"],
  upper: ["Muy completa la rutina", "Buena combinación"],
  full: ["Full body bien armado", "Ideal para cuando no hay tiempo"],
  arms: ["Esos brazos 💣", "Hombros redondos ya", "Qué pump"],
};

// ---------- generación ----------
function buildSession(plantilla, fuerza, ejercicioIds, cardioIds, fechaInicio, gimnasios) {
  const nombres = [];
  for (const [g, cant] of plantilla.slots) {
    const n = Array.isArray(cant) ? randInt(cant[0], cant[1]) : cant;
    const disponibles = byGroup(g).filter((x) => !nombres.includes(x) && ejercicioIds[x]);
    nombres.push(...sample(disponibles, n));
  }

  const series = [];
  for (const nombre of nombres) {
    const e = EJ[nombre];
    const nSeries = randInt(3, 4);
    const trabajo = e.base == null ? null : roundTo(e.base * fuerza * rand(0.9, 1.1), e.step);
    let orden = 1;
    if (e.comp && trabajo && chance(0.6)) {
      series.push({ ejercicio: nombre, orden: orden++, peso: roundTo(trabajo * 0.5, e.step),
        repeticiones: randInt(8, 12), tipo_serie: "warmup", descanso: 60 });
    }
    // reps objetivo del ejercicio; en cada serie se mantienen o bajan un poco por el cansancio
    let repsPrev = randInt(e.reps[0], e.reps[1]);
    let pesoPrev = trabajo;
    for (let i = 0; i < nSeries; i++) {
      const ultima = i === nSeries - 1;
      let peso = pesoPrev;
      let reps = i === 0 ? repsPrev : Math.max(e.reps[0] - 2, 1, repsPrev - pick([0, 0, 1, 1, 2]));
      let tipo = "serie";
      if (trabajo && i > 0 && chance(0.3)) { peso = roundTo(pesoPrev + e.step, e.step); reps = Math.max(1, reps - 1); } // sube el peso
      repsPrev = reps;
      pesoPrev = peso;
      if (ultima && chance(0.25)) { tipo = "failure"; reps = Math.max(1, reps - randInt(0, 2)); }
      else if (ultima && trabajo && !e.comp && chance(0.2)) { tipo = "dropset"; peso = roundTo(trabajo * 0.7, e.step); reps += randInt(2, 5); }
      // con peso corporal algunos le meten lastre en dominadas/fondos
      if (e.base == null && (nombre === "Dominadas" || nombre === "Fondos en paralelas") && chance(0.3)) {
        peso = roundTo(rand(5, 25) * fuerza, 2.5);
      }
      series.push({ ejercicio: nombre, orden: orden++, peso, repeticiones: reps, tipo_serie: tipo,
        descanso: e.comp ? randInt(120, 180) : randInt(60, 105) });
    }
  }

  // a veces cierra con cardio
  if (chance(0.3)) {
    const nombre = pick(Object.keys(CARDIO).filter((n) => cardioIds[n]));
    if (nombre) {
      const min = randInt(10, 25);
      const k = CARDIO[nombre].kmPorMin;
      series.push({ ejercicio: nombre, orden: 1, peso: null, repeticiones: 0, tipo_serie: "serie", descanso: null,
        tiempo_segundos: min * 60, distancia_km: k ? Math.round(min * rand(k[0], k[1]) * 100) / 100 : null });
    }
  }

  const duracion = Math.round(series.length * rand(2.6, 3.4) * 60 + randInt(0, 600)); // ~ 45-100 min
  const fechaFin = new Date(fechaInicio.getTime() + duracion * 1000);
  const volumen = series.reduce((acc, s) => acc + (s.peso || 0) * (s.repeticiones || 0), 0);
  const descripcion = chance(0.8) ? pick(chance(0.7) ? DESCRIPCIONES[plantilla.tag] : DESCRIPCIONES.general) : null;

  return {
    nombre_rutina_snapshot: plantilla.nombre,
    tag: plantilla.tag,
    descripcion,
    fecha_inicio: fechaInicio,
    fecha_fin: fechaFin,
    duracion_segundos: duracion,
    volumen_total: Math.round(volumen * 100) / 100,
    gimnasio_id: gimnasios.length && chance(0.65) ? pick(gimnasios).id_gimnasio : null,
    series,
  };
}

// fechas distintas en las últimas ~3 semanas, en horarios de gimnasio
function randomDates(n) {
  const dias = sample(Array.from({ length: 21 }, (_, i) => i + 1), n).sort((a, b) => b - a);
  return dias.map((d) => {
    const fecha = new Date(Date.now() - d * DAY);
    fecha.setHours(pick([7, 8, 9, 12, 13, 17, 18, 19, 20, 21]), randInt(0, 59), 0, 0);
    return fecha;
  });
}

function buildInteractions(sesion, seguidores) {
  const ahora = Date.now();
  const despues = (maxHoras) => {
    const t = sesion.fecha_fin.getTime() + rand(0.05, maxHoras) * HOUR;
    return new Date(Math.min(t, ahora - 60 * 1000));
  };
  // cada sesión tiene su propio "alcance": entre 20% y 80% de los seguidores le dan like
  const tasaLike = rand(0.2, 0.8);
  const likes = seguidores.filter(() => chance(tasaLike)).map((id) => ({ usuario_id: id, fecha: despues(48) }));
  // comentan algunos de los que dieron like (y ocasionalmente alguno que no)
  const nComentarios = Math.min(randInt(0, 7), seguidores.length);
  const comentadores = sample(likes.length >= nComentarios ? likes.map((l) => l.usuario_id) : seguidores, nComentarios);
  const usados = new Set();
  const comentarios = comentadores.map((id) => {
    let texto;
    do {
      texto = chance(0.4) ? pick(COMENTARIOS[sesion.tag]) : pick(COMENTARIOS.general);
    } while (usados.has(texto) && usados.size < 20);
    usados.add(texto);
    return { usuario_id: id, contenido: texto, fecha: despues(72) };
  });
  return { likes, comentarios };
}

// ---------- base ----------
const ensureRegistro = (q) =>
  q.query(`CREATE TABLE IF NOT EXISTS demo_seed_sesion (
    sesion_id INT PRIMARY KEY REFERENCES sesionentrenamiento(id_sesion) ON DELETE CASCADE
  )`);

async function clean() {
  await ensureRegistro(pool);
  const l = await pool.query(
    `DELETE FROM sesion_like WHERE usuario_id IN (SELECT id FROM usuario WHERE email ILIKE $1)`, [`%@${SEED_DOMAIN}`]);
  const c = await pool.query(
    `DELETE FROM sesion_comentario WHERE usuario_id IN (SELECT id FROM usuario WHERE email ILIKE $1)`, [`%@${SEED_DOMAIN}`]);
  const s = await pool.query(
    `DELETE FROM sesionentrenamiento WHERE id_sesion IN (SELECT sesion_id FROM demo_seed_sesion)`);
  console.log(`Borrados: ${s.rowCount} entrenamientos (con sus series), ${l.rowCount} likes y ${c.rowCount} comentarios.`);
}

async function seed() {
  await ensureRegistro(pool);
  const ya = await pool.query("SELECT COUNT(*)::int AS n FROM demo_seed_sesion");
  if (ya.rows[0].n > 0) {
    console.log(`Ya hay ${ya.rows[0].n} entrenamientos de demo. Corré --clean primero si querés regenerarlos.`);
    return;
  }

  const { rows: usuarios } = await pool.query("SELECT id, username, email, tipo_usuario FROM usuario ORDER BY id");
  const reales = usuarios.filter((u) => !u.email.toLowerCase().endsWith(`@${SEED_DOMAIN}`));
  const esOficial = (u) => /gymmaxxing/i.test(u.username);
  const destinatarios = reales.filter((u) => {
    if (EXCLUDE.includes(u.username.toLowerCase()) || esOficial(u)) return false;
    if (u.tipo_usuario === "gimnasio") return false;
    if (u.tipo_usuario === "entrenador") return CON_COACH;
    return true;
  });
  if (destinatarios.length === 0) {
    console.log("No encontré influencers.");
    return;
  }

  const { rows: ejercicios } = await pool.query(
    "SELECT id_ejercicio, nombre FROM ejercicio WHERE COALESCE(es_personalizado, FALSE) = FALSE");
  const ejercicioIds = {};
  const cardioIds = {};
  for (const e of ejercicios) {
    if (EJ[e.nombre]) ejercicioIds[e.nombre] = e.id_ejercicio;
    if (CARDIO[e.nombre]) cardioIds[e.nombre] = e.id_ejercicio;
  }
  const faltan = Object.keys(EJ).filter((n) => !ejercicioIds[n]);
  if (faltan.length) console.log("Aviso: no están en el catálogo y se omiten:", faltan.join(", "));

  const { rows: gimnasios } = await pool.query("SELECT id_gimnasio, nombre FROM gimnasio");
  const { rows: follows } = await pool.query(
    `SELECT su.id_seguido, su.id_seguidor FROM seguimientousuario su
     JOIN usuario u ON u.id = su.id_seguidor WHERE u.email ILIKE $1`, [`%@${SEED_DOMAIN}`]);
  const seguidoresDe = new Map();
  for (const f of follows) {
    if (!seguidoresDe.has(f.id_seguido)) seguidoresDe.set(f.id_seguido, []);
    seguidoresDe.get(f.id_seguido).push(f.id_seguidor);
  }
  if (follows.length === 0) console.log("Aviso: no hay seguidores de relleno; los entrenamientos van a quedar sin likes ni comentarios.");

  // armar todo el plan en memoria
  const plan = destinatarios.map((u) => {
    const fuerza = rand(0.8, 1.25); // cada influencer tiene su nivel
    const plantillas = sample(PLANTILLAS, POR_USUARIO);
    const sesiones = randomDates(POR_USUARIO).map((fecha, i) => {
      const s = buildSession(plantillas[i % plantillas.length], fuerza, ejercicioIds, cardioIds, fecha, gimnasios);
      Object.assign(s, buildInteractions(s, seguidoresDe.get(u.id) ?? []));
      return s;
    });
    return { usuario: u, sesiones };
  });

  console.log(`\nEntrenamientos a crear (${POR_USUARIO} por usuario):`);
  console.table(plan.map(({ usuario, sesiones }) => ({
    username: usuario.username,
    seguidores_relleno: (seguidoresDe.get(usuario.id) ?? []).length,
    entrenamientos: sesiones.map((s) => s.nombre_rutina_snapshot).join(" / "),
    likes: sesiones.map((s) => s.likes.length).join(" / "),
    comentarios: sesiones.map((s) => s.comentarios.length).join(" / "),
  })));
  const ej = plan[0].sesiones[0];
  console.log(`\nEjemplo (${plan[0].usuario.username} - ${ej.nombre_rutina_snapshot}, ${Math.round(ej.duracion_segundos / 60)} min, ${ej.volumen_total} kg de volumen):`);
  ej.series.forEach((s) => console.log(`  ${s.ejercicio} #${s.orden}: ${s.peso ?? "PC"} x ${s.repeticiones}${s.tipo_serie !== "serie" ? ` (${s.tipo_serie})` : ""}${s.tiempo_segundos ? ` ${s.tiempo_segundos / 60} min` : ""}`));
  if (ej.comentarios.length) console.log(`  Comentarios: ${ej.comentarios.map((c) => `"${c.contenido}"`).join(", ")}`);

  if (!APPLY) {
    console.log("\nSimulación: no se escribió nada. Si está bien, corré con --apply.");
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    let nSes = 0, nSeries = 0, nLikes = 0, nCom = 0;
    for (const { usuario, sesiones } of plan) {
      for (const s of sesiones) {
        const { rows } = await client.query(
          `INSERT INTO sesionentrenamiento
             (fecha, fecha_inicio, fecha_fin, duracion_segundos, volumen_total, descripcion, estado,
              nombre_rutina_snapshot, gimnasio_id, usuario_id, rutina_id)
           VALUES ($1, $1, $2, $3, $4, $5, 'finalizada', $6, $7, $8, NULL)
           RETURNING id_sesion`,
          [s.fecha_inicio, s.fecha_fin, s.duracion_segundos, s.volumen_total, s.descripcion,
            s.nombre_rutina_snapshot, s.gimnasio_id, usuario.id]);
        const id = rows[0].id_sesion;
        await client.query("INSERT INTO demo_seed_sesion (sesion_id) VALUES ($1)", [id]);
        for (const se of s.series) {
          const ejercicioId = ejercicioIds[se.ejercicio] ?? cardioIds[se.ejercicio];
          await client.query(
            `INSERT INTO serie (sesion_id, ejercicio_id, repeticiones, peso, descanso, orden, tipo_serie, tiempo_segundos, distancia_km)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
            [id, ejercicioId, se.repeticiones, se.peso, se.descanso, se.orden, se.tipo_serie,
              se.tiempo_segundos ?? null, se.distancia_km ?? null]);
          nSeries++;
        }
        for (const l of s.likes) {
          await client.query(
            "INSERT INTO sesion_like (sesion_id, usuario_id, fecha) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING",
            [id, l.usuario_id, l.fecha]);
          nLikes++;
        }
        for (const c of s.comentarios) {
          await client.query(
            "INSERT INTO sesion_comentario (sesion_id, usuario_id, contenido, fecha) VALUES ($1,$2,$3,$4)",
            [id, c.usuario_id, c.contenido, c.fecha]);
          nCom++;
        }
        nSes++;
      }
      console.log(`  ${usuario.username}: listo`);
    }
    await client.query("COMMIT");
    console.log(`\nListo: ${nSes} entrenamientos, ${nSeries} series, ${nLikes} likes y ${nCom} comentarios.`);
    console.log("Para borrarlo todo: node scripts/seed-actividad.js --clean");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error, no se guardó nada:", err.message);
    process.exitCode = 1;
  } finally {
    client.release();
  }
}

(async () => {
  try {
    if (CLEAN) await clean();
    else await seed();
  } finally {
    await pool.end();
  }
})();
