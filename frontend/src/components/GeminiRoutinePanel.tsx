import { useEffect, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { isVideoMediaUrl, resolveMediaUrl } from "../lib/media";

type GeminiPreviewExercise = {
  id_ejercicio: number;
  nombre: string;
  grupo_muscular: string | null;
  imagen_url?: string | null;
};

type GeminiRoutinePanelProps = {
  open: boolean;
  loading: boolean;
  onClose: () => void;
  onGenerate: (payload: {
    prompt: string;
    objetivo?: string;
    diasPorSemana?: number;
  }) => void;
  lastGeneratedRoutine: {
    nombre: string;
    aviso?: string | null;
    detalleTecnico?: string | null;
    totalEjercicios: number;
    ejerciciosPreview: GeminiPreviewExercise[];
  } | null;
  onViewGeneratedRoutine: (() => void) | null;
  errorMessage: string;
};

// Pedidos de ejemplo: un click y quedan escritos en el textarea.
const PROMPT_SUGGESTIONS = [
  "Piernas para hipertrofia",
  "Push Pull Legs",
  "Full body para principiantes",
  "Espalda y bíceps",
  "Pecho, hombros y tríceps",
];

const DAY_OPTIONS = [1, 2, 3, 4, 5, 6, 7];

// Destello de 4 puntas con degradé: el mismo símbolo de Gemini que se usa en Rutinas.
function GeminiSpark({ size = 22 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <defs>
        <linearGradient id="gemini-drawer-spark" x1="3" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#4285f4" />
          <stop offset="0.55" stopColor="#9b72cb" />
          <stop offset="1" stopColor="#d96570" />
        </linearGradient>
      </defs>
      <path
        fill="url(#gemini-drawer-spark)"
        d="M12 2.5c.8 3.3 1.7 4.9 3 6.2s2.9 2.2 6.2 3c-3.3.8-4.9 1.7-6.2 3s-2.2 2.9-3 6.2c-.8-3.3-1.7-4.9-3-6.2s-2.9-2.2-6.2-3c3.3-.8 4.9-1.7 6.2-3s2.2-2.9 3-6.2Z"
      />
    </svg>
  );
}

function ExerciseThumb({ exercise }: { exercise: GeminiPreviewExercise }) {
  const src = resolveMediaUrl(exercise.imagen_url ?? null);
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <span className="gx-thumb gx-thumb-empty" aria-hidden="true">
        {exercise.nombre.trim().charAt(0).toUpperCase() || "?"}
      </span>
    );
  }

  if (isVideoMediaUrl(src)) {
    return (
      <video
        className="gx-thumb"
        src={src}
        muted
        loop
        autoPlay
        playsInline
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <img className="gx-thumb" src={src} alt="" loading="lazy" onError={() => setFailed(true)} />
  );
}

function GeminiRoutinePanel(props: GeminiRoutinePanelProps) {
  const { open, loading, onClose } = props;

  useEffect(() => {
    if (!open) {
      return;
    }
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !loading) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, loading, onClose]);

  if (!open) {
    return null;
  }

  // Portal al body: así el panel queda afuera de .content y no lo pisan los estilos globales del tema
  // claro (que fuerzan fondo blanco y texto negro a todo lo que termina en -panel / -item).
  return createPortal(
    <div
      className="gemini-drawer-scrim"
      role="presentation"
      onClick={loading ? undefined : onClose}
    >
      <aside
        className="gemini-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="gemini-drawer-title"
        onClick={(event) => event.stopPropagation()}
      >
        <GeminiRoutinePanelBody {...props} />
      </aside>
    </div>,
    document.body,
  );
}

