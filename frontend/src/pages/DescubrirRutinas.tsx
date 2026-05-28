import { useEffect, useMemo, useState } from "react";
import {
  fetchRoutineExercises,
  fetchRoutineSeed,
  recordRoutineCopy,
  saveTrainingSeedAsRoutine,
  toggleRoutineLike,
} from "../lib/trainingTransfer";
import { TITLE_MAX_LENGTH, limitTitle } from "../lib/textLimits";
import type { DiscoverRoutineSummary, RoutineExerciseDetailed, RoutineSummary, Usuario } from "../types";
import VerifiedBadge from "../components/VerifiedBadge";

type DescubrirRutinasProps = {
  usuario: Usuario;
  onBack?: () => void;
  onOpenProfile?: (username: string) => void;
};

type OrdenDiscover = "recientes" | "populares" | "copiadas" | "guardadas" | "random";
type TipoCreador = "todos" | "usuario" | "entrenador" | "gimnasio";
type SaveRoutineMode = "guardar" | "copiar";

const API = "http://localhost:3000";
const ORDEN_OPTIONS: Array<{ value: OrdenDiscover; label: string }> = [
  { value: "recientes", label: "Mas nuevas" },
  { value: "populares", label: "Populares" },
  { value: "copiadas", label: "Mas copiadas" },
  { value: "guardadas", label: "Mas guardadas" },
  { value: "random", label: "Random" },
];

function LikeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M9 10V21H5.5C4.7 21 4 20.3 4 19.5V11.5C4 10.7 4.7 10 5.5 10H9ZM11 21H17.5C18.2 21 18.8 20.5 19 19.8L20.9 13.1C21.1 12.3 20.5 11.5 19.7 11.5H15V6.8C15 5.8 14.2 5 13.2 5C12.8 5 12.4 5.2 12.2 5.5L8.9 10.2C8.6 10.6 8.5 11 8.5 11.4V19C8.5 20.1 9.4 21 10.5 21H11Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

