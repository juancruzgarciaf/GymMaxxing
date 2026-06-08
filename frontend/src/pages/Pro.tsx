import { useState } from "react";

type PlanId = "monthly" | "yearly" | "lifetime";

type Plan = {
  id: PlanId;
  name: string;
  price: number;
  priceText: string;
  description: string;
  badge?: string;
};

const plans: Plan[] = [
  {
    id: "monthly",
    name: "Mensual",
    price: 2.99,
    priceText: "USD 2.99",
    description: "Facturado mensualmente",
  },
  {
    id: "yearly",
    name: "Anual",
    price: 23.99,
    priceText: "USD 23.99",
    description: "Facturado anualmente",
    badge: "Ahorra 33%",
  },
  {
    id: "lifetime",
    name: "Para Siempre",
    price: 74.99,
    priceText: "USD 74.99",
    description: "Paga una sola vez",
  },
];

const planComparison = [
  {
    feature: "Ejercicios personalizados",
    common: "Hasta 10 ejercicios",
    pro: "Ejercicios ilimitados",
  },
  {
    feature: "Estadisticas avanzadas",
    common: "Resumen general",
    pro: "Graficos mensuales y comparaciones",
  },
  {
    feature: "Progreso por ejercicio",
    common: "Ultimos registros",
    pro: "Evolucion de peso, reps y volumen",
  },
  {
    feature: "Medidas corporales",
    common: "No incluido",
    pro: "Seguimiento completo",
  },
  {
    feature: "Historial de entrenamientos",
    common: "Ultimos 90 dias",
    pro: "Historial completo",
  },
  {
    feature: "Calculadora de calentamiento",
    common: "No incluido",
    pro: "Incluida",
  },
];

type ProProps = {
  onClose: () => void;
};

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m5 12 4 4L19 6" />
    </svg>
  );
}

function MinusIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 12h12" />
    </svg>
  );
}

function Pro({ onClose }: ProProps) {
  const [selectedPlanId, setSelectedPlanId] = useState<PlanId>("yearly");
  const [discountCode, setDiscountCode] = useState("");
  const [message, setMessage] = useState("");

  const selectedPlan = plans.find((plan) => plan.id === selectedPlanId) ?? plans[1];

  const handleGoToPayment = (plan: Plan) => {
    console.log("Plan seleccionado para futuro pago:", plan);
    setMessage(`Proximamente se habilitara el pago para el plan ${plan.name}.`);
  };

  const handleAddDiscount = () => {
    setMessage(
      discountCode.trim()
        ? "Los codigos de descuento estaran disponibles proximamente."
        : "Ingresa un codigo de descuento.",
    );
  };

  return (
    <main className="page-shell pro-page-shell">
      <section className="pro-hero">
        <div className="pro-hero-copy">
          <p className="eyebrow">GymMaxxing PRO</p>
          <h1>Acceso completo a GymMaxxing PRO</h1>
          <p className="subtitle">Lleva tu entrenamiento a otro nivel</p>
        </div>
        <div className="pro-mark" aria-hidden="true">
          PRO
        </div>
      </section>

      <section className="pro-layout">
        <div className="pro-benefits-panel">
          <div className="pro-section-head">
            <p className="eyebrow">Compara los planes</p>
            <h2>Plan gratuito o PRO: elige hasta donde quieres llegar</h2>
            <p>Empieza gratis y desbloquea mas control sobre tu progreso cuando lo necesites.</p>
          </div>

          <div className="pro-comparison">
            <div className="pro-comparison-head" aria-hidden="true">
              <span>Funcionalidad</span>
              <strong>Plan gratuito</strong>
              <strong className="pro-comparison-pro-title">PRO</strong>
            </div>

            {planComparison.map((item) => {
              const commonUnavailable = item.common === "No incluido";

              return (
                <article className="pro-comparison-row" key={item.feature}>
                  <h3>{item.feature}</h3>
                  <div className={`pro-comparison-value ${commonUnavailable ? "unavailable" : ""}`}>
                    <span className="pro-comparison-icon" aria-hidden="true">
                      {commonUnavailable ? <MinusIcon /> : <CheckIcon />}
                    </span>
                    <span>
                      <small>Plan gratuito</small>
                      {item.common}
                    </span>
                  </div>
                  <div className="pro-comparison-value pro-value">
                    <span>
                      <small>PRO</small>
                      {item.pro}
                    </span>
                  </div>
                </article>
              );
            })}
          </div>

          <p className="pro-support-note">
            Con PRO tambien apoyas el desarrollo y las nuevas funciones de GymMaxxing.
          </p>
        </div>

        <aside className="pro-checkout-card">
          <div className="pro-section-head">
            <p className="eyebrow">Elige tu plan</p>
            <h2>Activa tu mejor version</h2>
          </div>

          <div className="pro-plans" role="radiogroup" aria-label="Planes PRO">
            {plans.map((plan) => {
              const isSelected = selectedPlanId === plan.id;

              return (
                <button
                  type="button"
                  className={`pro-plan-card ${isSelected ? "selected" : ""}`}
                  onClick={() => {
                    setSelectedPlanId(plan.id);
                    setMessage("");
                  }}
                  role="radio"
                  aria-checked={isSelected}
                  key={plan.id}
                >
                  <span className="pro-plan-radio" aria-hidden="true" />
                  <span className="pro-plan-copy">
                    <span className="pro-plan-title-row">
                      <strong>{plan.name}</strong>
                      {plan.badge ? <small className="pro-plan-badge">{plan.badge}</small> : null}
                    </span>
                    <small>{plan.description}</small>
                  </span>
                  <span className="pro-plan-price">{plan.priceText}</span>
                </button>
              );
            })}
          </div>

          <div className="pro-discount">
            <label htmlFor="pro-discount-code">Codigo de descuento</label>
            <div className="pro-discount-row">
              <input
                id="pro-discount-code"
                className="field"
                value={discountCode}
                onChange={(event) => setDiscountCode(event.target.value)}
                placeholder="Ingresa tu codigo"
              />
              <button type="button" className="btn secondary" onClick={handleAddDiscount}>
                Anadir
              </button>
            </div>
          </div>

          {message ? (
            <p className="status ok pro-payment-message" role="status">
              {message}
            </p>
          ) : null}

          <button
            type="button"
            className="btn pro-payment-button"
            onClick={() => handleGoToPayment(selectedPlan)}
          >
            Ir a pagar - Plan {selectedPlan.name}
          </button>
          <button type="button" className="btn secondary pro-later-button" onClick={onClose}>
            Quiza mas tarde
          </button>
          <p className="pro-cancel-note">Cancela tu suscripcion en cualquier momento.</p>
        </aside>
      </section>
    </main>
  );
}

export default Pro;
