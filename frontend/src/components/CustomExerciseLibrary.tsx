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

const API = "http://localhost:3000";

function CustomExerciseLibrary({ authToken, onAuthExpired }: { authToken: string; onAuthExpired: () => void }) {
  const [data, setData] = useState<ResponseData>({ items: [], count: 0, limit: 10, isPro: false });
  const [form, setForm] = useState({ nombre: "", grupo_muscular: "", tipo_disciplina: "Musculacion", descripcion: "" });
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
    try {
      setSaving(true);
      setError("");
      const response = await fetch(`${API}/ejercicios`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "No se pudo crear el ejercicio");
      setForm({ nombre: "", grupo_muscular: "", tipo_disciplina: "Musculacion", descripcion: "" });
      await load();
      notifyCustomExercisesUpdated();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "No se pudo crear el ejercicio");
    } finally { setSaving(false); }
  };

  const remove = async (id: number) => {
    const response = await fetch(`${API}/ejercicios/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${authToken}` } });
    const payload = await response.json();
    if (!response.ok) return setError(payload.error || "No se pudo eliminar");
    await load();
    notifyCustomExercisesUpdated();
  };

  const reachedLimit = data.limit != null && data.count >= data.limit;
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
        <input className="field" placeholder="Nombre del ejercicio" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
        <input className="field" placeholder="Grupo muscular" value={form.grupo_muscular} onChange={(e) => setForm({ ...form, grupo_muscular: e.target.value })} />
        <input className="field" placeholder="Disciplina" value={form.tipo_disciplina} onChange={(e) => setForm({ ...form, tipo_disciplina: e.target.value })} />
        <input className="field" placeholder="Descripcion opcional" value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
        <button type="button" className="btn" disabled={saving || reachedLimit || !form.nombre.trim() || !form.grupo_muscular.trim()} onClick={() => void create()}>
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
