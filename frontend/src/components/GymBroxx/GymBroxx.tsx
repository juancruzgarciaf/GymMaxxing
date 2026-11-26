import { useEffect, useRef, useState } from "react";
import type { Usuario } from "../../types";
import GymBroxxFigure from "./GymBroxxFigure";
import {
  GREETING_TIP,
  pickTip,
  resolveTipText,
  type BroxxAction,
  type BroxxContext,
  type BroxxPose,
  type BroxxReply,
  type BroxxTip,
} from "./tips";
import "./GymBroxx.css";

type Props = {
  usuario: Usuario;
  canTrain: boolean;
  isTraining: boolean;
  /** Sube la mascota para no tapar la barra de entrenamiento en curso. */
  lifted?: boolean;
  onAction: (action: BroxxAction) => void;
};

type Phase = "idle" | "calling" | "open" | "closing";
type ActiveTip = { tip: BroxxTip; text: string };

const MUTED_STORAGE_KEY = "gymbroxx_muted_v1";
const GREETED_STORAGE_KEY = "gymbroxx_greeted_v1";

const FIRST_TIP_DELAY_MS = 9000;
const MIN_TIP_GAP_MS = 80_000;
const MAX_TIP_GAP_MS = 160_000;

const STATUS: Record<BroxxPose, string> = {
  wave: "en línea",
  dumbbell: "entrenando",
  protein: "tomando proteína",
  phone: "mirando el celu",
  music: "escuchando música",
  sleep: "durmiendo",
};

const IDLE_POSES: BroxxPose[] = ["dumbbell", "music", "phone", "protein", "wave"];

const WAKE_TIP: BroxxTip = {
  id: "wake",
  pose: "wave",
  text: (ctx) => `¡Volví, ${ctx.name}! Ya me tenías extrañando 💪`,
};

const randomBetween = (min: number, max: number) => min + Math.random() * (max - min);

const isNightNow = () => {
  const hour = new Date().getHours();
  return hour >= 23 || hour < 6;
};

const initialIdlePose = (): BroxxPose => (isNightNow() ? "sleep" : "dumbbell");

