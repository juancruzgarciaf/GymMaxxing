import { useState } from "react";
import type { SearchUser, Usuario } from "../types";

type BuscarProps = {
  usuario: Usuario;
  onOpenProfile: (userId: number) => void;
};

const API = "http://localhost:3000";

function Buscar({ usuario, onOpenProfile }: BuscarProps) {
  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState<SearchUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const buscarUsuarios = async () => {
    const cleanQuery = query.trim();
    if (!cleanQuery) {
      setResultados([]);
      setError("Escribí un username para buscar.");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const res = await fetch(
        `${API}/users/search?q=${encodeURIComponent(cleanQuery)}&viewer_id=${usuario.id}`
      );
      const data = (await res.json()) as SearchUser[] | { error?: string };

      if (!res.ok) {
        throw new Error("error" in data ? data.error || "No se pudo buscar usuarios" : "No se pudo buscar usuarios");
      }

      setResultados(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo buscar usuarios");
    } finally {
      setLoading(false);
    }
  };

  const toggleFollow = async (target: SearchUser) => {
    try {
      setError("");

      const res = await fetch(`${API}/users/${target.id}/follow`, {
        method: target.lo_sigo ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seguidor_id: usuario.id }),
      });

      const data = (await res.json()) as { error?: string };

      if (!res.ok) {
        throw new Error(data.error || "No se pudo actualizar el seguimiento");
      }

      setResultados((prev) =>
        prev.map((item) =>
          item.id === target.id
            ? {
                ...item,
                lo_sigo: !item.lo_sigo,
                followers_count: item.followers_count + (item.lo_sigo ? -1 : 1),
              }
            : item
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar el seguimiento");
    }
  };

  return (
    <main className="page-shell">
      <section className="page-hero">
        <p className="eyebrow">Buscar</p>
        <h1>Encontrá usuarios</h1>
        <p className="subtitle">
          Buscá por username, entrá al perfil y seguí a quienes quieras ver en tu feed.
        </p>
      </section>

      <section className="search-panel">
        <input
          className="field"
          placeholder="Buscar por username"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              void buscarUsuarios();
            }
          }}
        />
        <button type="button" className="btn" onClick={() => void buscarUsuarios()} disabled={loading}>
          {loading ? "Buscando..." : "Buscar"}
        </button>
      </section>

      {error ? <div className="status error">{error}</div> : null}

      <section className="user-list">
        {resultados.map((item) => (
          <article key={item.id} className="user-card">
            <div>
              <strong>{item.username}</strong>
              <p>{item.email}</p>
              <small>
                {item.followers_count} seguidores · {item.following_count} seguidos
              </small>
            </div>

            <div className="user-card-actions">
              <button type="button" className="btn secondary" onClick={() => onOpenProfile(item.id)}>
                Ver perfil
              </button>
              {item.id !== usuario.id ? (
                <button
                  type="button"
                  className={`btn ${item.lo_sigo ? "danger" : ""}`}
                  onClick={() => void toggleFollow(item)}
                >
                  {item.lo_sigo ? "Dejar de seguir" : "Seguir"}
                </button>
              ) : null}
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}

export default Buscar;
