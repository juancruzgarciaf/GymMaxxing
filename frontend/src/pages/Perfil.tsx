import { useEffect, useState } from "react";
import ProfileHeader from "../components/ProfileHeader";
import ProfileSocialModal from "../components/ProfileSocialModal";
import ProfileTrainingSearch from "../components/ProfileTrainingSearch";
import RoutinePostCard from "../components/RoutinePostCard";
import TrainingCalendar from "../components/TrainingCalendar";
import UserTrainingFeed from "../components/UserTrainingFeed";
import ProEvolution from "../components/ProEvolution";
import { COUNTRY_OPTIONS } from "../lib/countries";
import { isGymUser } from "../lib/roles";
import { DESCRIPTION_MAX_LENGTH, USERNAME_MAX_LENGTH, limitDescription, limitUsername } from "../lib/textLimits";
import type {
  EntrenamientoResumen,
  GimnasioPerfil,
  GymDaySchedule,
  GymHolidaySchedule,
  PerfilUsuario,
  RoutinePostSummary,
  SocialUser,
  Usuario,
} from "../types";

type PerfilProps = {
  usuario: Usuario;
  profileUsername: string;
  onOpenProfile: (username: string) => void;
  onBack: () => void;
  onOpenTraining: (training: EntrenamientoResumen) => void;
  onOpenRoutine: (routine: RoutinePostSummary) => void;
  onSaveAsRoutine: (training: EntrenamientoResumen, customName?: string) => void | Promise<void>;
  authToken: string | null;
  onAuthExpired: () => void;
  onUserUpdated: (usuario: Usuario) => void;
};

const API = "http://localhost:3000";
const TRAINING_LEVEL_OPTIONS = ["Principiante", "Avanzado", "Veterano", "GYMMAXXER"];
const GENDER_OPTIONS = [
  { value: "hombre", label: "Hombre" },
  { value: "mujer", label: "Mujer" },
];
const GYM_TYPE_OPTIONS = [
  "Comercial",
  "Hardcore",
  "Bodybuilding",
  "Powerlifting",
  "Crossfit",
  "Funcional",
  "Boutique",
  "Premium",
  "Women Only",
];
const GYM_SERVICE_OPTIONS = [
  "Duchas",
  "Lockers",
  "Aire acondicionado",
  "WiFi",
  "Estacionamiento",
  "Sauna",
  "Pileta",
  "Cafeteria",
  "Venta de suplementos",
  "Clases grupales",
  "Personal trainers",
  "Sector de posing",
  "Sector de powerlifting",
];
const GYM_DAYS: Array<{ key: string; label: string }> = [
  { key: "lunes", label: "Lunes" },
  { key: "martes", label: "Martes" },
  { key: "miercoles", label: "Miercoles" },
  { key: "jueves", label: "Jueves" },
  { key: "viernes", label: "Viernes" },
  { key: "sabado", label: "Sabado" },
  { key: "domingo", label: "Domingo" },
];
const GYM_DAY_SHORT_LABELS: Record<string, string> = {
  lunes: "Lun",
  martes: "Mar",
  miercoles: "Mie",
  jueves: "Jue",
  viernes: "Vie",
  sabado: "Sab",
  domingo: "Dom",
};
const DEFAULT_GYM_SCHEDULE: Record<string, GymDaySchedule> = {
  lunes: { abierto: true, apertura: "07:00", cierre: "22:00" },
  martes: { abierto: true, apertura: "07:00", cierre: "22:00" },
  miercoles: { abierto: true, apertura: "07:00", cierre: "22:00" },
  jueves: { abierto: true, apertura: "07:00", cierre: "22:00" },
  viernes: { abierto: true, apertura: "07:00", cierre: "22:00" },
  sabado: { abierto: true, apertura: "09:00", cierre: "18:00" },
  domingo: { abierto: false, apertura: "09:00", cierre: "14:00" },
};
const DEFAULT_GYM_HOLIDAYS: GymHolidaySchedule = {
  activo: false,
  nota: "",
  apertura: "09:00",
  cierre: "14:00",
};

const emptyGymForm = (): GimnasioPerfil => ({
  nombre_gimnasio: "",
  telefono: "",
  sitio_web: "",
  instagram: "",
  descripcion_corta: "",
  tipo_gimnasio: "",
  direccion: "",
  ciudad: "",
  provincia: "",
  pais: "",
  google_maps_url: "",
  horarios: DEFAULT_GYM_SCHEDULE,
  horarios_feriados: DEFAULT_GYM_HOLIDAYS,
  servicios: [],
});

const normalizeGymForm = (profile: PerfilUsuario | null): GimnasioPerfil => {
  const source = profile?.gimnasio_perfil;

  return {
    ...emptyGymForm(),
    ...source,
    nombre_gimnasio: source?.nombre_gimnasio ?? profile?.usuario.username ?? "",
    descripcion_corta: limitDescription(source?.descripcion_corta ?? ""),
    horarios: {
      ...DEFAULT_GYM_SCHEDULE,
      ...(source?.horarios ?? {}),
    },
    horarios_feriados: {
      ...DEFAULT_GYM_HOLIDAYS,
      ...(source?.horarios_feriados ?? {}),
    },
    servicios: source?.servicios ?? [],
  };
};

