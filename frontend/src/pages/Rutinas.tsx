import { useEffect, useMemo, useState } from "react";
import type { Usuario } from "../types";

type Rutina = {
  id_rutina: number;
  nombre: string;
  descripcion: string | null;
  duracion_estimada: number | null;
  creador_id: number;
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

type SesionEntrenamiento = {
  id_sesion: number;
  usuario_id: number;
  rutina_id: number;
  descripcion: string | null;
};

type Serie = {
  id_serie?: number;
  repeticiones: number;
  peso: number | null;
  descanso: number | null;
  orden: number;
  ejercicio_id: number;
  sesion_id: number;
  nombre?: string;
};

type RutinasProps = {
  usuario: Usuario;
};

const API = "http://localhost:3000";

function Rutinas({ usuario }: RutinasProps) {
  const [rutinas, setRutinas] = useState<Rutina[]>([]);
  const [selectedRutinaId, setSelectedRutinaId] = useState<number | null>(null);

  const [rutinaForm, setRutinaForm] = useState({
    nombre: "",
    descripcion: "",
    duracion_estimada: "",
  });

  const [buscarRutinaId, setBuscarRutinaId] = useState("");
  const [rutinaBuscada, setRutinaBuscada] = useState<Rutina | null>(null);

  const [catalogoEjercicios, setCatalogoEjercicios] = useState<Ejercicio[]>([]);
  const [rutinaEjercicios, setRutinaEjercicios] = useState<RutinaEjercicio[]>([]);

  const [agregarEjercicioForm, setAgregarEjercicioForm] = useState({
    id_ejercicio: "",
    series: "4",
    repeticiones: "10",
    descanso: "90",
    orden: "1",
  });

  const [editingEjercicioId, setEditingEjercicioId] = useState<number | null>(null);
  const [editEjercicioForm, setEditEjercicioForm] = useState({
    series: "",
    repeticiones: "",
    descanso: "",
    orden: "",
  });

  const [sesionActiva, setSesionActiva] = useState<SesionEntrenamiento | null>(null);
  const [seriesSesion, setSeriesSesion] = useState<Serie[]>([]);
  const [serieForm, setSerieForm] = useState({
    ejercicio_id: "",
    repeticiones: "",
    peso: "",
    descanso: "",
    orden: "1",
  });

  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState<string>("");
  const [error, setError] = useState<string>("");

  const rutinaSeleccionada = useMemo(
    () => rutinas.find((r) => r.id_rutina === selectedRutinaId) ?? null,
    [rutinas, selectedRutinaId],
  );

  const cargarRutinas = async () => {
    const res = await fetch(`${API}/rutinas`);
    const data = (await res.json()) as Rutina[];
    if (!res.ok) throw new Error("No se pudieron obtener las rutinas");
    setRutinas(data);
  };

  const cargarCatalogoEjercicios = async () => {
    const res = await fetch(`${API}/ejercicios`);
    const data = (await res.json()) as Ejercicio[];
    if (!res.ok) throw new Error("No se pudo obtener el catalogo de ejercicios");
    setCatalogoEjercicios(data);
  };

  const cargarEjerciciosDeRutina = async (idRutina: number) => {
    const res = await fetch(`${API}/rutinas/${idRutina}/ejercicios`);
    const data = (await res.json()) as RutinaEjercicio[];
    if (!res.ok) throw new Error("No se pudieron obtener los ejercicios de la rutina");
    setRutinaEjercicios(data);

    setAgregarEjercicioForm((prev) => ({
      ...prev,
      orden: String((data.at(-1)?.orden ?? 0) + 1),
    }));
  };

  const cargarSeriesSesion = async (idSesion: number) => {
    const res = await fetch(`${API}/entrenamientos/sesion/${idSesion}/series`);
    const data = (await res.json()) as Serie[];
    if (!res.ok) throw new Error("No se pudieron obtener las series de la sesion");
    setSeriesSesion(data);
    setSerieForm((prev) => ({ ...prev, orden: String(data.length + 1) }));
  };

  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);
        setError("");
        await Promise.all([cargarRutinas(), cargarCatalogoEjercicios()]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error cargando datos iniciales");
      } finally {
        setLoading(false);
      }
    };

    init();
  }, []);

  useEffect(() => {
    if (!selectedRutinaId) {
      setRutinaEjercicios([]);
      return;
    }

    const load = async () => {
      try {
        setError("");
        await cargarEjerciciosDeRutina(selectedRutinaId);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error cargando ejercicios de rutina");
      }
    };

    load();
  }, [selectedRutinaId]);

  const handleCrearRutina = async () => {
    try {
      if (!rutinaForm.nombre.trim()) {
        alert("El nombre es obligatorio");
        return;
      }

      setError("");
      const res = await fetch(`${API}/rutinas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: rutinaForm.nombre,
          descripcion: rutinaForm.descripcion || null,
          duracion_estimada: rutinaForm.duracion_estimada
            ? Number(rutinaForm.duracion_estimada)
            : null,
          creador_id: usuario.id,
        }),
      });

      const data = (await res.json()) as Rutina | { error?: string };
      if (!res.ok) {
        throw new Error("error" in data && data.error ? data.error : "No se pudo crear la rutina");
      }

      const nuevaRutina = data as Rutina;
      await cargarRutinas();
      setSelectedRutinaId(nuevaRutina.id_rutina);
      setMensaje("Rutina creada correctamente");
      setRutinaForm({ nombre: "", descripcion: "", duracion_estimada: "" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error creando rutina");
    }
  };

  const handleActualizarRutina = async () => {
    if (!rutinaSeleccionada) return;

    try {
      setError("");
      const res = await fetch(`${API}/rutinas/${rutinaSeleccionada.id_rutina}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: rutinaForm.nombre || rutinaSeleccionada.nombre,
          descripcion: rutinaForm.descripcion || rutinaSeleccionada.descripcion,
          duracion_estimada: rutinaForm.duracion_estimada
            ? Number(rutinaForm.duracion_estimada)
            : rutinaSeleccionada.duracion_estimada,
          creador_id: usuario.id,
          id_carpeta: null,
        }),
      });

      const data = (await res.json()) as Rutina | { error?: string };
      if (!res.ok) {
        throw new Error("error" in data && data.error ? data.error : "No se pudo actualizar la rutina");
      }

      const actualizada = data as Rutina;
      await cargarRutinas();
      setSelectedRutinaId(actualizada.id_rutina);
      setMensaje("Rutina actualizada");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error actualizando rutina");
    }
  };

  const handleEliminarRutina = async () => {
    if (!rutinaSeleccionada) return;

    const ok = window.confirm(`Eliminar la rutina "${rutinaSeleccionada.nombre}"?`);
    if (!ok) return;

    try {
      setError("");
      const res = await fetch(`${API}/rutinas/${rutinaSeleccionada.id_rutina}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error || "No se pudo eliminar la rutina");
      }

      await cargarRutinas();
      setSelectedRutinaId(null);
      setRutinaBuscada(null);
      setMensaje("Rutina eliminada");
      setSesionActiva(null);
      setSeriesSesion([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error eliminando rutina");
    }
  };

  const handleObtenerRutinaPorId = async () => {
    if (!buscarRutinaId.trim()) return;

    try {
      setError("");
      const res = await fetch(`${API}/rutinas/${buscarRutinaId}`);
      const data = (await res.json()) as Rutina | { error?: string };

      if (!res.ok) {
        throw new Error("error" in data && data.error ? data.error : "No se encontro la rutina");
      }

      const rutina = data as Rutina;
      setRutinaBuscada(rutina);
      setSelectedRutinaId(rutina.id_rutina);
      setRutinaForm({
        nombre: rutina.nombre ?? "",
        descripcion: rutina.descripcion ?? "",
        duracion_estimada: rutina.duracion_estimada ? String(rutina.duracion_estimada) : "",
      });
      setMensaje("Rutina cargada por ID");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error buscando rutina");
    }
  };

  const handleAgregarEjercicio = async () => {
    if (!selectedRutinaId) return;
    if (!agregarEjercicioForm.id_ejercicio) {
      alert("Selecciona un ejercicio");
      return;
    }

    try {
      setError("");
      const res = await fetch(`${API}/rutinas/ejercicios`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id_rutina: selectedRutinaId,
          id_ejercicio: Number(agregarEjercicioForm.id_ejercicio),
          series: Number(agregarEjercicioForm.series),
          repeticiones: Number(agregarEjercicioForm.repeticiones),
          descanso: Number(agregarEjercicioForm.descanso),
          orden: Number(agregarEjercicioForm.orden),
        }),
      });

      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error || "No se pudo agregar el ejercicio a la rutina");
      }

      await cargarEjerciciosDeRutina(selectedRutinaId);
      setMensaje("Ejercicio agregado a la rutina");
      setAgregarEjercicioForm((prev) => ({
        ...prev,
        id_ejercicio: "",
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error agregando ejercicio");
    }
  };

  const startEditEjercicio = (item: RutinaEjercicio) => {
    setEditingEjercicioId(item.id_ejercicio);
    setEditEjercicioForm({
      series: String(item.series),
      repeticiones: String(item.repeticiones),
      descanso: String(item.descanso),
      orden: String(item.orden),
    });
  };

  const handleActualizarEjercicio = async (idEjercicio: number) => {
    if (!selectedRutinaId) return;

    try {
      setError("");
      const res = await fetch(`${API}/rutinas/${selectedRutinaId}/ejercicios/${idEjercicio}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          series: Number(editEjercicioForm.series),
          repeticiones: Number(editEjercicioForm.repeticiones),
          descanso: Number(editEjercicioForm.descanso),
          orden: Number(editEjercicioForm.orden),
        }),
      });

      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error || "No se pudo actualizar el ejercicio");
      }

      await cargarEjerciciosDeRutina(selectedRutinaId);
      setEditingEjercicioId(null);
      setMensaje("Ejercicio actualizado");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error actualizando ejercicio");
    }
  };

  const handleEliminarEjercicio = async (idEjercicio: number) => {
    if (!selectedRutinaId) return;

    try {
      setError("");
      const res = await fetch(`${API}/rutinas/${selectedRutinaId}/ejercicios/${idEjercicio}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error || "No se pudo eliminar el ejercicio");
      }

      await cargarEjerciciosDeRutina(selectedRutinaId);
      setMensaje("Ejercicio eliminado de rutina");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error eliminando ejercicio");
    }
  };

  const handleIniciarRutina = async () => {
    if (!selectedRutinaId) {
      alert("Selecciona una rutina primero");
      return;
    }

    try {
      setError("");
      const res = await fetch(`${API}/entrenamientos/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          usuario_id: usuario.id,
          rutina_id: selectedRutinaId,
          descripcion: rutinaSeleccionada?.nombre || null,
        }),
      });

      const data = (await res.json()) as SesionEntrenamiento | { error?: string };
      if (!res.ok) {
        throw new Error("error" in data && data.error ? data.error : "No se pudo iniciar la sesion");
      }

      const sesion = data as SesionEntrenamiento;
      setSesionActiva(sesion);
      setSeriesSesion([]);
      setSerieForm((prev) => ({ ...prev, orden: "1" }));
      setMensaje(`Sesion iniciada (ID ${sesion.id_sesion})`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error iniciando sesion");
    }
  };

  const handleRegistrarSerie = async () => {
    if (!sesionActiva) return;
    if (!serieForm.ejercicio_id || !serieForm.repeticiones) {
      alert("Completa ejercicio y repeticiones");
      return;
    }

    try {
      setError("");
      const res = await fetch(`${API}/entrenamientos/serie`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repeticiones: Number(serieForm.repeticiones),
          peso: serieForm.peso ? Number(serieForm.peso) : null,
          descanso: serieForm.descanso ? Number(serieForm.descanso) : null,
          orden: Number(serieForm.orden),
          ejercicio_id: Number(serieForm.ejercicio_id),
          sesion_id: sesionActiva.id_sesion,
        }),
      });

      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error || "No se pudo registrar la serie");
      }

      await cargarSeriesSesion(sesionActiva.id_sesion);
      setSerieForm((prev) => ({
        ...prev,
        repeticiones: "",
        peso: "",
        descanso: "",
        orden: String(seriesSesion.length + 2),
      }));
      setMensaje("Serie registrada");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error registrando serie");
    }
  };

  const handleFinalizarSesion = async () => {
    if (!sesionActiva) return;

    try {
      setError("");
      const res = await fetch(`${API}/entrenamientos/end`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sesion_id: sesionActiva.id_sesion }),
      });

      const data = (await res.json()) as { estado?: string; error?: string };
      if (!res.ok) {
        throw new Error(data.error || "No se pudo finalizar la sesion");
      }

      setMensaje(`Sesion ${sesionActiva.id_sesion} finalizada`);
      setSesionActiva(null);
      setSeriesSesion([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error finalizando sesion");
    }
  };

  return (
    <main className="app">
      <section className="hero">
        <p className="eyebrow">Rutinas y entrenamiento</p>
        <h1>Gestion de rutinas</h1>
        <p className="subtitle">
          Crea, edita y elimina rutinas. Tambien puedes administrar ejercicios,
          iniciar una sesion y registrar series por ejercicio.
        </p>
      </section>

      {loading && <p className="status">Cargando datos iniciales...</p>}
      {error && <p className="status error">{error}</p>}
      {mensaje && <p className="status ok">{mensaje}</p>}

      <section className="panel two-cols">
        <article className="box">
          <h2>ABM de rutina</h2>
          <div className="form-grid">
            <input
              className="field"
              placeholder="Nombre"
              value={rutinaForm.nombre}
              onChange={(e) => setRutinaForm((prev) => ({ ...prev, nombre: e.target.value }))}
            />
            <input
              className="field"
              placeholder="Descripcion"
              value={rutinaForm.descripcion}
              onChange={(e) =>
                setRutinaForm((prev) => ({ ...prev, descripcion: e.target.value }))
              }
            />
            <input
              className="field"
              type="number"
              min="1"
              placeholder="Duracion estimada (min)"
              value={rutinaForm.duracion_estimada}
              onChange={(e) =>
                setRutinaForm((prev) => ({ ...prev, duracion_estimada: e.target.value }))
              }
            />
          </div>

          <div className="actions-row">
            <button className="btn" type="button" onClick={handleCrearRutina}>
              Crear rutina
            </button>
            <button
              className="btn secondary"
              type="button"
              onClick={handleActualizarRutina}
              disabled={!rutinaSeleccionada}
            >
              Actualizar rutina
            </button>
            <button
              className="btn danger"
              type="button"
              onClick={handleEliminarRutina}
              disabled={!rutinaSeleccionada}
            >
              Borrar rutina
            </button>
          </div>

          <div className="lookup-row">
            <input
              className="field"
              type="number"
              min="1"
              placeholder="Obtener rutina por ID"
              value={buscarRutinaId}
              onChange={(e) => setBuscarRutinaId(e.target.value)}
            />
            <button className="btn secondary" type="button" onClick={handleObtenerRutinaPorId}>
              Buscar
            </button>
          </div>

          {rutinaBuscada && (
            <p className="helper-text">
              Rutina encontrada: <strong>{rutinaBuscada.nombre}</strong> (ID {rutinaBuscada.id_rutina})
            </p>
          )}
        </article>

        <article className="box">
          <h2>Rutinas existentes</h2>
          <div className="list">
            {rutinas.length === 0 && <p className="helper-text">No hay rutinas cargadas.</p>}
            {rutinas.map((rutina) => (
              <button
                key={rutina.id_rutina}
                type="button"
                className={`list-item ${selectedRutinaId === rutina.id_rutina ? "active" : ""}`}
                onClick={() => {
                  setSelectedRutinaId(rutina.id_rutina);
                  setRutinaForm({
                    nombre: rutina.nombre,
                    descripcion: rutina.descripcion ?? "",
                    duracion_estimada: rutina.duracion_estimada
                      ? String(rutina.duracion_estimada)
                      : "",
                  });
                }}
              >
                <span>
                  #{rutina.id_rutina} {rutina.nombre}
                </span>
                <small>{rutina.descripcion || "Sin descripcion"}</small>
              </button>
            ))}
          </div>
        </article>
      </section>

      <section className="panel two-cols">
        <article className="box">
          <h2>Ejercicios de la rutina</h2>
          {!selectedRutinaId ? (
            <p className="helper-text">Selecciona una rutina para administrar ejercicios.</p>
          ) : (
            <>
              <div className="form-grid form-grid-5">
                <select
                  className="field"
                  value={agregarEjercicioForm.id_ejercicio}
                  onChange={(e) =>
                    setAgregarEjercicioForm((prev) => ({ ...prev, id_ejercicio: e.target.value }))
                  }
                >
                  <option value="">Ejercicio</option>
                  {catalogoEjercicios.map((ej) => (
                    <option key={ej.id_ejercicio} value={ej.id_ejercicio}>
                      {ej.nombre}
                    </option>
                  ))}
                </select>
                <input
                  className="field"
                  type="number"
                  min="1"
                  placeholder="Series"
                  value={agregarEjercicioForm.series}
                  onChange={(e) =>
                    setAgregarEjercicioForm((prev) => ({ ...prev, series: e.target.value }))
                  }
                />
                <input
                  className="field"
                  type="number"
                  min="1"
                  placeholder="Repeticiones"
                  value={agregarEjercicioForm.repeticiones}
                  onChange={(e) =>
                    setAgregarEjercicioForm((prev) => ({ ...prev, repeticiones: e.target.value }))
                  }
                />
                <input
                  className="field"
                  type="number"
                  min="0"
                  placeholder="Descanso (seg)"
                  value={agregarEjercicioForm.descanso}
                  onChange={(e) =>
                    setAgregarEjercicioForm((prev) => ({ ...prev, descanso: e.target.value }))
                  }
                />
                <input
                  className="field"
                  type="number"
                  min="1"
                  placeholder="Orden"
                  value={agregarEjercicioForm.orden}
                  onChange={(e) =>
                    setAgregarEjercicioForm((prev) => ({ ...prev, orden: e.target.value }))
                  }
                />
              </div>

              <div className="actions-row">
                <button className="btn" type="button" onClick={handleAgregarEjercicio}>
                  Agregar ejercicio
                </button>
              </div>

              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Orden</th>
                      <th>Ejercicio</th>
                      <th>Series</th>
                      <th>Reps</th>
                      <th>Descanso</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rutinaEjercicios.length === 0 && (
                      <tr>
                        <td colSpan={6}>No hay ejercicios en esta rutina.</td>
                      </tr>
                    )}
                    {rutinaEjercicios.map((item) => {
                      const isEditing = editingEjercicioId === item.id_ejercicio;

                      return (
                        <tr key={`${item.id_rutina}-${item.id_ejercicio}`}>
                          <td>
                            {isEditing ? (
                              <input
                                className="field compact"
                                type="number"
                                value={editEjercicioForm.orden}
                                onChange={(e) =>
                                  setEditEjercicioForm((prev) => ({ ...prev, orden: e.target.value }))
                                }
                              />
                            ) : (
                              item.orden
                            )}
                          </td>
                          <td>{item.nombre}</td>
                          <td>
                            {isEditing ? (
                              <input
                                className="field compact"
                                type="number"
                                value={editEjercicioForm.series}
                                onChange={(e) =>
                                  setEditEjercicioForm((prev) => ({ ...prev, series: e.target.value }))
                                }
                              />
                            ) : (
                              item.series
                            )}
                          </td>
                          <td>
                            {isEditing ? (
                              <input
                                className="field compact"
                                type="number"
                                value={editEjercicioForm.repeticiones}
                                onChange={(e) =>
                                  setEditEjercicioForm((prev) => ({ ...prev, repeticiones: e.target.value }))
                                }
                              />
                            ) : (
                              item.repeticiones
                            )}
                          </td>
                          <td>
                            {isEditing ? (
                              <input
                                className="field compact"
                                type="number"
                                value={editEjercicioForm.descanso}
                                onChange={(e) =>
                                  setEditEjercicioForm((prev) => ({ ...prev, descanso: e.target.value }))
                                }
                              />
                            ) : (
                              `${item.descanso}s`
                            )}
                          </td>
                          <td>
                            {!isEditing ? (
                              <div className="inline-actions">
                                <button
                                  className="btn tiny secondary"
                                  type="button"
                                  onClick={() => startEditEjercicio(item)}
                                >
                                  Editar
                                </button>
                                <button
                                  className="btn tiny danger"
                                  type="button"
                                  onClick={() => handleEliminarEjercicio(item.id_ejercicio)}
                                >
                                  Borrar
                                </button>
                              </div>
                            ) : (
                              <div className="inline-actions">
                                <button
                                  className="btn tiny"
                                  type="button"
                                  onClick={() => handleActualizarEjercicio(item.id_ejercicio)}
                                >
                                  Guardar
                                </button>
                                <button
                                  className="btn tiny secondary"
                                  type="button"
                                  onClick={() => setEditingEjercicioId(null)}
                                >
                                  Cancelar
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </article>

        <article className="box">
          <h2>Sesion de entrenamiento</h2>
          <div className="actions-row">
            <button
              className="btn"
              type="button"
              onClick={handleIniciarRutina}
              disabled={!selectedRutinaId || Boolean(sesionActiva)}
            >
              Iniciar rutina
            </button>
            <button
              className="btn danger"
              type="button"
              onClick={handleFinalizarSesion}
              disabled={!sesionActiva}
            >
              Finalizar sesion
            </button>
          </div>

          {sesionActiva ? (
            <>
              <p className="helper-text">
                Sesion activa: <strong>#{sesionActiva.id_sesion}</strong>
              </p>

              <div className="form-grid form-grid-5">
                <select
                  className="field"
                  value={serieForm.ejercicio_id}
                  onChange={(e) =>
                    setSerieForm((prev) => ({ ...prev, ejercicio_id: e.target.value }))
                  }
                >
                  <option value="">Ejercicio</option>
                  {rutinaEjercicios.map((ej) => (
                    <option key={`sesion-ej-${ej.id_ejercicio}`} value={ej.id_ejercicio}>
                      {ej.nombre}
                    </option>
                  ))}
                </select>
                <input
                  className="field"
                  type="number"
                  min="1"
                  placeholder="Repeticiones"
                  value={serieForm.repeticiones}
                  onChange={(e) =>
                    setSerieForm((prev) => ({ ...prev, repeticiones: e.target.value }))
                  }
                />
                <input
                  className="field"
                  type="number"
                  min="0"
                  placeholder="Peso"
                  value={serieForm.peso}
                  onChange={(e) => setSerieForm((prev) => ({ ...prev, peso: e.target.value }))}
                />
                <input
                  className="field"
                  type="number"
                  min="0"
                  placeholder="Descanso"
                  value={serieForm.descanso}
                  onChange={(e) =>
                    setSerieForm((prev) => ({ ...prev, descanso: e.target.value }))
                  }
                />
                <input
                  className="field"
                  type="number"
                  min="1"
                  placeholder="Orden"
                  value={serieForm.orden}
                  onChange={(e) => setSerieForm((prev) => ({ ...prev, orden: e.target.value }))}
                />
              </div>

              <div className="actions-row">
                <button className="btn" type="button" onClick={handleRegistrarSerie}>
                  Registrar serie
                </button>
                <button
                  className="btn secondary"
                  type="button"
                  onClick={() => cargarSeriesSesion(sesionActiva.id_sesion)}
                >
                  Refrescar series
                </button>
              </div>

              <div className="list">
                {seriesSesion.length === 0 && (
                  <p className="helper-text">Aun no hay series registradas en la sesion.</p>
                )}
                {seriesSesion.map((serie) => (
                  <div
                    key={`serie-${serie.sesion_id}-${serie.ejercicio_id}-${serie.orden}`}
                    className="list-item static"
                  >
                    <span>
                      Serie #{serie.orden} - Ejercicio {serie.nombre || serie.ejercicio_id}
                    </span>
                    <small>
                      Reps: {serie.repeticiones} | Peso: {serie.peso ?? "-"} | Descanso: {serie.descanso ?? "-"}
                    </small>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="helper-text">
              No hay sesion activa. Selecciona una rutina y presiona "Iniciar rutina".
            </p>
          )}
        </article>
      </section>
    </main>
  );
}

export default Rutinas;
