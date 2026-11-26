/*
  Seed de seguidores falsos para la demo de GymMaxxing.

  Crea 150 usuarios de relleno (tipo_usuario = 'usuario') cuyo único fin es seguir
  a las cuentas reales: la cuenta oficial de GymMaxxing, los gimnasios, el coach
  y los influencers. Cada cuenta recibe una cantidad distinta (random) de seguidores.

  Uso (desde la carpeta backend):
    node scripts/seed-followers.js            -> simulación: muestra a quién va a seguir, no escribe nada
    node scripts/seed-followers.js --apply    -> crea los usuarios y los follows
    node scripts/seed-followers.js --clean    -> borra todos los usuarios de relleno (y sus follows)

  Opciones:
    --count=150                 cantidad de usuarios falsos
    --exclude=user1,user2       usernames reales que NO deben recibir seguidores (ej. tu cuenta personal)

  Los usuarios falsos se reconocen por el dominio de mail @seed.gymmaxxing.test.
  Los follows se insertan directo en la base, así que no generan notificaciones.
*/
require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const { Pool } = require("pg");

const SEED_DOMAIN = "seed.gymmaxxing.test";
const SEED_PASSWORD = "gymmaxxing123";

const args = process.argv.slice(2);
const getArg = (name) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split("=").slice(1).join("=") : undefined;
};
const APPLY = args.includes("--apply");
const CLEAN = args.includes("--clean");
const COUNT = Number(getArg("count") ?? 150);
const EXCLUDE = (getArg("exclude") ?? "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: Number(process.env.DB_PORT),
});

// ---------- datos para generar perfiles creíbles ----------
const HOMBRES = ["Lucas", "Mateo", "Santiago", "Tomás", "Joaquín", "Benjamín", "Facundo", "Nicolás", "Agustín", "Franco",
  "Bautista", "Ignacio", "Thiago", "Valentín", "Martín", "Gonzalo", "Federico", "Lautaro", "Matías", "Juan", "Pedro",
  "Ramiro", "Bruno", "Emiliano", "Felipe", "Julián", "Maximiliano", "Ezequiel", "Gastón", "Leandro", "Rodrigo", "Diego"];
const MUJERES = ["Sofía", "Valentina", "Martina", "Camila", "Lucía", "Micaela", "Florencia", "Agustina", "Julieta", "Catalina",
  "Milagros", "Victoria", "Abril", "Delfina", "Paula", "Rocío", "Antonella", "Carolina", "Josefina", "Brenda", "Lara",
  "Candela", "Pilar", "Morena", "Belén", "Ailén", "Jazmín", "Guadalupe", "Sol", "Natalia", "Daniela", "Emilia"];
const APELLIDOS = ["González", "Rodríguez", "Gómez", "Fernández", "López", "Díaz", "Martínez", "Pérez", "García", "Sánchez",
  "Romero", "Sosa", "Torres", "Álvarez", "Ruiz", "Ramírez", "Flores", "Benítez", "Acosta", "Medina", "Herrera", "Suárez",
  "Aguirre", "Giménez", "Gutiérrez", "Pereyra", "Rojas", "Molina", "Castro", "Ortiz", "Silva", "Núñez", "Luna", "Juárez",
  "Cabrera", "Ríos", "Ferreyra", "Godoy", "Morales", "Domínguez", "Moreno", "Peralta", "Vega", "Carrizo", "Quiroga", "Ledesma"];
const NIVELES = ["Principiante", "Principiante", "Principiante", "Avanzado", "Avanzado", "Veterano", "GYMMAXXER"];
const OBJETIVOS = ["Ganar masa muscular", "Bajar de peso", "Definición", "Ganar fuerza", "Mejorar resistencia",
  "Salud general", "Recomposición corporal", "Powerlifting", "Tonificar"];
const SUFIJOS = ["fit", "gym", "lifts", "training", "strong", "ar", "bsas"];

