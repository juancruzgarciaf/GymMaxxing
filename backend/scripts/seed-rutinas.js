/*
  Seed de rutinas para la demo de GymMaxxing.

  A cada creador le crea N rutinas públicas (por defecto 2), todas distintas:
  tipo de día (Push, Pull, Piernas, Upper, Full Body...), nombre, descripción,
  ejercicios, series, repeticiones, descansos y fecha de creación se sortean.
  Quedan visibles en Descubrir > Rutinas.

  Uso (desde la carpeta backend):
    node scripts/seed-rutinas.js             -> simulación: muestra el plan, no escribe nada
    node scripts/seed-rutinas.js --apply     -> crea las rutinas
    node scripts/seed-rutinas.js --clean     -> borra solo las rutinas que creó este script

  Opciones:
    --tipos=usuario          a quiénes crearles rutinas, separado por comas:
                             usuario (influencers), entrenador, gimnasio
                             ej: --tipos=entrenador,gimnasio
    --por-usuario=2          rutinas por creador
    --con-coach              atajo viejo: equivale a sumar "entrenador" a --tipos
    --exclude=user1,user2    usernames que no deben recibir rutinas

  Se puede correr varias veces con distintos --tipos: los creadores que ya tienen
  rutinas de demo se saltean. No toca a la cuenta oficial de GymMaxxing ni a los
  usuarios de relleno.
  Después podés correr scripts/seed-interacciones-rutinas.js para sumarles guardados, copias y likes.
*/
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
const TZ = process.env.APP_TIMEZONE?.trim() || "America/Argentina/Buenos_Aires";
process.env.TZ = TZ;
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
const TIPOS = new Set(
  (getArg("tipos") ?? "usuario").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)
);
if (CON_COACH) TIPOS.add("entrenador");
const TIPOS_VALIDOS = ["usuario", "entrenador", "gimnasio"];
const tiposInvalidos = [...TIPOS].filter((t) => !TIPOS_VALIDOS.includes(t));
if (tiposInvalidos.length) {
  console.error(`--tipos inválido: ${tiposInvalidos.join(", ")}. Usá: ${TIPOS_VALIDOS.join(", ")}`);
  process.exit(1);
}
const POR_USUARIO = Number(getArg("por-usuario") ?? 2);
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
const DAY = 24 * 3600 * 1000;

// ---------- catálogo (nombres del catálogo oficial) ----------
// reps = rango típico; comp = compuesto (más descanso, menos reps)
const EJ = {
  "Press banca": { g: "pecho", reps: [5, 10], comp: true },
  "Press inclinado": { g: "pecho", reps: [6, 10], comp: true },
  "Aperturas con mancuernas": { g: "pecho", reps: [10, 15] },
  "Fondos en paralelas": { g: "pecho", reps: [8, 15] },
  "Dominadas": { g: "espalda", reps: [6, 12] },
  "Jalón al pecho": { g: "espalda", reps: [8, 12] },
  "Remo con barra": { g: "espalda", reps: [6, 10], comp: true },
  "Remo con mancuerna": { g: "espalda", reps: [8, 12] },
  "Sentadilla": { g: "piernas", reps: [4, 10], comp: true },
  "Prensa de piernas": { g: "piernas", reps: [8, 15] },
  "Peso muerto": { g: "piernas", reps: [3, 8], comp: true },
  "Zancadas": { g: "piernas", reps: [8, 12] },
  "Curl femoral": { g: "piernas", reps: [10, 15] },
  "Press militar": { g: "hombros", reps: [5, 10], comp: true },
  "Elevaciones laterales": { g: "hombros", reps: [12, 20] },
  "Pájaros": { g: "hombros", reps: [12, 20] },
  "Curl bíceps con barra": { g: "biceps", reps: [8, 12] },
  "Curl martillo": { g: "biceps", reps: [8, 12] },
  "Extensión de tríceps en polea": { g: "triceps", reps: [10, 15] },
  "Press francés": { g: "triceps", reps: [8, 12] },
  "Crunch abdominal": { g: "core", reps: [15, 25] },
  "Elevaciones de piernas": { g: "core", reps: [10, 20] },
};
const byGroup = (g) => Object.keys(EJ).filter((n) => EJ[n].g === g);

