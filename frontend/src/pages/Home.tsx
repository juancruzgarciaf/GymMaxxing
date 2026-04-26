import { useEffect, useState } from "react";
import TrainingPostCard from "../components/TrainingPostCard";
import type { EntrenamientoResumen, Usuario } from "../types";

type HomeProps = {
  usuario: Usuario;
  onOpenProfile: (userId: number) => void;
  onOpenTraining: (training: EntrenamientoResumen) => void;
  onSaveAsRoutine: (training: EntrenamientoResumen, customName?: string) => void | Promise<void>;
};

const API = "http://localhost:3000";

function Home({
  usuario,
  onOpenProfile,
  onOpenTraining,
  onSaveAsRoutine,
}: HomeProps) {
  const [feed, setFeed] = useState<EntrenamientoResumen[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const loadFeed = async () => {
      try {
        setLoading(true);
        setError("");

        const res = await fetch(`${API}/users/${usuario.id}/feed`);
        const data = (await res.json()) as EntrenamientoResumen[] | { error?: string };

        if (!res.ok) {
          throw new Error("error" in data ? data.error || "No se pudo cargar el feed" : "No se pudo cargar el feed");
        }

        if (!cancelled) {
          setFeed(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "No se pudo cargar el feed");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadFeed();

    return () => {
      cancelled = true;
    };
  }, [usuario.id]);

  return (
    <main className="page-shell">
      <section className="page-hero">
        <h1>FEED</h1>
      </section>

      {loading ? <div className="status">Cargando feed...</div> : null}
      {error ? <div className="status error">{error}</div> : null}

      {!loading && !error && feed.length === 0 ? (
        <section className="empty-state">
          <h2>Tu feed todavía está vacío</h2>
          <p>
            Finalizá una rutina, completá un entrenamiento libre o seguí a otros usuarios desde
            Buscar para empezar a ver publicaciones acá.
          </p>
        </section>
      ) : null}

      <section className="feed-list">
        {feed.map((item) => (
          <TrainingPostCard
            key={item.id_sesion}
            item={item}
            viewerId={usuario.id}
            onOpenProfile={onOpenProfile}
            onOpenTraining={onOpenTraining}
            onSaveAsRoutine={onSaveAsRoutine}
          />
        ))}
      </section>
    </main>
  );
}

export default Home;
