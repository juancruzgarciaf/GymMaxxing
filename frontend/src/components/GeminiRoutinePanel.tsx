import { useState, type FormEvent } from "react";

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
    totalEjercicios: number;
    ejerciciosPreview: Array<{
      id_ejercicio: number;
      nombre: string;
      grupo_muscular: string | null;
    }>;
  } | null;
  onViewGeneratedRoutine: (() => void) | null;
  errorMessage: string;
};

function GeminiRoutinePanel({
  open,
  loading,
  onClose,
  onGenerate,
  lastGeneratedRoutine,
  onViewGeneratedRoutine,
  errorMessage,
}: GeminiRoutinePanelProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="gemini-panel-backdrop" role="presentation" onClick={onClose}>
      <aside
        className="gemini-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Generar rutina con Gemini"
        onClick={(event) => event.stopPropagation()}
      >
        <GeminiRoutinePanelBody
          loading={loading}
          onClose={onClose}
          onGenerate={onGenerate}
          lastGeneratedRoutine={lastGeneratedRoutine}
          onViewGeneratedRoutine={onViewGeneratedRoutine}
          errorMessage={errorMessage}
        />
      </aside>
    </div>
  );
}

type GeminiRoutinePanelBodyProps = Omit<GeminiRoutinePanelProps, "open">;

function GeminiRoutinePanelBody({
  loading,
  onClose,
  onGenerate,
  lastGeneratedRoutine,
  onViewGeneratedRoutine,
  errorMessage,
}: GeminiRoutinePanelBodyProps) {
  const [prompt, setPrompt] = useState("");
  const [objetivo, setObjetivo] = useState("");
  const [diasPorSemana, setDiasPorSemana] = useState("");

  const submitWithCurrentValues = () => {
    const nextPrompt = prompt.trim();
    const nextObjetivo = objetivo.trim();
    const diasRaw = diasPorSemana.trim();

    if (!nextPrompt) {
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

    if (diasRaw) {
      const parsed = Number(diasRaw);
      if (Number.isInteger(parsed) && parsed > 0) {
        payload.diasPorSemana = parsed;
      }
    }

    onGenerate(payload);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submitWithCurrentValues();
  };

  return (
    <>
      <div className="gemini-panel-head">
        <div>
          <p className="gemini-panel-eyebrow">Gemini + GymMaxxing</p>
          <h2>Generar rutina</h2>
          <p className="gemini-panel-copy">
            Escribí una consigna corta y GymMaxxing intentará armar un borrador editable de
            rutina, sin mostrarte una respuesta tipo chatbot.
          </p>
        </div>
        <button type="button" className="modal-close" onClick={onClose} disabled={loading}>
          ×
        </button>
      </div>

      <form className="gemini-panel-form" onSubmit={handleSubmit}>
        <label className="gemini-field-group">
          <span>Pedido</span>
          <textarea
            className="field gemini-panel-textarea"
            placeholder="Quiero una rutina de piernas para hipertrofia"
            rows={5}
            disabled={loading}
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            required
          />
        </label>

        <label className="gemini-field-group">
          <span>Objetivo opcional</span>
          <input
            className="field"
            placeholder="ganar masa muscular"
            disabled={loading}
            value={objetivo}
            onChange={(event) => setObjetivo(event.target.value)}
          />
        </label>

        <label className="gemini-field-group">
          <span>Días por semana</span>
          <input
            className="field"
            type="number"
            min="1"
            max="7"
            placeholder="3"
            disabled={loading}
            value={diasPorSemana}
            onChange={(event) => setDiasPorSemana(event.target.value)}
          />
        </label>

        <div className="gemini-panel-note">
          Gemini usa tu perfil y datos internos de GymMaxxing para devolver una estructura de
          rutina que después podrás revisar y guardar solo si la confirmás.
        </div>

        {errorMessage ? (
          <div className="gemini-panel-error">
            <div>{errorMessage}</div>
            <div className="gemini-panel-error-actions">
              <button
                type="button"
                className="btn secondary"
                onClick={submitWithCurrentValues}
                disabled={loading || !prompt.trim()}
              >
                Reintentar
              </button>
            </div>
          </div>
        ) : null}

        {lastGeneratedRoutine ? (
          <div className="gemini-panel-result">
            <strong>{lastGeneratedRoutine.nombre}</strong>
            <small>{lastGeneratedRoutine.totalEjercicios} ejercicios generados</small>
            {lastGeneratedRoutine.ejerciciosPreview.length > 0 ? (
              <div className="gemini-panel-result-list">
                {lastGeneratedRoutine.ejerciciosPreview.map((exercise) => (
                  <div key={exercise.id_ejercicio} className="gemini-panel-result-item">
                    <span>{exercise.nombre}</span>
                    <small>{exercise.grupo_muscular ?? "Sin grupo muscular"}</small>
                  </div>
                ))}
              </div>
            ) : null}
            {onViewGeneratedRoutine ? (
              <button type="button" className="btn secondary" onClick={onViewGeneratedRoutine}>
                Ver rutina creada
              </button>
            ) : null}
          </div>
        ) : null}

        <div className="gemini-panel-actions">
          <button type="button" className="btn secondary" onClick={onClose} disabled={loading}>
            Cerrar
          </button>
          <button type="submit" className="btn" disabled={loading}>
            {loading ? "Generando..." : "Generar con Gemini"}
          </button>
        </div>
      </form>
    </>
  );
}

export default GeminiRoutinePanel;