function GeminiRoutinePanelBody({
  loading,
  onClose,
  onGenerate,
  lastGeneratedRoutine,
  onViewGeneratedRoutine,
  errorMessage,
}: Omit<GeminiRoutinePanelProps, "open">) {
  const [prompt, setPrompt] = useState("");
  const [objetivo, setObjetivo] = useState("");
  const [diasPorSemana, setDiasPorSemana] = useState<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Cuando llega una rutina nueva, la llevamos a la vista.
  useEffect(() => {
    if (lastGeneratedRoutine) {
      resultRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [lastGeneratedRoutine]);

  const submitWithCurrentValues = () => {
    const nextPrompt = prompt.trim();
    const nextObjetivo = objetivo.trim();

    if (!nextPrompt || loading) {
      return;
    }

    const payload: {
      prompt: string;
      objetivo?: string;
      diasPorSemana?: number;
    } = { prompt: nextPrompt };

    if (nextObjetivo) {
      payload.objetivo = nextObjetivo;
    }

    if (diasPorSemana != null) {
      payload.diasPorSemana = diasPorSemana;
    }

    onGenerate(payload);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submitWithCurrentValues();
  };

  const applySuggestion = (suggestion: string) => {
    setPrompt(suggestion);
    textareaRef.current?.focus();
  };

  return (
    <form className="gemini-drawer-form" onSubmit={handleSubmit}>
      <header className="gemini-drawer-head">
        <span className="gemini-drawer-badge" aria-hidden="true">
          <GeminiSpark size={24} />
        </span>
        <div className="gemini-drawer-titles">
          <p className="gemini-drawer-eyebrow">Gemini</p>
          <h2 id="gemini-drawer-title">Generar rutina</h2>
        </div>
        <button
          type="button"
          className="gemini-drawer-close"
          onClick={onClose}
          disabled={loading}
          aria-label="Cerrar"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </header>

      <div className="gemini-drawer-scroll">
        <p className="gemini-drawer-intro">
          Contale qué querés entrenar y Gemini arma un borrador con ejercicios de tu biblioteca.
          Lo revisás y lo guardás solo si te convence.
        </p>

        <section className="gemini-drawer-section">
          <label className="gemini-drawer-label" htmlFor="gemini-drawer-prompt">
            ¿Qué querés entrenar?
          </label>
          <textarea
            id="gemini-drawer-prompt"
            ref={textareaRef}
            className="field gemini-drawer-textarea"
            placeholder="Ej: rutina de piernas para hipertrofia, 1 hora"
            rows={4}
            disabled={loading}
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                submitWithCurrentValues();
              }
            }}
            required
          />
          <div className="gemini-drawer-suggestions" aria-label="Ideas rápidas">
            {PROMPT_SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                className={`gemini-suggestion${prompt.trim() === suggestion ? " is-active" : ""}`}
                onClick={() => applySuggestion(suggestion)}
                disabled={loading}
              >
                {suggestion}
              </button>
            ))}
          </div>
        </section>

        <section className="gemini-drawer-section">
          <label className="gemini-drawer-label" htmlFor="gemini-drawer-goal">
            Objetivo <span className="gemini-drawer-optional">opcional</span>
          </label>
          <input
            id="gemini-drawer-goal"
            className="field"
            placeholder="Ganar masa muscular"
            disabled={loading}
            value={objetivo}
            onChange={(event) => setObjetivo(event.target.value)}
          />
        </section>

        <section className="gemini-drawer-section">
          <span className="gemini-drawer-label" id="gemini-drawer-days-label">
            Días por semana <span className="gemini-drawer-optional">opcional</span>
          </span>
          <div className="gemini-days" role="radiogroup" aria-labelledby="gemini-drawer-days-label">
            {DAY_OPTIONS.map((day) => {
              const selected = diasPorSemana === day;
              return (
                <button
                  key={day}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  className={`gemini-day${selected ? " is-active" : ""}`}
                  onClick={() => setDiasPorSemana(selected ? null : day)}
                  disabled={loading}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </section>

        <p className="gemini-drawer-hint">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20 6 9 17l-5-5" />
          </svg>
          Usa tu perfil y solo ejercicios que ya existen en GymMaxxing.
        </p>

        {errorMessage ? (
          <div className="gemini-drawer-error" role="alert">
            <span>{errorMessage}</span>
            <button
              type="button"
              className="gemini-link-btn"
              onClick={submitWithCurrentValues}
              disabled={loading || !prompt.trim()}
            >
              Reintentar
            </button>
          </div>
        ) : null}

        {loading ? (
          <div className="gemini-result" aria-live="polite">
            <div className="gemini-result-head">
              <span className="gemini-result-title">Armando tu rutina…</span>
              <span className="gemini-result-meta">Esto tarda unos segundos</span>
            </div>
            <div className="gemini-result-list" aria-hidden="true">
              {[0, 1, 2, 3].map((index) => (
                <div key={index} className="gemini-result-row is-skeleton">
                  <span className="gx-thumb gx-skeleton" />
                  <span className="gemini-result-text">
                    <span className="gx-skeleton gx-skeleton-line" />
                    <span className="gx-skeleton gx-skeleton-line short" />
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : lastGeneratedRoutine ? (
          <div className="gemini-result" ref={resultRef} aria-live="polite">
            <div className="gemini-result-head">
              <span className="gemini-result-title">{lastGeneratedRoutine.nombre}</span>
              <span className="gemini-result-meta">
                {lastGeneratedRoutine.totalEjercicios}{" "}
                {lastGeneratedRoutine.totalEjercicios === 1 ? "ejercicio" : "ejercicios"}
              </span>
            </div>
            {lastGeneratedRoutine.aviso ? (
              <div className="gemini-result-notice" role="status">
                <p>{lastGeneratedRoutine.aviso}</p>
                {lastGeneratedRoutine.detalleTecnico ? (
                  <code className="gemini-result-detail">{lastGeneratedRoutine.detalleTecnico}</code>
                ) : null}
              </div>
            ) : null}
            {lastGeneratedRoutine.ejerciciosPreview.length > 0 ? (
              <ol className="gemini-result-list">
                {lastGeneratedRoutine.ejerciciosPreview.map((exercise, index) => (
                  <li
                    key={`${exercise.id_ejercicio}-${index}`}
                    className="gemini-result-row"
                    style={{ animationDelay: `${index * 45}ms` }}
                  >
                    <ExerciseThumb exercise={exercise} />
                    <span className="gemini-result-text">
                      <span className="gemini-result-name">{exercise.nombre}</span>
                      <span className="gemini-result-group">
                        {exercise.grupo_muscular ?? "Sin grupo muscular"}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            ) : null}
            {onViewGeneratedRoutine ? (
              <button type="button" className="btn gemini-result-cta" onClick={onViewGeneratedRoutine}>
                Revisar y guardar
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <footer className="gemini-drawer-foot">
        <button type="button" className="btn secondary" onClick={onClose} disabled={loading}>
          Cerrar
        </button>
        <button
          type="submit"
          className="btn gemini-drawer-submit"
          disabled={loading || !prompt.trim()}
        >
          {loading ? (
            <span className="gemini-spinner" aria-hidden="true" />
          ) : (
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
              <path
                fill="currentColor"
                d="M12 2.5c.8 3.3 1.7 4.9 3 6.2s2.9 2.2 6.2 3c-3.3.8-4.9 1.7-6.2 3s-2.2 2.9-3 6.2c-.8-3.3-1.7-4.9-3-6.2s-2.9-2.2-6.2-3c3.3-.8 4.9-1.7 6.2-3s2.2-2.9 3-6.2Z"
              />
            </svg>
          )}
          {loading
            ? "Generando…"
            : lastGeneratedRoutine
              ? "Generar otra"
              : "Generar con Gemini"}
        </button>
      </footer>
    </form>
  );
}

export default GeminiRoutinePanel;
