type ProfileTrainingSearchProps = {
  query: string;
  minDuration: string;
  maxDuration: string;
  availableGroups: string[];
  selectedGroups: string[];
  loading: boolean;
  resultsCount: number;
  onQueryChange: (value: string) => void;
  onMinDurationChange: (value: string) => void;
  onMaxDurationChange: (value: string) => void;
  onToggleGroup: (group: string) => void;
  onApply: () => void | Promise<void>;
  onClear: () => void | Promise<void>;
};

function ProfileTrainingSearch({
  query,
  minDuration,
  maxDuration,
  availableGroups,
  selectedGroups,
  loading,
  resultsCount,
  onQueryChange,
  onMinDurationChange,
  onMaxDurationChange,
  onToggleGroup,
  onApply,
  onClear,
}: ProfileTrainingSearchProps) {
  return (
    <section className="box profile-training-search">
      <div className="profile-training-search-head">
        <div>
          <h2>Buscar entrenamiento propio</h2>
          <p className="helper-text">Filtra por nombre, grupo muscular o duracion.</p>
        </div>
        <span>{loading ? "Buscando..." : `${resultsCount} resultado(s)`}</span>
      </div>

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
    </section>
  );
}

export default ProfileTrainingSearch;
