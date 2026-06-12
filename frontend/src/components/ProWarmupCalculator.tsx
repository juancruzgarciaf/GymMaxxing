import { useMemo, useState } from "react";
import "./ProWarmupCalculator.css";

type WarmupSet = {
  percentage: number;
  weight: number;
  repetitions: number;
  restSeconds: number;
};

const warmupSteps = [
  { percentage: 40, repetitions: 8, restSeconds: 60 },
  { percentage: 60, repetitions: 5, restSeconds: 75 },
  { percentage: 75, repetitions: 3, restSeconds: 90 },
  { percentage: 90, repetitions: 1, restSeconds: 120 },
];

const roundToIncrement = (weight: number, increment: number) =>
  Math.round(weight / increment) * increment;

const formatWeight = (weight: number) =>
  new Intl.NumberFormat("es-AR", {
    maximumFractionDigits: 2,
  }).format(weight);

const formatRest = (seconds: number) =>
  seconds >= 60
    ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")} min`
    : `${seconds} seg`;

function ProWarmupCalculator() {
  const [targetWeight, setTargetWeight] = useState(100);
  const [minimumWeight, setMinimumWeight] = useState(20);
  const [increment, setIncrement] = useState(2.5);

  const warmupSets = useMemo(() => {
    if (targetWeight <= 0 || increment <= 0 || minimumWeight < 0) {
      return [];
    }

    const sets: WarmupSet[] = [];
    const firstWeight = Math.min(minimumWeight, targetWeight);

    if (firstWeight > 0 && firstWeight < targetWeight) {
      sets.push({
        percentage: Math.round((firstWeight / targetWeight) * 100),
        weight: firstWeight,
        repetitions: 10,
        restSeconds: 45,
      });
    }

    warmupSteps.forEach((step) => {
      const calculatedWeight = Math.max(
        minimumWeight,
        roundToIncrement((targetWeight * step.percentage) / 100, increment),
      );

      if (
        calculatedWeight <= 0 ||
        calculatedWeight >= targetWeight ||
        sets.some((set) => set.weight === calculatedWeight)
      ) {
        return;
      }

      sets.push({ ...step, weight: calculatedWeight });
    });

    return sets.sort((a, b) => a.weight - b.weight);
  }, [increment, minimumWeight, targetWeight]);

  const isValid =
    targetWeight > 0 &&
    minimumWeight >= 0 &&
    increment > 0 &&
    minimumWeight < targetWeight;

  return (
    <section className="pro-warmup-calculator">
      <header className="pro-warmup-header">
        <div>
          <p className="eyebrow">Preparacion inteligente</p>
          <h2>Calculadora de calentamiento</h2>
          <p>
            Genera series de aproximacion para llegar al peso de trabajo sin
            fatigarte antes de empezar.
          </p>
        </div>
        <div className="pro-warmup-target">
          <span>Serie efectiva</span>
          <strong>{formatWeight(targetWeight)} kg</strong>
        </div>
      </header>

      <div className="pro-warmup-layout">
        <div className="pro-warmup-form">
          <label>
            <span>Peso objetivo</span>
            <div className="pro-number-field">
              <input
                type="number"
                min="1"
                step="0.5"
                value={targetWeight}
                onChange={(event) => setTargetWeight(Number(event.target.value))}
              />
              <small>kg</small>
            </div>
          </label>

          <label>
            <span>Peso inicial o barra</span>
            <div className="pro-number-field">
              <input
                type="number"
                min="0"
                step="0.5"
                value={minimumWeight}
                onChange={(event) => setMinimumWeight(Number(event.target.value))}
              />
              <small>kg</small>
            </div>
          </label>

          <label>
            <span>Incremento disponible</span>
            <select
              className="field"
              value={increment}
              onChange={(event) => setIncrement(Number(event.target.value))}
            >
              <option value={1}>1 kg</option>
              <option value={2}>2 kg</option>
              <option value={2.5}>2.5 kg</option>
              <option value={5}>5 kg</option>
            </select>
          </label>

          <div className="pro-warmup-tip">
            <strong>Como se calcula</strong>
            <p>
              Los saltos suben progresivamente y las repeticiones bajan para
              preparar el movimiento sin acumular fatiga.
            </p>
          </div>
        </div>

        <div className="pro-warmup-result">
          {!isValid ? (
            <div className="pro-warmup-empty">
              El peso objetivo debe ser mayor que el peso inicial.
            </div>
          ) : (
            <>
              <div className="pro-warmup-result-heading">
                <div>
                  <span>Plan sugerido</span>
                  <strong>{warmupSets.length} series de aproximacion</strong>
                </div>
                <small>Antes de tus series efectivas</small>
              </div>

              <ol className="pro-warmup-sets">
                {warmupSets.map((set, index) => (
                  <li key={`${set.weight}-${set.repetitions}`}>
                    <span className="pro-warmup-order">{index + 1}</span>
                    <div>
                      <strong>{formatWeight(set.weight)} kg</strong>
                      <small>{set.percentage}% del peso objetivo</small>
                    </div>
                    <div className="pro-warmup-set-data">
                      <span>
                        {set.repetitions} {set.repetitions === 1 ? "rep" : "reps"}
                      </span>
                      <small>{formatRest(set.restSeconds)}</small>
                    </div>
                  </li>
                ))}
                <li className="effective">
                  <span className="pro-warmup-order">✓</span>
                  <div>
                    <strong>{formatWeight(targetWeight)} kg</strong>
                    <small>Peso objetivo</small>
                  </div>
                  <div className="pro-warmup-set-data">
                    <span>Serie efectiva</span>
                    <small>Listo para entrenar</small>
                  </div>
                </li>
              </ol>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

export default ProWarmupCalculator;
