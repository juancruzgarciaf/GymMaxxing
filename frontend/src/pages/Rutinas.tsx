import { useEffect, useMemo, useState } from "react";
import { createRoutineShareUrl } from "../lib/trainingTransfer";
import type { Usuario } from "../types";

type Rutina = {
  id_rutina: number;
  nombre: string;
  descripcion: string | null;
  duracion_estimada: number | null;
  creador_id: number;
  id_carpeta: number | null;
  save_count: number;
  copy_count: number;
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
  tipo: SetTipo;
};

type SetTipo = "warmup" | "serie" | "dropset" | "failure";

type EjercicioDraft = {
  id_ejercicio: number;
  nombre: string;
  grupo_muscular: string;
  tipo_disciplina: string;
  descansoMin: string;
  descansoSeg: string;
  series: SerieDraft[];
};

type ResumenEjercicio = {
  nombre: string;
  grupo_muscular: string;
};

type EjecucionSerie = {
  id: string;
  numero: number;
  kg: string;
  reps: string;
  tipo: SetTipo;
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
  rutina_id: number;
  descripcion: string | null;
};

type RutinasProps = {
  usuario: Usuario;
};

type VistaRutinas = "lista" | "editor" | "ejecucion";

type DescansoActivo = {
  restanteSegundos: number;
  etiqueta: string;
  finalizado: boolean;
};

type PersistedRutinaEjercicio = {
  id_ejercicio: number;
  descansoSegundos: number;
  series: Array<{
    kg: string;
    reps: string;
    tipo: SetTipo;
  }>;
};

const API = "http://localhost:3000";
const RUTINA_PREFS_KEY = "gymmaxxing_rutina_series_v1";

const nuevaSerie = (reps = ""): SerieDraft => ({
  id: crypto.randomUUID(),
  kg: "",
  reps,
  tipo: "serie",
});

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

const readRutinaPrefs = () => {
  try {
    const raw = localStorage.getItem(RUTINA_PREFS_KEY);
    if (!raw) {
      return {} as Record<string, PersistedRutinaEjercicio[]>;
    }
    return JSON.parse(raw) as Record<string, PersistedRutinaEjercicio[]>;
  } catch {
    return {} as Record<string, PersistedRutinaEjercicio[]>;
  }
};

const writeRutinaPrefs = (next: Record<string, PersistedRutinaEjercicio[]>) => {
  localStorage.setItem(RUTINA_PREFS_KEY, JSON.stringify(next));
};