type UserTrainingSearchResponse = {
  items: EntrenamientoResumen[];
  grupos_musculares: string[];
  tipos_disciplina: string[];
};

type SocialModalMode = "followers" | "following";
type GymPublicSection = "servicios" | "horarios";

function Perfil({
  usuario,
  profileUsername,
  onOpenProfile,
  onBack,
  onOpenTraining,
  onOpenRoutine,
  onSaveAsRoutine,
  authToken,
  onAuthExpired,
  onUserUpdated,
}: PerfilProps) {
  const [perfil, setPerfil] = useState<PerfilUsuario | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [trainingSearchQuery, setTrainingSearchQuery] = useState("");
  const [trainingMinDuration, setTrainingMinDuration] = useState("");
  const [trainingMaxDuration, setTrainingMaxDuration] = useState("");
  const [selectedTrainingGroups, setSelectedTrainingGroups] = useState<string[]>([]);
  const [availableTrainingGroups, setAvailableTrainingGroups] = useState<string[]>([]);
  const [selectedTrainingDisciplines, setSelectedTrainingDisciplines] = useState<string[]>([]);
  const [availableTrainingDisciplines, setAvailableTrainingDisciplines] = useState<string[]>([]);
  const [trainingResults, setTrainingResults] = useState<EntrenamientoResumen[]>([]);
  const [trainingSearchLoading, setTrainingSearchLoading] = useState(false);
  const [trainingSearchError, setTrainingSearchError] = useState("");
  const [socialModal, setSocialModal] = useState<SocialModalMode | null>(null);
  const [socialUsers, setSocialUsers] = useState<SocialUser[]>([]);
  const [socialLoading, setSocialLoading] = useState(false);
  const [socialError, setSocialError] = useState("");
  const [socialActionLoadingId, setSocialActionLoadingId] = useState<number | null>(null);
  const [isPro, setIsPro] = useState(false);
  const [proStatsOpen, setProStatsOpen] = useState(false);
  const [gymPublicSection, setGymPublicSection] = useState<GymPublicSection>("servicios");
  const [form, setForm] = useState({
    username: "",
    email: "",
    edad: "",
    peso: "",
    altura: "",
    genero: "",
    nacionalidad: "",
    nivel_entrenamiento: "",
    objetivo_entrenamiento: "",
    foto_perfil_url: "",
  });
  const [gymForm, setGymForm] = useState<GimnasioPerfil>(() => emptyGymForm());
  const currentNationalityIsKnown =
    !form.nacionalidad || COUNTRY_OPTIONS.includes(form.nacionalidad);
  const currentTrainingLevelIsKnown =
    !form.nivel_entrenamiento || TRAINING_LEVEL_OPTIONS.includes(form.nivel_entrenamiento);

  const cargarPerfil = async () => {
    try {
      setLoading(true);
      setError("");

      const res = await fetch(`${API}/users/profile/${encodeURIComponent(profileUsername)}?viewer_id=${usuario.id}`);
      const data = (await res.json()) as PerfilUsuario | { error?: string };

      if (!res.ok) {
        throw new Error("error" in data ? data.error || "No se pudo cargar el perfil" : "No se pudo cargar el perfil");
      }

      setPerfil(data as PerfilUsuario);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el perfil");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void cargarPerfil();
  }, [profileUsername]);

  useEffect(() => {
    if (!perfil?.is_own_profile || !authToken || isGymUser(perfil.usuario)) {
      setIsPro(false);
      setProStatsOpen(false);
      return;
    }

    let cancelled = false;

    const loadProStatus = async () => {
      try {
        const response = await fetch(`${API}/suscripciones/me`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (response.status === 401) {
          onAuthExpired();
          return;
        }
        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as { isPro?: boolean };
        if (!cancelled) {
          setIsPro(Boolean(data.isPro));
        }
      } catch {
        if (!cancelled) {
          setIsPro(false);
        }
      }
    };

    void loadProStatus();
    return () => {
      cancelled = true;
    };
  }, [authToken, onAuthExpired, perfil?.is_own_profile, perfil?.usuario.id]);

  const cargarUsuariosSociales = async (mode: SocialModalMode) => {
    if (!perfil) {
      return;
    }

    try {
      setSocialLoading(true);
      setSocialError("");

      const res = await fetch(`${API}/users/${perfil.usuario.id}/${mode}?viewer_id=${usuario.id}`);
      const data = (await res.json()) as SocialUser[] | { error?: string };

      if (!res.ok) {
        throw new Error("error" in data ? data.error || "No se pudo cargar la lista" : "No se pudo cargar la lista");
      }

      setSocialUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      setSocialError(err instanceof Error ? err.message : "No se pudo cargar la lista");
      setSocialUsers([]);
    } finally {
      setSocialLoading(false);
    }
  };

  const abrirModalSocial = (mode: SocialModalMode) => {
    setSocialModal(mode);
    setSocialUsers([]);
    void cargarUsuariosSociales(mode);
  };

  const cerrarModalSocial = () => {
    setSocialModal(null);
    setSocialUsers([]);
    setSocialError("");
    setSocialActionLoadingId(null);
  };

  const buscarEntrenamientos = async (options?: {
    query?: string;
    minDuration?: string;
    maxDuration?: string;
    selectedGroups?: string[];
    selectedDisciplines?: string[];
  }) => {
    if (!perfil?.is_own_profile) {
      return;
    }

    const nextQuery = options?.query ?? trainingSearchQuery;
    const nextMinDuration = options?.minDuration ?? trainingMinDuration;
    const nextMaxDuration = options?.maxDuration ?? trainingMaxDuration;
    const nextSelectedGroups = options?.selectedGroups ?? selectedTrainingGroups;
    const nextSelectedDisciplines =
      options?.selectedDisciplines ?? selectedTrainingDisciplines;

    try {
      setTrainingSearchLoading(true);
      setTrainingSearchError("");

      const params = new URLSearchParams();
      params.set("viewer_id", String(usuario.id));

      if (nextQuery.trim()) {
        params.set("q", nextQuery.trim());
      }

      if (nextSelectedGroups.length > 0) {
        params.set("grupo_muscular", nextSelectedGroups.join(","));
      }

      if (nextSelectedDisciplines.length > 0) {
        params.set("tipo_disciplina", nextSelectedDisciplines.join(","));
      }

      if (nextMinDuration.trim()) {
        params.set("duracion_min", nextMinDuration.trim());
      }

      if (nextMaxDuration.trim()) {
        params.set("duracion_max", nextMaxDuration.trim());
      }

      const res = await fetch(`${API}/users/${perfil.usuario.id}/trainings/search?${params.toString()}`);
      const data = (await res.json()) as UserTrainingSearchResponse | { error?: string };

      if (!res.ok) {
        throw new Error(
          "error" in data
            ? data.error || "No se pudieron buscar entrenamientos"
            : "No se pudieron buscar entrenamientos",
        );
      }

      if ("items" in data) {
        setTrainingResults(data.items);
        setAvailableTrainingGroups(data.grupos_musculares);
        setAvailableTrainingDisciplines(data.tipos_disciplina);
      }
    } catch (err) {
      setTrainingSearchError(err instanceof Error ? err.message : "No se pudieron buscar entrenamientos");
      setTrainingResults([]);
    } finally {
      setTrainingSearchLoading(false);
    }
  };

  useEffect(() => {
    setTrainingSearchQuery("");
    setTrainingMinDuration("");
    setTrainingMaxDuration("");
    setSelectedTrainingGroups([]);
    setAvailableTrainingGroups([]);
    setSelectedTrainingDisciplines([]);
    setAvailableTrainingDisciplines([]);
    setTrainingResults(perfil?.entrenamientos ?? []);
    setTrainingSearchError("");

    if (perfil?.is_own_profile && !isGymUser(perfil.usuario)) {
      void buscarEntrenamientos({
        query: "",
        minDuration: "",
        maxDuration: "",
        selectedGroups: [],
        selectedDisciplines: [],
      });
    }
  }, [perfil?.usuario.id, perfil?.is_own_profile]);

  useEffect(() => {
    if (!perfil || !perfil.is_own_profile) {
      return;
    }

    setForm({
      username: perfil.usuario.username || "",
      email: perfil.usuario.email || "",
      edad: perfil.usuario.edad == null ? "" : String(perfil.usuario.edad),
      peso: perfil.usuario.peso == null ? "" : String(perfil.usuario.peso),
      altura: perfil.usuario.altura == null ? "" : String(perfil.usuario.altura),
      genero: perfil.usuario.genero || "",
      nacionalidad: perfil.usuario.nacionalidad || "",
      nivel_entrenamiento: perfil.usuario.nivel_entrenamiento || "",
      objetivo_entrenamiento: perfil.usuario.objetivo_entrenamiento || "",
      foto_perfil_url: perfil.usuario.foto_perfil_url || "",
    });
    setGymForm(normalizeGymForm(perfil));
  }, [perfil]);

  const handleGuardarPerfil = async () => {
    if (!perfil || !perfil.is_own_profile) {
      return;
    }

    if (!authToken) {
      setError("No hay token activo. Volve a iniciar sesion.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      const editingGym = isGymUser(perfil.usuario);

      const res = await fetch(`${API}/users/${perfil.usuario.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
      username: limitUsername(form.username.trim()),
          email: form.email.trim(),
          edad: editingGym ? null : form.edad.trim() ? Number(form.edad) : null,
          peso: editingGym ? null : form.peso.trim() ? Number(form.peso) : null,
          altura: editingGym ? null : form.altura.trim() ? Number(form.altura) : null,
          genero: editingGym ? null : form.genero || null,
          nacionalidad: editingGym ? null : form.nacionalidad.trim() || null,
          nivel_entrenamiento: editingGym ? null : form.nivel_entrenamiento.trim() || null,
          objetivo_entrenamiento: editingGym ? null : form.objetivo_entrenamiento.trim() || null,
          foto_perfil_url: form.foto_perfil_url.trim() || null,
          tipo_usuario: perfil.usuario.tipo_usuario,
          gimnasio_perfil: editingGym ? gymForm : undefined,
        }),
      });

      const data = (await res.json()) as Usuario | { error?: string };

      if (res.status === 401) {
        onAuthExpired();
        return;
      }

      if (!res.ok) {
        throw new Error("error" in data ? data.error || "No se pudo actualizar" : "No se pudo actualizar");
      }

      const usuarioActualizado = data as Usuario;
      setPerfil((prev) =>
        prev
          ? {
              ...prev,
              usuario: {
                ...prev.usuario,
                ...usuarioActualizado,
              },
              gimnasio_perfil: editingGym ? gymForm : prev.gimnasio_perfil,
            }
          : prev,
      );
      onUserUpdated({
        ...usuario,
        ...usuarioActualizado,
      });
      setEditMode(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar el perfil");
    } finally {
      setSaving(false);
    }
  };

  const toggleFollow = async () => {
    if (!perfil || perfil.is_own_profile) {
      return;
    }

    try {
      setError("");

      const res = await fetch(`${API}/users/${perfil.usuario.id}/follow`, {
        method: perfil.viewer_follows ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seguidor_id: usuario.id }),
      });

      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error || "No se pudo actualizar el seguimiento");
      }

      setPerfil((prev) =>
        prev
          ? {
              ...prev,
              viewer_follows: !prev.viewer_follows,
              followers_count: prev.followers_count + (prev.viewer_follows ? -1 : 1),
            }
          : prev
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar el seguimiento");
    }
  };

  const seguirUsuarioSocial = async (target: SocialUser) => {
    if (target.id === usuario.id) {
      return;
    }

    try {
      setSocialActionLoadingId(target.id);
      setSocialError("");

      const res = await fetch(`${API}/users/${target.id}/follow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seguidor_id: usuario.id }),
      });

      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error || "No se pudo seguir al usuario");
      }

      setSocialUsers((prev) =>
        prev.map((item) => (item.id === target.id ? { ...item, viewer_follows: true } : item)),
      );

      if (perfil?.usuario.id === target.id) {
        setPerfil((prev) =>
          prev
            ? {
                ...prev,
                viewer_follows: true,
                followers_count: prev.followers_count + 1,
              }
            : prev,
        );
      }
    } catch (err) {
      setSocialError(err instanceof Error ? err.message : "No se pudo seguir al usuario");
    } finally {
      setSocialActionLoadingId(null);
    }
  };

  const dejarDeSeguirUsuarioSocial = async (target: SocialUser) => {
    if (target.id === usuario.id) {
      return;
    }

    try {
      setSocialActionLoadingId(target.id);
      setSocialError("");

      const res = await fetch(`${API}/users/${target.id}/follow`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seguidor_id: usuario.id }),
      });

      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error || "No se pudo dejar de seguir al usuario");
      }

      setSocialUsers((prev) =>
        socialModal === "following" && perfil?.is_own_profile
          ? prev.filter((item) => item.id !== target.id)
          : prev.map((item) => (item.id === target.id ? { ...item, viewer_follows: false } : item)),
      );

      if (perfil?.is_own_profile && socialModal === "following") {
        setPerfil((prev) =>
          prev
            ? {
                ...prev,
                following_count: Math.max(prev.following_count - 1, 0),
              }
            : prev,
        );
      }

      if (perfil?.usuario.id === target.id) {
        setPerfil((prev) =>
          prev
            ? {
                ...prev,
                viewer_follows: false,
                followers_count: Math.max(prev.followers_count - 1, 0),
              }
            : prev,
        );
      }
    } catch (err) {
      setSocialError(err instanceof Error ? err.message : "No se pudo dejar de seguir al usuario");
    } finally {
      setSocialActionLoadingId(null);
    }
  };

  const toggleTrainingGroup = (group: string) => {
    setSelectedTrainingGroups((prev) =>
      prev.includes(group) ? prev.filter((item) => item !== group) : [...prev, group],
    );
  };

  const toggleTrainingDiscipline = (discipline: string) => {
    setSelectedTrainingDisciplines((prev) =>
      prev.includes(discipline)
        ? prev.filter((item) => item !== discipline)
        : [...prev, discipline],
    );
  };

  const clearTrainingSearch = async () => {
    setTrainingSearchQuery("");
    setTrainingMinDuration("");
    setTrainingMaxDuration("");
    setSelectedTrainingGroups([]);
    setSelectedTrainingDisciplines([]);
    await buscarEntrenamientos({
      query: "",
      minDuration: "",
      maxDuration: "",
      selectedGroups: [],
      selectedDisciplines: [],
    });
  };

  const updateGymField = <K extends keyof GimnasioPerfil>(key: K, value: GimnasioPerfil[K]) => {
    setGymForm((prev) => ({ ...prev, [key]: value }));
  };

  const updateGymDay = (dayKey: string, next: Partial<GymDaySchedule>) => {
    setGymForm((prev) => ({
      ...prev,
      horarios: {
        ...prev.horarios,
        [dayKey]: {
          ...(prev.horarios[dayKey] ?? DEFAULT_GYM_SCHEDULE[dayKey]),
          ...next,
        },
      },
    }));
  };

  const copyScheduleToAllDays = () => {
    const monday = gymForm.horarios.lunes ?? DEFAULT_GYM_SCHEDULE.lunes;
    setGymForm((prev) => ({
      ...prev,
      horarios: GYM_DAYS.reduce<Record<string, GymDaySchedule>>((acc, day) => {
        acc[day.key] = { ...monday };
        return acc;
      }, {}),
    }));
  };

  const toggleGymService = (service: string) => {
    setGymForm((prev) => ({
      ...prev,
      servicios: prev.servicios.includes(service)
        ? prev.servicios.filter((item) => item !== service)
        : [...prev.servicios, service],
    }));
  };

  const handleTrainingUpdated = (training: EntrenamientoResumen) => {
    setPerfil((prev) =>
      prev
        ? {
            ...prev,
            entrenamientos: prev.entrenamientos.map((item) =>
              item.id_sesion === training.id_sesion ? { ...item, ...training } : item,
            ),
          }
        : prev,
    );
    setTrainingResults((prev) =>
      prev.map((item) => (item.id_sesion === training.id_sesion ? { ...item, ...training } : item)),
    );
  };

  const handleTrainingDeleted = (trainingId: number) => {
    setPerfil((prev) =>
      prev
        ? {
            ...prev,
            trainings_count: Math.max(0, prev.trainings_count - 1),
            entrenamientos: prev.entrenamientos.filter((item) => item.id_sesion !== trainingId),
          }
        : prev,
    );
    setTrainingResults((prev) => prev.filter((item) => item.id_sesion !== trainingId));
  };

  const trainingsToShow =
    perfil && isGymUser(perfil.usuario)
      ? []
      : perfil?.is_own_profile
      ? trainingResults
      : perfil?.entrenamientos ?? [];
  const profileIsGym = perfil ? isGymUser(perfil.usuario) : false;
  const gymInfo = perfil?.gimnasio_perfil ?? null;

  return (
    <main className="page-shell profile-page-shell">
      {loading ? <div className="status">Cargando perfil...</div> : null}
      {error ? <div className="status error">{error}</div> : null}

      {!loading && perfil ? (
        <>
          {!perfil.is_own_profile ? (
            <div className="profile-back-row">
              <button type="button" className="btn secondary profile-back-button" onClick={onBack}>
                Volver
              </button>
            </div>
          ) : null}

          <ProfileHeader
            perfil={perfil}
            editMode={editMode}
            onToggleEdit={() => setEditMode((prev) => !prev)}
            onToggleFollow={toggleFollow}
            onOpenFollowers={() => abrirModalSocial("followers")}
            onOpenFollowing={() => abrirModalSocial("following")}
          />

          {perfil.is_own_profile && isPro && !profileIsGym ? (
            <>
              <section className="profile-pro-entry">
                <div>
                  <p className="eyebrow">GymMaxxing PRO</p>
                  <h2>Tu progreso, con mas detalle</h2>
                  <p>Analiza duracion, volumen y repeticiones semana a semana.</p>
                </div>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setProStatsOpen((prev) => !prev)}
                >
                  {proStatsOpen ? "Ocultar estadisticas" : "Ver estadisticas PRO"}
                </button>
              </section>

              {proStatsOpen && authToken ? (
                <ProEvolution
                  authToken={authToken}
                  onAuthExpired={onAuthExpired}
                  onClose={() => setProStatsOpen(false)}
                />
              ) : null}
            </>
          ) : null}

          {perfil.is_own_profile && editMode && !profileIsGym ? (
            <section className="feed-card">
              <h2>Editar usuario</h2>
              <div className="form-grid two-inline">
                <input
                  className="field"
                  placeholder="Username"
                  maxLength={USERNAME_MAX_LENGTH}
                  value={form.username}
                  onChange={(event) => setForm((prev) => ({ ...prev, username: limitUsername(event.target.value) }))}
                />
                <input
                  className="field"
                  placeholder="Email"
                  value={form.email}
                  onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                />
                <input
                  className="field"
                  type="number"
                  min="0"
                  placeholder="Edad"
                  value={form.edad}
                  onChange={(event) => setForm((prev) => ({ ...prev, edad: event.target.value }))}
                />
                <input
                  className="field"
                  type="number"
                  min="0"
                  placeholder="Peso"
                  value={form.peso}
                  onChange={(event) => setForm((prev) => ({ ...prev, peso: event.target.value }))}
                />
                <input
                  className="field"
                  type="number"
                  min="0"
                  placeholder="Altura"
                  value={form.altura}
                  onChange={(event) => setForm((prev) => ({ ...prev, altura: event.target.value }))}
                />
                <select
                  className="field"
                  value={form.genero}
                  onChange={(event) => setForm((prev) => ({ ...prev, genero: event.target.value }))}
                >
                  <option value="">Genero</option>
                  {GENDER_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <select
                  className="field"
                  value={form.nacionalidad}
                  onChange={(event) => setForm((prev) => ({ ...prev, nacionalidad: event.target.value }))}
                >
                  <option value="">Nacionalidad</option>
                  {!currentNationalityIsKnown ? (
                    <option value={form.nacionalidad}>{form.nacionalidad}</option>
                  ) : null}
                  {COUNTRY_OPTIONS.map((country) => (
                    <option key={country} value={country}>
                      {country}
                    </option>
                  ))}
                </select>
                <select
                  className="field"
                  value={form.nivel_entrenamiento}
                  onChange={(event) => setForm((prev) => ({ ...prev, nivel_entrenamiento: event.target.value }))}
                >
                  <option value="">Nivel de entrenamiento</option>
                  {!currentTrainingLevelIsKnown ? (
                    <option value={form.nivel_entrenamiento}>{form.nivel_entrenamiento}</option>
                  ) : null}
                  {TRAINING_LEVEL_OPTIONS.map((level) => (
                    <option key={level} value={level}>
                      {level}
                    </option>
                  ))}
                </select>
                <input
                  className="field"
                  placeholder="Objetivo de entrenamiento"
                  value={form.objetivo_entrenamiento}
                  onChange={(event) => setForm((prev) => ({ ...prev, objetivo_entrenamiento: event.target.value }))}
                />
                <input
                  className="field"
                  placeholder="URL de foto de perfil"
                  value={form.foto_perfil_url}
                  onChange={(event) => setForm((prev) => ({ ...prev, foto_perfil_url: event.target.value }))}
                />
              </div>
              <div className="actions-row">
                <button type="button" className="btn" disabled={saving} onClick={() => void handleGuardarPerfil()}>
                  {saving ? "Guardando..." : "Guardar cambios"}
                </button>
              </div>
            </section>
          ) : null}

          {perfil.is_own_profile && editMode && profileIsGym ? (
            <section className="gym-profile-editor">
              <div className="gym-editor-section">
                <div className="gym-editor-head">
                  <h2>Editar gimnasio</h2>
                  <span>Perfil publico</span>
                </div>
                <div className="form-grid two-inline">
                  <input
                    className="field"
                    placeholder="Username"
                    maxLength={USERNAME_MAX_LENGTH}
                    value={form.username}
                    onChange={(event) => setForm((prev) => ({ ...prev, username: limitUsername(event.target.value) }))}
                  />
                  <input
                    className="field"
                    placeholder="Email"
                    value={form.email}
                    onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                  />
                  <input
                    className="field"
                    placeholder="URL de foto de perfil"
                    value={form.foto_perfil_url}
                    onChange={(event) => setForm((prev) => ({ ...prev, foto_perfil_url: event.target.value }))}
                  />
                  <input
                    className="field"
                    placeholder="Nombre del gimnasio"
                    value={gymForm.nombre_gimnasio ?? ""}
                    onChange={(event) => updateGymField("nombre_gimnasio", event.target.value)}
                  />
                  <select
                    className="field"
                    value={gymForm.tipo_gimnasio ?? ""}
                    onChange={(event) => updateGymField("tipo_gimnasio", event.target.value)}
                  >
                    <option value="">Tipo de gimnasio</option>
                    {GYM_TYPE_OPTIONS.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                  <input
                    className="field"
                    placeholder="Telefono"
                    value={gymForm.telefono ?? ""}
                    onChange={(event) => updateGymField("telefono", event.target.value)}
                  />
                  <input
                    className="field"
                    placeholder="Instagram"
                    value={gymForm.instagram ?? ""}
                    onChange={(event) => updateGymField("instagram", event.target.value)}
                  />
                  <input
                    className="field"
                    placeholder="Sitio web"
                    value={gymForm.sitio_web ?? ""}
                    onChange={(event) => updateGymField("sitio_web", event.target.value)}
                  />
                  <textarea
                    className="field gym-textarea"
                    placeholder="Descripcion corta del gimnasio"
                    maxLength={DESCRIPTION_MAX_LENGTH}
                    value={gymForm.descripcion_corta ?? ""}
                    onChange={(event) => updateGymField("descripcion_corta", limitDescription(event.target.value))}
                  />
                  <small className="field-counter">
                    {(gymForm.descripcion_corta ?? "").length}/{DESCRIPTION_MAX_LENGTH}
                  </small>
                </div>
              </div>

              <div className="gym-editor-section">
                <div className="gym-editor-head">
                  <h2>Ubicacion</h2>
                  <span>Como llegar</span>
                </div>
                <div className="form-grid two-inline">
                  <input className="field" placeholder="Direccion" value={gymForm.direccion ?? ""} onChange={(event) => updateGymField("direccion", event.target.value)} />
                  <input className="field" placeholder="Ciudad" value={gymForm.ciudad ?? ""} onChange={(event) => updateGymField("ciudad", event.target.value)} />
                  <input className="field" placeholder="Provincia" value={gymForm.provincia ?? ""} onChange={(event) => updateGymField("provincia", event.target.value)} />
                  <input className="field" placeholder="Pais" value={gymForm.pais ?? ""} onChange={(event) => updateGymField("pais", event.target.value)} />
                  <input className="field wide-field" placeholder="Link de Google Maps opcional" value={gymForm.google_maps_url ?? ""} onChange={(event) => updateGymField("google_maps_url", event.target.value)} />
                </div>
              </div>

              <div className="gym-editor-section">
                <div className="gym-editor-head">
                  <h2>Horarios</h2>
                  <button type="button" className="btn secondary compact" onClick={copyScheduleToAllDays}>
                    Copiar lunes a todos
                  </button>
                </div>
                <div className="gym-schedule-grid">
                  {GYM_DAYS.map((day) => {
                    const schedule = gymForm.horarios[day.key] ?? DEFAULT_GYM_SCHEDULE[day.key];
                    return (
                      <article key={day.key} className={`gym-day-card ${schedule.abierto ? "" : "closed"}`}>
                        <div className="gym-day-head">
                          <strong>{day.label}</strong>
                          <label className="switch-row">
                            <input
                              type="checkbox"
                              checked={schedule.abierto}
                              onChange={(event) => updateGymDay(day.key, { abierto: event.target.checked })}
                            />
                            <span>{schedule.abierto ? "Abierto" : "Cerrado"}</span>
                          </label>
                        </div>
                        <div className="gym-time-row">
                          <input
                            className="field"
                            type="time"
                            value={schedule.apertura}
                            disabled={!schedule.abierto}
                            onChange={(event) => updateGymDay(day.key, { apertura: event.target.value })}
                          />
                          <input
                            className="field"
                            type="time"
                            value={schedule.cierre}
                            disabled={!schedule.abierto}
                            onChange={(event) => updateGymDay(day.key, { cierre: event.target.value })}
                          />
                        </div>
                      </article>
                    );
                  })}
                </div>
                <div className="gym-holiday-card">
                  <label className="switch-row">
                    <input
                      type="checkbox"
                      checked={gymForm.horarios_feriados.activo}
                      onChange={(event) =>
                        updateGymField("horarios_feriados", {
                          ...gymForm.horarios_feriados,
                          activo: event.target.checked,
                        })
                      }
                    />
                    <span>Horario especial para feriados</span>
                  </label>
                  <input
                    className="field"
                    placeholder="Nota para feriados"
                    value={gymForm.horarios_feriados.nota}
                    onChange={(event) =>
                      updateGymField("horarios_feriados", {
                        ...gymForm.horarios_feriados,
                        nota: event.target.value,
                      })
                    }
                  />
                  <div className="gym-time-row">
                    <input
                      className="field"
                      type="time"
                      value={gymForm.horarios_feriados.apertura}
                      onChange={(event) =>
                        updateGymField("horarios_feriados", {
                          ...gymForm.horarios_feriados,
                          apertura: event.target.value,
                        })
                      }
                    />
                    <input
                      className="field"
                      type="time"
                      value={gymForm.horarios_feriados.cierre}
                      onChange={(event) =>
                        updateGymField("horarios_feriados", {
                          ...gymForm.horarios_feriados,
                          cierre: event.target.value,
                        })
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="gym-editor-section">
                <div className="gym-editor-head">
                  <h2>Servicios</h2>
                  <span>{gymForm.servicios.length} seleccionados</span>
                </div>
                <div className="gym-chip-grid">
                  {GYM_SERVICE_OPTIONS.map((service) => (
                    <button
                      key={service}
                      type="button"
                      className={`gym-chip ${gymForm.servicios.includes(service) ? "active" : ""}`}
                      onClick={() => toggleGymService(service)}
                    >
                      {service}
                    </button>
                  ))}
                </div>
              </div>

              <div className="actions-row gym-editor-actions">
                <button type="button" className="btn" disabled={saving} onClick={() => void handleGuardarPerfil()}>
                  {saving ? "Guardando..." : "Guardar cambios"}
                </button>
              </div>
            </section>
          ) : null}

          {profileIsGym ? (
            <section className="profile-content-layout gym-profile-content-layout">
              <section className="profile-feed-column" aria-label="Rutinas del gimnasio">
                {perfil.rutinas?.length ? (
                  <section className="feed-list">
                    {perfil.rutinas.map((routine) => (
                      <RoutinePostCard
                        key={routine.id_rutina}
                        item={routine}
                        onOpenProfile={onOpenProfile}
                        onOpenRoutine={onOpenRoutine}
                      />
                    ))}
                  </section>
                ) : (
                  <section className="empty-state">
                    <h2>No hay rutinas publicadas todavía</h2>
                    <p>Cuando este gimnasio cree rutinas, van a aparecer acá.</p>
                  </section>
                )}
              </section>

              <aside className="gym-public-profile gym-public-sidebar">
                <article className="gym-public-card gym-public-combined-card">
                  <div className="gym-section-tabs" aria-label="Informacion del gimnasio">
                    <button
                      type="button"
                      className={gymPublicSection === "servicios" ? "active" : ""}
                      onClick={() => setGymPublicSection("servicios")}
                    >
                      Servicios
                    </button>
                    <button
                      type="button"
                      className={gymPublicSection === "horarios" ? "active" : ""}
                      onClick={() => setGymPublicSection("horarios")}
                    >
                      Horarios
                    </button>
                  </div>

                  {gymPublicSection === "horarios" ? (
                    <div className="gym-section-content">
                      <div className="gym-public-hours">
                        {GYM_DAYS.map((day) => {
                          const schedule = gymInfo?.horarios?.[day.key] ?? DEFAULT_GYM_SCHEDULE[day.key];
                          return (
                            <div key={day.key} className={`gym-hour-calendar-day ${schedule.abierto ? "" : "closed"}`}>
                              <span className="gym-hour-calendar-label">{GYM_DAY_SHORT_LABELS[day.key] ?? day.label}</span>
                              <div className="gym-hour-calendar-capsule">
                                {schedule.abierto ? (
                                  <>
                                    <strong>{schedule.apertura}</strong>
                                    <small>{schedule.cierre}</small>
                                  </>
                                ) : (
                                  <strong>Cerrado</strong>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {gymInfo?.horarios_feriados?.activo ? (
                        <p className="helper-text">
                          Feriados: {gymInfo.horarios_feriados.nota || `${gymInfo.horarios_feriados.apertura} - ${gymInfo.horarios_feriados.cierre}`}
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  {gymPublicSection === "servicios" ? (
                    <div className="gym-section-content">
                      {gymInfo?.servicios?.length ? (
                        <div className="gym-chip-grid readonly">
                          {gymInfo.servicios.map((service) => (
                            <span key={service} className="gym-chip active">
                              {service}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p>Servicios pendientes de cargar.</p>
                      )}
                    </div>
                  ) : null}
                </article>
              </aside>
            </section>
          ) : (
            <section className="profile-content-layout">
              <section className="profile-feed-column" aria-label="Entrenamientos del usuario">
                {perfil.is_own_profile ? (
                  <>
                    <ProfileTrainingSearch
                      query={trainingSearchQuery}
                      minDuration={trainingMinDuration}
                      maxDuration={trainingMaxDuration}
                      availableGroups={availableTrainingGroups}
                      availableDisciplines={availableTrainingDisciplines}
                      selectedGroups={selectedTrainingGroups}
                      selectedDisciplines={selectedTrainingDisciplines}
                      loading={trainingSearchLoading}
                      resultsCount={trainingResults.length}
                      onQueryChange={setTrainingSearchQuery}
                      onMinDurationChange={setTrainingMinDuration}
                      onMaxDurationChange={setTrainingMaxDuration}
                      onToggleGroup={toggleTrainingGroup}
                      onToggleDiscipline={toggleTrainingDiscipline}
                      onApply={buscarEntrenamientos}
                      onClear={clearTrainingSearch}
                    />
                    {trainingSearchError ? <div className="status error">{trainingSearchError}</div> : null}
                  </>
                ) : null}

                <UserTrainingFeed
                  trainings={trainingsToShow}
                  viewerId={usuario.id}
                  onOpenProfile={onOpenProfile}
                  onOpenTraining={onOpenTraining}
                  onSaveAsRoutine={onSaveAsRoutine}
                  onTrainingUpdated={handleTrainingUpdated}
                  onTrainingDeleted={handleTrainingDeleted}
                />
              </section>

              <aside className="profile-calendar-column" aria-label="Calendario de entrenamientos">
                <TrainingCalendar trainings={trainingsToShow} onOpenTraining={onOpenTraining} />
              </aside>
            </section>
          )}

          {socialModal ? (
            <ProfileSocialModal
              mode={socialModal}
              users={socialUsers}
              loading={socialLoading}
              error={socialError}
              actionLoadingId={socialActionLoadingId}
              profileIsOwn={perfil.is_own_profile}
              viewerId={usuario.id}
              onClose={cerrarModalSocial}
              onOpenProfile={onOpenProfile}
              onFollow={seguirUsuarioSocial}
              onUnfollow={dejarDeSeguirUsuarioSocial}
            />
          ) : null}
        </>
      ) : null}
    </main>
  );
}

export default Perfil;
