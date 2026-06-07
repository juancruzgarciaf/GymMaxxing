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

const benefits = [
  {
    title: "Rutinas ilimitadas",
    description: "Crea y organiza todas las rutinas que necesites.",
  },
  {
    title: "Ejercicios personalizados ilimitados",
    description: "Arma una biblioteca de ejercicios completamente tuya.",
  },
  {
    title: "Estadisticas avanzadas",
    description: "Analiza tu progreso, volumen y rendimiento con mas detalle.",
  },
  {
    title: "Seguimiento de medidas corporales",
    description: "Registra cambios fisicos y acompana tu evolucion.",
  },
  {
    title: "Historial completo de entrenamientos",
    description: "Consulta todas tus sesiones sin limites.",
  },
  {
    title: "Calculadora de calentamiento",
    description: "Prepara tus series de aproximacion de manera practica.",
  },
  {
    title: "Soporte al desarrollo del proyecto",
    description: "Ayuda a que GymMaxxing siga creciendo y mejorando.",
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
            <p className="eyebrow">Todo incluido</p>
            <h2>Mas herramientas para avanzar</h2>
            <p>Entrena, registra y analiza tu progreso sin limites.</p>
          </div>

          <div className="pro-benefit-grid">
            {benefits.map((benefit) => (
              <article className="pro-benefit-card" key={benefit.title}>
                <span className="pro-benefit-icon">
                  <CheckIcon />
                </span>
                <div>
                  <h3>{benefit.title}</h3>
                  <p>{benefit.description}</p>
                </div>
              </article>
            ))}
          </div>
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
