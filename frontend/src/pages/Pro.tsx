import { useEffect, useState } from "react";

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
  onExplorePro: () => void;
  authToken: string;
  onAuthExpired: () => void;
};

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m5 12 4 4L19 6" />
    </svg>
  );
}

function Pro({ onClose, onExplorePro, authToken, onAuthExpired }: ProProps) {
  const [selectedPlanId, setSelectedPlanId] = useState<PlanId>("yearly");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [isPro, setIsPro] = useState(false);

  const selectedPlan = plans.find((plan) => plan.id === selectedPlanId) ?? plans[1];

  useEffect(() => {
    let cancelled = false;

    const loadSubscription = async () => {
      try {
        const response = await fetch("http://localhost:3000/suscripciones/me", {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (response.status === 401) {
          onAuthExpired();
          return;
        }
        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as { isPro?: boolean };
        if (!cancelled) {
          setIsPro(Boolean(data.isPro));
        }
      } catch {
        // El checkout sigue disponible aunque falle esta consulta informativa.
      }
    };

    void loadSubscription();
    return () => {
      cancelled = true;
    };
  }, [authToken, onAuthExpired]);

  const handleGoToPayment = async (plan: Plan) => {
    const paymentWindow = window.open("about:blank", "_blank");
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("http://localhost:3000/suscripciones/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ plan: plan.id }),
      });
      const data = (await response.json()) as {
        checkoutUrl?: string;
        mockActivated?: boolean;
        error?: string;
      };

      if (response.status === 401) {
        paymentWindow?.close();
        onAuthExpired();
        return;
      }
      if (!response.ok || !data.checkoutUrl) {
        throw new Error(data.error || "No se pudo iniciar el pago");
      }

      if (data.mockActivated) {
        setIsPro(true);
        setMessage("Plan PRO activado en modo demostracion.");
        if (paymentWindow) {
          paymentWindow.opener = null;
          paymentWindow.location.replace(data.checkoutUrl);
        } else {
          window.location.assign(data.checkoutUrl);
        }
        return;
      }

      paymentWindow?.close();
      window.location.assign(data.checkoutUrl);
    } catch (error) {
      paymentWindow?.close();
      setMessage(error instanceof Error ? error.message : "No se pudo iniciar el pago");
    } finally {
      setLoading(false);
    }
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
                    <span>
                      <small>Plan gratuito</small>
                      {item.common}
                    </span>
                  </div>
                  <div className="pro-comparison-value pro-value">
                    <span className="pro-comparison-icon" aria-hidden="true">
                      <CheckIcon />
                    </span>
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
          {isPro ? (
            <div className="pro-success-card" role="status">
              <span className="pro-success-icon" aria-hidden="true">
                <CheckIcon />
              </span>
              <p className="eyebrow">GymMaxxing PRO activado</p>
              <h2>Gracias por tu compra</h2>
              <p>
                Ya eres parte de PRO. Tu apoyo nos ayuda a seguir mejorando GymMaxxing y
                creando nuevas herramientas para tus entrenamientos.
              </p>
              <div className="pro-success-plan">
                <span>Tu acceso</span>
                <strong>Funciones premium habilitadas</strong>
              </div>
              <button type="button" className="btn pro-payment-button" onClick={onExplorePro}>
                Explorar funciones PRO
              </button>
              <button type="button" className="btn secondary pro-later-button" onClick={onClose}>
                Volver al inicio
              </button>
            </div>
          ) : (
            <>
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
                      disabled={loading}
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

              {message ? (
                <p className="status error pro-payment-message" role="alert">
                  {message}
                </p>
              ) : null}

              <button
                type="button"
                className="btn pro-payment-button"
                onClick={() => handleGoToPayment(selectedPlan)}
                disabled={loading}
              >
                {loading ? "Preparando pago..." : `Ir a pagar - Plan ${selectedPlan.name}`}
              </button>
              <button
                type="button"
                className="btn secondary pro-later-button"
                onClick={onClose}
                disabled={loading}
              >
                Quiza mas tarde
              </button>
              <p className="pro-cancel-note">Cancela tu suscripcion en cualquier momento.</p>
            </>
          )}
        </aside>
      </section>
    </main>
  );
}

export default Pro;