// tipo de rutina -> [grupo, cantidad de ejercicios], nombres y descripciones posibles
const PLANTILLAS = [
  {
    slots: [["pecho", 2], ["hombros", [1, 2]], ["triceps", [1, 2]]],
    nombres: ["Push Day", "Push pesado", "Empuje total", "Push de hipertrofia", "Pecho, hombro y tríceps"],
    descripciones: ["Empuje: pecho, hombros y tríceps.", "La que uso para subir la banca.", "Volumen alto de empuje, descansos cortos en los accesorios.", "Push clásico, simple y efectivo 🔥"],
  },
  {
    slots: [["espalda", 3], ["biceps", [1, 2]], ["hombros", [0, 1]]],
    nombres: ["Pull Day", "Espalda en V", "Pull de fuerza", "Espalda ancha", "Tirón completo"],
    descripciones: ["Tirón: espalda, deltoides posterior y bíceps.", "Para ensanchar la espalda de verdad 🦍", "Remos pesados y dominadas, lo básico bien hecho.", "Mi pull de todas las semanas."],
  },
  {
    slots: [["piernas", [4, 5]], ["core", [0, 1]]],
    nombres: ["Leg Day", "Piernas sin excusas", "Piernas de acero", "Lower pesado", "Cuádriceps y femorales"],
    descripciones: ["Nunca saltees piernas 🦵", "Sentadilla y peso muerto como base, después accesorios.", "La rutina que más odio y más resultados me dio.", "Piernas completas, prepará las escaleras 😂"],
  },
  {
    slots: [["pecho", [1, 2]], ["espalda", 2], ["hombros", 1], ["biceps", [0, 1]], ["triceps", [0, 1]]],
    nombres: ["Upper Body", "Torso completo", "Upper de hipertrofia", "Upper express"],
    descripciones: ["Torso balanceado entre empuje y tirón.", "Ideal para un split upper/lower de 4 días.", "Upper rápido pero intenso, menos de una hora."],
  },
  {
    slots: [["piernas", 2], ["pecho", 1], ["espalda", 1], ["hombros", 1], ["core", [0, 1]]],
    nombres: ["Full Body", "Full Body 3x semana", "Cuerpo completo", "Full Body para principiantes"],
    descripciones: ["Todo el cuerpo en una sesión, ideal si entrenás 3 veces por semana.", "Para cuando no hay tiempo: básicos y a casa.", "Rutina con la que arranqué, la recomiendo para empezar."],
  },
  {
    slots: [["pecho", 3], ["triceps", 2]],
    nombres: ["Pecho y tríceps", "Bro split: pecho", "Pecho on fire"],
    descripciones: ["Día de pecho clásico con tríceps al final.", "Pump de pecho asegurado 💪", "Mucho volumen de pecho, cuidá los hombros."],
  },
  {
    slots: [["espalda", 3], ["biceps", 2]],
    nombres: ["Espalda y bíceps", "Bro split: espalda", "Back & Bis"],
    descripciones: ["Espalda gruesa y bíceps de cierre.", "Tirones pesados y después pump de brazos.", "La espalda no miente."],
  },
  {
    slots: [["hombros", 3], ["biceps", 1], ["triceps", 1]],
    nombres: ["Hombros y brazos", "Hombros 3D", "Arm Day 💣"],
    descripciones: ["Hombros redondos y brazos llenos.", "Laterales y pájaros con mucho volumen.", "Día de pump, música fuerte y a darle."],
  },
];

// Gimnasios y entrenadores publican sus rutinas con otro tono que los influencers.
const ESTILO = {
  gimnasio: {
    sufijos: ["Nivel inicial", "Nivel intermedio", "Nivel avanzado", "Plan del mes", "Sala de musculación"],
    descripciones: [
      "Rutina armada por los profes del gym. Consultá en sala por la técnica de cada ejercicio.",
      "Programa del mes para socios. Ideal para combinar con las clases grupales.",
      "Plan recomendado por el staff. Calentá 10 minutos antes de empezar.",
      "Rutina pensada para hacer en nuestra sala de musculación, con las máquinas que tenemos.",
      "Si tenés dudas con algún ejercicio, preguntale a cualquiera de los instructores 💪",
    ],
  },
  entrenador: {
    sufijos: ["Hipertrofia", "Fuerza", "Principiantes", "Intermedios", "Bloque 1", "Recomposición"],
    descripciones: [
      "La misma rutina que les doy a mis alumnos. Progresá de a poco en el peso, la técnica primero.",
      "Dejá 1-2 repeticiones en reserva en cada serie. Si llegás al tope de reps, subí el peso.",
      "Programa de 6 semanas. Escribime si querés que la adapte a tu objetivo.",
      "Para alumnos que ya tienen la técnica de los básicos. Respetá los descansos.",
      "Bloque de acumulación: volumen moderado, mucha calidad en cada repetición.",
    ],
  },
};

