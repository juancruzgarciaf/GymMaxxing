import { useState } from "react";

type ProfileTrainingSearchProps = {
  query: string;
  minDuration: string;
  maxDuration: string;
  availableGroups: string[];
  availableDisciplines: string[];
  selectedGroups: string[];
  selectedDisciplines: string[];
  loading: boolean;
  resultsCount: number;
  onQueryChange: (value: string) => void;
  onMinDurationChange: (value: string) => void;
  onMaxDurationChange: (value: string) => void;
  onToggleGroup: (group: string) => void;
  onToggleDiscipline: (discipline: string) => void;
  onApply: () => void | Promise<void>;
  onClear: () => void | Promise<void>;
};

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle
        cx="10.5"
        cy="10.5"
        r="5.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M15 15L20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ProfileTrainingSearch({
  query,
  minDuration,
  maxDuration,
  availableGroups,
  availableDisciplines,
  selectedGroups,
  selectedDisciplines,
  loading,
  resultsCount,
  onQueryChange,
  onMinDurationChange,
  onMaxDurationChange,
  onToggleGroup,
  onToggleDiscipline,
  onApply,
  onClear,
}: ProfileTrainingSearchProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <section className={`box profile-training-search ${expanded ? "expanded" : ""}`}>
      <div className="profile-training-search-head">
        <div>
          <h2>Buscar entrenamiento propio</h2>
          <p className="helper-text">Filtra por nombre, grupo muscular, equipamiento o duracion.</p>
        </div>
        <div className="profile-training-search-actions">
          {expanded ? <span>{loading ? "Buscando..." : `${resultsCount} resultado(s)`}</span> : null}
          <button
            type="button"
            className={`social-action icon-only profile-training-search-toggle ${expanded ? "active" : ""}`}
            onClick={() => setExpanded((prev) => !prev)}
            aria-label={expanded ? "Ocultar buscador" : "Mostrar buscador"}
            aria-expanded={expanded}
            title={expanded ? "Ocultar buscador" : "Buscar entrenamientos"}
          >
            <SearchIcon />
          </button>
        </div>
      </div>

      {expanded ? (
        <>
          <div className="profile-training-search-grid">
            <input
              className="field"
              placeholder="Nombre del entrenamiento o ejercicio"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  void onApply();
                }
              }}
            />
            <input
              className="field"
              type="number"
              min="0"
              placeholder="Duracion min. (min)"
              value={minDuration}
              onChange={(event) => onMinDurationChange(event.target.value)}
            />
            <input
              className="field"
              type="number"
              min="0"
              placeholder="Duracion max. (min)"
              value={maxDuration}
              onChange={(event) => onMaxDurationChange(event.target.value)}
            />
            <button type="button" className="btn" onClick={() => void onApply()} disabled={loading}>
              Aplicar
            </button>
            <button type="button" className="btn secondary" onClick={() => void onClear()} disabled={loading}>
              Limpiar
            </button>
          </div>

          <div className="profile-training-filter-block">
            <span className="profile-training-filter-label">Grupo muscular</span>
            <div className="muscle-chips profile-training-muscles">
              {availableGroups.length === 0 ? (
                <span className="helper-text">No hay grupos musculares para filtrar.</span>
              ) : (
                availableGroups.map((group) => (
                  <button
                    type="button"
                    key={group}
                    className={`muscle-chip-btn ${selectedGroups.includes(group) ? "active" : ""}`}
                    onClick={() => onToggleGroup(group)}
                  >
                    {group}
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="profile-training-filter-block">
            <span className="profile-training-filter-label">Equipamiento</span>
            <div className="muscle-chips profile-training-muscles">
              {availableDisciplines.length === 0 ? (
                <span className="helper-text">No hay equipamiento para filtrar.</span>
              ) : (
                availableDisciplines.map((discipline) => (
                  <button
                    type="button"
                    key={discipline}
                    className={`muscle-chip-btn ${selectedDisciplines.includes(discipline) ? "active" : ""}`}
                    onClick={() => onToggleDiscipline(discipline)}
                  >
                    {discipline}
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}

export default ProfileTrainingSearch;
