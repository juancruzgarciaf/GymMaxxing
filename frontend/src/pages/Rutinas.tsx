import { useEffect, useMemo, useState } from "react";

type Ejercicio = {
  id_ejercicio: number;
  nombre: string;
  descripcion: string;
  grupo_muscular: string;
  tipo_disciplina: string;
};

const API_URL = "http://localhost:3000/ejercicios";

function Rutinas() {
  const [ejercicios, setEjercicios] = useState<Ejercicio[]>([]);
  const [grupoSeleccionado, setGrupoSeleccionado] = useState("Todos");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchEjercicios = async () => {
      try {
        setLoading(true);
        setError("");
        const response = await fetch(API_URL);

        if (!response.ok) {
          throw new Error("No se pudieron obtener los ejercicios.");
        }

        const data = (await response.json()) as Ejercicio[];
        setEjercicios(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error inesperado.");
      } finally {
        setLoading(false);
      }
    };

    fetchEjercicios();
  }, []);

  const grupos = useMemo(() => {
    const valores = new Set(
      ejercicios
        .map((ejercicio) => ejercicio.grupo_muscular?.trim())
        .filter((grupo): grupo is string => Boolean(grupo)),
    );
    return ["Todos", ...Array.from(valores).sort((a, b) => a.localeCompare(b))];
  }, [ejercicios]);

  const ejerciciosFiltrados = useMemo(() => {
    if (grupoSeleccionado === "Todos") return ejercicios;
    return ejercicios.filter(
      (ejercicio) => ejercicio.grupo_muscular === grupoSeleccionado,
    );
  }, [ejercicios, grupoSeleccionado]);

  return (
    <main className="app">
      <section className="hero">
        <p className="eyebrow">Rutinas</p>
        <h1>Biblioteca de ejercicios</h1>
        <p className="subtitle">
          Elegi un grupo muscular y explora movimientos para construir tus
          rutinas.
        </p>
      </section>

      <section className="filters">
        {grupos.map((grupo) => (
          <button
            key={grupo}
            type="button"
            className={`chip ${grupoSeleccionado === grupo ? "is-active" : ""}`}
            onClick={() => setGrupoSeleccionado(grupo)}
          >
            {grupo}
          </button>
        ))}
      </section>

      {loading && <p className="status">Cargando ejercicios...</p>}
      {error && <p className="status error">{error}</p>}

      {!loading && !error && (
        <section className="grid">
          {ejerciciosFiltrados.length === 0 ? (
            <article className="card empty">
              <h2>Sin resultados</h2>
              <p>No hay ejercicios para el filtro seleccionado.</p>
            </article>
          ) : (
            ejerciciosFiltrados.map((ejercicio) => (
              <article className="card" key={ejercicio.id_ejercicio}>
                <div className="card-top">
                  <span className="tag">{ejercicio.grupo_muscular || "General"}</span>
                  <span className="discipline">
                    {ejercicio.tipo_disciplina || "Sin disciplina"}
                  </span>
                </div>
                <h2>{ejercicio.nombre}</h2>
                <p>{ejercicio.descripcion || "Sin descripcion disponible."}</p>
              </article>
            ))
          )}
        </section>
      )}
    </main>
  );
}

export default Rutinas;
