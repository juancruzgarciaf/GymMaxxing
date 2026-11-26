import { useEffect, useRef } from "react";
import type { BroxxPose } from "./tips";
import dumbbellImg from "../../assets/gymbroxx/gymbroxx-dumbbell.png";
import musicImg from "../../assets/gymbroxx/gymbroxx-music.png";
import musicNotesLeftImg from "../../assets/gymbroxx/gymbroxx-music-notes-left.png";
import musicNotesRightImg from "../../assets/gymbroxx/gymbroxx-music-notes-right.png";
import musicWavesLeftImg from "../../assets/gymbroxx/gymbroxx-music-waves-left.png";
import musicWavesRightImg from "../../assets/gymbroxx/gymbroxx-music-waves-right.png";
import phoneImg from "../../assets/gymbroxx/gymbroxx-phone.png";
import proteinImg from "../../assets/gymbroxx/gymbroxx-protein.png";
import sleepImg from "../../assets/gymbroxx/gymbroxx-sleep.png";
import sleepZ1Img from "../../assets/gymbroxx/gymbroxx-sleep-z1.png";
import sleepZ2Img from "../../assets/gymbroxx/gymbroxx-sleep-z2.png";
import sleepZ3Img from "../../assets/gymbroxx/gymbroxx-sleep-z3.png";
import waveImg from "../../assets/gymbroxx/gymbroxx-wave.png";

// Las imágenes originales se recortaron todas con el mismo encuadre, así el cuerpo no "salta"
// al cambiar de pose. Los ojos se borraron de la imagen y se dibujan acá para poder animarlos
// (parpadear, mirar al cursor, ojos felices). Las notas y las Z son capas aparte.

const BODY: Record<BroxxPose, string> = {
  wave: waveImg,
  dumbbell: dumbbellImg,
  protein: proteinImg,
  phone: phoneImg,
  music: musicImg,
  sleep: sleepImg,
};

type Decor = { key: string; src: string; left: number; top: number; width: number };

const DECOR: Partial<Record<BroxxPose, Decor[]>> = {
  music: [
    { key: "notes-left", src: musicNotesLeftImg, left: -10.29, top: 7.81, width: 23.53 },
    { key: "notes-right", src: musicNotesRightImg, left: 84.56, top: 8.59, width: 21.32 },
    { key: "waves-left", src: musicWavesLeftImg, left: -3.68, top: 37.5, width: 8.82 },
    { key: "waves-right", src: musicWavesRightImg, left: 90.44, top: 42.19, width: 8.82 },
  ],
  sleep: [
    { key: "z1", src: sleepZ1Img, left: 83.09, top: 18.75, width: 8.82 },
    { key: "z2", src: sleepZ2Img, left: 90.44, top: 11.72, width: 10.29 },
    { key: "z3", src: sleepZ3Img, left: 100, top: 1.56, width: 11.76 },
  ],
};

const EYES = [
  { left: 33.82, top: 38.28, width: 8.09, height: 11.72 },
  { left: 55.15, top: 38.28, width: 8.09, height: 11.72 },
];

// Hacia dónde mira cuando está "en lo suyo" en cada pose.
const POSE_GAZE: Partial<Record<BroxxPose, [number, number]>> = {
  phone: [0.9, 0.8],
  protein: [0.7, 0.5],
};

type Props = {
  pose: BroxxPose;
  size: number;
  talking?: boolean;
  happy?: boolean;
  followCursor?: boolean;
  className?: string;
};

const randomBetween = (min: number, max: number) => min + Math.random() * (max - min);

function GymBroxxFigure({ pose, size, talking = false, happy = false, followCursor = false, className }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const lastPointerMoveRef = useRef(0);

  const setGaze = (x: number, y: number) => {
    const node = rootRef.current;
    if (!node) return;
    node.style.setProperty("--broxx-lx", x.toFixed(3));
    node.style.setProperty("--broxx-ly", y.toFixed(3));
  };

  // Parpadeo aleatorio (a veces doble, como las personas).
  useEffect(() => {
    if (pose === "sleep") return;
    let timer = 0;
    const blink = (thenAgain: boolean) => {
      const node = rootRef.current;
      if (!node) return;
      node.classList.add("is-blinking");
      timer = window.setTimeout(() => {
        node.classList.remove("is-blinking");
        timer = thenAgain
          ? window.setTimeout(() => blink(false), 140)
          : window.setTimeout(() => blink(Math.random() < 0.2), randomBetween(2200, 5600));
      }, 120);
    };
    timer = window.setTimeout(() => blink(false), randomBetween(900, 3000));
    return () => window.clearTimeout(timer);
  }, [pose]);

  // Mirada "idle": mira para los costados cada tanto, o a lo que tiene en la mano.
  useEffect(() => {
    if (pose === "sleep") return;
    let timer = 0;
    const look = () => {
      if (Date.now() - lastPointerMoveRef.current > 2500) {
        const focus = POSE_GAZE[pose];
        if (focus && Math.random() < 0.6) {
          setGaze(focus[0], focus[1]);
        } else if (Math.random() < 0.35) {
          setGaze(0, 0);
        } else {
          setGaze(randomBetween(-1, 1), randomBetween(-0.7, 0.6));
        }
      }
      timer = window.setTimeout(look, randomBetween(1600, 4200));
    };
    look();
    return () => window.clearTimeout(timer);
  }, [pose]);

  // Sigue al cursor con la mirada.
  useEffect(() => {
    if (!followCursor || pose === "sleep") return;
    let frame = 0;
    const onMove = (event: PointerEvent) => {
      lastPointerMoveRef.current = Date.now();
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const node = rootRef.current;
        if (!node) return;
        const rect = node.getBoundingClientRect();
        const dx = event.clientX - (rect.left + rect.width * 0.48);
        const dy = event.clientY - (rect.top + rect.height * 0.44);
        const dist = Math.hypot(dx, dy) || 1;
        const strength = Math.min(1, dist / 180);
        setGaze((dx / dist) * strength, (dy / dist) * strength);
      });
    };
    window.addEventListener("pointermove", onMove);
    return () => {
      window.removeEventListener("pointermove", onMove);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [followCursor, pose]);

  const classes = ["broxx-figure", talking ? "is-talking" : "", happy ? "is-happy" : "", className ?? ""]
    .filter(Boolean)
    .join(" ");

  return (
    <div ref={rootRef} className={classes} data-pose={pose} style={{ width: size }} aria-hidden="true">
      <div className="broxx-hop" key={pose}>
        <div className="broxx-body">
          <img src={BODY[pose]} alt="" draggable={false} className="broxx-body-img" />
          {pose !== "sleep"
            ? EYES.map((eye, index) => (
                <span
                  key={index}
                  className="broxx-eye"
                  style={{
                    left: `${eye.left}%`,
                    top: `${eye.top}%`,
                    width: `${eye.width}%`,
                    height: `${eye.height}%`,
                  }}
                />
              ))
            : null}
        </div>
        {(DECOR[pose] ?? []).map((decor) => (
          <img
            key={decor.key}
            src={decor.src}
            alt=""
            draggable={false}
            className={`broxx-decor broxx-decor-${decor.key}`}
            style={{ left: `${decor.left}%`, top: `${decor.top}%`, width: `${decor.width}%` }}
          />
        ))}
      </div>
    </div>
  );
}

export default GymBroxxFigure;
