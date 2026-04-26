import { useEffect, useMemo, useState } from "react";
import {
  fetchRoutineExercises,
  fetchRoutineSummary,
  fetchRoutineSeed,
  recordRoutineCopy,
  saveTrainingSeedAsRoutine,
} from "../lib/trainingTransfer";
import type { DiscoverRoutineSummary, RoutineExerciseDetailed, RoutineSummary, Usuario } from "../types";

type DescubrirRutinasProps = {
  usuario: Usuario;
};

type OrdenDiscover = "recientes" | "populares" | "copiadas" | "guardadas" | "random";
type TipoCreador = "todos" | "usuario" | "entrenador" | "gimnasio";

const API = "http://localhost:3000";
const ORDEN_OPTIONS: Array<{ value: OrdenDiscover; label: string }> = [
  { value: "recientes", label: "Mas nuevas" },
  { value: "populares", label: "Populares" },
  { value: "copiadas", label: "Mas copiadas" },
  { value: "guardadas", label: "Mas guardadas" },
  { value: "random", label: "Random" },
];

function DescubrirRutinas({ usuario }: DescubrirRutinasProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const [query, setQuery] = useState("");
  const [orden, setOrden] = useState<OrdenDiscover>("recientes");
  const [excludeFollowing, setExcludeFollowing] = useState(false);
  const [rutinasOficiales, setRutinasOficiales] = useState(false);
  const [tipoCreador, setTipoCreador] = useState<TipoCreador>("todos");

  const [rutinas, setRutinas] = useState<DiscoverRoutineSummary[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);

  const [detalleRutinaId, setDetalleRutinaId] = useState<number | null>(null);
  const [detalleRutina, setDetalleRutina] = useState<RoutineSummary | null>(null);
  const [detalleEjercicios, setDetalleEjercicios] = useState<RoutineExerciseDetailed[]>([]);
  const [detalleLoading, setDetalleLoading] = useState(false);
  const [copiarModalRutinaId, setCopiarModalRutinaId] = useState<number | null>(null);
  const [copyNameDraft, setCopyNameDraft] = useState("");
  const [copyingRoutine, setCopyingRoutine] = useState(false);

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

  const abrirDetalle = async (rutinaId: number) => {
    try {
      setDetalleLoading(true);
      setError("");
      const [rutina, ejercicios] = await Promise.all([
        fetchRoutineSummary(rutinaId),
        fetchRoutineExercises(rutinaId),
      ]);
      setDetalleRutinaId(rutinaId);
      setDetalleRutina(rutina);
      setDetalleEjercicios(ejercicios);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo abrir la rutina");
    } finally {
      setDetalleLoading(false);
    }
  };

  const handleCopiarRutina = async (rutinaId: number, customName?: string) => {
    try {
      setError("");
      setMensaje("");
      const { seed, routine } = await fetchRoutineSeed(rutinaId);

      await saveTrainingSeedAsRoutine(seed, usuario.id, {
        name: customName?.trim() || `${routine.nombre} (Copia)`,
        description: routine.descripcion,
      });

      await recordRoutineCopy(routine.id_rutina, usuario.id);
      setMensaje("Rutina copiada a tus rutinas");
      await fetchDescubrirRutinas();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo copiar la rutina");
    }
  };

  const openCopyModal = (rutina: DiscoverRoutineSummary) => {
    setCopiarModalRutinaId(rutina.id_rutina);
    setCopyNameDraft(`${rutina.nombre} (Copia)`);
  };

  const closeCopyModal = () => {
    if (copyingRoutine) {
      return;
    }
    setCopiarModalRutinaId(null);
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

    const nextName = copyNameDraft.trim();
    if (!nextName) {
      setError("El nombre de la rutina no puede estar vacio");
      return;
    }

    try {
      setCopyingRoutine(true);
      await handleCopiarRutina(copiarModalRutinaId, nextName);
      setCopiarModalRutinaId(null);
      setCopyNameDraft("");
    } finally {
      setCopyingRoutine(false);
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

  return (
    <main className="page-shell">
      <section className="page-hero compact">
        <p className="eyebrow">Descubrir Rutinas</p>
        <h1>Explora rutinas nuevas</h1>
        <p className="subtitle">
          Aqui aparecen rutinas publicas de otros usuarios para descubrir, ver y copiar.
        </p>
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
              checked={excludeFollowing}
              onChange={(event) => setExcludeFollowing(event.target.checked)}
            />
            Excluir rutinas de seguidos
          </label>

          <label className="discover-check">
            <input
              type="checkbox"
              checked={rutinasOficiales}
              onChange={(event) => setRutinasOficiales(event.target.checked)}
            />
            Rutinas oficiales
          </label>
        </div>

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
      </section>

      {loading ? <div className="status">Cargando rutinas...</div> : null}

      <section className="discover-grid">
        {rutinas.map((rutina) => (
          <article key={rutina.id_rutina} className="discover-card">
            <div className="discover-card-head">
              <h2>{rutina.nombre}</h2>
              <small>por {rutina.creador_username}</small>
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
                onClick={() => void abrirDetalle(rutina.id_rutina)}
              >
                Ver rutina
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => openCopyModal(rutina)}
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
              <h2>Detalle de rutina #{detalleRutinaId}</h2>
              <button type="button" className="btn secondary" onClick={closeDetailModal}>
                Cerrar
              </button>
            </div>

            {detalleLoading ? (
              <p className="helper-text">Cargando detalle...</p>
            ) : (
              <>
                <h3 className="routine-title-xl">{detalleRutina?.nombre || "Rutina"}</h3>
                <p className="helper-text">{detalleRutina?.descripcion || "Sin descripcion"}</p>

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
            aria-label="Copiar rutina"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-head">
              <h2>Copiar rutina</h2>
              <button type="button" className="modal-close" onClick={closeCopyModal} disabled={copyingRoutine}>
                ×
              </button>
            </div>
            <p className="helper-text">Elegi el nombre con el que queres guardarla en tus rutinas.</p>
            <input
              className="field"
              placeholder="Nombre de rutina"
              value={copyNameDraft}
              onChange={(event) => setCopyNameDraft(event.target.value)}
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
                {copyingRoutine ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}

export default DescubrirRutinas;
