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
const FEED_PAGE_SIZE = 10;

type FeedResponse = {
  items: EntrenamientoResumen[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

function Home({
  usuario,
  onOpenProfile,
  onOpenTraining,
  onSaveAsRoutine,
}: HomeProps) {
  const [feed, setFeed] = useState<EntrenamientoResumen[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setPage(1);
  }, [usuario.id]);

  useEffect(() => {
    let cancelled = false;

    const loadFeed = async () => {
      try {
        setLoading(true);
        setError("");

        const res = await fetch(`${API}/users/${usuario.id}/feed?page=${page}&pageSize=${FEED_PAGE_SIZE}`);
        const data = (await res.json()) as EntrenamientoResumen[] | FeedResponse | { error?: string };

        if (!res.ok) {
          throw new Error("error" in data ? data.error || "No se pudo cargar el feed" : "No se pudo cargar el feed");
        }

        if (!cancelled) {
          if (Array.isArray(data)) {
            setFeed(data);
            setTotalItems(data.length);
            setTotalPages(1);
          } else if ("items" in data && Array.isArray(data.items)) {
            setFeed(data.items);
            setTotalItems(data.total);
            setTotalPages(data.totalPages);
            if (data.page !== page) {
              setPage(data.page);
            }
          } else {
            setFeed([]);
            setTotalItems(0);
            setTotalPages(1);
          }
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
  }, [page, usuario.id]);

  const goToPage = (nextPage: number) => {
    setPage(Math.min(Math.max(nextPage, 1), totalPages));
  };

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

      {!loading && !error && totalItems > 0 && totalPages > 1 ? (
        <nav className="feed-pagination" aria-label="Paginación del feed">
          <button type="button" className="btn secondary" onClick={() => goToPage(page - 1)} disabled={page <= 1}>
            Anterior
          </button>
          <span>
            Página {page} de {totalPages}
          </span>
          <button
            type="button"
            className="btn secondary"
            onClick={() => goToPage(page + 1)}
            disabled={page >= totalPages}
          >
            Siguiente
          </button>
        </nav>
      ) : null}
    </main>
  );
}

export default Home;