// ---------- generación ----------
function buildRutina(plantilla, ejercicioIds, nombresUsados, tipoCreador) {
  const elegidos = [];
  for (const [g, cant] of plantilla.slots) {
    const n = Array.isArray(cant) ? randInt(cant[0], cant[1]) : cant;
    const disponibles = byGroup(g).filter((x) => !elegidos.includes(x) && ejercicioIds[x]);
    elegidos.push(...sample(disponibles, n));
  }
  // los compuestos van primero
  elegidos.sort((a, b) => Number(Boolean(EJ[b].comp)) - Number(Boolean(EJ[a].comp)));

  const ejercicios = elegidos.map((nombre, i) => {
    const e = EJ[nombre];
    return {
      nombre,
      id_ejercicio: ejercicioIds[nombre],
      series: e.comp ? randInt(3, 5) : randInt(3, 4),
      repeticiones: randInt(e.reps[0], e.reps[1]),
      descanso: e.comp ? pick([120, 150, 180]) : pick([60, 75, 90]),
      orden: i + 1,
    };
  });

  // ~ 1 min por serie + descansos
  const segundos = ejercicios.reduce((acc, e) => acc + e.series * (60 + e.descanso), 0);
  const duracion = Math.max(30, Math.round(segundos / 60 / 5) * 5);

  const estilo = ESTILO[tipoCreador];
  let nombre = pick(plantilla.nombres.filter((n) => !nombresUsados.has(n))) ?? pick(plantilla.nombres);
  nombresUsados.add(nombre);
  if (estilo) nombre = `${nombre.replace(/\s*\p{Extended_Pictographic}/gu, "")} - ${pick(estilo.sufijos)}`.slice(0, 60);
  const descripciones = estilo && chance(0.75) ? estilo.descripciones : plantilla.descripciones;
  return {
    nombre,
    descripcion: estilo || chance(0.9) ? pick(descripciones) : null,
    duracion_estimada: duracion,
    fecha_creacion: new Date(Date.now() - rand(2, 45) * DAY),
    ejercicios,
  };
}

// ---------- base ----------
const ensureRegistro = async (q) => {
  await q.query(`ALTER TABLE rutina ADD COLUMN IF NOT EXISTS visible_en_descubrir BOOLEAN NOT NULL DEFAULT TRUE`);
  await q.query(`CREATE TABLE IF NOT EXISTS demo_seed_rutina (
    rutina_id INT PRIMARY KEY REFERENCES rutina(id_rutina) ON DELETE CASCADE
  )`);
};

