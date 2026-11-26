import { useEffect, useRef, useState } from "react";
import type { SearchUser, Usuario } from "../types";
import VerifiedBadge from "../components/VerifiedBadge";
import UserAvatar from "../components/UserAvatar";
import searchEmptyBodybuilders from "../assets/search-empty-bodybuilders.png";

type BuscarProps = {
  usuario: Usuario;
  query: string;
  resultados: SearchUser[];
  onQueryChange: (query: string) => void;
  onResultadosChange: (resultados: SearchUser[] | ((prev: SearchUser[]) => SearchUser[])) => void;
  onOpenProfile: (username: string) => void;
};

type RecentSearchUser = Pick<SearchUser, "id" | "username" | "foto_perfil_url" | "tipo_usuario">;

const API = "http://localhost:3000";
const SEARCH_DEBOUNCE_MS = 250;
const MAX_RECENT_SEARCHES = 10;

const recentSearchesKey = (userId: number) => `gymmaxxing_recent_searches_v1_${userId}`;

const toRecentSearchUser = (user: RecentSearchUser): RecentSearchUser => ({
  id: user.id,
  username: user.username,
  foto_perfil_url: user.foto_perfil_url ?? null,
  tipo_usuario: user.tipo_usuario ?? "",
});

const readRecentSearches = (userId: number): RecentSearchUser[] => {
  try {
    const raw = localStorage.getItem(recentSearchesKey(userId));
    if (!raw) {
      return [];
    }

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter(
        (item): item is RecentSearchUser =>
          typeof item === "object" &&
          item !== null &&
          typeof (item as RecentSearchUser).id === "number" &&
          typeof (item as RecentSearchUser).username === "string"
      )
      .map(toRecentSearchUser)
      .slice(0, MAX_RECENT_SEARCHES);
  } catch {
    return [];
  }
};

const writeRecentSearches = (userId: number, items: RecentSearchUser[]) => {
  try {
    if (items.length === 0) {
      localStorage.removeItem(recentSearchesKey(userId));
      return;
    }

    localStorage.setItem(recentSearchesKey(userId), JSON.stringify(items));
  } catch {
    // Si el storage no está disponible, el historial queda solo en memoria.
  }
};

type SearchUserRowProps = {
  user: RecentSearchUser;
  onOpen: () => void;
  onRemove?: () => void;
};