const readMuted = () => {
  try {
    return localStorage.getItem(MUTED_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
};

const readGreeted = () => {
  try {
    return sessionStorage.getItem(GREETED_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
};

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

const firstName = (usuario: Usuario) => usuario.nombre?.trim().split(/\s+/)[0] || usuario.username;

function GymBroxx({ usuario, canTrain, isTraining, lifted = false, onAction }: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [active, setActive] = useState<ActiveTip | null>(null);
  const [answer, setAnswer] = useState<BroxxReply | null>(null);
  const [typed, setTyped] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [pillHovered, setPillHovered] = useState(false);
  const [muted, setMuted] = useState(readMuted);
  const [idlePose, setIdlePose] = useState<BroxxPose>(initialIdlePose);
  const [pending, setPending] = useState<ActiveTip | null>(null);

  const ctxRef = useRef<BroxxContext>({ name: firstName(usuario), hour: 12, isTraining, canTrain });
  const recentRef = useRef<string[]>([]);
  const firstTipRef = useRef(true);

  useEffect(() => {
    ctxRef.current = { name: firstName(usuario), hour: new Date().getHours(), isTraining, canTrain };
  }, [usuario, isTraining, canTrain]);

  useEffect(() => {
    try {
      localStorage.setItem(MUTED_STORAGE_KEY, muted ? "1" : "0");
    } catch {
      // Sin storage, simplemente no se recuerda.
    }
  }, [muted]);

  const currentText = answer ? answer.answer : active?.text ?? "";
  const typingDone = typed >= currentText.length;
  const action = answer ? answer.action : active?.tip.action;
  const showReplies = Boolean(active?.tip.replies && !answer);

  const openWith = (entry: ActiveTip) => {
    firstTipRef.current = false;
    setActive(entry);
    setAnswer(null);
    setTyped(0);
    setPending(null);
    setPhase("calling");
  };

  const openNext = () => {
    const ctx = { ...ctxRef.current, hour: new Date().getHours() };
    let tip: BroxxTip;
    if (!readGreeted()) {
      tip = GREETING_TIP;
      try {
        sessionStorage.setItem(GREETED_STORAGE_KEY, "1");
      } catch {
        // ignorar
      }
    } else {
      tip = pickTip(ctx, recentRef.current);
    }
    recentRef.current = [tip.id, ...recentRef.current].slice(0, 4);
    openWith({ tip, text: resolveTipText(tip, ctx) });
  };

  const close = (keepAsUnread = false) => {
    if (phase !== "open" && phase !== "calling") return;
    if (keepAsUnread && active) {
      setPending(active);
    }
    if (active) {
      setIdlePose(answer?.pose ?? active.tip.pose);
    }
    setPhase("closing");
  };

  // Programa el próximo mensaje mientras está tranquilo en la esquina.
  useEffect(() => {
    if (phase !== "idle" || muted) return;
    let timer = 0;
    const tick = () => {
      firstTipRef.current = false;
      if (document.hidden) {
        timer = window.setTimeout(tick, 15_000);
        return;
      }
      openNext();
    };
    const delay = firstTipRef.current ? FIRST_TIP_DELAY_MS : randomBetween(MIN_TIP_GAP_MS, MAX_TIP_GAP_MS);
    timer = window.setTimeout(tick, delay);
    return () => window.clearTimeout(timer);
    // openNext solo lee refs, no hace falta como dependencia.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, muted]);

  // Antes de hablar salta un par de veces para llamar la atención.
  useEffect(() => {
    if (phase === "calling") {
      const timer = window.setTimeout(() => setPhase("open"), prefersReducedMotion() ? 0 : 700);
      return () => window.clearTimeout(timer);
    }
    if (phase === "closing") {
      const timer = window.setTimeout(() => setPhase("idle"), prefersReducedMotion() ? 0 : 260);
      return () => window.clearTimeout(timer);
    }
  }, [phase]);

  // Efecto máquina de escribir.
  useEffect(() => {
    if (phase !== "open" || typed >= currentText.length) return;
    const previous = currentText[typed - 1] ?? "";
    const delay = prefersReducedMotion() ? 0 : /[.,!?…]/.test(previous) ? 170 : 26;
    const timer = window.setTimeout(() => {
      setTyped((value) => (prefersReducedMotion() ? currentText.length : value + 1));
    }, delay);
    return () => window.clearTimeout(timer);
  }, [phase, typed, currentText]);

  // Se cierra solo después de un rato (no mientras el mouse está encima).
  useEffect(() => {
    if (phase !== "open" || !typingDone || hovered || !active) return;
    const waitingAnswer = showReplies;
    const delay = answer
      ? action
        ? 9000
        : 4200
      : waitingAnswer
        ? 14_000
        : 6000 + currentText.length * 35;
    const timer = window.setTimeout(() => close(waitingAnswer), delay);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, typingDone, hovered, active, answer]);

  // Cada tanto cambia lo que está haciendo en la esquina.
  useEffect(() => {
    if (phase !== "idle" || muted) return;
    const interval = window.setInterval(() => {
      if (isNightNow()) {
        setIdlePose("sleep");
        return;
      }
      setIdlePose((current) => {
        const options = IDLE_POSES.filter((pose) => pose !== current);
        return options[Math.floor(Math.random() * options.length)] ?? current;
      });
    }, 45_000);
    return () => window.clearInterval(interval);
  }, [phase, muted]);

  // Escape cierra el globo.
  useEffect(() => {
    if (phase !== "open") return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close(showReplies);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, showReplies]);

  const handlePillClick = () => {
    if (muted) {
      // Tocarlo cuando está silenciado lo despierta.
      setMuted(false);
      openWith({ tip: WAKE_TIP, text: resolveTipText(WAKE_TIP, ctxRef.current) });
      return;
    }
    if (phase === "idle") {
      if (pending) {
        openWith(pending);
      } else {
        openNext();
      }
      return;
    }
    close();
  };

  const handleReply = (reply: BroxxReply) => {
    setAnswer(reply);
    setTyped(0);
  };

  const handleAction = (type: BroxxAction) => {
    onAction(type);
    close();
  };

  const toggleMute = () => {
    setMuted((value) => !value);
    if (!muted) {
      setPending(null);
      close();
    }
  };

  const skipTyping = () => {
    if (!typingDone) setTyped(currentText.length);
  };

  const cardOpen = phase === "open" || phase === "closing";
  const cardPose: BroxxPose = answer?.pose ?? active?.tip.pose ?? idlePose;
  const pillPose: BroxxPose =
    phase === "calling" && active ? active.tip.pose : muted ? "sleep" : pillHovered ? "wave" : idlePose;
  const status = muted
    ? "silenciado"
    : isTraining && pillPose !== "sleep"
      ? "entrenando con vos"
      : STATUS[pillPose];

  const rootClasses = [
    "gymbroxx",
    `is-${phase}`,
    lifted ? "is-lifted" : "",
    muted ? "is-muted" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={rootClasses}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setHovered(false);
      }}
    >
      {cardOpen && active ? (
        <section className="broxx-card" aria-label="Mensaje de GymBroxx">
          <header className="broxx-card-head">
            <div className="broxx-card-title">
              <strong>GymBroxx</strong>
              <small>
                {STATUS[cardPose]}
              </small>
            </div>
            <div className="broxx-card-tools">
              <button
                type="button"
                className="broxx-icon-btn"
                onClick={toggleMute}
                title="Silenciar a GymBroxx"
                aria-label="Silenciar a GymBroxx"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                  <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
                  <path d="M3 3l18 18" />
                </svg>
              </button>
              <button
                type="button"
                className="broxx-icon-btn"
                onClick={() => close(showReplies)}
                title="Minimizar"
                aria-label="Minimizar"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
            </div>
          </header>

          <div className="broxx-card-body">
            <div className="broxx-stage">
              <GymBroxxFigure
                pose={cardPose}
                size={108}
                talking={phase === "open" && !typingDone}
                happy={Boolean(answer?.happy) && typingDone}
                followCursor
              />
              <span className="broxx-floor-shadow" aria-hidden="true" />
            </div>

            <div className="broxx-chat">
              <p className="broxx-bubble" aria-live="polite" onClick={skipTyping}>
                <span className="broxx-bubble-sizer" aria-hidden="true">
                  {currentText}
                </span>
                <span className="broxx-bubble-text">
                  {currentText.slice(0, typed)}
                  {!typingDone ? <span className="broxx-caret" aria-hidden="true" /> : null}
                </span>
              </p>

              {showReplies && typingDone ? (
                <div className="broxx-replies">
                  {active.tip.replies?.map((reply, index) => (
                    <button
                      key={reply.label}
                      type="button"
                      className="broxx-reply"
                      style={{ animationDelay: `${index * 70}ms` }}
                      onClick={() => handleReply(reply)}
                    >
                      {reply.label}
                    </button>
                  ))}
                </div>
              ) : null}

              {action && typingDone ? (
                <button type="button" className="broxx-cta" onClick={() => handleAction(action.type)}>
                  {action.label}
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M5 12h14" />
                    <path d="M13 6l6 6-6 6" />
                  </svg>
                </button>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      <button
        type="button"
        className="broxx-pill"
        onClick={handlePillClick}
        onMouseEnter={() => setPillHovered(true)}
        onMouseLeave={() => setPillHovered(false)}
        aria-expanded={cardOpen}
        aria-label={muted ? "GymBroxx está silenciado. Tocá para despertarlo" : "Hablar con GymBroxx"}
        title={muted ? "Tocá para despertarlo" : undefined}
      >
        <span className="broxx-pill-avatar">
          <GymBroxxFigure pose={pillPose} size={66} followCursor={pillHovered} />
          {pending ? <span className="broxx-badge">1</span> : null}
        </span>
        <span className="broxx-pill-text">
          <strong>GymBroxx</strong>
          <small>
            {status}
          </small>
        </span>
      </button>
    </div>
  );
}

export default GymBroxx;