function DescubrirRutinas({ usuario, onBack, onOpenProfile }: DescubrirRutinasProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const [query, setQuery] = useState("");
  const [orden, setOrden] = useState<OrdenDiscover>("recientes");
  const [excludeFollowing, setExcludeFollowing] = useState(false);
  const [rutinasOficiales, setRutinasOficiales] = useState(false);
  const [tipoCreador, setTipoCreador] = useState<TipoCreador>("todos");
  const [showMuscleFilters, setShowMuscleFilters] = useState(false);

  const [rutinas, setRutinas] = useState<DiscoverRoutineSummary[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);

  const [detalleRutinaId, setDetalleRutinaId] = useState<number | null>(null);
  const [detalleRutina, setDetalleRutina] = useState<RoutineSummary | null>(null);
  const [detalleEjercicios, setDetalleEjercicios] = useState<RoutineExerciseDetailed[]>([]);
  const [detalleLoading, setDetalleLoading] = useState(false);
  const [copiarModalRutinaId, setCopiarModalRutinaId] = useState<number | null>(null);
  const [saveRoutineMode, setSaveRoutineMode] = useState<SaveRoutineMode>("guardar");
  const [copyNameDraft, setCopyNameDraft] = useState("");
  const [copyingRoutine, setCopyingRoutine] = useState(false);
  const [likeLoadingId, setLikeLoadingId] = useState<number | null>(null);
  const [likePulseId, setLikePulseId] = useState<number | null>(null);

  const availableGroups = useMemo(() => {
    const grupos = new Set<string>();
    rutinas.forEach((rutina) => {
      rutina.grupos_musculares.forEach((grupo) => {
        if (grupo) {
          grupos.add(grupo);
        }
      });
    });
    return Array.from(grupos).sort((a, b) => a.localeCompare(b));
  }, [rutinas]);

  const detalleDiscoverRutina = useMemo(
    () => rutinas.find((rutina) => rutina.id_rutina === detalleRutinaId) ?? null,
    [detalleRutinaId, rutinas],
  );

  const fetchDescubrirRutinas = async () => {
    try {
      setLoading(true);
      setError("");
      const params = new URLSearchParams();
      params.set("viewer_id", String(usuario.id));
      params.set("orden", orden);

      if (query.trim()) {
        params.set("q", query.trim());
      }

      if (selectedGroups.length > 0) {
        params.set("grupo_muscular", selectedGroups.join(","));
      }

      if (excludeFollowing) {
        params.set("exclude_following", "1");
      }

      if (rutinasOficiales) {
        params.set("rutinas_oficiales", "1");
      }

      if (!rutinasOficiales && tipoCreador !== "todos") {
        params.set("tipo_creador", tipoCreador);
      }

      const res = await fetch(`${API}/rutinas/discover?${params.toString()}`);
      const data = (await res.json()) as DiscoverRoutineSummary[] | { error?: string };

      if (!res.ok) {
        throw new Error("error" in data ? data.error || "No se pudieron cargar rutinas" : "No se pudieron cargar rutinas");
      }

      setRutinas(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar rutinas");
      setRutinas([]);
    } finally {
      setLoading(false);
    }
  };

  const abrirDetalle = async (rutina: DiscoverRoutineSummary) => {
    try {
      setDetalleLoading(true);
      setError("");
      setDetalleRutinaId(rutina.id_rutina);
      setDetalleRutina(rutina);
      const ejercicios = await fetchRoutineExercises(rutina.id_rutina);
      setDetalleEjercicios(ejercicios);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo abrir la rutina");
    } finally {
      setDetalleLoading(false);
    }
  };

  const handleGuardarRutina = async (rutinaId: number, customName?: string) => {
    try {
      setError("");
      setMensaje("");
      const { seed, routine } = await fetchRoutineSeed(rutinaId);

      await saveTrainingSeedAsRoutine(seed, usuario.id, {
        name: customName?.trim() || routine.nombre,
        description: routine.descripcion,
      });

      setMensaje("Rutina guardada en tus rutinas");
      await fetchDescubrirRutinas();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la rutina");
    }
  };

  const handleCopiarRutina = async (rutinaId: number, customName: string) => {
    try {
      setError("");
      setMensaje("");
      const { seed, routine } = await fetchRoutineSeed(rutinaId);

      await saveTrainingSeedAsRoutine(seed, usuario.id, {
        name: customName.trim() || routine.nombre,
        description: routine.descripcion,
      });

      await recordRoutineCopy(routine.id_rutina, usuario.id);
      setMensaje("Rutina copiada a tus rutinas");
      await fetchDescubrirRutinas();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo copiar la rutina");
    }
  };

  const openSaveRoutineModal = (
    rutina: Pick<RoutineSummary, "id_rutina" | "nombre">,
    mode: SaveRoutineMode,
  ) => {
    setCopiarModalRutinaId(rutina.id_rutina);
    setSaveRoutineMode(mode);
    setCopyNameDraft(limitTitle(rutina.nombre));
  };

  const closeCopyModal = () => {
    if (copyingRoutine) {
      return;
    }
    setCopiarModalRutinaId(null);
    setSaveRoutineMode("guardar");
    setCopyNameDraft("");
  };

  const closeDetailModal = () => {
    setDetalleRutinaId(null);
    setDetalleRutina(null);
    setDetalleEjercicios([]);
  };

  const confirmCopyRoutine = async () => {
    if (!copiarModalRutinaId) {
      return;
    }

    const nextName = limitTitle(copyNameDraft.trim());
    if (!nextName) {
      setError("El nombre de la rutina no puede estar vacio");
      return;
    }

    try {
      setCopyingRoutine(true);
      if (saveRoutineMode === "copiar") {
        await handleCopiarRutina(copiarModalRutinaId, nextName);
      } else {
        await handleGuardarRutina(copiarModalRutinaId, nextName);
      }
      setCopiarModalRutinaId(null);
      setCopyNameDraft("");
      setSaveRoutineMode("guardar");
    } finally {
      setCopyingRoutine(false);
    }
  };

  const handleToggleRoutineLike = async (rutinaId: number, liked: boolean) => {
    try {
      setLikeLoadingId(rutinaId);
      setError("");
      const summary = await toggleRoutineLike(rutinaId, usuario.id, liked);
      setRutinas((prev) =>
        prev.map((rutina) =>
          rutina.id_rutina === rutinaId
            ? { ...rutina, likes_count: summary.likes_count, viewer_liked: summary.viewer_liked }
            : rutina,
        ),
      );
      setDetalleRutina((prev) =>
        prev && prev.id_rutina === rutinaId
          ? { ...prev, likes_count: summary.likes_count, viewer_liked: summary.viewer_liked }
          : prev,
      );
      if (summary.viewer_liked) {
        setLikePulseId(rutinaId);
        window.setTimeout(() => setLikePulseId((current) => (current === rutinaId ? null : current)), 520);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar el like");
    } finally {
      setLikeLoadingId(null);
    }
  };

  const handleToggleGroup = (group: string) => {
    setSelectedGroups((prev) =>
      prev.includes(group) ? prev.filter((item) => item !== group) : [...prev, group],
    );
  };

  const handleResetFiltros = () => {
    setQuery("");
    setOrden("recientes");
    setExcludeFollowing(false);
    setRutinasOficiales(false);
    setTipoCreador("todos");
    setSelectedGroups([]);
  };

  useEffect(() => {
    void fetchDescubrirRutinas();
  }, []);

  useEffect(() => {
    if (!mensaje) {
      return;
    }

    const timer = window.setTimeout(() => {
      setMensaje("");
    }, 2600);

    return () => window.clearTimeout(timer);
  }, [mensaje]);

  useEffect(() => {
    if (detalleRutinaId == null) {
      return;
    }

    const previousBodyOverflow = document.body.style.overflow;
    const previousRootOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousRootOverflow;
    };
  }, [detalleRutinaId]);

  return (
    <main className="page-shell">
      <section className={`page-hero compact ${onBack ? "discover-branch-hero" : ""}`}>
        {onBack ? (
          <button type="button" className="btn secondary" onClick={onBack}>
            Volver
          </button>
        ) : null}
        <div>
          <h1>Explora rutinas nuevas</h1>
          <p className="subtitle">
            Aqui aparecen rutinas publicas de otros usuarios para descubrir, ver y copiar.
          </p>
        </div>
      </section>

      {error ? <div className="status error">{error}</div> : null}
      {mensaje ? <div className="status ok">{mensaje}</div> : null}

      <section className="box discover-controls">
        <div className="discover-main-filters">
          <input
            className="field"
            placeholder="Buscar por nombre de rutina"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                void fetchDescubrirRutinas();
              }
            }}
          />

          <select
            className="field"
            value={orden}
            onChange={(event) => setOrden(event.target.value as OrdenDiscover)}
          >
            {ORDEN_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <select
            className="field"
            value={tipoCreador}
            onChange={(event) => setTipoCreador(event.target.value as TipoCreador)}
          >
            <option value="todos">Todos los creadores</option>
            <option value="usuario">Usuarios</option>
            <option value="entrenador">Entrenadores</option>
            <option value="gimnasio">Gimnasios</option>
          </select>

          <button type="button" className="btn" onClick={() => void fetchDescubrirRutinas()}>
            Aplicar
          </button>
          <button type="button" className="btn secondary" onClick={handleResetFiltros}>
            Limpiar
          </button>
        </div>

        <div className="discover-switches">
          <label className="discover-check">
            <input
              type="checkbox"
              checked={rutinasOficiales}
              onChange={(event) => setRutinasOficiales(event.target.checked)}
            />
            Rutinas oficiales
          </label>

          <label className="discover-check">
            <input
              type="checkbox"
              checked={excludeFollowing}
              onChange={(event) => setExcludeFollowing(event.target.checked)}
            />
            Excluir rutinas de seguidos
          </label>

          <button
            type="button"
            className={`btn secondary discover-muscle-toggle ${showMuscleFilters ? "active" : ""}`}
            onClick={() => setShowMuscleFilters((prev) => !prev)}
            aria-expanded={showMuscleFilters}
          >
            {selectedGroups.length > 0
              ? `Filtrar por musculo (${selectedGroups.length})`
              : "Filtrar por musculo"}
          </button>
        </div>

        {showMuscleFilters ? (
          <div className="muscle-chips discover-muscles">
            {availableGroups.length === 0 ? (
              <span className="helper-text">No hay grupos musculares para filtrar.</span>
            ) : (
              availableGroups.map((group) => (
                <button
                  type="button"
                  key={group}
                  className={`muscle-chip-btn ${selectedGroups.includes(group) ? "active" : ""}`}
                  onClick={() => handleToggleGroup(group)}
                >
                  {group}
                </button>
              ))
            )}
          </div>
        ) : null}
      </section>

      {loading ? <div className="status">Cargando rutinas...</div> : null}

      <section className="discover-grid">
        {rutinas.map((rutina) => (
          <article key={rutina.id_rutina} className="discover-card">
            <div className="discover-card-head">
              <h2>{rutina.nombre}</h2>
              <small className="verified-name">
                por {rutina.creador_username}
                <VerifiedBadge tipoUsuario={rutina.creador_tipo_usuario} />
              </small>
            </div>

            <p className="discover-description">{rutina.descripcion || "Sin descripcion"}</p>

            <div className="detail-meta">
              <span>{rutina.total_ejercicios} ejercicios</span>
              <span>{rutina.save_count} guardados</span>
              <span>{rutina.copy_count} copias</span>
            </div>

            <div className="muscle-chips">
              {rutina.grupos_musculares.length === 0 ? (
                <span className="muscle-chip">Sin grupos</span>
              ) : (
                rutina.grupos_musculares.map((grupo) => (
                  <span key={`${rutina.id_rutina}-${grupo}`} className="muscle-chip">
                    {grupo}
                  </span>
                ))
              )}
            </div>

            <div className="actions-row">
              <button
                type="button"
                className="btn secondary"
                onClick={() => void abrirDetalle(rutina)}
              >
                Ver rutina
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => openSaveRoutineModal(rutina, "copiar")}
              >
                Copiar rutina
              </button>
            </div>
          </article>
        ))}

        {!loading && rutinas.length === 0 ? (
          <article className="empty-state discover-empty">
            <p>No hay rutinas para este filtro</p>
            <small>Prueba cambiando filtros o el orden de resultados.</small>
          </article>
        ) : null}
      </section>

      {detalleRutinaId != null ? (
        <div className="modal-backdrop" role="presentation" onClick={closeDetailModal}>
          <section
            className="modal-card discover-detail-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Detalle de rutina"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="detail-topbar">
              <h2>Detalle de rutina</h2>
              <button type="button" className="btn secondary" onClick={closeDetailModal}>
                Cerrar
              </button>
            </div>

            {detalleLoading ? (
              <p className="helper-text">Cargando detalle...</p>
            ) : (
              <>
                <div className="discover-detail-summary">
                  <div className="discover-detail-main">
                    <h3 className="routine-title-xl">{detalleRutina?.nombre || "Rutina"}</h3>
                    <p className="helper-text">{detalleRutina?.descripcion || "Sin descripcion"}</p>
                  </div>
                  {detalleDiscoverRutina ? (
                    <button
                      type="button"
                      className={`profile-chip discover-detail-author ${onOpenProfile ? "" : "static"}`}
                      onClick={() => {
                        closeDetailModal();
                        onOpenProfile?.(detalleDiscoverRutina.creador_username);
                      }}
                      disabled={!onOpenProfile}
                    >
                      <span className="avatar-circle">
                        {detalleDiscoverRutina.creador_username.slice(0, 1).toUpperCase()}
                      </span>
                      <span>
                        <strong className="verified-name">
                          {detalleDiscoverRutina.creador_username}
                          <VerifiedBadge tipoUsuario={detalleDiscoverRutina.creador_tipo_usuario} />
                        </strong>
                        <small>Autor de la rutina</small>
                      </span>
                    </button>
                  ) : null}
                </div>

                {detalleRutina ? (
                  <>
                    <div className="detail-meta discover-detail-meta">
                      <span>{detalleEjercicios.length} Ejercicios</span>
                      <span>{detalleRutina.save_count} Guardados</span>
                      <span>{detalleRutina.copy_count} Copias</span>
                    </div>
                    <div className="feed-card-social-actions discover-detail-actions">
                      <button
                        type="button"
                        className={`social-action ${detalleRutina.viewer_liked ? "active" : ""} ${
                          likePulseId === detalleRutina.id_rutina ? "like-burst" : ""
                        }`}
                        onClick={() =>
                          void handleToggleRoutineLike(detalleRutina.id_rutina, detalleRutina.viewer_liked)
                        }
                        disabled={likeLoadingId === detalleRutina.id_rutina}
                        aria-label={detalleRutina.viewer_liked ? "Quitar like" : "Dar like"}
                        aria-pressed={detalleRutina.viewer_liked}
                        title={detalleRutina.viewer_liked ? "Quitar like" : "Dar like"}
                      >
                        <LikeIcon />
                        <span className="social-action-count">{detalleRutina.likes_count}</span>
                      </button>
                      <button
                        type="button"
                        className="btn"
                        onClick={() => openSaveRoutineModal(detalleRutina, "guardar")}
                      >
                        Guardar rutina
                      </button>
                    </div>
                  </>
                ) : null}

                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Orden</th>
                        <th>Ejercicio</th>
                        <th>Grupo</th>
                        <th>Series</th>
                        <th>Reps</th>
                        <th>Descanso</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detalleEjercicios.map((ejercicio) => (
                        <tr key={`${ejercicio.id_rutina}-${ejercicio.id_ejercicio}`}>
                          <td>{ejercicio.orden}</td>
                          <td>{ejercicio.nombre}</td>
                          <td>{ejercicio.grupo_muscular}</td>
                          <td>{ejercicio.series}</td>
                          <td>{ejercicio.repeticiones}</td>
                          <td>{ejercicio.descanso}s</td>
                        </tr>
                      ))}
                      {detalleEjercicios.length === 0 ? (
                        <tr>
                          <td colSpan={6}>Esta rutina no tiene ejercicios.</td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>
        </div>
      ) : null}

      {copiarModalRutinaId != null ? (
        <div className="modal-backdrop" role="presentation" onClick={closeCopyModal}>
          <section
            className="modal-card save-name-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Guardar rutina"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-head">
              <h2>{saveRoutineMode === "copiar" ? "Copiar rutina" : "Guardar rutina"}</h2>
              <button type="button" className="modal-close" onClick={closeCopyModal} disabled={copyingRoutine}>
                ×
              </button>
            </div>
            <p className="helper-text">Elegi el nombre con el que queres guardarla en tus rutinas.</p>
            <input
              className="field"
              placeholder="Nombre de rutina"
              maxLength={TITLE_MAX_LENGTH}
              value={copyNameDraft}
              onChange={(event) => setCopyNameDraft(limitTitle(event.target.value))}
            />
            <div className="modal-actions">
              <button type="button" className="btn secondary" onClick={closeCopyModal} disabled={copyingRoutine}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => void confirmCopyRoutine()}
                disabled={copyingRoutine}
              >
                {copyingRoutine
                  ? saveRoutineMode === "copiar"
                    ? "Copiando..."
                    : "Guardando..."
                  : saveRoutineMode === "copiar"
                    ? "Copiar"
                    : "Guardar"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}

export default DescubrirRutinas;
