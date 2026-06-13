import { useEffect, useState } from "react";
import { notifyCustomExercisesUpdated } from "../lib/customExercises";
import "./CustomExerciseLibrary.css";

type Exercise = {
  id_ejercicio: number;
  nombre: string;
  descripcion: string | null;
  grupo_muscular: string;
  tipo_disciplina: string;
};

type ResponseData = {
  items: Exercise[];
  count: number;
  limit: number | null;
  isPro: boolean;
};

const DISCIPLINE_OPTIONS = ["Musculacion", "Calistenia", "Cardio", "Movilidad", "Funcional", "Otro"];
const MUSCLE_GROUP_OPTIONS = [
  "Pecho",
  "Espalda",
  "Piernas",
  "Hombros",
  "Biceps",
  "Triceps",
  "Brazos",
  "Core",
  "Gluteos",
  "Full body",
  "Cardio",
  "Otro",
];

const API = "http://localhost:3000";
const EMPTY_FORM = {
  nombre: "",
  grupo_muscular: "",
  tipo_disciplina: "Musculacion",
  descripcion: "",
};

function CustomExerciseLibrary({ authToken, onAuthExpired }: { authToken: string; onAuthExpired: () => void }) {
  const [data, setData] = useState<ResponseData>({ items: [], count: 0, limit: 10, isPro: false });
  const [form, setForm] = useState(EMPTY_FORM);
  const [customDiscipline, setCustomDiscipline] = useState("");
  const [customMuscleGroup, setCustomMuscleGroup] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const response = await fetch(`${API}/ejercicios/mios`, { headers: { Authorization: `Bearer ${authToken}` } });
    if (response.status === 401) return onAuthExpired();
    const payload = await response.json();
    if (response.ok) setData(payload);
  };

  useEffect(() => { void load(); }, [authToken]);

  const create = async () => {
    const payloadForm = {
      ...form,
      grupo_muscular: form.grupo_muscular === "Otro" ? customMuscleGroup.trim() : form.grupo_muscular,
      tipo_disciplina: form.tipo_disciplina === "Otro" ? customDiscipline.trim() : form.tipo_disciplina,
    };

    try {
      setSaving(true);
      setError("");
      const response = await fetch(`${API}/ejercicios`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(payloadForm),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "No se pudo crear el ejercicio");
      setForm(EMPTY_FORM);
      setCustomDiscipline("");
      setCustomMuscleGroup("");
      await load();
      notifyCustomExercisesUpdated();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "No se pudo crear el ejercicio");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: number) => {
    const response = await fetch(`${API}/ejercicios/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${authToken}` } });
    const payload = await response.json();
    if (!response.ok) return setError(payload.error || "No se pudo eliminar");
    await load();
    notifyCustomExercisesUpdated();
  };

  const reachedLimit = data.limit != null && data.count >= data.limit;
  const validMuscleGroup = form.grupo_muscular && (form.grupo_muscular !== "Otro" || customMuscleGroup.trim());
  const validDiscipline = form.tipo_disciplina !== "Otro" || customDiscipline.trim();

  return (
    <section className="custom-exercise-library">
      <header>
        <div><p className="eyebrow">Biblioteca personal</p><h2>Mis ejercicios personalizados</h2><p>Crea movimientos propios para usarlos en rutinas y entrenamientos.</p></div>
        <div className={reachedLimit ? "custom-exercise-usage limit" : "custom-exercise-usage"}>
          <strong>{data.count}{data.limit == null ? "" : ` / ${data.limit}`}</strong>
          <span>Disponible con GymMaxxing PRO</span>
        </div>
      </header>
      <div className="custom-exercise-form">
        <label>
          <span>Nombre</span>
          <input className="field" placeholder="Ej: Press unilateral" value={form.nombre} onChange={(event) => setForm({ ...form, nombre: event.target.value })} />
        </label>
        <label>
          <span>Disciplina</span>
          <select className="field" value={form.tipo_disciplina} onChange={(event) => setForm({ ...form, tipo_disciplina: event.target.value })}>
            {DISCIPLINE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>
        {form.tipo_disciplina === "Otro" ? (
          <label>
            <span>Nueva disciplina</span>
            <input className="field" placeholder="Escribe la disciplina" value={customDiscipline} onChange={(event) => setCustomDiscipline(event.target.value)} />
          </label>
        ) : null}
        <label>
          <span>Grupo muscular</span>
          <select className="field" value={form.grupo_muscular} onChange={(event) => setForm({ ...form, grupo_muscular: event.target.value })}>
            <option value="">Selecciona una opcion</option>
            {MUSCLE_GROUP_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>
        {form.grupo_muscular === "Otro" ? (
          <label>
            <span>Nuevo grupo muscular</span>
            <input className="field" placeholder="Escribe el grupo muscular" value={customMuscleGroup} onChange={(event) => setCustomMuscleGroup(event.target.value)} />
          </label>
        ) : null}
        <label className="custom-exercise-description">
          <span>Descripcion</span>
          <input className="field" placeholder="Descripcion opcional" value={form.descripcion} onChange={(event) => setForm({ ...form, descripcion: event.target.value })} />
        </label>
        <button type="button" className="btn" disabled={saving || reachedLimit || !form.nombre.trim() || !validMuscleGroup || !validDiscipline} onClick={() => void create()}>
          {saving ? "Creando..." : "Crear ejercicio"}
        </button>
      </div>
      {reachedLimit ? <div className="custom-exercise-limit">Llegaste al limite gratuito de 10 ejercicios. PRO permite crear ejercicios ilimitados.</div> : null}
      {error ? <div className="status error">{error}</div> : null}
      <div className="custom-exercise-list">
        {data.items.map((item) => <article key={item.id_ejercicio}><div><strong>{item.nombre}</strong><span>{item.grupo_muscular} · {item.tipo_disciplina}</span></div><button type="button" onClick={() => void remove(item.id_ejercicio)}>Eliminar</button></article>)}
        {!data.items.length ? <p>Todavia no creaste ejercicios personalizados.</p> : null}
      </div>
    </section>
  );
}

export default CustomExerciseLibrary;