function SearchUserRow({ user, onOpen, onRemove }: SearchUserRowProps) {
  return (
    <article className="user-card search-user-card">
      <button
        type="button"
        className="search-user-open"
        onClick={onOpen}
        aria-label={`Ver perfil de ${user.username}`}
      >
        <UserAvatar
          username={user.username}
          photoUrl={user.foto_perfil_url}
          className="search-user-avatar"
        />
        <strong className="verified-name search-user-name">
          <span className="search-user-name-text">{user.username}</span>
          <VerifiedBadge tipoUsuario={user.tipo_usuario} />
        </strong>
      </button>

      {onRemove ? (
        <button
          type="button"
          className="search-recent-remove"
          onClick={onRemove}
          aria-label={`Quitar a ${user.username} de recientes`}
          title="Quitar de recientes"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 6 18 18M18 6 6 18" />
          </svg>
        </button>
      ) : null}
    </article>
  );
}

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
  const [searchedQuery, setSearchedQuery] = useState("");
  const [recentSearches, setRecentSearches] = useState<RecentSearchUser[]>(() =>
    readRecentSearches(usuario.id)
  );
  const inputRef = useRef<HTMLInputElement>(null);

  const cleanQuery = query.trim();
  const isSearchEmpty = cleanQuery.length === 0;
  const showNoResults =
    !isSearchEmpty && !loading && !error && searchedQuery === cleanQuery && resultados.length === 0;

  // Búsqueda en vivo: cada cambio del texto dispara una búsqueda (con un pequeño debounce)
  // y cancela la anterior para que nunca pise resultados más nuevos.
  useEffect(() => {
    if (!cleanQuery) {
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setLoading(true);
      setError("");

      try {
        const res = await fetch(
          `${API}/users/search?q=${encodeURIComponent(cleanQuery)}&viewer_id=${usuario.id}`,
          { signal: controller.signal }
        );
        const data = (await res.json()) as SearchUser[] | { error?: string };

        if (!res.ok) {
          throw new Error(
            "error" in data ? data.error || "No se pudo buscar usuarios" : "No se pudo buscar usuarios"
          );
        }

        onResultadosChange(Array.isArray(data) ? data : []);
        setSearchedQuery(cleanQuery);
      } catch (err) {
        if (controller.signal.aborted) {
          return;
        }
        setError(err instanceof Error ? err.message : "No se pudo buscar usuarios");
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [cleanQuery, usuario.id, onResultadosChange]);

  const handleQueryChange = (value: string) => {
    onQueryChange(value);

    if (!value.trim()) {
      onResultadosChange([]);
      setSearchedQuery("");
      setLoading(false);
      setError("");
    }
  };

  const clearQuery = () => {
    handleQueryChange("");
    inputRef.current?.focus();
  };

  const updateRecentSearches = (next: RecentSearchUser[]) => {
    setRecentSearches(next);
    writeRecentSearches(usuario.id, next);
  };

  const openUser = (user: RecentSearchUser) => {
    updateRecentSearches(
      [toRecentSearchUser(user), ...recentSearches.filter((item) => item.id !== user.id)].slice(
        0,
        MAX_RECENT_SEARCHES
      )
    );
    onOpenProfile(user.username);
  };

  const removeRecentSearch = (userId: number) => {
    updateRecentSearches(recentSearches.filter((item) => item.id !== userId));
  };

  const clearRecentSearches = () => {
    updateRecentSearches([]);
  };

  return (
    <main className="page-shell">
      <section className="page-hero">
        <h1>Busca Usuarios</h1>
      </section>

      <section className="search-panel" role="search">
        <div className="search-input-wrap">
          <svg className="search-input-icon" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            ref={inputRef}
            className="field search-input"
            type="search"
            name="gm-search-query"
            placeholder="Buscar"
            aria-label="Buscar usuarios"
            value={query}
            onChange={(event) => handleQueryChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape" && query) {
                event.preventDefault();
                clearQuery();
              }
            }}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            enterKeyHint="search"
            data-1p-ignore="true"
            data-lpignore="true"
            data-bwignore="true"
            data-form-type="other"
          />
          {query ? (
            <button
              type="button"
              className="search-input-clear"
              onClick={clearQuery}
              aria-label="Borrar búsqueda"
              title="Borrar búsqueda"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M7 7 17 17M17 7 7 17" />
              </svg>
            </button>
          ) : null}
        </div>
      </section>

      {error ? <div className="status error">{error}</div> : null}

      {isSearchEmpty ? (
        recentSearches.length > 0 ? (
          <section className="search-recents">
            <div className="search-recents-head">
              <h2>Recientes</h2>
              <button type="button" className="search-recents-clear" onClick={clearRecentSearches}>
                Borrar todo
              </button>
            </div>
            <div className="user-list">
              {recentSearches.map((item) => (
                <SearchUserRow
                  key={item.id}
                  user={item}
                  onOpen={() => openUser(item)}
                  onRemove={() => removeRecentSearch(item.id)}
                />
              ))}
            </div>
          </section>
        ) : (
          <section className="search-empty-illustration" aria-hidden="true">
            <img src={searchEmptyBodybuilders} alt="" />
          </section>
        )
      ) : (
        <section className="user-list" aria-busy={loading}>
          {resultados.map((item) => (
            <SearchUserRow key={item.id} user={item} onOpen={() => openUser(item)} />
          ))}
          {showNoResults ? (
            <p className="search-no-results">No encontramos usuarios para “{cleanQuery}”.</p>
          ) : null}
        </section>
      )}
    </main>
  );
}

export default Buscar;
