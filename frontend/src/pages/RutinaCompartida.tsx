import { useEffect, useState } from "react";
import {
  fetchRoutineSeed,
  saveTrainingSeedAsRoutine,
} from "../lib/trainingTransfer";
import type { RoutineSummary, TrainingSeed, Usuario } from "../types";

type RutinaCompartidaProps = {
  usuario: Usuario;
  routineId: number;
  onClose: () => void;
  onCopyToTraining: (seed: TrainingSeed) => void;
};

function RutinaCompartida({
  usuario,
  routineId,
  onClose,
  onCopyToTraining,
}: RutinaCompartidaProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [routine, setRoutine] = useState<RoutineSummary | null>(null);
  const [seed, setSeed] = useState<TrainingSeed | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadRoutine = async () => {
      try {
        setLoading(true);
        setError("");
        setMessage("");
        const data = await fetchRoutineSeed(routineId);
        if (!cancelled) {
          setRoutine(data.routine);
          setSeed(data.seed);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "No se pudo cargar la rutina compartida");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadRoutine();

    return () => {
      cancelled = true;
    };
  }, [routineId]);

  useEffect(() => {
    if (!message) {
      return;
    }
    const timer = window.setTimeout(() => setMessage(""), 2600);
    return () => window.clearTimeout(timer);
  }, [message]);

  useEffect(() => {
    if (!error) {
      return;
    }
    const timer = window.setTimeout(() => setError(""), 3800);
    return () => window.clearTimeout(timer);
  }, [error]);

  const handleSaveAsOwnRoutine = async () => {
    if (!seed || !routine) {
      return;
    }

    try {
      setSaving(true);
      setError("");
      await saveTrainingSeedAsRoutine(seed, usuario.id, {
        name: routine.nombre,
        description: routine.descripcion,
      });
      setMessage("Rutina guardada en tus rutinas");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la rutina");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="app">
      {(error || message) ? (
        <div className={`toast-pop ${error ? "error" : "ok"}`} role="status" aria-live="polite">
          {error || message}
        </div>
      ) : null}

      <section className="hero editor-header">
        <button type="button" className="btn secondary" onClick={onClose}>
          ← Volver
        </button>
        <h1>Rutina compartida</h1>
        <span />
      </section>

      {loading ? <p className="status">Cargando rutina compartida...</p> : null}

      {!loading && routine && seed ? (
        <section className="panel two-cols">
          <article className="box">
            <h2>{routine.nombre}</h2>
            <p className="helper-text">{routine.descripcion || "Sin descripcion"}</p>
            <div className="detail-meta">
              <span>Duracion: {routine.duracion_estimada ?? "-"} min</span>
              <span>ID {routine.id_rutina}</span>
            </div>

            <h3 className="detail-subtitle">Ejercicios ({seed.exercises.length})</h3>
            {seed.exercises.length === 0 ? (
              <p className="helper-text">Esta rutina no tiene ejercicios.</p>
            ) : (
              <div className="exercise-summary-grid">
                {seed.exercises.map((exercise) => (
                  <div key={exercise.id_ejercicio} className="exercise-summary-item">
                    <strong>{exercise.nombre}</strong>
                    <small>
                      {exercise.grupo_muscular} · {exercise.series.length} series
                    </small>
                  </div>
                ))}
              </div>
            )}
          </article>

          <article className="box">
            <h2>Que puedes hacer</h2>
            <p className="helper-text">
              Copiarla a Entrenamiento para arrancar una sesion nueva ahora mismo.
            </p>
            <p className="helper-text">
              Guardarla como tu propia rutina para tenerla en tu biblioteca.
            </p>

            <div className="actions-row">
              <button type="button" className="btn" onClick={() => onCopyToTraining(seed)}>
                Copiar a entrenamiento
              </button>
              <button
                type="button"
                className="btn secondary"
                onClick={() => void handleSaveAsOwnRoutine()}
                disabled={saving}
              >
                Guardar como mi rutina
              </button>
            </div>
          </article>
        </section>
      ) : null}
    </main>
  );
}

export default RutinaCompartida;
