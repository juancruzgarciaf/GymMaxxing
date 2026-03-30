import { useEffect, useState } from "react";
import type { Usuario } from "../types";

type Rutina = {
  id_rutina: number;
  nombre: string;
  descripcion: string | null;
  duracion_estimada: number | null;
  creador_id: number;
  id_carpeta: number | null;
};

type CarpetaRutina = {
  id_carpeta: number;
  nombre: string;
  id_carpeta_padre: number | null;
};

type Ejercicio = {
  id_ejercicio: number;
  nombre: string;
  descripcion: string;
  grupo_muscular: string;
  tipo_disciplina: string;
};

type RutinaEjercicio = {
  id_rutina: number;
  id_ejercicio: number;
  series: number;
  repeticiones: number;
  descanso: number;
  orden: number;
  nombre: string;
  descripcion: string;
  grupo_muscular: string;
  tipo_disciplina: string;
};

type SerieDraft = {
  id: string;
  kg: string;
  reps: string;
};

type EjercicioDraft = {
  id_ejercicio: number;
  nombre: string;
  grupo_muscular: string;
  tipo_disciplina: string;
  series: SerieDraft[];
};

type RutinasProps = {
  usuario: Usuario;
};

type VistaRutinas = "lista" | "editor";

const API = "http://localhost:3000";

const nuevaSerie = (reps = ""): SerieDraft => ({
  id: crypto.randomUUID(),
  kg: "",
  reps,
});

const parseError = async (res: Response, fallback: string) => {
  try {
    const data = (await res.json()) as { error?: string };
    return data.error || fallback;
  } catch {
    return fallback;
  }
};

