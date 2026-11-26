import { useEffect, useMemo, useState } from "react";
import {
  createRoutineShareUrl,
  fetchRoutineSummary,
  fetchRoutineSeed,
  matchPersistedByOrder,
  readPersistedRoutineExercises,
  saveTrainingSeedAsRoutine,
} from "../lib/trainingTransfer";
import type { RoutineSummary, TrainingSeed, TrainingSeedExercise, Usuario } from "../types";
import UserAvatar from "../components/UserAvatar";
import VerifiedBadge from "../components/VerifiedBadge";
import ExerciseMedia from "../components/ExerciseMedia";
import MusicaChips from "../components/MusicaChips";
import { playlistDesdeCampos } from "../lib/musica";

type RutinaCompartidaProps = {
  usuario: Usuario;
  canTrain: boolean;
  routineId: number;
  onClose: () => void;
  onOpenProfile: (username: string) => void;
  onCopyToTraining: (seed: TrainingSeed, options?: { isOwnRoutine?: boolean }) => void;
};

type RoutineCreator = Pick<Usuario, "id" | "username" | "tipo_usuario" | "foto_perfil_url">;

const API = "http://localhost:3000";

const normalizeText = (value?: string | null) =>
  (value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();

const isCardioExercise = (exercise: TrainingSeedExercise) =>
  normalizeText(exercise.tipo_disciplina).includes("cardio") ||
  normalizeText(exercise.grupo_muscular) === "cardio";

const twoDigits = (value: number) => String(value).padStart(2, "0");

const formatRest = (seconds: number) => {
  const safe = Math.max(0, Math.floor(seconds));
  return `${Math.floor(safe / 60)}:${twoDigits(safe % 60)}`;
};

const getSerieLabel = (tipo: TrainingSeedExercise["series"][number]["tipo"], serieNumber: number) => {
  switch (tipo) {
    case "failure":
      return { label: "F", className: "failure" };
    case "dropset":
      return { label: "D", className: "dropset" };
    case "warmup":
      return { label: "W", className: "warmup" };
    default:
      return { label: String(serieNumber), className: "normal" };
  }
};

// En las rutinas propias, completamos kg, reps, tipo de serie y nota con lo que el creador
// guardó en este navegador (el backend solo guarda cantidad de series y repeticiones).
const withOwnPersistedSeries = (seed: TrainingSeed, routineId: number): TrainingSeed => {
  const persisted = matchPersistedByOrder(seed.exercises, readPersistedRoutineExercises(routineId));

  return {
    ...seed,
    exercises: seed.exercises.map((exercise, index) => {
      const saved = persisted[index];
      if (!saved) {
        return exercise;
      }

      return {
        ...exercise,
        nota: saved.nota || exercise.nota,
        descansoSegundos: Math.max(0, saved.descansoSegundos ?? exercise.descansoSegundos),
        series: exercise.series.map((serie, serieIndex) => {
          const savedSerie = saved.series?.[serieIndex];
          return savedSerie
            ? {
                ...serie,
                kg: savedSerie.kg ?? serie.kg,
                reps: savedSerie.reps ?? serie.reps,
                tipo: savedSerie.tipo ?? serie.tipo,
              }
            : serie;
        }),
      };
    }),
  };
};

function RutinaCompartida({
  usuario,
  canTrain,
  routineId,
  onClose,
  onOpenProfile,
  onCopyToTraining,
}: RutinaCompartidaProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [routine, setRoutine] = useState<RoutineSummary | null>(null);
  const [seed, setSeed] = useState<TrainingSeed | null>(null);
  const [creator, setCreator] = useState<RoutineCreator | null>(null);

  const isOwnRoutine = routine != null && routine.creador_id === usuario.id;

  useEffect(() => {
    let cancelled = false;

    const loadRoutine = async () => {
      try {
        setLoading(true);
        setError("");
        setMessage("");
        const data = await fetchRoutineSeed(routineId);
        const own = data.routine.creador_id === usuario.id;

        let creatorData: RoutineCreator | null = null;
        try {
          const res = await fetch(`${API}/users/${data.routine.creador_id}`);
          if (res.ok) {
            const user = (await res.json()) as Usuario;
            creatorData = {
              id: user.id,
              username: user.username,
              tipo_usuario: user.tipo_usuario,
              foto_perfil_url: user.foto_perfil_url ?? null,
            };
          }
        } catch {
          // Si no se puede cargar el autor, la rutina se muestra igual.
        }

        if (!cancelled) {
          setRoutine(data.routine);
          setSeed(own ? withOwnPersistedSeries(data.seed, data.routine.id_rutina) : data.seed);
          setCreator(creatorData);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "No se pudo cargar la rutina");
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
  }, [routineId, usuario.id]);

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

  const muscleGroups = useMemo(() => {
    const groups = new Set<string>();
    seed?.exercises.forEach((exercise) => {
      if (exercise.grupo_muscular) {
        groups.add(exercise.grupo_muscular);
      }
    });
    return Array.from(groups).sort((a, b) => a.localeCompare(b));
  }, [seed]);

  const totalSeries = useMemo(
    () => seed?.exercises.reduce((acc, exercise) => acc + exercise.series.length, 0) ?? 0,
    [seed],
  );

  const handleSaveAsOwnRoutine = async () => {
    if (!seed || !routine || isOwnRoutine) {
      return;
    }

    try {
      setSaving(true);
      setError("");
      await saveTrainingSeedAsRoutine(seed, usuario.id, {
        name: routine.nombre,
        description: routine.descripcion,
      });
      const refreshedRoutine = await fetchRoutineSummary(routine.id_rutina);
      setRoutine(refreshedRoutine);
      setMessage("Rutina guardada en tus rutinas");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la rutina");
    } finally {
      setSaving(false);
    }
  };

  const handleShare = async () => {
    if (!routine) {
      return;
    }

    const url = createRoutineShareUrl(routine.id_rutina);
    try {
      await navigator.clipboard.writeText(url);
      setMessage("Link de la rutina copiado");
    } catch {
      setError("No se pudo copiar el link");
    }
  };

  return (
    <main className="page-shell routine-view">
      {(error || message) ? (
        <div className={`toast-pop ${error ? "error" : "ok"}`} role="status" aria-live="polite">
          {error || message}
        </div>
      ) : null}

      <section className="detail-topbar">
        <div className="detail-topbar-actions">
          <button type="button" className="btn secondary" onClick={onClose}>
            Volver
          </button>
        </div>
        {creator ? (
          <button
            type="button"
            className="profile-chip detail-author"
            onClick={() => onOpenProfile(creator.username)}
            title={`Ver perfil de ${creator.username}`}
          >
            <UserAvatar username={creator.username} photoUrl={creator.foto_perfil_url} />
            <span>
              <strong className="verified-name">
                {creator.username}
                <VerifiedBadge tipoUsuario={creator.tipo_usuario} />
              </strong>
              <small>{isOwnRoutine ? "Tu rutina" : "Autor de la rutina"}</small>
            </span>
          </button>
        ) : null}
      </section>

      {loading ? <p className="status">Cargando rutina...</p> : null}
      {!loading && !routine ? (
        <section className="empty-state">
          <h2>No encontramos esta rutina</h2>
          <p>Puede que haya sido eliminada.</p>
        </section>
      ) : null}

      {!loading && routine && seed ? (
        <>
          <section className="profile-banner training-banner">
            <div className="profile-main">
              <p className="eyebrow">{isOwnRoutine ? "Tu rutina" : "Rutina"}</p>
              <h1>{routine.nombre}</h1>
              <p className="subtitle">{routine.descripcion || "Sin descripcion"}</p>
              <MusicaChips playlist={playlistDesdeCampos(routine)} cancion={null} />

              <div className="metrics-row detail-metrics-row">
                <div className="metric-box detail-metric">
                  <span>Ejercicios</span>
                  <strong>{seed.exercises.length}</strong>
                </div>
                <div className="metric-box detail-metric">
                  <span>Series</span>
                  <strong>{totalSeries}</strong>
                </div>
                <div className="metric-box detail-metric">
                  <span>Duracion</span>
                  <strong>{routine.duracion_estimada ? `${routine.duracion_estimada} min` : "-"}</strong>
                </div>
                <div className="metric-box detail-metric">
                  <span>Guardados</span>
                  <strong>{routine.save_count}</strong>
                </div>
                <div className="metric-box detail-metric">
                  <span>Copias</span>
                  <strong>{routine.copy_count}</strong>
                </div>
              </div>

              {muscleGroups.length > 0 ? (
                <div className="muscle-chips">
                  {muscleGroups.map((group) => (
                    <span key={group} className="muscle-chip">
                      {group}
                    </span>
                  ))}
                </div>
              ) : null}

              <div className="actions-row routine-view-actions">
                {canTrain ? (
                  <button
                    type="button"
                    className="btn"
                    onClick={() => onCopyToTraining(seed, { isOwnRoutine })}
                  >
                    Copiar a entrenamiento
                  </button>
                ) : null}
                {!isOwnRoutine ? (
                  <div className="action-with-metric">
                    <button
                      type="button"
                      className="btn secondary"
                      onClick={() => void handleSaveAsOwnRoutine()}
                      disabled={saving}
                    >
                      {saving ? "Guardando..." : "Guardar como mi rutina"}
                    </button>
                    <span className="action-metric-pill" title="Cantidad de usuarios que guardaron esta rutina">
                      {routine.save_count}
                    </span>
                  </div>
                ) : null}
                <button type="button" className="btn secondary" onClick={() => void handleShare()}>
                  Compartir link
                </button>
              </div>
              {isOwnRoutine ? (
                <p className="helper-text">Es tu rutina: para modificarla entrá a Rutinas.</p>
              ) : !canTrain ? (
                <p className="helper-text">Las cuentas gimnasio no pueden iniciar entrenamientos.</p>
              ) : null}
            </div>
          </section>

          {seed.exercises.length === 0 ? (
            <section className="empty-state">
              <h2>Esta rutina no tiene ejercicios</h2>
            </section>
          ) : (
            <section className="detail-exercises">
              {seed.exercises.map((exercise, exerciseIndex) => {
                const cardio = isCardioExercise(exercise);
                const showWeight = exercise.series.some((serie) => serie.kg.trim());
                let serieNumber = 0;

                return (
                  <article
                    key={`${exercise.id_ejercicio}-${exerciseIndex}`}
                    className="exercise-card readonly detail-exercise-card"
                  >
                    <div className="exercise-card-head">
                      <ExerciseMedia
                        exerciseId={exercise.id_ejercicio}
                        name={exercise.nombre}
                        imageUrl={exercise.imagen_url}
                      />
                      <div>
                        <h3>{exercise.nombre}</h3>
                        <small>
                          {exercise.grupo_muscular || "Sin grupo"} · {exercise.tipo_disciplina || "Sin disciplina"}
                        </small>
                      </div>
                      <span className="detail-series-count">
                        {exercise.series.length} {exercise.series.length === 1 ? "serie" : "series"}
                        {exercise.descansoSegundos > 0 ? ` · Descanso ${formatRest(exercise.descansoSegundos)}` : ""}
                      </span>
                    </div>

                    {exercise.nota ? (
                      <div className="exercise-note-readonly">
                        <span>Nota</span>
                        <p>{exercise.nota}</p>
                      </div>
                    ) : null}

                    {!cardio ? (
                      <div className="set-table readonly-table detail-readonly-table">
                        <div className={`set-table-head readonly-grid routine-sets-grid ${showWeight ? "" : "no-weight"}`}>
                          <span>Serie</span>
                          {showWeight ? <span>Peso</span> : null}
                          <span>Reps</span>
                        </div>

                        {exercise.series.map((serie, serieIndex) => {
                          if (serie.tipo === "serie") {
                            serieNumber += 1;
                          }
                          const serieLabel = getSerieLabel(serie.tipo, serieNumber);

                          return (
                            <div
                              key={serieIndex}
                              className={`set-row readonly-grid routine-sets-grid ${showWeight ? "" : "no-weight"}`}
                            >
                              <div className={`readonly-cell serie-code ${serieLabel.className}`}>
                                {serieLabel.label}
                              </div>
                              {showWeight ? (
                                <div className="readonly-cell">{serie.kg.trim() ? `${serie.kg} kg` : "-"}</div>
                              ) : null}
                              <div className="readonly-cell">{serie.reps.trim() || "-"}</div>
                            </div>
                          );
                        })}
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </section>
          )}
        </>
      ) : null}
    </main>
  );
}

export default RutinaCompartida;
