import { useEffect, useMemo, useState } from "react";
import "./ProBodyMeasurements.css";

type MeasurementKey = "peso" | "cintura" | "pecho" | "brazo" | "cadera" | "muslo";

type BodyMeasurement = {
  id_medida: number;
  fecha: string;
  peso: number | null;
  cintura: number | null;
  pecho: number | null;
  brazo: number | null;
  cadera: number | null;
  muslo: number | null;
  nota: string | null;
};

type Props = {
  authToken: string;
  onAuthExpired: () => void;
};

const API = "http://localhost:3000";
const metrics: Array<{ key: MeasurementKey; label: string; unit: string }> = [
  { key: "peso", label: "Peso", unit: "kg" },
  { key: "cintura", label: "Cintura", unit: "cm" },
  { key: "pecho", label: "Pecho", unit: "cm" },
  { key: "brazo", label: "Brazo", unit: "cm" },
  { key: "cadera", label: "Cadera", unit: "cm" },
  { key: "muslo", label: "Muslo", unit: "cm" },
];

const today = () => new Date().toISOString().slice(0, 10);
const emptyForm = () => ({
  fecha: today(),
  peso: "",
  cintura: "",
  pecho: "",
  brazo: "",
  cadera: "",
  muslo: "",
  nota: "",
});

function ProBodyMeasurements({ authToken, onAuthExpired }: Props) {
  const [items, setItems] = useState<BodyMeasurement[]>([]);
  const [metric, setMetric] = useState<MeasurementKey>("peso");
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API}/suscripciones/body-measurements`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (response.status === 401) {
        onAuthExpired();
        return;
      }
      const payload = (await response.json()) as BodyMeasurement[] | { error?: string };
      if (!response.ok || !Array.isArray(payload)) {
        throw new Error(!Array.isArray(payload) ? payload.error : "No se pudieron cargar las medidas");
      }
      setItems(payload);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar las medidas");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [authToken]);

  const points = useMemo(
    () => items.filter((item) => item[metric] != null).map((item) => ({
      date: item.fecha,
      value: Number(item[metric]),
    })),
    [items, metric],
  );

  const line = useMemo(() => {
    const width = 760;
    const height = 240;
    const pad = 34;
    const values = points.map((point) => point.value);
    const min = Math.min(...values, 0);
    const max = Math.max(...values, 1);
    const range = Math.max(max - min, 1);
    return points.map((point, index) => ({
      ...point,
      x: points.length === 1 ? width / 2 : pad + (index / (points.length - 1)) * (width - pad * 2),
      y: pad + (1 - (point.value - min) / range) * (height - pad * 2),
    }));
  }, [points]);

  const save = async () => {
    try {
      setSaving(true);
      setError("");
      const response = await fetch(`${API}/suscripciones/body-measurements`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "No se pudo guardar la medida");
      setForm(emptyForm());
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo guardar la medida");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: number) => {
    const response = await fetch(`${API}/suscripciones/body-measurements/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if (response.ok) setItems((current) => current.filter((item) => item.id_medida !== id));
  };

  const currentMetric = metrics.find((item) => item.key === metric)!;
  const latest = points[points.length - 1];
  const first = points[0];

  return (
    <section className="pro-body-measurements">
      <header>
        <div>
          <p className="eyebrow">Medidas corporales</p>
          <h2>Segui tus cambios fisicos</h2>
          <p>Registra peso y contornos para comparar tu evolucion.</p>
        </div>
        <div className="body-measurement-current">
          <span>{currentMetric.label} actual</span>
          <strong>{latest ? `${latest.value} ${currentMetric.unit}` : "-"}</strong>
          <small>
            {latest && first ? `${latest.value - first.value >= 0 ? "+" : ""}${(latest.value - first.value).toFixed(1)} desde el inicio` : "Sin registros"}
          </small>
        </div>
      </header>

      <div className="body-measurement-form">
        <input className="field" type="date" value={form.fecha} onChange={(event) => setForm({ ...form, fecha: event.target.value })} />
        {metrics.map((item) => (
          <label key={item.key}>
            <span>{item.label}</span>
            <input className="field" type="number" min="0" step="0.1" placeholder={item.unit} value={form[item.key]} onChange={(event) => setForm({ ...form, [item.key]: event.target.value })} />
          </label>
        ))}
        <input className="field body-note" placeholder="Nota opcional" maxLength={240} value={form.nota} onChange={(event) => setForm({ ...form, nota: event.target.value })} />
        <button type="button" className="btn" disabled={saving} onClick={() => void save()}>
          {saving ? "Guardando..." : "Guardar medidas"}
        </button>
      </div>

      {error ? <div className="status error">{error}</div> : null}
      {loading ? <div className="status">Cargando medidas...</div> : null}

      {!loading ? (
        <>
          <div className="body-metric-tabs">
            {metrics.map((item) => (
              <button type="button" className={metric === item.key ? "active" : ""} onClick={() => setMetric(item.key)} key={item.key}>
                {item.label}
              </button>
            ))}
          </div>
          {line.length ? (
            <div className="body-chart-scroll">
              <svg className="body-chart" viewBox="0 0 760 280" role="img" aria-label={`Evolucion de ${currentMetric.label}`}>
                {[50, 105, 160, 215].map((y) => <line key={y} x1="34" x2="726" y1={y} y2={y} />)}
                {line.length > 1 ? <polyline points={line.map((point) => `${point.x},${point.y}`).join(" ")} /> : null}
                {line.map((point) => (
                  <g key={point.date}>
                    <circle cx={point.x} cy={point.y} r="6" />
                    <text x={point.x} y={point.y - 14}>{point.value} {currentMetric.unit}</text>
                    <text className="date" x={point.x} y="266">{new Date(`${point.date}T00:00:00`).toLocaleDateString("es-AR", { day: "numeric", month: "short" })}</text>
                  </g>
                ))}
              </svg>
            </div>
          ) : <div className="body-measurement-empty">Todavia no hay registros para esta medida.</div>}

          <div className="body-measurement-history">
            {items.slice().reverse().slice(0, 6).map((item) => (
              <article key={item.id_medida}>
                <div><strong>{new Date(`${item.fecha}T00:00:00`).toLocaleDateString("es-AR")}</strong><span>{item.nota || "Registro corporal"}</span></div>
                <button type="button" onClick={() => void remove(item.id_medida)}>Eliminar</button>
              </article>
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}

export default ProBodyMeasurements;