const rand = (min, max) => min + Math.random() * (max - min);
const randInt = (min, max) => Math.floor(rand(min, max + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const slug = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

const buildUsername = (nombre, apellido) => {
  const n = slug(nombre);
  const a = slug(apellido);
  const yy = String(randInt(88, 107) % 100).padStart(2, "0");
  return pick([
    () => `${n}.${a}`,
    () => `${n}_${a}`,
    () => `${n}${a}${randInt(1, 99)}`,
    () => `${n}.${a}${yy}`,
    () => `${n}${a[0]}${yy}`,
    () => `${n}.${pick(SUFIJOS)}`,
    () => `${n}_${a}.${pick(SUFIJOS)}`,
    () => `${a}.${n}`,
  ])();
};

const buildFakeUser = (takenUsernames) => {
  const genero = Math.random() < 0.55 ? "hombre" : "mujer";
  const nombre = pick(genero === "hombre" ? HOMBRES : MUJERES);
  const apellido = pick(APELLIDOS);
  let username;
  do {
    username = buildUsername(nombre, apellido).slice(0, 30);
  } while (takenUsernames.has(username));
  takenUsernames.add(username);

  const altura = genero === "hombre" ? randInt(165, 192) : randInt(152, 178);
  const imc = rand(20, 28);
  const peso = Math.round(imc * (altura / 100) ** 2 * 10) / 10;

  return {
    username,
    email: `${username}@${SEED_DOMAIN}`,
    password: SEED_PASSWORD,
    edad: randInt(18, 45),
    peso,
    altura,
    genero,
    nacionalidad: Math.random() < 0.9 ? "Argentina" : pick(["Uruguay", "Chile", "Paraguay"]),
    nivel_entrenamiento: pick(NIVELES),
    objetivo_entrenamiento: pick(OBJETIVOS),
    // ~70% con avatar ilustrado, el resto sin foto (como pasa en cualquier red)
    foto_perfil_url:
      Math.random() < 0.7
        ? `https://api.dicebear.com/9.x/${pick(["avataaars", "notionists", "lorelei"])}/svg?seed=${encodeURIComponent(username)}`
        : null,
  };
};

// Probabilidad de que un usuario falso siga a cada cuenta: define cuán "popular" es.
const popularityFor = (target) => {
  if (target.kind === "oficial") return rand(0.85, 0.97);
  if (target.kind === "gimnasio") return rand(0.22, 0.5);
  if (target.kind === "coach") return rand(0.35, 0.65);
  // influencers: la mayoría con números medios y unos pocos muy seguidos
  return 0.08 + 0.85 * Math.random() ** 1.6;
};

const classify = (u) => {
  if (/gymmaxxing/i.test(u.username)) return "oficial";
  if (u.tipo_usuario === "gimnasio") return "gimnasio";
  if (u.tipo_usuario === "entrenador") return "coach";
  return "influencer";
};

const randomFollowDate = () => new Date(Date.now() - rand(1, 90) * 24 * 60 * 60 * 1000);

async function clean() {
  const { rowCount } = await pool.query("DELETE FROM usuario WHERE email ILIKE $1", [`%@${SEED_DOMAIN}`]);
  console.log(`Borrados ${rowCount} usuarios de relleno (sus follows se borran en cascada).`);
}

async function seed() {
  const { rows: existing } = await pool.query(
    "SELECT id, username, email, tipo_usuario FROM usuario ORDER BY id"
  );
  const alreadySeeded = existing.filter((u) => u.email.toLowerCase().endsWith(`@${SEED_DOMAIN}`));
  if (alreadySeeded.length > 0) {
    console.log(`Ya hay ${alreadySeeded.length} usuarios de relleno. Corré primero --clean si querés regenerarlos.`);
    return;
  }

  const targets = existing
    .filter((u) => !EXCLUDE.includes(u.username.toLowerCase()))
    .map((u) => ({ ...u, kind: classify(u) }));
  targets.forEach((t) => (t.p = popularityFor(t)));

  const taken = new Set(existing.map((u) => u.username.toLowerCase()));
  const fakes = Array.from({ length: COUNT }, () => buildFakeUser(taken));

  // a quién sigue cada usuario falso (cada uno sigue al menos a 1 cuenta)
  const plan = fakes.map(() => {
    const follows = targets.filter((t) => Math.random() < t.p);
    if (follows.length === 0) follows.push(pick(targets));
    return follows;
  });

  const counts = new Map(targets.map((t) => [t.id, 0]));
  plan.forEach((follows) => follows.forEach((t) => counts.set(t.id, counts.get(t.id) + 1)));

  console.log(`\nCuentas que van a recibir seguidores (${targets.length}):`);
  console.table(
    targets
      .map((t) => ({ username: t.username, tipo: t.kind, nuevos_seguidores: counts.get(t.id) }))
      .sort((a, b) => b.nuevos_seguidores - a.nuevos_seguidores)
  );
  if (EXCLUDE.length) console.log("Excluidas:", EXCLUDE.join(", "));
  console.log(`Usuarios falsos a crear: ${fakes.length}. Ejemplos: ${fakes.slice(0, 6).map((f) => f.username).join(", ")}`);

  if (!APPLY) {
    console.log("\nSimulación: no se escribió nada. Si está bien, corré con --apply.");
    console.log("(Los números van a variar un poco en la corrida real porque se vuelven a sortear.)");
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    let totalFollows = 0;
    for (let i = 0; i < fakes.length; i++) {
      const f = fakes[i];
      const { rows } = await client.query(
        `INSERT INTO usuario
           (username, email, password, edad, peso, altura, genero, nacionalidad,
            nivel_entrenamiento, objetivo_entrenamiento, tipo_usuario, foto_perfil_url)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'usuario',$11)
         RETURNING id`,
        [f.username, f.email, f.password, f.edad, f.peso, f.altura, f.genero, f.nacionalidad,
          f.nivel_entrenamiento, f.objetivo_entrenamiento, f.foto_perfil_url]
      );
      const fakeId = rows[0].id;
      for (const t of plan[i]) {
        await client.query(
          `INSERT INTO seguimientousuario (id_seguidor, id_seguido, fecha)
           VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
          [fakeId, t.id, randomFollowDate()]
        );
        totalFollows++;
      }
      if ((i + 1) % 25 === 0) console.log(`  ${i + 1}/${fakes.length} usuarios creados...`);
    }
    await client.query("COMMIT");
    console.log(`\nListo: ${fakes.length} usuarios y ${totalFollows} follows creados.`);
    console.log(`Para borrarlos: node scripts/seed-followers.js --clean`);
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
