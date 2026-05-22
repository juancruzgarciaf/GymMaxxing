import { useState } from "react";
import type { SearchUser, Usuario } from "../types";
import VerifiedBadge from "../components/VerifiedBadge";

type BuscarProps = {
  usuario: Usuario;
  query: string;
  resultados: SearchUser[];
  onQueryChange: (query: string) => void;
  onResultadosChange: (resultados: SearchUser[] | ((prev: SearchUser[]) => SearchUser[])) => void;
  onOpenProfile: (username: string) => void;
};

const API = "http://localhost:3000";

function Buscar({
  usuario,
  query,
  resultados,
  onQueryChange,
  onResultadosChange,
  onOpenProfile,
}: BuscarProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const buscarUsuarios = async () => {
    const cleanQuery = query.trim();
    if (!cleanQuery) {
      onResultadosChange([]);
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

      onResultadosChange(Array.isArray(data) ? data : []);
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

      onResultadosChange((prev) =>
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
        <h1>Busca Usuarios</h1>
      </section>

      <section className="search-panel">
        <input
          className="field"
          placeholder="Buscar por username"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
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
              <strong className="verified-name">
                {item.username}
                <VerifiedBadge tipoUsuario={item.tipo_usuario} />
              </strong>
              <p>{item.email}</p>
              <small>
                {item.followers_count} seguidores · {item.following_count} seguidos
              </small>
            </div>

            <div className="user-card-actions">
              <button type="button" className="btn secondary" onClick={() => onOpenProfile(item.username)}>
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
