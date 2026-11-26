/*
  Seed de interacciones con rutinas para la demo de GymMaxxing.

  Los usuarios de relleno (@seed.gymmaxxing.test) guardan, copian y le dan like a las
  rutinas públicas de las cuentas reales: la cuenta oficial de GymMaxxing, los
  influencers, el coach y los gimnasios. Cada rutina recibe cantidades distintas:
  - las oficiales son las más populares,
  - los seguidores de un creador interactúan mucho más que el resto,
  - hay menos copias que guardados, y menos guardados que likes.

  Uso (desde la carpeta backend):
    node scripts/seed-interacciones-rutinas.js             -> simulación: muestra el plan, no escribe nada
    node scripts/seed-interacciones-rutinas.js --apply     -> inserta guardados, copias y likes
    node scripts/seed-interacciones-rutinas.js --clean     -> borra todas las interacciones de los usuarios de relleno

  Opciones:
    --sin-likes              no genera likes, solo guardados y copias
    --exclude=user1,user2    creadores cuyas rutinas no deben recibir interacciones

  Requiere haber corrido antes scripts/seed-followers.js --apply (y conviene seed-rutinas.js --apply).
  Se puede volver a correr: las rutinas que ya tienen interacciones de relleno se saltean.
  Se insertan directo en la base: no generan notificaciones ni crean rutinas copiadas
  en las cuentas de relleno (solo suben los contadores de guardados / copias / likes).
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
const SIN_LIKES = args.includes("--sin-likes");
const EXCLUDE = (getArg("exclude") ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: Number(process.env.DB_PORT),
  options: `-c timezone=${TZ}`,
});

const rand = (min, max) => min + Math.random() * (max - min);
const chance = (p) => Math.random() < p;
const HOUR = 3600 * 1000;

const classify = (u) => {
  if (/gymmaxxing/i.test(u.username)) return "oficial";
  if (u.tipo_usuario === "gimnasio") return "gimnasio";
  if (u.tipo_usuario === "entrenador") return "coach";
  return "influencer";
};

// "alcance" de cada rutina: qué tan probable es que un seguidor / no seguidor interactúe
const alcanceFor = (kind) => {
  if (kind === "oficial") return { seguidor: rand(0.25, 0.55), resto: rand(0.08, 0.2) };
  if (kind === "coach") return { seguidor: rand(0.15, 0.4), resto: rand(0.02, 0.06) };
  if (kind === "gimnasio") return { seguidor: rand(0.08, 0.25), resto: rand(0.01, 0.04) };
  // influencers: la mayoría con números medios y unas pocas rutinas que explotan
  const viral = Math.random() ** 2;
  return { seguidor: 0.05 + 0.45 * viral, resto: 0.005 + 0.06 * viral };
};

const ensureTablas = async (q) => {
  for (const tabla of ["rutina_guardado", "rutina_copia", "rutina_like"]) {
    const pk = { rutina_guardado: "id_guardado", rutina_copia: "id_copia", rutina_like: "id_like" }[tabla];
    await q.query(`CREATE TABLE IF NOT EXISTS ${tabla} (
      ${pk} SERIAL PRIMARY KEY,
      rutina_id INT NOT NULL REFERENCES rutina(id_rutina) ON DELETE CASCADE,
      usuario_id INT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
      fecha TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE (rutina_id, usuario_id)
    )`);
  }
};

async function clean() {
  await ensureTablas(pool);
  const seedUsers = `SELECT id FROM usuario WHERE email ILIKE $1`;
  const p = [`%@${SEED_DOMAIN}`];
  const g = await pool.query(`DELETE FROM rutina_guardado WHERE usuario_id IN (${seedUsers})`, p);
  const c = await pool.query(`DELETE FROM rutina_copia WHERE usuario_id IN (${seedUsers})`, p);
  const l = await pool.query(`DELETE FROM rutina_like WHERE usuario_id IN (${seedUsers})`, p);
  console.log(`Borrados: ${g.rowCount} guardados, ${c.rowCount} copias y ${l.rowCount} likes de usuarios de relleno.`);
}

async function seed() {
  await ensureTablas(pool);
  const p = [`%@${SEED_DOMAIN}`];
  // Las rutinas que ya recibieron interacciones de relleno se saltean, así se puede
  // volver a correr después de crear rutinas nuevas (ej. de gimnasios o entrenadores).
  const { rows: yaSeedeadas } = await pool.query(
    `SELECT rutina_id FROM rutina_guardado WHERE usuario_id IN (SELECT id FROM usuario WHERE email ILIKE $1)
     UNION SELECT rutina_id FROM rutina_copia WHERE usuario_id IN (SELECT id FROM usuario WHERE email ILIKE $1)
     UNION SELECT rutina_id FROM rutina_like WHERE usuario_id IN (SELECT id FROM usuario WHERE email ILIKE $1)`, p);
  const conInteracciones = new Set(yaSeedeadas.map((x) => x.rutina_id));

  const { rows: relleno } = await pool.query(`SELECT id FROM usuario WHERE email ILIKE $1`, p);
  if (relleno.length === 0) {
    console.log("No hay usuarios de relleno. Corré primero: node scripts/seed-followers.js --apply");
    return;
  }
  const rellenoIds = relleno.map((u) => u.id);

  const { rows: rutinas } = await pool.query(
    `SELECT r.id_rutina, r.nombre, r.fecha_creacion, u.id AS creador_id, u.username, u.tipo_usuario
     FROM rutina r
     JOIN usuario u ON u.id = r.creador_id
     WHERE COALESCE(r.visible_en_descubrir, TRUE) = TRUE
       AND u.email NOT ILIKE $1
     ORDER BY u.username, r.fecha_creacion`, p);
  const objetivo = rutinas.filter((r) =>
    !EXCLUDE.includes(r.username.toLowerCase()) && !conInteracciones.has(r.id_rutina));
  if (conInteracciones.size) {
    console.log(`Se saltean ${conInteracciones.size} rutinas que ya tienen interacciones de relleno.`);
  }
  if (objetivo.length === 0) {
    console.log("No hay rutinas públicas nuevas de cuentas reales para sumarles interacciones.");
    return;
  }

  const { rows: follows } = await pool.query(
    `SELECT su.id_seguido, su.id_seguidor FROM seguimientousuario su
     JOIN usuario u ON u.id = su.id_seguidor WHERE u.email ILIKE $1`, p);
  const seguidoresDe = new Map();
  for (const f of follows) {
    if (!seguidoresDe.has(f.id_seguido)) seguidoresDe.set(f.id_seguido, new Set());
    seguidoresDe.get(f.id_seguido).add(f.id_seguidor);
  }

  const ahora = Date.now();
  const fechaDespues = (desde) => {
    const base = Math.max(new Date(desde ?? ahora - 30 * 24 * HOUR).getTime(), ahora - 60 * 24 * HOUR);
    const t = base + Math.random() * Math.max(ahora - base - 60 * 1000, 0);
    return new Date(Math.min(t, ahora - 60 * 1000));
  };

  const plan = objetivo.map((r) => {
    const kind = classify(r);
    const alcance = alcanceFor(kind);
    const seguidores = seguidoresDe.get(r.creador_id) ?? new Set();
    const likes = [], guardados = [], copias = [];
    for (const id of rellenoIds) {
      const prob = seguidores.has(id) ? alcance.seguidor : alcance.resto;
      // quien guarda o copia casi siempre también le dio like
      const guarda = chance(prob * 0.55);
      const copia = chance(prob * (guarda ? 0.45 : 0.15));
      const likea = !SIN_LIKES && (guarda || copia ? chance(0.85) : chance(prob));
      if (likea) likes.push({ usuario_id: id, fecha: fechaDespues(r.fecha_creacion) });
      if (guarda) guardados.push({ usuario_id: id, fecha: fechaDespues(r.fecha_creacion) });
      if (copia) copias.push({ usuario_id: id, fecha: fechaDespues(r.fecha_creacion) });
    }
    return { rutina: r, kind, likes, guardados, copias };
  });

  console.log(`\nInteracciones a crear (${rellenoIds.length} usuarios de relleno, ${objetivo.length} rutinas):`);
  console.table(plan.map(({ rutina, kind, likes, guardados, copias }) => ({
    creador: rutina.username,
    tipo: kind,
    rutina: rutina.nombre.slice(0, 32),
    guardados: guardados.length,
    copias: copias.length,
    likes: SIN_LIKES ? "-" : likes.length,
  })));

  if (!APPLY) {
    console.log("\nSimulación: no se escribió nada. Si está bien, corré con --apply.");
    return;
  }

  const insertar = async (client, tabla, rutinaId, filas) => {
    if (filas.length === 0) return 0;
    const { rowCount } = await client.query(
      `INSERT INTO ${tabla} (rutina_id, usuario_id, fecha)
       SELECT $1, x.usuario_id, x.fecha
       FROM UNNEST($2::int[], $3::timestamp[]) AS x(usuario_id, fecha)
       ON CONFLICT (rutina_id, usuario_id) DO NOTHING`,
      [rutinaId, filas.map((f) => f.usuario_id), filas.map((f) => f.fecha)]);
    return rowCount;
  };

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    let nG = 0, nC = 0, nL = 0;
    for (const { rutina, likes, guardados, copias } of plan) {
      nG += await insertar(client, "rutina_guardado", rutina.id_rutina, guardados);
      nC += await insertar(client, "rutina_copia", rutina.id_rutina, copias);
      nL += await insertar(client, "rutina_like", rutina.id_rutina, likes);
    }
    await client.query("COMMIT");
    console.log(`\nListo: ${nG} guardados, ${nC} copias y ${nL} likes.`);
    console.log("Para borrarlos: node scripts/seed-interacciones-rutinas.js --clean");
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
