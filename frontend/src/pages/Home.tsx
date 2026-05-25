import { useEffect, useState } from "react";
import FeedSidebar from "../components/FeedSidebar";
import RoutinePostCard from "../components/RoutinePostCard";
import TrainingPostCard from "../components/TrainingPostCard";
import type { EntrenamientoResumen, FeedItem, PerfilUsuario, RoutinePostSummary, SuggestedAthlete, Usuario } from "../types";

type HomeProps = {
  usuario: Usuario;
  onOpenProfile: (username: string) => void;
  onOpenTraining: (training: EntrenamientoResumen) => void;
  onOpenRoutine: (routine: RoutinePostSummary) => void;
  onSaveAsRoutine: (training: EntrenamientoResumen, customName?: string) => void | Promise<void>;
};

const API = "http://localhost:3000";
const FEED_PAGE_SIZE = 10;

type FeedResponse = {
  items: FeedItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

function Home({
  usuario,
  onOpenProfile,
  onOpenTraining,
  onOpenRoutine,
  onSaveAsRoutine,
}: HomeProps) {
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [profileSummary, setProfileSummary] = useState<PerfilUsuario | null>(null);
  const [suggestedAthletes, setSuggestedAthletes] = useState<SuggestedAthlete[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(true);
  const [suggestionsError, setSuggestionsError] = useState("");
  const [followLoadingId, setFollowLoadingId] = useState<number | null>(null);

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
        const data = (await res.json()) as FeedItem[] | FeedResponse | { error?: string };

        if (!res.ok) {
          throw new Error("error" in data ? data.error || "No se pudo cargar Inicio" : "No se pudo cargar Inicio");
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
          setError(err instanceof Error ? err.message : "No se pudo cargar Inicio");
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

  useEffect(() => {
    let cancelled = false;

    const loadSidebar = async () => {
      try {
        setSuggestionsLoading(true);
        setSuggestionsError("");

        const [profileRes, suggestionsRes] = await Promise.all([
          fetch(`${API}/users/${usuario.id}/profile?viewer_id=${usuario.id}`),
          fetch(`${API}/users/${usuario.id}/suggestions?limit=5`),
        ]);

        const profileData = (await profileRes.json()) as PerfilUsuario | { error?: string };
        const suggestionsData = (await suggestionsRes.json()) as SuggestedAthlete[] | { error?: string };

        if (!profileRes.ok) {
          throw new Error(
            "error" in profileData
              ? profileData.error || "No se pudo cargar tu perfil"
              : "No se pudo cargar tu perfil",
          );
        }

        if (!suggestionsRes.ok) {
          throw new Error(
            "error" in suggestionsData
              ? suggestionsData.error || "No se pudieron cargar sugerencias"
              : "No se pudieron cargar sugerencias",
          );
        }

        if (!cancelled) {
          setProfileSummary(profileData as PerfilUsuario);
          setSuggestedAthletes(Array.isArray(suggestionsData) ? suggestionsData : []);
        }
      } catch (err) {
        if (!cancelled) {
          setSuggestionsError(err instanceof Error ? err.message : "No se pudo cargar la sidebar");
        }
      } finally {
        if (!cancelled) {
          setSuggestionsLoading(false);
        }
      }
    };

    void loadSidebar();

    return () => {
      cancelled = true;
    };
  }, [usuario.id]);

  const goToPage = (nextPage: number) => {
    setPage(Math.min(Math.max(nextPage, 1), totalPages));
  };

  const followSuggestedAthlete = async (athlete: SuggestedAthlete) => {
    try {
      setFollowLoadingId(athlete.id);
      setSuggestionsError("");

      const res = await fetch(`${API}/users/${athlete.id}/follow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seguidor_id: usuario.id }),
      });
      const data = (await res.json()) as { error?: string };

      if (!res.ok) {
        throw new Error(data.error || "No se pudo seguir al atleta");
      }

      setSuggestedAthletes((prev) => prev.filter((item) => item.id !== athlete.id));
      setProfileSummary((prev) =>
        prev
          ? {
              ...prev,
              following_count: prev.following_count + 1,
            }
          : prev,
      );
    } catch (err) {
      setSuggestionsError(err instanceof Error ? err.message : "No se pudo seguir al atleta");
    } finally {
      setFollowLoadingId(null);
    }
  };

  const handleTrainingUpdated = (training: EntrenamientoResumen) => {
    setFeed((prev) =>
      prev.map((item) =>
        item.content_type !== "routine" && item.id_sesion === training.id_sesion
          ? { ...item, ...training }
          : item,
      ),
    );
    setProfileSummary((prev) =>
      prev
        ? {
            ...prev,
            entrenamientos: prev.entrenamientos.map((item) =>
              item.id_sesion === training.id_sesion ? { ...item, ...training } : item,
            ),
          }
        : prev,
    );
  };

  const handleTrainingDeleted = (trainingId: number) => {
    setFeed((prev) =>
      prev.filter((item) => item.content_type === "routine" || item.id_sesion !== trainingId),
    );
    setTotalItems((prev) => Math.max(0, prev - 1));
    setProfileSummary((prev) =>
      prev
        ? {
            ...prev,
            trainings_count: Math.max(0, prev.trainings_count - 1),
            entrenamientos: prev.entrenamientos.filter((item) => item.id_sesion !== trainingId),
          }
        : prev,
    );
  };

  return (
    <main className="page-shell feed-page-shell">
      <section className="page-hero">
        <h1>Inicio</h1>
      </section>

      <div className="feed-layout">
        <section className="feed-main-column" aria-label="Publicaciones de inicio">
          {loading ? <div className="status">Cargando Inicio...</div> : null}
          {error ? <div className="status error">{error}</div> : null}

          {!loading && !error && feed.length === 0 ? (
            <section className="empty-state">
              <h2>Tu Inicio todavía está vacío</h2>
              <p>
                Finalizá una rutina, completá un entrenamiento libre o seguí a otros usuarios desde
                Buscar para empezar a ver publicaciones acá.
              </p>
            </section>
          ) : null}

          <section className="feed-list">
            {feed.map((item) => (
              item.content_type === "routine" ? (
                <RoutinePostCard
                  key={`routine-${item.id_rutina}`}
                  item={item}
                  onOpenProfile={onOpenProfile}
                  onOpenRoutine={onOpenRoutine}
                />
              ) : (
                <TrainingPostCard
                  key={`training-${item.id_sesion}`}
                  item={item}
                  viewerId={usuario.id}
                  onOpenProfile={onOpenProfile}
                  onOpenTraining={onOpenTraining}
                  onSaveAsRoutine={onSaveAsRoutine}
                  onTrainingUpdated={handleTrainingUpdated}
                  onTrainingDeleted={handleTrainingDeleted}
                />
              )
            ))}
          </section>

          {!loading && !error && totalItems > 0 && totalPages > 1 ? (
            <nav className="feed-pagination" aria-label="Paginación de inicio">
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
        </section>

        <FeedSidebar
          usuario={usuario}
          profile={profileSummary}
          suggestedAthletes={suggestedAthletes}
          suggestionsLoading={suggestionsLoading}
          suggestionsError={suggestionsError}
          followLoadingId={followLoadingId}
          onFollowSuggested={followSuggestedAthlete}
          onOpenProfile={onOpenProfile}
        />
      </div>
    </main>
  );
}

export default Home;
