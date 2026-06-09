import type { FormEvent } from "react";

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
    id_rutina: number;
    nombre: string;
    totalEjercicios: number;
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
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const prompt = String(formData.get("prompt") ?? "").trim();
    const objetivo = String(formData.get("objetivo") ?? "").trim();
    const diasRaw = String(formData.get("dias_por_semana") ?? "").trim();

    if (!prompt) {
      return;
    }

    const payload: {
      prompt: string;
      objetivo?: string;
      diasPorSemana?: number;
    } = { prompt };

    if (objetivo) {
      payload.objetivo = objetivo;
    }

    if (diasRaw) {
      const parsed = Number(diasRaw);
      if (Number.isInteger(parsed) && parsed > 0) {
        payload.diasPorSemana = parsed;
      }
    }

    onGenerate(payload);
  };

  return (
    <>
      <div className="gemini-panel-head">
        <div>
          <p className="gemini-panel-eyebrow">Gemini + GymMaxxing</p>
          <h2>Generar rutina</h2>
          <p className="gemini-panel-copy">
            Escribí una consigna corta y GymMaxxing intentará crear una rutina real en tu
            biblioteca, sin mostrarte una respuesta tipo chatbot.
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
            name="prompt"
            placeholder="Quiero una rutina de piernas para hipertrofia"
            rows={5}
            disabled={loading}
            required
          />
        </label>

        <label className="gemini-field-group">
          <span>Objetivo opcional</span>
          <input
            className="field"
            name="objetivo"
            placeholder="ganar masa muscular"
            disabled={loading}
          />
        </label>

        <label className="gemini-field-group">
          <span>Días por semana</span>
          <input
            className="field"
            name="dias_por_semana"
            type="number"
            min="1"
            max="7"
            placeholder="3"
            disabled={loading}
          />
        </label>

        <div className="gemini-panel-note">
          Gemini usa tu perfil y datos internos de GymMaxxing para devolver una estructura de
          rutina que el backend guarda como una rutina real.
        </div>

        {errorMessage ? <div className="gemini-panel-error">{errorMessage}</div> : null}

        {lastGeneratedRoutine ? (
          <div className="gemini-panel-result">
            <strong>{lastGeneratedRoutine.nombre}</strong>
            <small>{lastGeneratedRoutine.totalEjercicios} ejercicios generados</small>
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
