// Mensajes de GymBroxx. Cada mensaje tiene una pose (qué imagen muestra la mascota),
// un texto y, opcionalmente, respuestas rápidas con las que el usuario le contesta.

export type BroxxPose = "wave" | "dumbbell" | "protein" | "phone" | "music" | "sleep";

export type BroxxAction = "training" | "routines";

export type BroxxReply = {
  label: string;
  answer: string;
  pose?: BroxxPose;
  happy?: boolean;
  action?: { type: BroxxAction; label: string };
};

export type BroxxContext = {
  name: string;
  hour: number;
  isTraining: boolean;
  canTrain: boolean;
};

export type BroxxTip = {
  id: string;
  pose: BroxxPose;
  text: string | ((ctx: BroxxContext) => string);
  replies?: BroxxReply[];
  action?: { type: BroxxAction; label: string };
  /** Si devuelve false, el mensaje no se muestra en este contexto. */
  when?: (ctx: BroxxContext) => boolean;
  /** Más peso = sale más seguido. Por defecto 1. */
  weight?: number | ((ctx: BroxxContext) => number);
};

const isNight = (ctx: BroxxContext) => ctx.hour >= 23 || ctx.hour < 6;
const isMorning = (ctx: BroxxContext) => ctx.hour >= 6 && ctx.hour < 12;
const notTraining = (ctx: BroxxContext) => !ctx.isTraining;

export const GREETING_TIP: BroxxTip = {
  id: "greeting",
  pose: "wave",
  text: (ctx) => `¡Hola ${ctx.name}! Soy GymBroxx, tu compañero de gym. Voy a andar por acá 💪`,
};

export const BROXX_TIPS: BroxxTip[] = [
  {
    id: "protein",
    pose: "protein",
    text: "¿Ya tomaste tu proteína hoy?",
    when: notTraining,
    weight: 2,
    replies: [
      { label: "Obvio 🥤", answer: "¡Esa! Tus músculos te lo agradecen.", happy: true, pose: "wave" },
      { label: "Todavía no", answer: "¡Andá a prepararte un shake, rey! Sin proteína no hay gains 🥛", pose: "protein" },
    ],
  },
  {
    id: "trained-today",
    pose: "dumbbell",
    text: "¿Ya entrenaste hoy?",
    when: (ctx) => ctx.canTrain && !ctx.isTraining && !isNight(ctx),
    weight: 2,
    replies: [
      { label: "Sí 🔥", answer: "¡Bestia! Mañana más.", happy: true, pose: "wave" },
      {
        label: "Todavía no",
        answer: "Dale, que el hierro no se levanta solo.",
        pose: "dumbbell",
        action: { type: "training", label: "Empezar entrenamiento" },
      },
    ],
  },
  {
    id: "music",
    pose: "music",
    text: (ctx) => (ctx.isTraining ? "¿Qué estás escuchando mientras entrenás? 🎧" : "¿Qué estás escuchando?"),
    weight: 2,
    replies: [
      { label: "Rock 🤘", answer: "¡Eso! Subile el volumen 🔊", happy: true },
      { label: "Reggaetón 🔥", answer: "Con eso sale PR seguro 😎", happy: true },
      { label: "Nada", answer: "Ponete algo, que con música se entrena mejor 🎶" },
    ],
  },
  {
    id: "rest",
    pose: "sleep",
    text: "Es importante descansar bien. Los músculos crecen mientras dormís 😴",
    when: notTraining,
    weight: 2,
  },
  {
    id: "night",
    pose: "sleep",
    text: "Ya es tarde... ¿no te convendría ir a dormir? Mañana se entrena mejor 🌙",
    when: (ctx) => isNight(ctx) && notTraining(ctx),
    weight: 4,
  },
  {
    id: "water",
    pose: "protein",
    text: "¿Tomaste suficiente agua hoy? Hidratarse también es entrenar 💧",
    weight: 1,
    replies: [
      { label: "Sí", answer: "¡Así me gusta! 💪", happy: true, pose: "wave" },
      { label: "Ahora tomo", answer: "Eso, un vasito ya mismo 🚰" },
    ],
  },
  {
    id: "log-training",
    pose: "phone",
    text: "¿Registraste tu último entreno? Así no perdés nada de tu progreso 📈",
    when: (ctx) => ctx.canTrain && notTraining(ctx),
    action: { type: "training", label: "Registrar entreno" },
  },
  {
    id: "routines",
    pose: "phone",
    text: "Pegale una mirada a tus rutinas, capaz es momento de cambiar algo 👀",
    when: notTraining,
    action: { type: "routines", label: "Ver rutinas" },
  },
  {
    id: "legs",
    pose: "dumbbell",
    text: "Acordate: no se saltea el día de piernas 🦵",
    replies: [
      { label: "Jamás", answer: "Así me gusta 😤", happy: true, pose: "wave" },
      { label: "Mmm...", answer: "Las piernas también son músculos, eh 👀" },
    ],
  },
  {
    id: "consistency",
    pose: "dumbbell",
    text: "La constancia le gana a la motivación. Un día a la vez 💯",
  },
  {
    id: "morning",
    pose: "wave",
    text: (ctx) => `¡Buen día, ${ctx.name}! ¿Qué toca entrenar hoy?`,
    when: (ctx) => isMorning(ctx) && notTraining(ctx),
    weight: 2,
    replies: [
      { label: "Pecho 💪", answer: "¡Lunes internacional todos los días! 😂", happy: true },
      { label: "Piernas 🦵", answer: "Respeto. Mañana no subís escaleras 🫡", happy: true },
      { label: "Descanso", answer: "Bien ahí, el descanso también suma 😴", pose: "sleep" },
    ],
  },
  {
    id: "one-more",
    pose: "dumbbell",
    text: "¡Vamos que vos podés! Una serie más 💥",
    when: (ctx) => ctx.isTraining,
    weight: 3,
  },
  {
    id: "rest-between-sets",
    pose: "phone",
    text: "No te olvides de respetar el descanso entre series ⏱️",
    when: (ctx) => ctx.isTraining,
    weight: 2,
  },
  {
    id: "post-workout",
    pose: "protein",
    text: "Cuando termines, no te olvides del post-entreno 🥤",
    when: (ctx) => ctx.isTraining,
    weight: 2,
  },
];

export const resolveTipText = (tip: BroxxTip, ctx: BroxxContext) =>
  typeof tip.text === "function" ? tip.text(ctx) : tip.text;

const tipWeight = (tip: BroxxTip, ctx: BroxxContext) =>
  typeof tip.weight === "function" ? tip.weight(ctx) : tip.weight ?? 1;

/** Elige un mensaje al azar (ponderado), evitando repetir los últimos. */
export const pickTip = (ctx: BroxxContext, recentIds: string[]): BroxxTip => {
  const usesTraining = (tip: BroxxTip) =>
    tip.action?.type === "training" || tip.replies?.some((reply) => reply.action?.type === "training");

  const available = BROXX_TIPS.filter(
    (tip) => (tip.when ? tip.when(ctx) : true) && (ctx.canTrain || !usesTraining(tip))
  );
  const fresh = available.filter((tip) => !recentIds.includes(tip.id));
  const pool = fresh.length > 0 ? fresh : available;

  const total = pool.reduce((sum, tip) => sum + tipWeight(tip, ctx), 0);
  let roll = Math.random() * total;
  for (const tip of pool) {
    roll -= tipWeight(tip, ctx);
    if (roll <= 0) {
      return tip;
    }
  }
  return pool[0] ?? GREETING_TIP;
};