async function clean() {
  await ensureRegistro(pool);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE sesionentrenamiento SET rutina_id = NULL
       WHERE rutina_id IN (SELECT rutina_id FROM demo_seed_rutina)`);
    const re = await client.query(
      `DELETE FROM rutinaejercicio WHERE id_rutina IN (SELECT rutina_id FROM demo_seed_rutina)`);
    const r = await client.query(
      `DELETE FROM rutina WHERE id_rutina IN (SELECT rutina_id FROM demo_seed_rutina)`);
    await client.query("COMMIT");
    console.log(`Borradas: ${r.rowCount} rutinas (${re.rowCount} ejercicios de rutina). Sus guardados, copias y likes se borran en cascada.`);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error, no se borró nada:", err.message);
    process.exitCode = 1;
  } finally {
    client.release();
  }
}

async function seed() {
  await ensureRegistro(pool);
  const { rows: yaTienen } = await pool.query(
    `SELECT DISTINCT r.creador_id FROM rutina r JOIN demo_seed_rutina d ON d.rutina_id = r.id_rutina`);
  const conRutinasDemo = new Set(yaTienen.map((x) => x.creador_id));

  const { rows: usuarios } = await pool.query("SELECT id, username, email, tipo_usuario FROM usuario ORDER BY id");
  const reales = usuarios.filter((u) => !u.email.toLowerCase().endsWith(`@${SEED_DOMAIN}`));
  const esOficial = (u) => /gymmaxxing/i.test(u.username);
  const candidatos = reales.filter((u) => {
    if (EXCLUDE.includes(u.username.toLowerCase()) || esOficial(u)) return false;
    return TIPOS.has((u.tipo_usuario ?? "usuario").trim().toLowerCase());
  });
  const salteados = candidatos.filter((u) => conRutinasDemo.has(u.id));
  const destinatarios = candidatos.filter((u) => !conRutinasDemo.has(u.id));
  if (salteados.length) {
    console.log(`Ya tienen rutinas de demo (se saltean): ${salteados.map((u) => u.username).join(", ")}`);
  }
  if (destinatarios.length === 0) {
    console.log(`No hay creadores nuevos de tipo ${[...TIPOS].join(", ")} para crearles rutinas.`);
    return;
  }

  const { rows: ejercicios } = await pool.query(
    "SELECT id_ejercicio, nombre FROM ejercicio WHERE COALESCE(es_personalizado, FALSE) = FALSE");
  const ejercicioIds = {};
  for (const e of ejercicios) if (EJ[e.nombre]) ejercicioIds[e.nombre] = e.id_ejercicio;
  const faltan = Object.keys(EJ).filter((n) => !ejercicioIds[n]);
  if (faltan.length) console.log("Aviso: no están en el catálogo y se omiten:", faltan.join(", "));

  const plan = destinatarios.map((u) => {
    const nombresUsados = new Set();
    const plantillas = sample(PLANTILLAS, POR_USUARIO);
    const tipo = (u.tipo_usuario ?? "usuario").trim().toLowerCase();
    const rutinas = plantillas.map((p) => buildRutina(p, ejercicioIds, nombresUsados, tipo))
      .filter((r) => r.ejercicios.length > 0);
    return { usuario: u, rutinas };
  });

  console.log(`\nRutinas a crear (${POR_USUARIO} por usuario):`);
  console.table(plan.map(({ usuario, rutinas }) => ({
    username: usuario.username,
    tipo: usuario.tipo_usuario,
    rutinas: rutinas.map((r) => r.nombre).join(" / "),
    ejercicios: rutinas.map((r) => r.ejercicios.length).join(" / "),
    minutos: rutinas.map((r) => r.duracion_estimada).join(" / "),
  })));
  const ej = plan[0].rutinas[0];
  console.log(`\nEjemplo (${plan[0].usuario.username} - "${ej.nombre}", ~${ej.duracion_estimada} min):`);
  console.log(`  ${ej.descripcion ?? "(sin descripción)"}`);
  ej.ejercicios.forEach((e) => console.log(`  ${e.orden}. ${e.nombre}: ${e.series} x ${e.repeticiones}, descanso ${e.descanso}s`));

  if (!APPLY) {
    console.log("\nSimulación: no se escribió nada. Si está bien, corré con --apply.");
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    let nRut = 0, nEj = 0;
    for (const { usuario, rutinas } of plan) {
      for (const r of rutinas) {
        const { rows } = await client.query(
          `INSERT INTO rutina (nombre, descripcion, duracion_estimada, fecha_creacion, creador_id, id_carpeta, visible_en_descubrir)
           VALUES ($1, $2, $3, $4, $5, NULL, TRUE)
           RETURNING id_rutina`,
          [r.nombre, r.descripcion, r.duracion_estimada, r.fecha_creacion, usuario.id]);
        const id = rows[0].id_rutina;
        await client.query("INSERT INTO demo_seed_rutina (rutina_id) VALUES ($1)", [id]);
        for (const e of r.ejercicios) {
          await client.query(
            `INSERT INTO rutinaejercicio (id_ejercicio, id_rutina, series, repeticiones, descanso, orden)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [e.id_ejercicio, id, e.series, e.repeticiones, e.descanso, e.orden]);
          nEj++;
        }
        nRut++;
      }
      console.log(`  ${usuario.username}: listo`);
    }
    await client.query("COMMIT");
    console.log(`\nListo: ${nRut} rutinas con ${nEj} ejercicios.`);
    console.log("Siguiente paso (opcional): node scripts/seed-interacciones-rutinas.js");
    console.log("Para borrarlas: node scripts/seed-rutinas.js --clean");
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