function Rutinas({ usuario }: RutinasProps) {
  const [vista, setVista] = useState<VistaRutinas>("lista");
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  const [rutinas, setRutinas] = useState<Rutina[]>([]);
  const [carpetas, setCarpetas] = useState<CarpetaRutina[]>([]);
  const [catalogoEjercicios, setCatalogoEjercicios] = useState<Ejercicio[]>([]);

  const [selectedRutinaId, setSelectedRutinaId] = useState<number | null>(null);
  const [expandedCarpetas, setExpandedCarpetas] = useState<Record<number, boolean>>({});
  const [busquedaRutina, setBusquedaRutina] = useState("");

  const [editorRutinaId, setEditorRutinaId] = useState<number | null>(null);
  const [editorNombre, setEditorNombre] = useState("");
  const [editorDescripcion, setEditorDescripcion] = useState("");
  const [editorDuracion, setEditorDuracion] = useState("");
  const [editorCarpetaId, setEditorCarpetaId] = useState<string>("");
  const [editorEjercicios, setEditorEjercicios] = useState<EjercicioDraft[]>([]);

  const [filtroEquipo, setFiltroEquipo] = useState("");
  const [filtroMusculo, setFiltroMusculo] = useState("");
  const [busquedaEjercicio, setBusquedaEjercicio] = useState("");

  const rutinaSeleccionada =
    selectedRutinaId == null
      ? null
      : rutinas.find((rutina) => rutina.id_rutina === selectedRutinaId) ?? null;

  const cargarRutinas = async () => {
    const res = await fetch(`${API}/rutinas`);
    if (!res.ok) {
      throw new Error(await parseError(res, "No se pudieron obtener las rutinas"));
    }

    const data = (await res.json()) as Rutina[];
    setRutinas(data);
  };

  const cargarCarpetas = async () => {
    const res = await fetch(`${API}/rutinas/carpetas`);
    if (!res.ok) {
      setCarpetas([]);
      return;
    }

    const data = (await res.json()) as CarpetaRutina[];
    setCarpetas(data);
    setExpandedCarpetas((prev) => {
      const next = { ...prev };
      data.forEach((carpeta) => {
        if (next[carpeta.id_carpeta] == null) {
          next[carpeta.id_carpeta] = true;
        }
      });
      return next;
    });
  };

  const cargarCatalogoEjercicios = async () => {
    const res = await fetch(`${API}/ejercicios`);
    if (!res.ok) {
      throw new Error(await parseError(res, "No se pudo obtener el catalogo de ejercicios"));
    }
    const data = (await res.json()) as Ejercicio[];
    setCatalogoEjercicios(data);
  };

  const cargarEjerciciosDeRutina = async (idRutina: number) => {
    const res = await fetch(`${API}/rutinas/${idRutina}/ejercicios`);
    if (!res.ok) {
      throw new Error(await parseError(res, "No se pudieron obtener los ejercicios de la rutina"));
    }
    return (await res.json()) as RutinaEjercicio[];
  };

  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);
        setError("");
        setMensaje("");
        await Promise.all([cargarRutinas(), cargarCatalogoEjercicios(), cargarCarpetas()]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error cargando datos iniciales");
      } finally {
        setLoading(false);
      }
    };

    void init();
  }, []);

  const abrirEditorNuevaRutina = () => {
    setError("");
    setMensaje("");
    setEditorRutinaId(null);
    setEditorNombre("");
    setEditorDescripcion("");
    setEditorDuracion("");
    setEditorCarpetaId("");
    setEditorEjercicios([]);
    setFiltroEquipo("");
    setFiltroMusculo("");
    setBusquedaEjercicio("");
    setVista("editor");
  };

  const abrirEditorRutina = async (rutina: Rutina) => {
    try {
      setLoading(true);
      setError("");
      setMensaje("");

      const ejercicios = await cargarEjerciciosDeRutina(rutina.id_rutina);
      const draft = ejercicios.map((item) => ({
        id_ejercicio: item.id_ejercicio,
        nombre: item.nombre,
        grupo_muscular: item.grupo_muscular,
        tipo_disciplina: item.tipo_disciplina,
        series: Array.from(
          { length: Math.max(1, item.series) },
          () => nuevaSerie(String(item.repeticiones || "")),
        ),
      }));

      setEditorRutinaId(rutina.id_rutina);
      setEditorNombre(rutina.nombre);
      setEditorDescripcion(rutina.descripcion ?? "");
      setEditorDuracion(rutina.duracion_estimada ? String(rutina.duracion_estimada) : "");
      setEditorCarpetaId(rutina.id_carpeta ? String(rutina.id_carpeta) : "");
      setEditorEjercicios(draft);
      setVista("editor");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo abrir la rutina");
    } finally {
      setLoading(false);
    }
  };

  const handleCrearCarpeta = async () => {
    const nombre = window.prompt("Nombre de la carpeta");
    if (!nombre || !nombre.trim()) {
      return;
    }

    try {
      setError("");
      setMensaje("");
      const res = await fetch(`${API}/rutinas/carpetas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: nombre.trim() }),
      });

      if (!res.ok) {
        throw new Error(await parseError(res, "No se pudo crear la carpeta"));
      }

      await cargarCarpetas();
      setMensaje("Carpeta creada");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error creando carpeta");
    }
  };

  const handleEliminarRutina = async () => {
    if (!rutinaSeleccionada) {
      return;
    }

    const confirmar = window.confirm(`Eliminar la rutina "${rutinaSeleccionada.nombre}"?`);
    if (!confirmar) {
      return;
    }

    try {
      setError("");
      setMensaje("");
      const res = await fetch(`${API}/rutinas/${rutinaSeleccionada.id_rutina}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error(await parseError(res, "No se pudo eliminar la rutina"));
      }

      await cargarRutinas();
      setSelectedRutinaId(null);
      setMensaje("Rutina eliminada");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error eliminando rutina");
    }
  };

  const handlePegarRutina = async () => {
    if (!navigator.clipboard) {
      setError("Tu navegador no soporta portapapeles en esta pagina");
      return;
    }

    try {
      setError("");
      setMensaje("");

      const clipboardText = await navigator.clipboard.readText();
      if (!clipboardText.trim()) {
        throw new Error("El portapapeles esta vacio");
      }

      const payload = JSON.parse(clipboardText) as {
        nombre?: string;
        descripcion?: string | null;
        duracion_estimada?: number | null;
        id_carpeta?: number | null;
        ejercicios?: Array<{ id_ejercicio?: number; repeticiones?: number; series?: number }>;
      };

      if (!payload.nombre?.trim()) {
        throw new Error("JSON invalido: falta 'nombre' para crear la rutina");
      }

      const createRes = await fetch(`${API}/rutinas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: payload.nombre.trim(),
          descripcion: payload.descripcion ?? null,
          duracion_estimada: payload.duracion_estimada ?? null,
          creador_id: usuario.id,
          id_carpeta: payload.id_carpeta ?? null,
        }),
      });

      if (!createRes.ok) {
        throw new Error(await parseError(createRes, "No se pudo pegar la rutina"));
      }

      const nuevaRutina = (await createRes.json()) as Rutina;

      if (Array.isArray(payload.ejercicios)) {
        for (let orden = 0; orden < payload.ejercicios.length; orden += 1) {
          const ejercicio = payload.ejercicios[orden];
          if (!ejercicio.id_ejercicio) {
            continue;
          }

          await fetch(`${API}/rutinas/ejercicios`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id_rutina: nuevaRutina.id_rutina,
              id_ejercicio: ejercicio.id_ejercicio,
              series: Math.max(1, ejercicio.series ?? 1),
              repeticiones: Math.max(1, ejercicio.repeticiones ?? 10),
              descanso: 90,
              orden: orden + 1,
            }),
          });
        }
      }

      await cargarRutinas();
      setSelectedRutinaId(nuevaRutina.id_rutina);
      setMensaje("Rutina pegada desde portapapeles");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo pegar rutina. Usa JSON valido en el portapapeles.",
      );
    }
  };

  const handleBuscarRutinas = () => {
    setBusquedaRutina((prev) => prev.trim());
  };

  const agregarEjercicioAlEditor = (ejercicio: Ejercicio) => {
    setEditorEjercicios((prev) => {
      if (prev.some((item) => item.id_ejercicio === ejercicio.id_ejercicio)) {
        return prev;
      }

      return [
        ...prev,
        {
          id_ejercicio: ejercicio.id_ejercicio,
          nombre: ejercicio.nombre,
          grupo_muscular: ejercicio.grupo_muscular,
          tipo_disciplina: ejercicio.tipo_disciplina,
          series: [nuevaSerie()],
        },
      ];
    });
  };

  const removerEjercicioDelEditor = (idEjercicio: number) => {
    setEditorEjercicios((prev) => prev.filter((item) => item.id_ejercicio !== idEjercicio));
  };

  const agregarSerieAEjercicio = (idEjercicio: number) => {
    setEditorEjercicios((prev) =>
      prev.map((item) =>
        item.id_ejercicio === idEjercicio
          ? { ...item, series: [...item.series, nuevaSerie()] }
          : item,
      ),
    );
  };

  const borrarSerieDeEjercicio = (idEjercicio: number, serieId: string) => {
    setEditorEjercicios((prev) =>
      prev.map((item) => {
        if (item.id_ejercicio !== idEjercicio) {
          return item;
        }

        if (item.series.length <= 1) {
          return item;
        }

        return {
          ...item,
          series: item.series.filter((serie) => serie.id !== serieId),
        };
      }),
    );
  };

  const updateSerie = (
    idEjercicio: number,
    serieId: string,
    field: "kg" | "reps",
    value: string,
  ) => {
    setEditorEjercicios((prev) =>
      prev.map((item) => {
        if (item.id_ejercicio !== idEjercicio) {
          return item;
        }

        return {
          ...item,
          series: item.series.map((serie) => {
            if (serie.id !== serieId) {
              return serie;
            }

            return { ...serie, [field]: value };
          }),
        };
      }),
    );
  };

  const guardarRutina = async () => {
    if (!editorNombre.trim()) {
      alert("El nombre de la rutina es obligatorio");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setMensaje("");

      const body = {
        nombre: editorNombre.trim(),
        descripcion: editorDescripcion.trim() || null,
        duracion_estimada: editorDuracion ? Number(editorDuracion) : null,
        creador_id: usuario.id,
        id_carpeta: editorCarpetaId ? Number(editorCarpetaId) : null,
      };

      let rutinaId = editorRutinaId;

      if (rutinaId == null) {
        const createRes = await fetch(`${API}/rutinas`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!createRes.ok) {
          throw new Error(await parseError(createRes, "No se pudo crear la rutina"));
        }
        const nueva = (await createRes.json()) as Rutina;
        rutinaId = nueva.id_rutina;
      } else {
        const updateRes = await fetch(`${API}/rutinas/${rutinaId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!updateRes.ok) {
          throw new Error(await parseError(updateRes, "No se pudo actualizar la rutina"));
        }
      }

      const ejerciciosActuales = await cargarEjerciciosDeRutina(rutinaId);
      const actualesPorEjercicio = new Map(
        ejerciciosActuales.map((ejercicio) => [ejercicio.id_ejercicio, ejercicio]),
      );
      const nuevosIds = new Set(editorEjercicios.map((ejercicio) => ejercicio.id_ejercicio));

      for (const ejercicioActual of ejerciciosActuales) {
        if (!nuevosIds.has(ejercicioActual.id_ejercicio)) {
          const deleteRes = await fetch(
            `${API}/rutinas/${rutinaId}/ejercicios/${ejercicioActual.id_ejercicio}`,
            { method: "DELETE" },
          );
          if (!deleteRes.ok) {
            throw new Error(await parseError(deleteRes, "No se pudo eliminar ejercicio de rutina"));
          }
        }
      }

      for (let orden = 0; orden < editorEjercicios.length; orden += 1) {
        const ejercicio = editorEjercicios[orden];
        const repeticiones = Number(
          ejercicio.series.find((serie) => serie.reps.trim())?.reps ?? "10",
        );

        const payload = {
          series: Math.max(1, ejercicio.series.length),
          repeticiones: Number.isNaN(repeticiones) ? 10 : Math.max(1, repeticiones),
          descanso: 90,
          orden: orden + 1,
        };

        const existing = actualesPorEjercicio.get(ejercicio.id_ejercicio);
        if (existing) {
          const updateRes = await fetch(
            `${API}/rutinas/${rutinaId}/ejercicios/${ejercicio.id_ejercicio}`,
            {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            },
          );
          if (!updateRes.ok) {
            throw new Error(await parseError(updateRes, "No se pudo actualizar ejercicio"));
          }
        } else {
          const addRes = await fetch(`${API}/rutinas/ejercicios`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id_rutina: rutinaId,
              id_ejercicio: ejercicio.id_ejercicio,
              ...payload,
            }),
          });
          if (!addRes.ok) {
            throw new Error(await parseError(addRes, "No se pudo agregar ejercicio"));
          }
        }
      }

      await Promise.all([cargarRutinas(), cargarCarpetas()]);
      setSelectedRutinaId(rutinaId);
      setVista("lista");
      setMensaje("Rutina guardada");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error guardando rutina");
    } finally {
      setLoading(false);
    }
  };

  const rutinasFiltradas = rutinas.filter((rutina) => {
    const search = busquedaRutina.trim().toLowerCase();
    if (!search) {
      return true;
    }

    return (
      rutina.nombre.toLowerCase().includes(search) ||
      (rutina.descripcion ?? "").toLowerCase().includes(search) ||
      String(rutina.id_rutina).includes(search)
    );
  });

  const rutinasPorCarpeta = new Map<number | null, Rutina[]>();
  rutinasFiltradas.forEach((rutina) => {
    const key = rutina.id_carpeta ?? null;
    const current = rutinasPorCarpeta.get(key) ?? [];
    current.push(rutina);
    rutinasPorCarpeta.set(key, current);
  });

  const carpetasPorPadre = new Map<number | null, CarpetaRutina[]>();
  carpetas.forEach((carpeta) => {
    const key = carpeta.id_carpeta_padre ?? null;
    const current = carpetasPorPadre.get(key) ?? [];
    current.push(carpeta);
    carpetasPorPadre.set(key, current);
  });

  const equipos = Array.from(
    new Set(catalogoEjercicios.map((ejercicio) => ejercicio.tipo_disciplina).filter(Boolean)),
  );
  const musculos = Array.from(
    new Set(catalogoEjercicios.map((ejercicio) => ejercicio.grupo_muscular).filter(Boolean)),
  );

  const catalogoFiltrado = catalogoEjercicios.filter((ejercicio) => {
    const matchEquipo = !filtroEquipo || ejercicio.tipo_disciplina === filtroEquipo;
    const matchMusculo = !filtroMusculo || ejercicio.grupo_muscular === filtroMusculo;
    const search = busquedaEjercicio.trim().toLowerCase();
    const matchSearch =
      !search ||
      ejercicio.nombre.toLowerCase().includes(search) ||
      ejercicio.grupo_muscular.toLowerCase().includes(search);
    return matchEquipo && matchMusculo && matchSearch;
  });

  const renderRutinaItem = (rutina: Rutina) => (
    <button
      key={rutina.id_rutina}
      type="button"
      className={`list-item ${selectedRutinaId === rutina.id_rutina ? "active" : ""}`}
      onClick={() => setSelectedRutinaId(rutina.id_rutina)}
    >
      <span>
        #{rutina.id_rutina} {rutina.nombre}
      </span>
      <small>{rutina.descripcion || "Sin descripcion"}</small>
    </button>
  );

  const renderCarpeta = (carpeta: CarpetaRutina, nivel: number) => {
    const isExpanded = expandedCarpetas[carpeta.id_carpeta] ?? true;
    const rutinasDeCarpeta = rutinasPorCarpeta.get(carpeta.id_carpeta) ?? [];
    const subcarpetas = carpetasPorPadre.get(carpeta.id_carpeta) ?? [];

    return (
      <div key={carpeta.id_carpeta} className="folder-node" style={{ marginLeft: `${nivel * 16}px` }}>
        <button
          type="button"
          className="folder-toggle"
          onClick={() =>
            setExpandedCarpetas((prev) => ({
              ...prev,
              [carpeta.id_carpeta]: !(prev[carpeta.id_carpeta] ?? true),
            }))
          }
        >
          <span>{isExpanded ? "▾" : "▸"}</span>
          <strong>{carpeta.nombre}</strong>
          <small>{rutinasDeCarpeta.length}</small>
        </button>

        {isExpanded && (
          <div className="folder-children">
            {rutinasDeCarpeta.map((rutina) => renderRutinaItem(rutina))}
            {subcarpetas.map((subcarpeta) => renderCarpeta(subcarpeta, nivel + 1))}
          </div>
        )}
      </div>
    );
  };

  if (vista === "editor") {
    return (
      <main className="app">
        <section className="hero editor-header">
          <button type="button" className="btn secondary" onClick={() => setVista("lista")}>
            ← Volver
          </button>
          <h1>{editorRutinaId ? "Editar rutina" : "Crear rutina"}</h1>
          <button type="button" className="btn" onClick={guardarRutina} disabled={loading}>
            Guardar rutina
          </button>
        </section>

        {loading && <p className="status">Guardando...</p>}
        {error && <p className="status error">{error}</p>}
        {mensaje && <p className="status ok">{mensaje}</p>}

        <section className="panel routine-editor-layout">
          <article className="box">
            <div className="form-grid">
              <input
                className="field"
                placeholder="Nombre de rutina"
                value={editorNombre}
                onChange={(event) => setEditorNombre(event.target.value)}
              />
              <input
                className="field"
                placeholder="Descripcion"
                value={editorDescripcion}
                onChange={(event) => setEditorDescripcion(event.target.value)}
              />
              <div className="form-grid two-inline">
                <input
                  className="field"
                  type="number"
                  min="1"
                  placeholder="Duracion (min)"
                  value={editorDuracion}
                  onChange={(event) => setEditorDuracion(event.target.value)}
                />
                <select
                  className="field"
                  value={editorCarpetaId}
                  onChange={(event) => setEditorCarpetaId(event.target.value)}
                >
                  <option value="">Sin carpeta</option>
                  {carpetas.map((carpeta) => (
                    <option key={carpeta.id_carpeta} value={carpeta.id_carpeta}>
                      {carpeta.nombre}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="editor-selected">
              {editorEjercicios.length === 0 ? (
                <div className="empty-state">
                  <p>No hay ejercicios</p>
                  <small>Agrega ejercicios desde la libreria de la derecha.</small>
                </div>
              ) : (
                editorEjercicios.map((ejercicio) => (
                  <article key={ejercicio.id_ejercicio} className="exercise-card">
                    <div className="exercise-card-head">
                      <div>
                        <h3>{ejercicio.nombre}</h3>
                        <small>
                          {ejercicio.grupo_muscular} · {ejercicio.tipo_disciplina}
                        </small>
                      </div>
                      <button
                        type="button"
                        className="btn tiny danger"
                        onClick={() => removerEjercicioDelEditor(ejercicio.id_ejercicio)}
                      >
                        Quitar
                      </button>
                    </div>

                    <div className="set-table">
                      <div className="set-table-head">
                        <span>Set</span>
                        <span>KG</span>
                        <span>Reps</span>
                        <span />
                      </div>

                      {ejercicio.series.map((serie, index) => (
                        <div key={serie.id} className="set-row">
                          <span className="set-number">{index + 1}</span>
                          <input
                            className="field compact"
                            type="number"
                            min="0"
                            placeholder="-"
                            value={serie.kg}
                            onChange={(event) =>
                              updateSerie(
                                ejercicio.id_ejercicio,
                                serie.id,
                                "kg",
                                event.target.value,
                              )
                            }
                          />
                          <input
                            className="field compact"
                            type="number"
                            min="1"
                            placeholder="-"
                            value={serie.reps}
                            onChange={(event) =>
                              updateSerie(
                                ejercicio.id_ejercicio,
                                serie.id,
                                "reps",
                                event.target.value,
                              )
                            }
                          />
                          <button
                            type="button"
                            className="btn tiny secondary"
                            disabled={ejercicio.series.length <= 1}
                            onClick={() => borrarSerieDeEjercicio(ejercicio.id_ejercicio, serie.id)}
                          >
                            x
                          </button>
                        </div>
                      ))}
                    </div>

                    <button
                      type="button"
                      className="btn secondary"
                      onClick={() => agregarSerieAEjercicio(ejercicio.id_ejercicio)}
                    >
                      + Add serie
                    </button>
                  </article>
                ))
              )}
            </div>
          </article>

          <aside className="box">
            <h2>Suggested exercises</h2>
            <div className="form-grid">
              <select
                className="field"
                value={filtroEquipo}
                onChange={(event) => setFiltroEquipo(event.target.value)}
              >
                <option value="">Todo equipamiento</option>
                {equipos.map((equipo) => (
                  <option key={equipo} value={equipo}>
                    {equipo}
                  </option>
                ))}
              </select>

              <select
                className="field"
                value={filtroMusculo}
                onChange={(event) => setFiltroMusculo(event.target.value)}
              >
                <option value="">Todos musculos</option>
                {musculos.map((musculo) => (
                  <option key={musculo} value={musculo}>
                    {musculo}
                  </option>
                ))}
              </select>

              <input
                className="field"
                placeholder="Buscar ejercicios"
                value={busquedaEjercicio}
                onChange={(event) => setBusquedaEjercicio(event.target.value)}
              />
            </div>

            <div className="library-list">
              {catalogoFiltrado.map((ejercicio) => {
                const yaAgregado = editorEjercicios.some(
                  (item) => item.id_ejercicio === ejercicio.id_ejercicio,
                );

                return (
                  <div key={ejercicio.id_ejercicio} className="library-item">
                    <div>
                      <strong>{ejercicio.nombre}</strong>
                      <small>{ejercicio.grupo_muscular}</small>
                    </div>
                    <button
                      type="button"
                      className="btn tiny"
                      disabled={yaAgregado}
                      onClick={() => agregarEjercicioAlEditor(ejercicio)}
                    >
                      {yaAgregado ? "Agregado" : "+"}
                    </button>
                  </div>
                );
              })}
              {catalogoFiltrado.length === 0 && (
                <p className="helper-text">No hay ejercicios para ese filtro.</p>
              )}
            </div>
          </aside>
        </section>
      </main>
    );
  }

  const carpetasRaiz = carpetasPorPadre.get(null) ?? [];
  const rutinasSueltas = rutinasPorCarpeta.get(null) ?? [];

  return (
    <main className="app">
      <section className="hero">
        <p className="eyebrow">Rutinas</p>
        <h1>Tus rutinas</h1>
        <p className="subtitle">Una vista simple para buscar, organizar y editar.</p>
      </section>

      {loading && <p className="status">Cargando datos...</p>}
      {error && <p className="status error">{error}</p>}
      {mensaje && <p className="status ok">{mensaje}</p>}

      <section className="panel two-cols">
        <article className="box">
          <div className="actions-row">
            <input
              className="field"
              placeholder="Buscar rutinas"
              value={busquedaRutina}
              onChange={(event) => setBusquedaRutina(event.target.value)}
            />
            <button className="btn" type="button" onClick={abrirEditorNuevaRutina}>
              Crear rutina
            </button>
            <button
              className="btn secondary"
              type="button"
              disabled={!rutinaSeleccionada}
              onClick={() => {
                if (rutinaSeleccionada) {
                  void abrirEditorRutina(rutinaSeleccionada);
                }
              }}
            >
              Modificar rutina
            </button>
            <button className="btn secondary" type="button" onClick={handlePegarRutina}>
              Pegar rutina
            </button>
            <button className="btn secondary" type="button" onClick={handleBuscarRutinas}>
              Buscar
            </button>
            <button className="btn secondary" type="button" onClick={handleCrearCarpeta}>
              Nueva carpeta
            </button>
          </div>

          <div className="folder-tree">
            {carpetasRaiz.map((carpeta) => renderCarpeta(carpeta, 0))}
            {rutinasSueltas.length > 0 && (
              <div className="folder-node">
                <button type="button" className="folder-toggle static">
                  <strong>Sin carpeta</strong>
                  <small>{rutinasSueltas.length}</small>
                </button>
                <div className="folder-children">{rutinasSueltas.map((rutina) => renderRutinaItem(rutina))}</div>
              </div>
            )}
            {rutinasFiltradas.length === 0 && (
              <div className="empty-state">
                <p>No hay rutinas</p>
                <small>Crea tu primera rutina para empezar.</small>
              </div>
            )}
          </div>
        </article>

        <article className="box">
          <h2>Detalle</h2>
          {rutinaSeleccionada ? (
            <div className="routine-detail">
              <h3>{rutinaSeleccionada.nombre}</h3>
              <p>{rutinaSeleccionada.descripcion || "Sin descripcion"}</p>
              <small>
                Duracion: {rutinaSeleccionada.duracion_estimada ?? "-"} min · ID{" "}
                {rutinaSeleccionada.id_rutina}
              </small>
              <div className="actions-row">
                <button
                  type="button"
                  className="btn"
                  onClick={() => void abrirEditorRutina(rutinaSeleccionada)}
                >
                  Modificar
                </button>
                <button type="button" className="btn danger" onClick={handleEliminarRutina}>
                  Eliminar
                </button>
              </div>
            </div>
          ) : (
            <p className="helper-text">Selecciona una rutina para ver sus detalles.</p>
          )}
        </article>
      </section>
    </main>
  );
}

export default Rutinas;
