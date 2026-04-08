import { useEffect, useMemo, useState } from "react";
import siluetaStrongman from "../assets/siluetastrongman.png";
import { saveTrainingSeedAsRoutine } from "../lib/trainingTransfer";
import type { TrainingSeed, TrainingSetType, Usuario } from "../types";

type Ejercicio = {
  id_ejercicio: number;
  nombre: string;
  descripcion: string;
  grupo_muscular: string;
  tipo_disciplina: string;
};

type CarpetaRutina = {
  id_carpeta: number;
  nombre: string;
  id_carpeta_padre: number | null;
};

type EjecucionSerie = {
  id: string;
  numero: number;
  kg: string;
  reps: string;
  tipo: TrainingSetType;
  completada: boolean;
  registrada: boolean;
};

type EjecucionEjercicio = {
  id_ejercicio: number;
  nombre: string;
  grupo_muscular: string;
  tipo_disciplina: string;
  descansoSegundos: number;
  series: EjecucionSerie[];
};

type SesionEntrenamiento = {
  id_sesion: number;
  usuario_id: number;
  rutina_id: number | null;
  descripcion: string | null;
  nombre_rutina_snapshot?: string | null;
};

type DescansoActivo = {
  restanteSegundos: number;
  etiqueta: string;
  finalizado: boolean;
};

type EntrenamientoProps = {
  usuario: Usuario;
  seed?: TrainingSeed | null;
  seedKey?: number;
  onSeedConsumed?: () => void;
};

type VistaEntrenamiento = "inicio" | "ejecucion" | "guardar";

const API = "http://localhost:3000";

const SET_TIPO_OPTIONS: Array<{ value: TrainingSetType; label: string }> = [
  { value: "warmup", label: "WarmUp" },
  { value: "serie", label: "Serie" },
  { value: "dropset", label: "DropSet" },
  { value: "failure", label: "Failure" },
];