const SET_TIPO_OPTIONS: Array<{ value: SetTipo; label: string }> = [
  { value: "warmup", label: "WarmUp" },
  { value: "serie", label: "Serie" },
  { value: "dropset", label: "DropSet" },
  { value: "failure", label: "Failure" },
];

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
  const [openFolderMenuId, setOpenFolderMenuId] = useState<number | null>(null);
  const [renameModal, setRenameModal] = useState<{
    open: boolean;
    id: number | null;
    value: string;
  }>({
    open: false,
    id: null,
    value: "",
  });
  const [busquedaRutina, setBusquedaRutina] = useState("");
  const [resumenLoading, setResumenLoading] = useState(false);
  const [resumenEjercicios, setResumenEjercicios] = useState<ResumenEjercicio[]>([]);

  const [editorRutinaId, setEditorRutinaId] = useState<number | null>(null);
  const [editorNombre, setEditorNombre] = useState("");
  const [editorDescripcion, setEditorDescripcion] = useState("");
  const [editorDuracion, setEditorDuracion] = useState("");
  const [editorCarpetaId, setEditorCarpetaId] = useState<string>("");
  const [editorEjercicios, setEditorEjercicios] = useState<EjercicioDraft[]>([]);

  const [filtroEquipo, setFiltroEquipo] = useState("");
  const [filtroMusculo, setFiltroMusculo] = useState("");
  const [busquedaEjercicio, setBusquedaEjercicio] = useState("");

  const [rutinaEnEjecucion, setRutinaEnEjecucion] = useState<Rutina | null>(null);
  const [sesionActiva, setSesionActiva] = useState<SesionEntrenamiento | null>(null);
  const [ejecucionEjercicios, setEjecucionEjercicios] = useState<EjecucionEjercicio[]>([]);
  const [descansoActivo, setDescansoActivo] = useState<DescansoActivo | null>(null);
  const [elapsedSesionSegundos, setElapsedSesionSegundos] = useState(0);

  const rutinaSeleccionada =
    selectedRutinaId == null
      ? null
      : rutinas.find((rutina) => rutina.id_rutina === selectedRutinaId) ?? null;

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

  const cargarRutinas = async () => {
    const res = await fetch(`${API}/rutinas?creador_id=${usuario.id}`);
    if (!res.ok) {
      throw new Error(await parseError(res, "No se pudieron obtener las rutinas"));
    }

    const data = (await res.json()) as Rutina[];
    setRutinas(data);
    setSelectedRutinaId((prev) =>
      prev != null && !data.some((rutina) => rutina.id_rutina === prev) ? null : prev,
    );
  };

  const cargarCarpetas = async () => {
    const res = await fetch(`${API}/rutinas/carpetas?usuario_id=${usuario.id}`);
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

  const getPersistedRutinaEjercicios = (idRutina: number) => {
    const all = readRutinaPrefs();
    return all[String(idRutina)] ?? [];
  };

  const savePersistedRutinaEjercicios = (
    idRutina: number,
    ejercicios: PersistedRutinaEjercicio[],
  ) => {
    const all = readRutinaPrefs();
    all[String(idRutina)] = ejercicios;
    writeRutinaPrefs(all);
  };

  const syncRutinaEjercicios = async (
    rutinaId: number,
    ejerciciosObjetivo: Array<{
      id_ejercicio: number;
      series: number;
      repeticiones: number;
      descanso: number;
      orden: number;
    }>,
  ) => {
    const ejerciciosActuales = await cargarEjerciciosDeRutina(rutinaId);
    const actualesPorEjercicio = new Map(
      ejerciciosActuales.map((ejercicio) => [ejercicio.id_ejercicio, ejercicio]),
    );
    const nuevosIds = new Set(ejerciciosObjetivo.map((ejercicio) => ejercicio.id_ejercicio));

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

    for (const ejercicio of ejerciciosObjetivo) {
      const payload = {
        series: ejercicio.series,
        repeticiones: ejercicio.repeticiones,
        descanso: ejercicio.descanso,
        orden: ejercicio.orden,
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
  }, [usuario.id]);

  useEffect(() => {
    if (selectedRutinaId == null) {
      setResumenEjercicios([]);
      setResumenLoading(false);
      return;
    }

    const loadResumen = async () => {
      try {
        setResumenLoading(true);
        const ejercicios = await cargarEjerciciosDeRutina(selectedRutinaId);
        setResumenEjercicios(
          ejercicios.map((item) => ({
            nombre: item.nombre,
            grupo_muscular: item.grupo_muscular,
          })),
        );
      } catch {
        setResumenEjercicios([]);
      } finally {
        setResumenLoading(false);
      }
    };

    void loadResumen();
  }, [selectedRutinaId]);

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
  }, [vista, sesionActiva]);

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
      const persistedByExercise = new Map(
        getPersistedRutinaEjercicios(rutina.id_rutina).map((item) => [item.id_ejercicio, item]),
      );
      const draft = ejercicios.map((item) => {
        const persisted = persistedByExercise.get(item.id_ejercicio);
        const descanso = descansoToInputs(persisted?.descansoSegundos ?? item.descanso ?? 0);
        const persistedSeries = persisted?.series ?? [];
        return {
          id_ejercicio: item.id_ejercicio,
          nombre: item.nombre,
          grupo_muscular: item.grupo_muscular,
          tipo_disciplina: item.tipo_disciplina,
          descansoMin: descanso.min,
          descansoSeg: descanso.sec,
          series: Array.from({ length: Math.max(1, item.series) }, (_, index) => {
            const serie = nuevaSerie(String(item.repeticiones || ""));
            const persistedSerie = persistedSeries[index];
            return persistedSerie
              ? {
                  ...serie,
                  kg: persistedSerie.kg ?? "",
                  reps: persistedSerie.reps ?? serie.reps,
                  tipo: persistedSerie.tipo ?? "serie",
                }
              : serie;
          }),
        };
      });

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
        body: JSON.stringify({
          nombre: nombre.trim(),
          usuario_id: usuario.id,
        }),
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creador_id: usuario.id,
        }),
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
        ejercicios?: Array<{
          id_ejercicio?: number;
          repeticiones?: number;
          series?: number;
          descanso?: number;
        }>;
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
              descanso: Math.max(0, ejercicio.descanso ?? 90),
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

  const compartirRutina = async () => {
    if (!rutinaSeleccionada) {
      return;
    }

    const url = createRoutineShareUrl(rutinaSeleccionada.id_rutina);

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        setMensaje("Link de rutina copiado");
        return;
      }
    } catch {
      // fallback abajo
    }

    window.prompt("Copiá este link para compartir la rutina", url);
  };

  const abrirModalRenombrarCarpeta = (carpeta: CarpetaRutina) => {
    setOpenFolderMenuId(null);
    setRenameModal({
      open: true,
      id: carpeta.id_carpeta,
      value: carpeta.nombre,
    });
  };

  const cerrarModalRenombrarCarpeta = () => {
    setRenameModal({
      open: false,
      id: null,
      value: "",
    });
  };

  const renombrarCarpeta = async () => {
    if (!renameModal.id || !renameModal.value.trim()) {
      return;
    }

    try {
      setError("");
      setMensaje("");
      const res = await fetch(`${API}/rutinas/carpetas/${renameModal.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: renameModal.value.trim(),
          usuario_id: usuario.id,
        }),
      });

      if (!res.ok) {
        throw new Error(await parseError(res, "No se pudo renombrar carpeta"));
      }

      await cargarCarpetas();
      cerrarModalRenombrarCarpeta();
      setMensaje("Carpeta renombrada");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error renombrando carpeta");
    }
  };

  const duplicarCarpeta = async (carpeta: CarpetaRutina) => {
    try {
      setOpenFolderMenuId(null);
      setError("");
      setMensaje("");
      const res = await fetch(`${API}/rutinas/carpetas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: `${carpeta.nombre} (copia)`,
          usuario_id: usuario.id,
          id_carpeta_padre: carpeta.id_carpeta_padre,
        }),
      });

      if (!res.ok) {
        throw new Error(await parseError(res, "No se pudo duplicar carpeta"));
      }

      await cargarCarpetas();
      setMensaje("Carpeta duplicada");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error duplicando carpeta");
    }
  };

  const eliminarCarpeta = async (carpeta: CarpetaRutina) => {
    const confirmar = window.confirm(
      `Eliminar carpeta "${carpeta.nombre}"? Las rutinas quedaran en "Sin carpeta".`,
    );
    if (!confirmar) {
      return;
    }

    try {
      setOpenFolderMenuId(null);
      setError("");
      setMensaje("");
      const res = await fetch(`${API}/rutinas/carpetas/${carpeta.id_carpeta}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          usuario_id: usuario.id,
        }),
      });

      if (!res.ok) {
        throw new Error(await parseError(res, "No se pudo eliminar carpeta"));
      }

      await Promise.all([cargarCarpetas(), cargarRutinas()]);
      setMensaje("Carpeta eliminada");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error eliminando carpeta");
    }
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
          descansoMin: "1",
          descansoSeg: "30",
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
      prev.map((item) => {
        if (item.id_ejercicio !== idEjercicio) {
          return item;
        }

        const ultimaSerie = item.series[item.series.length - 1];
        const nueva = nuevaSerie();
        const clonada = ultimaSerie
          ? {
              ...nueva,
              kg: ultimaSerie.kg,
              reps: ultimaSerie.reps,
              tipo: ultimaSerie.tipo,
            }
          : nueva;

        return { ...item, series: [...item.series, clonada] };
      }),
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

  const updateSerieEditor = (
    idEjercicio: number,
    serieId: string,
    field: "kg" | "reps" | "tipo",
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

            if (field === "tipo") {
              return {
                ...serie,
                tipo: value as SetTipo,
              };
            }
            return { ...serie, [field]: value };
          }),
        };
      }),
    );
  };

  const updateDescansoEditor = (
    idEjercicio: number,
    field: "descansoMin" | "descansoSeg",
    value: string,
  ) => {
    setEditorEjercicios((prev) =>
      prev.map((item) => (item.id_ejercicio === idEjercicio ? { ...item, [field]: value } : item)),
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

      const ejerciciosObjetivo = editorEjercicios.map((ejercicio, index) => {
        const repeticiones = Number(
          ejercicio.series.find((serie) => serie.reps.trim())?.reps ?? "10",
        );
        return {
          id_ejercicio: ejercicio.id_ejercicio,
          series: Math.max(1, ejercicio.series.length),
          repeticiones: Number.isNaN(repeticiones) ? 10 : Math.max(1, repeticiones),
          descanso: descansoDesdeInputs(ejercicio.descansoMin, ejercicio.descansoSeg),
          orden: index + 1,
        };
      });

      await syncRutinaEjercicios(rutinaId, ejerciciosObjetivo);
      savePersistedRutinaEjercicios(
        rutinaId,
        editorEjercicios.map((ejercicio) => ({
          id_ejercicio: ejercicio.id_ejercicio,
          descansoSegundos: descansoDesdeInputs(ejercicio.descansoMin, ejercicio.descansoSeg),
          series: ejercicio.series.map((serie) => ({
            kg: serie.kg,
            reps: serie.reps,
            tipo: serie.tipo,
          })),
        })),
      );

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

  const iniciarRutina = async () => {
    if (!rutinaSeleccionada) {
      return;
    }

    try {
      setLoading(true);
      setError("");
      setMensaje("");
      setDescansoActivo(null);
      setElapsedSesionSegundos(0);

      const ejercicios = await cargarEjerciciosDeRutina(rutinaSeleccionada.id_rutina);
      const persistedByExercise = new Map(
        getPersistedRutinaEjercicios(rutinaSeleccionada.id_rutina).map((item) => [item.id_ejercicio, item]),
      );
      const startRes = await fetch(`${API}/entrenamientos/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          usuario_id: usuario.id,
          rutina_id: rutinaSeleccionada.id_rutina,
          descripcion: rutinaSeleccionada.nombre,
        }),
      });

      if (!startRes.ok) {
        throw new Error(await parseError(startRes, "No se pudo iniciar la rutina"));
      }

      const sesion = (await startRes.json()) as SesionEntrenamiento;
      const ejecucion = ejercicios.map((item) => {
        const persisted = persistedByExercise.get(item.id_ejercicio);
        const persistedSeries = persisted?.series ?? [];
        return {
          id_ejercicio: item.id_ejercicio,
          nombre: item.nombre,
          grupo_muscular: item.grupo_muscular,
          tipo_disciplina: item.tipo_disciplina,
          descansoSegundos: Math.max(0, persisted?.descansoSegundos ?? item.descanso ?? 0),
          series: Array.from({ length: Math.max(1, item.series) }, (_, index) => ({
            id: crypto.randomUUID(),
            numero: index + 1,
            kg: persistedSeries[index]?.kg ?? "",
            reps: persistedSeries[index]?.reps ?? String(item.repeticiones || ""),
            tipo: persistedSeries[index]?.tipo ?? "serie",
            completada: false,
            registrada: false,
          })),
        };
      });

      setSesionActiva(sesion);
      setRutinaEnEjecucion(rutinaSeleccionada);
      setEjecucionEjercicios(ejecucion);
      setVista("ejecucion");
      setMensaje(`Rutina iniciada (Sesion #${sesion.id_sesion})`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error iniciando rutina");
    } finally {
      setLoading(false);
    }
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
                  return { ...serie, tipo: value as SetTipo };
                }
                return { ...serie, [field]: value };
              }),
            }
          : ejercicio,
      ),
    );
  };

  const updateDescansoEjecucion = (
    idEjercicio: number,
    field: "min" | "seg",
    value: string,
  ) => {
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

  const finalizarRutina = async () => {
    try {
      setLoading(true);
      setError("");
      const shouldOverwrite =
        rutinaEnEjecucion != null &&
        window.confirm("Quieres sobre escribir la rutina actual con los cambios de esta sesion?");
      if (sesionActiva) {
        const res = await fetch(`${API}/entrenamientos/${sesionActiva.id_sesion}/finalizar`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        if (!res.ok) {
          throw new Error(await parseError(res, "No se pudo finalizar la rutina"));
        }
      }

      if (shouldOverwrite && rutinaEnEjecucion) {
        const ejerciciosObjetivo = ejecucionEjercicios.map((ejercicio, index) => {
          const repeticiones = Number(
            ejercicio.series.find((serie) => serie.reps.trim())?.reps ?? "10",
          );
          return {
            id_ejercicio: ejercicio.id_ejercicio,
            series: Math.max(1, ejercicio.series.length),
            repeticiones: Number.isNaN(repeticiones) ? 10 : Math.max(1, repeticiones),
            descanso: Math.max(0, ejercicio.descansoSegundos),
            orden: index + 1,
          };
        });

        await syncRutinaEjercicios(rutinaEnEjecucion.id_rutina, ejerciciosObjetivo);
        savePersistedRutinaEjercicios(
          rutinaEnEjecucion.id_rutina,
          ejecucionEjercicios.map((ejercicio) => ({
            id_ejercicio: ejercicio.id_ejercicio,
            descansoSegundos: Math.max(0, ejercicio.descansoSegundos),
            series: ejercicio.series.map((serie) => ({
              kg: serie.kg,
              reps: serie.reps,
              tipo: serie.tipo,
            })),
          })),
        );
        await cargarRutinas();
        setSelectedRutinaId(rutinaEnEjecucion.id_rutina);
      }

      setSesionActiva(null);
      setRutinaEnEjecucion(null);
      setEjecucionEjercicios([]);
      setDescansoActivo(null);
      setElapsedSesionSegundos(0);
      setVista("lista");
      setMensaje(shouldOverwrite ? "Rutina finalizada y sobre escrita" : "Rutina finalizada");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error finalizando rutina");
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

  const gruposMuscularesResumen = Array.from(
    new Set(
      resumenEjercicios
        .map((ejercicio) => ejercicio.grupo_muscular)
        .filter((grupo) => Boolean(grupo?.trim())),
    ),
  );

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

  const renderRutinaItem = (rutina: Rutina) => (
    <button
      key={rutina.id_rutina}
      type="button"
      className={`list-item ${selectedRutinaId === rutina.id_rutina ? "active" : ""}`}
      onClick={() => setSelectedRutinaId(rutina.id_rutina)}
    >
      <span>
        {rutina.nombre}
      </span>
      <small>{rutina.descripcion || "Sin descripcion"}</small>
    </button>
  );

  const renderToast = () => {
    if (!error && !mensaje) {
      return null;
    }

    const isError = Boolean(error);
    const text = isError ? error : mensaje;
    return (
      <div className={`toast-pop ${isError ? "error" : "ok"}`} role="status" aria-live="polite">
        {text}
      </div>
    );
  };

  const renderCarpeta = (carpeta: CarpetaRutina, nivel: number) => {
    const isExpanded = expandedCarpetas[carpeta.id_carpeta] ?? true;
    const rutinasDeCarpeta = rutinasPorCarpeta.get(carpeta.id_carpeta) ?? [];
    const subcarpetas = carpetasPorPadre.get(carpeta.id_carpeta) ?? [];

    return (
      <div key={carpeta.id_carpeta} className="folder-node" style={{ marginLeft: `${nivel * 16}px` }}>
        <div className="folder-row">
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
          <button
            type="button"
            className="folder-menu-trigger"
            onClick={() =>
              setOpenFolderMenuId((prev) => (prev === carpeta.id_carpeta ? null : carpeta.id_carpeta))
            }
            aria-label="Opciones de carpeta"
          >
            ⋯
          </button>
          {openFolderMenuId === carpeta.id_carpeta && (
            <div className="folder-menu">
              <button type="button" onClick={() => abrirModalRenombrarCarpeta(carpeta)}>
                Editar carpeta
              </button>
              <button type="button" onClick={() => duplicarCarpeta(carpeta)}>
                Duplicar carpeta
              </button>
              <button type="button" className="danger" onClick={() => eliminarCarpeta(carpeta)}>
                Eliminar carpeta
              </button>
            </div>
          )}
        </div>

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
        {renderToast()}
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

                    <div className="rest-grid">
                      <span>Descanso</span>
                      <input
                        className="field compact"
                        type="number"
                        min="0"
                        placeholder="Min"
                        value={ejercicio.descansoMin}
                        onChange={(event) =>
                          updateDescansoEditor(
                            ejercicio.id_ejercicio,
                            "descansoMin",
                            event.target.value,
                          )
                        }
                      />
                      <input
                        className="field compact"
                        type="number"
                        min="0"
                        max="59"
                        placeholder="Seg"
                        value={ejercicio.descansoSeg}
                        onChange={(event) =>
                          updateDescansoEditor(
                            ejercicio.id_ejercicio,
                            "descansoSeg",
                            event.target.value,
                          )
                        }
                      />
                    </div>

                    <div className="set-table">
                      <div className="set-table-head">
                        <span>Set</span>
                        <span>KG</span>
                        <span>Reps</span>
                        <span />
                      </div>

                      {ejercicio.series.map((serie, index) => {
                        const numeroSerie = ejercicio.series
                          .slice(0, index + 1)
                          .filter((item) => item.tipo === "serie").length;

                        return (
                        <div key={serie.id} className="set-row">
                          <div className="set-type-wrap">
                            <select
                              className="set-type-select"
                              value={serie.tipo}
                              onChange={(event) =>
                                updateSerieEditor(
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
                            {serie.tipo === "serie" && (
                              <span className="set-order-badge">{numeroSerie}</span>
                            )}
                          </div>
                          <input
                            className="field compact"
                            type="number"
                            min="0"
                            placeholder="-"
                            value={serie.kg}
                            onChange={(event) =>
                              updateSerieEditor(
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
                              updateSerieEditor(
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
                        );
                      })}
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

  if (vista === "ejecucion") {
    return (
      <main className="app">
        {renderToast()}
        {descansoActivo && (
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
        )}

        <section className="hero editor-header">
          <button type="button" className="btn secondary" onClick={() => setVista("lista")}>
            ← Volver
          </button>
          <h1>{rutinaEnEjecucion?.nombre || "Ejecucion de rutina"}</h1>
          <button type="button" className="btn danger" onClick={finalizarRutina} disabled={loading}>
            Finalizar rutina
          </button>
        </section>

        <section className="panel two-cols">
          <article className="box">
            <h2>Progreso</h2>
            <p className="helper-text">
              Series completas: {seriesCompletadasEjecucion}/{totalSeriesEjecucion}
            </p>
            <p className="helper-text">Tiempo entrenando: {formatDuration(elapsedSesionSegundos)}</p>
            {descansoActivo ? (
              <div className="status">
                Descanso: <strong>{formatDuration(descansoActivo.restanteSegundos)}</strong> ·{" "}
                {descansoActivo.etiqueta}
              </div>
            ) : (
              <p className="helper-text">No hay descanso activo.</p>
            )}
          </article>
          <article className="box">
            <h2>Sesion</h2>
            <p className="helper-text">
              ID de sesion: <strong>{sesionActiva?.id_sesion ?? "-"}</strong>
            </p>
          </article>
        </section>

        <section className="panel">
          <article className="box">
            <div className="editor-selected">
              {ejecucionEjercicios.length === 0 ? (
                <div className="empty-state">
                  <p>La rutina no tiene ejercicios</p>
                  <small>Vuelve y agrega ejercicios a la rutina para ejecutarla.</small>
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
                            {serie.tipo === "serie" && (
                              <span className="set-order-badge">{numeroSerie}</span>
                            )}
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
        </section>
      </main>
    );
  }

  const carpetasRaiz = carpetasPorPadre.get(null) ?? [];
  const rutinasSueltas = rutinasPorCarpeta.get(null) ?? [];

  return (
    <main className="app">
      {renderToast()}
      <section className="hero">
        <p className="eyebrow">Rutinas</p>
        <h1>Tus rutinas</h1>
      </section>

      {loading && <p className="status">Cargando datos...</p>}
      <section className="panel two-cols rutinas-main-panels">
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
            <div className="routine-detail detail-rich">
              <h3 className="routine-title-xl">{rutinaSeleccionada.nombre}</h3>
              <p>{rutinaSeleccionada.descripcion || "Sin descripcion"}</p>
              <div className="detail-meta">
                <span>Duracion: {rutinaSeleccionada.duracion_estimada ?? "-"} min</span>
                <span>ID {rutinaSeleccionada.id_rutina}</span>
                <span>Guardados: {rutinaSeleccionada.save_count}</span>
                <span>Copias: {rutinaSeleccionada.copy_count}</span>
              </div>

              <p className="helper-text routine-copy-insight">
                Cantidad de veces copiadas: {rutinaSeleccionada.copy_count}
              </p>

              <h3 className="detail-subtitle">Grupos musculares</h3>
              {resumenLoading ? (
                <p className="helper-text">Cargando grupos musculares...</p>
              ) : gruposMuscularesResumen.length === 0 ? (
                <p className="helper-text">Sin grupos musculares identificados.</p>
              ) : (
                <div className="muscle-chips">
                  {gruposMuscularesResumen.map((grupo) => (
                    <span key={grupo} className="muscle-chip">
                      {grupo}
                    </span>
                  ))}
                </div>
              )}

              <h3 className="detail-subtitle">Ejercicios ({resumenEjercicios.length})</h3>
              {resumenLoading ? (
                <p className="helper-text">Cargando ejercicios...</p>
              ) : resumenEjercicios.length === 0 ? (
                <p className="helper-text">Esta rutina no tiene ejercicios.</p>
              ) : (
                <div className="exercise-summary-grid">
                  {resumenEjercicios.map((ejercicio, index) => (
                    <div key={`${ejercicio.nombre}-${index}`} className="exercise-summary-item">
                      <strong>{ejercicio.nombre}</strong>
                      <small>{ejercicio.grupo_muscular}</small>
                    </div>
                  ))}
                </div>
              )}

              <div className="actions-row">
                <button
                  type="button"
                  className="btn"
                  onClick={() => void abrirEditorRutina(rutinaSeleccionada)}
                >
                  Modificar
                </button>
                <button type="button" className="btn secondary" onClick={() => void compartirRutina()}>
                  Compartir link
                </button>
                <button type="button" className="btn" onClick={iniciarRutina}>
                  Comenzar rutina
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

      {renameModal.open && (
        <div className="modal-backdrop" role="presentation" onClick={cerrarModalRenombrarCarpeta}>
          <div
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-label="Renombrar carpeta"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-head">
              <h2>Rename Folder</h2>
              <button type="button" className="modal-close" onClick={cerrarModalRenombrarCarpeta}>
                ×
              </button>
            </div>
            <input
              className="field"
              placeholder="Nombre de carpeta"
              value={renameModal.value}
              onChange={(event) =>
                setRenameModal((prev) => ({
                  ...prev,
                  value: event.target.value,
                }))
              }
            />
            <div className="modal-actions">
              <button type="button" className="btn secondary" onClick={cerrarModalRenombrarCarpeta}>
                Cancel
              </button>
              <button
                type="button"
                className="btn"
                onClick={renombrarCarpeta}
                disabled={!renameModal.value.trim()}
              >
                Rename Folder
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default Rutinas;