const parseError = async (res: Response, fallback: string) => {
  try {
    const data = (await res.json()) as { error?: string };
    return data.error || fallback;
  } catch {
    return fallback;
  }
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const twoDigits = (value: number) => String(value).padStart(2, "0");

const formatDuration = (totalSeconds: number) => {
  const min = Math.floor(totalSeconds / 60);
  const sec = totalSeconds % 60;
  return `${twoDigits(min)}:${twoDigits(sec)}`;
};

const descansoDesdeInputs = (minRaw: string, secRaw: string) => {
  const min = Number(minRaw || "0");
  const sec = Number(secRaw || "0");
  const safeMin = Number.isNaN(min) ? 0 : clamp(Math.floor(min), 0, 999);
  const safeSec = Number.isNaN(sec) ? 0 : clamp(Math.floor(sec), 0, 59);
  return safeMin * 60 + safeSec;
};

const descansoToInputs = (descansoSegundos: number) => {
  const safe = Number.isFinite(descansoSegundos) ? Math.max(0, Math.floor(descansoSegundos)) : 0;
  return {
    min: String(Math.floor(safe / 60)),
    sec: String(safe % 60),
  };
};

const crearSerieEjecucion = (): EjecucionSerie => ({
  id: crypto.randomUUID(),
  numero: 1,
  kg: "",
  reps: "",
  tipo: "serie",
  completada: false,
  registrada: false,
});

function Entrenamiento({ usuario, seed, seedKey, onSeedConsumed }: EntrenamientoProps) {
  const [vista, setVista] = useState<VistaEntrenamiento>("inicio");
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  const [catalogoEjercicios, setCatalogoEjercicios] = useState<Ejercicio[]>([]);
  const [carpetas, setCarpetas] = useState<CarpetaRutina[]>([]);
  const [filtroEquipo, setFiltroEquipo] = useState("");
  const [filtroMusculo, setFiltroMusculo] = useState("");
  const [busquedaEjercicio, setBusquedaEjercicio] = useState("");

  const [sesionActiva, setSesionActiva] = useState<SesionEntrenamiento | null>(null);
  const [ejecucionEjercicios, setEjecucionEjercicios] = useState<EjecucionEjercicio[]>([]);
  const [descansoActivo, setDescansoActivo] = useState<DescansoActivo | null>(null);
  const [elapsedSesionSegundos, setElapsedSesionSegundos] = useState(0);

  const [guardarNombre, setGuardarNombre] = useState("");
  const [guardarDescripcion, setGuardarDescripcion] = useState("");
  const [guardarCarpetaId, setGuardarCarpetaId] = useState("");

  const totalSeriesEjecucion = useMemo(
    () => ejecucionEjercicios.reduce((acc, ejercicio) => acc + ejercicio.series.length, 0),
    [ejecucionEjercicios],
  );

  const seriesCompletadasEjecucion = useMemo(
    () =>
      ejecucionEjercicios.reduce(
        (acc, ejercicio) => acc + ejercicio.series.filter((serie) => serie.completada).length,
        0,
      ),
    [ejecucionEjercicios],
  );

  const equipos = useMemo(
    () =>
      Array.from(
        new Set(catalogoEjercicios.map((ejercicio) => ejercicio.tipo_disciplina).filter(Boolean)),
      ),
    [catalogoEjercicios],
  );

  const musculos = useMemo(
    () =>
      Array.from(
        new Set(catalogoEjercicios.map((ejercicio) => ejercicio.grupo_muscular).filter(Boolean)),
      ),
    [catalogoEjercicios],
  );

  const catalogoFiltrado = useMemo(() => {
    return catalogoEjercicios.filter((ejercicio) => {
      const matchEquipo = !filtroEquipo || ejercicio.tipo_disciplina === filtroEquipo;
      const matchMusculo = !filtroMusculo || ejercicio.grupo_muscular === filtroMusculo;
      const search = busquedaEjercicio.trim().toLowerCase();
      const matchSearch =
        !search ||
        ejercicio.nombre.toLowerCase().includes(search) ||
        ejercicio.grupo_muscular.toLowerCase().includes(search);
      return matchEquipo && matchMusculo && matchSearch;
    });
  }, [busquedaEjercicio, catalogoEjercicios, filtroEquipo, filtroMusculo]);

  const cargarCatalogoEjercicios = async () => {
    const res = await fetch(`${API}/ejercicios`);
    if (!res.ok) {
      throw new Error(await parseError(res, "No se pudo obtener el catalogo de ejercicios"));
    }

    const data = (await res.json()) as Ejercicio[];
    setCatalogoEjercicios(data);
  };

  const cargarCarpetas = async () => {
    const res = await fetch(`${API}/rutinas/carpetas?usuario_id=${usuario.id}`);
    if (!res.ok) {
      setCarpetas([]);
      return;
    }

    const data = (await res.json()) as CarpetaRutina[];
    setCarpetas(data);
  };

  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);
        setError("");
        await Promise.all([cargarCatalogoEjercicios(), cargarCarpetas()]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error cargando entrenamiento");
      } finally {
        setLoading(false);
      }
    };

    void init();
  }, [usuario.id]);

  useEffect(() => {
    if (!descansoActivo || descansoActivo.finalizado) {
      return;
    }

    const timer = window.setInterval(() => {
      setDescansoActivo((prev) => {
        if (!prev) {
          return null;
        }
        if (prev.restanteSegundos <= 1) {
          return { ...prev, restanteSegundos: 0, finalizado: true };
        }
        return { ...prev, restanteSegundos: prev.restanteSegundos - 1 };
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [descansoActivo]);

  useEffect(() => {
    if (vista !== "ejecucion" || !sesionActiva) {
      return;
    }

    const timer = window.setInterval(() => {
      setElapsedSesionSegundos((prev) => prev + 1);
    }, 1000);

    return () => window.clearInterval(timer);
  }, [sesionActiva, vista]);

  useEffect(() => {
    if (!mensaje) {
      return;
    }
    const timer = window.setTimeout(() => {
      setMensaje("");
    }, 2800);
    return () => window.clearTimeout(timer);
  }, [mensaje]);

  useEffect(() => {
    if (!error) {
      return;
    }
    const timer = window.setTimeout(() => {
      setError("");
    }, 4200);
    return () => window.clearTimeout(timer);
  }, [error]);

  const resetEntrenamiento = () => {
    setVista("inicio");
    setSesionActiva(null);
    setEjecucionEjercicios([]);
    setDescansoActivo(null);
    setElapsedSesionSegundos(0);
    setGuardarNombre("");
    setGuardarDescripcion("");
    setGuardarCarpetaId("");
    setFiltroEquipo("");
    setFiltroMusculo("");
    setBusquedaEjercicio("");
  };

  const renderToast = () => {
    if (!error && !mensaje) {
      return null;
    }

    const isError = Boolean(error);
    return (
      <div className={`toast-pop ${isError ? "error" : "ok"}`} role="status" aria-live="polite">
        {isError ? error : mensaje}
      </div>
    );
  };

  const ajustarDescansoActivo = (delta: number) => {
    setDescansoActivo((prev) => {
      if (!prev) {
        return prev;
      }
      const next = Math.max(0, prev.restanteSegundos + delta);
      return {
        ...prev,
        restanteSegundos: next,
        finalizado: next === 0,
      };
    });
  };

  const omitirDescansoActivo = () => {
    setDescansoActivo((prev) =>
      prev
        ? {
            ...prev,
            restanteSegundos: 0,
            finalizado: true,
          }
        : prev,
    );
  };

  const registrarSerie = async (
    ejercicio: EjecucionEjercicio,
    serie: EjecucionSerie,
    sesionId: number,
  ) => {
    const reps = Number(serie.reps || "0");
    const kg = Number(serie.kg || "0");
    const payload = {
      repeticiones: Number.isNaN(reps) ? 1 : Math.max(1, reps),
      peso: Number.isNaN(kg) || !serie.kg.trim() ? null : Math.max(0, kg),
      descanso: ejercicio.descansoSegundos,
      orden: serie.numero,
      ejercicio_id: ejercicio.id_ejercicio,
      sesion_id: sesionId,
    };

    const res = await fetch(`${API}/entrenamientos/serie`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error(await parseError(res, "No se pudo registrar la serie"));
    }
  };

  const syncSeriesDeSesion = async (sesionId: number) => {
    const series = ejecucionEjercicios.flatMap((ejercicio) =>
      ejercicio.series
        .filter((serie) => serie.completada)
        .map((serie) => {
          const reps = Number(serie.reps || "0");
          const kg = Number(serie.kg || "0");
          return {
            repeticiones: Number.isNaN(reps) ? 1 : Math.max(1, reps),
            peso: Number.isNaN(kg) || !serie.kg.trim() ? null : Math.max(0, kg),
            descanso: ejercicio.descansoSegundos,
            orden: serie.numero,
            ejercicio_id: ejercicio.id_ejercicio,
          };
        }),
    );

    const res = await fetch(`${API}/entrenamientos/${sesionId}/series`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ series }),
    });

    if (!res.ok) {
      throw new Error(await parseError(res, "No se pudieron sincronizar las series"));
    }
  };

  const buildCurrentTrainingSeed = (): TrainingSeed => ({
    origin: "sesion",
    sourceId: sesionActiva?.id_sesion ?? 0,
    title: guardarNombre.trim() || "Entrenamiento",
    description: guardarDescripcion.trim() || null,
    durationMinutes: Math.max(1, Math.round(elapsedSesionSegundos / 60) || 1),
    exercises: ejecucionEjercicios.map((ejercicio) => ({
      id_ejercicio: ejercicio.id_ejercicio,
      nombre: ejercicio.nombre,
      grupo_muscular: ejercicio.grupo_muscular,
      tipo_disciplina: ejercicio.tipo_disciplina,
      descansoSegundos: ejercicio.descansoSegundos,
      series: ejercicio.series.map((serie) => ({
        kg: serie.kg,
        reps: serie.reps,
        tipo: serie.tipo,
      })),
    })),
  });

  const seedToExecution = (nextSeed: TrainingSeed) => {
    return nextSeed.exercises.map((exercise) => ({
      id_ejercicio: exercise.id_ejercicio,
      nombre: exercise.nombre,
      grupo_muscular: exercise.grupo_muscular,
      tipo_disciplina: exercise.tipo_disciplina,
      descansoSegundos: Math.max(0, exercise.descansoSegundos),
      series: exercise.series.map((serie, index) => ({
        id: crypto.randomUUID(),
        numero: index + 1,
        kg: serie.kg,
        reps: serie.reps,
        tipo: serie.tipo,
        completada: false,
        registrada: false,
      })),
    }));
  };

  const comenzarEntrenamiento = async (nextSeed?: TrainingSeed) => {
    try {
      setLoading(true);
      setError("");
      setMensaje("");
      setDescansoActivo(null);
      setElapsedSesionSegundos(0);
      setGuardarNombre("");
      setGuardarDescripcion("");
      setGuardarCarpetaId("");

      const startRes = await fetch(`${API}/entrenamientos/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          usuario_id: usuario.id,
          rutina_id: null,
          descripcion: null,
        }),
      });

      if (!startRes.ok) {
        throw new Error(await parseError(startRes, "No se pudo iniciar el entrenamiento"));
      }

      const sesion = (await startRes.json()) as SesionEntrenamiento;
      setSesionActiva(sesion);
      setEjecucionEjercicios(nextSeed ? seedToExecution(nextSeed) : []);
      setGuardarNombre(nextSeed?.title ?? "");
      setGuardarDescripcion(nextSeed?.description ?? "");
      setVista("ejecucion");
      setMensaje(
        nextSeed
          ? `Entrenamiento iniciado desde ${nextSeed.origin === "rutina" ? "rutina" : "sesion"}`
          : `Entrenamiento iniciado (Sesion #${sesion.id_sesion})`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error iniciando entrenamiento");
    } finally {
      setLoading(false);
    }
  };

  const agregarEjercicio = (ejercicio: Ejercicio) => {
    setEjecucionEjercicios((prev) => {
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
          descansoSegundos: 90,
          series: [crearSerieEjecucion()],
        },
      ];
    });
  };

  const quitarEjercicio = (idEjercicio: number) => {
    setEjecucionEjercicios((prev) => prev.filter((item) => item.id_ejercicio !== idEjercicio));
  };

  const updateSerieEjecucion = (
    idEjercicio: number,
    serieId: string,
    field: "kg" | "reps" | "tipo",
    value: string,
  ) => {
    setEjecucionEjercicios((prev) =>
      prev.map((ejercicio) =>
        ejercicio.id_ejercicio === idEjercicio
          ? {
              ...ejercicio,
              series: ejercicio.series.map((serie) => {
                if (serie.id !== serieId) {
                  return serie;
                }
                if (field === "tipo") {
                  return { ...serie, tipo: value as TrainingSetType };
                }
                return { ...serie, [field]: value };
              }),
            }
          : ejercicio,
      ),
    );
  };

  const updateDescansoEjecucion = (idEjercicio: number, field: "min" | "seg", value: string) => {
    setEjecucionEjercicios((prev) =>
      prev.map((ejercicio) => {
        if (ejercicio.id_ejercicio !== idEjercicio) {
          return ejercicio;
        }
        const current = descansoToInputs(ejercicio.descansoSegundos);
        const minRaw = field === "min" ? value : current.min;
        const segRaw = field === "seg" ? value : current.sec;
        return {
          ...ejercicio,
          descansoSegundos: descansoDesdeInputs(minRaw, segRaw),
        };
      }),
    );
  };

  const agregarSerieEjecucion = (idEjercicio: number) => {
    setEjecucionEjercicios((prev) =>
      prev.map((ejercicio) => {
        if (ejercicio.id_ejercicio !== idEjercicio) {
          return ejercicio;
        }
        const nextNumber = ejercicio.series.length + 1;
        const ultimaSerie = ejercicio.series[ejercicio.series.length - 1];
        return {
          ...ejercicio,
          series: [
            ...ejercicio.series,
            {
              id: crypto.randomUUID(),
              numero: nextNumber,
              kg: ultimaSerie?.kg ?? "",
              reps: ultimaSerie?.reps ?? "",
              tipo: ultimaSerie?.tipo ?? "serie",
              completada: false,
              registrada: false,
            },
          ],
        };
      }),
    );
  };

  const eliminarSerieEjecucion = (idEjercicio: number, serieId: string) => {
    setEjecucionEjercicios((prev) =>
      prev.map((ejercicio) => {
        if (ejercicio.id_ejercicio !== idEjercicio || ejercicio.series.length <= 1) {
          return ejercicio;
        }
        const filtered = ejercicio.series.filter((serie) => serie.id !== serieId);
        return {
          ...ejercicio,
          series: filtered.map((serie, index) => ({ ...serie, numero: index + 1 })),
        };
      }),
    );
  };

  const toggleSerieCompletada = (idEjercicio: number, serieId: string) => {
    const ejercicio = ejecucionEjercicios.find((item) => item.id_ejercicio === idEjercicio);
    const serie = ejercicio?.series.find((item) => item.id === serieId);
    if (!ejercicio || !serie) {
      return;
    }

    const nuevaCompletada = !serie.completada;

    setEjecucionEjercicios((prev) =>
      prev.map((item) =>
        item.id_ejercicio === idEjercicio
          ? {
              ...item,
              series: item.series.map((set) =>
                set.id === serieId ? { ...set, completada: nuevaCompletada } : set,
              ),
            }
          : item,
      ),
    );

    if (nuevaCompletada && ejercicio.descansoSegundos > 0) {
      setDescansoActivo({
        restanteSegundos: ejercicio.descansoSegundos,
        etiqueta: `${ejercicio.nombre} · Serie ${serie.numero}`,
        finalizado: false,
      });
    }

    if (nuevaCompletada && sesionActiva && !serie.registrada) {
      void registrarSerie(ejercicio, serie, sesionActiva.id_sesion)
        .then(() => {
          setEjecucionEjercicios((prev) =>
            prev.map((item) =>
              item.id_ejercicio === idEjercicio
                ? {
                    ...item,
                    series: item.series.map((set) =>
                      set.id === serieId ? { ...set, registrada: true } : set,
                    ),
                  }
                : item,
            ),
          );
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : "No se pudo registrar la serie");
        });
    }
  };

  const completarEntrenamiento = async () => {
    if (!sesionActiva) {
      return;
    }

    try {
      setLoading(true);
      setError("");
      await syncSeriesDeSesion(sesionActiva.id_sesion);

      const res = await fetch(`${API}/entrenamientos/${sesionActiva.id_sesion}/finalizar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        throw new Error(await parseError(res, "No se pudo completar el entrenamiento"));
      }

      setDescansoActivo(null);
      setVista("guardar");
      setMensaje("Entrenamiento completado");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error completando entrenamiento");
    } finally {
      setLoading(false);
    }
  };

  const descartarEntrenamiento = async () => {
    if (!sesionActiva) {
      resetEntrenamiento();
      return;
    }

    const confirmar = window.confirm("Descartar este entrenamiento? Se borrara por completo.");
    if (!confirmar) {
      return;
    }

    try {
      setLoading(true);
      setError("");

      const res = await fetch(`${API}/entrenamientos/${sesionActiva.id_sesion}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error(await parseError(res, "No se pudo descartar el entrenamiento"));
      }

      resetEntrenamiento();
      setMensaje("Entrenamiento descartado");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error descartando entrenamiento");
    } finally {
      setLoading(false);
    }
  };

  const guardarEntrenamiento = async () => {
    if (!sesionActiva) {
      return;
    }

    try {
      setLoading(true);
      setError("");

      const nombre = guardarNombre.trim();
      const descripcion = guardarDescripcion.trim() || null;

      const updateRes = await fetch(`${API}/entrenamientos/${sesionActiva.id_sesion}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: nombre || null,
          descripcion,
        }),
      });

      if (!updateRes.ok) {
        throw new Error(await parseError(updateRes, "No se pudo guardar el entrenamiento"));
      }

      const guardarComoRutina = window.confirm(
        "Quieres guardar este entrenamiento tambien como rutina?",
      );

      if (guardarComoRutina) {
        const currentSeed = buildCurrentTrainingSeed();
        await saveTrainingSeedAsRoutine(currentSeed, usuario.id, {
          name: nombre || `Entrenamiento ${sesionActiva.id_sesion}`,
          description: descripcion,
          folderId: guardarCarpetaId ? Number(guardarCarpetaId) : null,
        });
      }

      resetEntrenamiento();
      setMensaje(
        guardarComoRutina
          ? "Entrenamiento guardado y rutina creada"
          : "Entrenamiento guardado",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error guardando entrenamiento");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!seed || seedKey == null) {
      return;
    }

    void comenzarEntrenamiento(seed).finally(() => {
      onSeedConsumed?.();
    });
  }, [seed, seedKey]);

  if (vista === "guardar") {
    return (
      <main className="app">
        {renderToast()}
        <section className="hero editor-header">
          <span />
          <h1>Guardar entrenamiento</h1>
          <button type="button" className="btn" onClick={guardarEntrenamiento} disabled={loading}>
            Guardar
          </button>
        </section>

        {loading ? <p className="status">Guardando...</p> : null}

        <section className="panel two-cols">
          <article className="box">
            <h2>Resumen</h2>
            <p className="helper-text">
              Sesion #{sesionActiva?.id_sesion ?? "-"} · Tiempo total {formatDuration(elapsedSesionSegundos)}
            </p>
            <p className="helper-text">
              Series completas: {seriesCompletadasEjecucion}/{totalSeriesEjecucion}
            </p>
            <p className="helper-text">Ejercicios usados: {ejecucionEjercicios.length}</p>
          </article>
          <article className="box">
            <h2>Que pasa al guardar</h2>
            <p className="helper-text">
              Se guarda esta sesion en tu historial y despues te preguntamos si tambien la quieres
              convertir en rutina.
            </p>
            <p className="helper-text">
              La carpeta solo se usa si decides guardar el entrenamiento como rutina.
            </p>
          </article>
        </section>

        <section className="panel">
          <article className="box">
            <div className="form-grid">
              <input
                className="field"
                placeholder="Nombre del entrenamiento"
                value={guardarNombre}
                onChange={(event) => setGuardarNombre(event.target.value)}
              />
              <input
                className="field"
                placeholder="Descripcion"
                value={guardarDescripcion}
                onChange={(event) => setGuardarDescripcion(event.target.value)}
              />
              <select
                className="field"
                value={guardarCarpetaId}
                onChange={(event) => setGuardarCarpetaId(event.target.value)}
              >
                <option value="">Carpeta de rutina (opcional)</option>
                {carpetas.map((carpeta) => (
                  <option key={carpeta.id_carpeta} value={carpeta.id_carpeta}>
                    {carpeta.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div className="actions-row training-save-actions">
              <button
                type="button"
                className="btn danger"
                onClick={() => void descartarEntrenamiento()}
                disabled={loading}
              >
                Descartar entrenamiento
              </button>
              <button type="button" className="btn" onClick={guardarEntrenamiento} disabled={loading}>
                Guardar
              </button>
            </div>
          </article>
        </section>
      </main>
    );
  }

  if (vista === "ejecucion") {
    return (
      <main className="app">
        {renderToast()}
        {descansoActivo ? (
          <section
            className={`rest-banner ${descansoActivo.finalizado ? "done" : ""}`}
            aria-live="polite"
          >
            <div className="rest-banner-main">
              <small>Descanso activo</small>
              <strong>{descansoActivo.etiqueta}</strong>
            </div>
            <div className="rest-banner-controls">
              <button type="button" className="btn secondary" onClick={() => ajustarDescansoActivo(-10)}>
                -10
              </button>
              <div className="rest-pill">{formatDuration(descansoActivo.restanteSegundos)}</div>
              <button type="button" className="btn secondary" onClick={() => ajustarDescansoActivo(10)}>
                +10
              </button>
              <button type="button" className="btn secondary" onClick={omitirDescansoActivo}>
                Omitir
              </button>
            </div>
          </section>
        ) : null}

        <section className="hero editor-header">
          <button
            type="button"
            className="btn secondary"
            onClick={() => void descartarEntrenamiento()}
            disabled={loading}
          >
            Cancelar
          </button>
          <h1>Entrenamiento libre</h1>
          <button
            type="button"
            className="btn danger"
            onClick={completarEntrenamiento}
            disabled={loading}
          >
            Completar entrenamiento
          </button>
        </section>

        {loading ? <p className="status">Procesando...</p> : null}

        <section className="panel two-cols">
          <article className="box">
            <h2>Progreso</h2>
            <p className="helper-text">
              Series completas: {seriesCompletadasEjecucion}/{totalSeriesEjecucion}
            </p>
            <p className="helper-text">Tiempo entrenando: {formatDuration(elapsedSesionSegundos)}</p>
            {!descansoActivo ? <p className="helper-text">No hay descanso activo.</p> : null}
          </article>
          <article className="box">
            <h2>Sesion</h2>
            <p className="helper-text">
              ID de sesion: <strong>{sesionActiva?.id_sesion ?? "-"}</strong>
            </p>
            <p className="helper-text">Ejercicios en curso: {ejecucionEjercicios.length}</p>
          </article>
        </section>

        <section className="panel routine-editor-layout">
          <article className="box">
            <div className="editor-selected">
              {ejecucionEjercicios.length === 0 ? (
                <div className="empty-state">
                  <p>No hay ejercicios en este entrenamiento</p>
                  <img
                    src={siluetaStrongman}
                    alt=""
                    aria-hidden="true"
                    className="training-empty-figure"
                  />
                  <small>Agrega ejercicios desde la libreria de la derecha.</small>
                </div>
              ) : (
                ejecucionEjercicios.map((ejercicio) => (
                  <article key={ejercicio.id_ejercicio} className="exercise-card">
                    <div className="exercise-card-head">
                      <div>
                        <h3>{ejercicio.nombre}</h3>
                        <small>
                          {ejercicio.grupo_muscular} · Descanso {formatDuration(ejercicio.descansoSegundos)}
                        </small>
                      </div>
                      <button
                        type="button"
                        className="btn tiny danger"
                        onClick={() => quitarEjercicio(ejercicio.id_ejercicio)}
                      >
                        Quitar
                      </button>
                    </div>

                    <div className="rest-grid">
                      <span>Descanso</span>
                      <input
                        className="field compact"
                        type="number"
                        min="0"
                        placeholder="Min"
                        value={descansoToInputs(ejercicio.descansoSegundos).min}
                        onChange={(event) =>
                          updateDescansoEjecucion(ejercicio.id_ejercicio, "min", event.target.value)
                        }
                      />
                      <input
                        className="field compact"
                        type="number"
                        min="0"
                        max="59"
                        placeholder="Seg"
                        value={descansoToInputs(ejercicio.descansoSegundos).sec}
                        onChange={(event) =>
                          updateDescansoEjecucion(ejercicio.id_ejercicio, "seg", event.target.value)
                        }
                      />
                    </div>

                    <div className="set-table execution-mode">
                      <div className="set-table-head">
                        <span>Set</span>
                        <span>KG</span>
                        <span>Reps</span>
                        <span />
                        <span>OK</span>
                      </div>

                      {ejercicio.series.map((serie, index) => {
                        const numeroSerie = ejercicio.series
                          .slice(0, index + 1)
                          .filter((item) => item.tipo === "serie").length;

                        return (
                          <div
                            key={serie.id}
                            className={`set-row ${serie.completada ? "completed" : ""}`}
                          >
                            <div className="set-type-wrap">
                              <select
                                className="set-type-select"
                                value={serie.tipo}
                                onChange={(event) =>
                                  updateSerieEjecucion(
                                    ejercicio.id_ejercicio,
                                    serie.id,
                                    "tipo",
                                    event.target.value,
                                  )
                                }
                              >
                                {SET_TIPO_OPTIONS.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                              {serie.tipo === "serie" ? (
                                <span className="set-order-badge">{numeroSerie}</span>
                              ) : null}
                            </div>
                            <input
                              className="field compact"
                              type="number"
                              min="0"
                              placeholder="-"
                              value={serie.kg}
                              onChange={(event) =>
                                updateSerieEjecucion(
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
                                updateSerieEjecucion(
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
                              onClick={() => eliminarSerieEjecucion(ejercicio.id_ejercicio, serie.id)}
                            >
                              x
                            </button>
                            <button
                              type="button"
                              className={`btn tiny ${serie.completada ? "success" : "secondary"}`}
                              onClick={() => toggleSerieCompletada(ejercicio.id_ejercicio, serie.id)}
                            >
                              {serie.completada ? "✓" : "○"}
                            </button>
                          </div>
                        );
                      })}
                    </div>

                    <button
                      type="button"
                      className="btn secondary"
                      onClick={() => agregarSerieEjecucion(ejercicio.id_ejercicio)}
                    >
                      + Add serie
                    </button>
                  </article>
                ))
              )}
            </div>
          </article>

          <aside className="box">
            <h2>Agregar ejercicios</h2>
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
                const yaAgregado = ejecucionEjercicios.some(
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
                      onClick={() => agregarEjercicio(ejercicio)}
                    >
                      {yaAgregado ? "Agregado" : "+"}
                    </button>
                  </div>
                );
              })}
              {catalogoFiltrado.length === 0 ? (
                <p className="helper-text">No hay ejercicios para ese filtro.</p>
              ) : null}
            </div>
          </aside>
        </section>
      </main>
    );
  }

  return (
    <main className="app">
      {renderToast()}
      <section className="hero">
        <h1>Entrenamiento</h1>
        <p className="subtitle">
          Arranca una sesion vacia, agrega ejercicios sobre la marcha y guardala despues si vale
          la pena repetirla.
        </p>
      </section>

      {loading ? <p className="status">Cargando datos...</p> : null}

      <section className="panel two-cols">
        <article className="box training-launch-card">
          <h2>Comenzar desde cero</h2>
          <p className="helper-text">
            Esto crea una sesion activa sin rutina base. Desde ahi puedes sumar o quitar ejercicios
            mientras entrenas.
          </p>
          <div className="actions-row">
            <button
              type="button"
              className="btn"
              onClick={() => void comenzarEntrenamiento()}
              disabled={loading}
            >
              Comenzar entrenamiento vacio
            </button>
          </div>
        </article>

        <article className="box">
          <h2>Como funciona</h2>
          <p className="helper-text">1. Empiezas una sesion con cronometro e ID propios.</p>
          <p className="helper-text">2. Agregas ejercicios igual que en el editor de rutinas.</p>
          <p className="helper-text">3. Ejecutas las series en la misma pantalla.</p>
          <p className="helper-text">
            4. Al completar, eliges nombre y descripcion, y opcionalmente la guardas como rutina.
          </p>
        </article>
      </section>
    </main>
  );
}

export default Entrenamiento;
