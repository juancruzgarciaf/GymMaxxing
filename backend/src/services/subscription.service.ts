import crypto from "crypto";
import { pool } from "../db";

export type SubscriptionPlanId = "monthly" | "yearly" | "lifetime";

type MercadoPagoResponse = {
  id?: string | number;
  init_point?: string;
  sandbox_init_point?: string;
  status?: string;
  external_reference?: string;
  currency_id?: string;
  transaction_amount?: number;
  next_payment_date?: string;
  auto_recurring?: {
    currency_id?: string;
    transaction_amount?: number;
  };
};

type SubscriptionRow = {
  id_suscripcion: number;
  usuario_id: number;
  plan: SubscriptionPlanId;
  estado: string;
  external_reference: string;
  mp_preapproval_id: string | null;
  mp_preference_id: string | null;
  mp_payment_id: string | null;
  moneda: string;
  monto: string | number;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  fecha_cancelacion: string | null;
};

const API_URL = "https://api.mercadopago.com";

const amountFromEnv = (key: string, fallback: number) => {
  const value = Number(process.env[key] ?? fallback);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${key} debe ser un monto mayor a cero`);
  }
  return value;
};

export const getPlans = () => ({
  monthly: {
    id: "monthly" as const,
    name: "Mensual",
    amount: amountFromEnv("MP_MONTHLY_PRICE", 2.99),
    frequency: 1,
  },
  yearly: {
    id: "yearly" as const,
    name: "Anual",
    amount: amountFromEnv("MP_YEARLY_PRICE", 23.99),
    frequency: 12,
  },
  lifetime: {
    id: "lifetime" as const,
    name: "Para Siempre",
    amount: amountFromEnv("MP_LIFETIME_PRICE", 74.99),
    frequency: null,
  },
});

const getAccessToken = () => {
  const accessToken = process.env.MP_ACCESS_TOKEN?.trim();
  if (!accessToken) {
    throw new Error("Falta configurar MP_ACCESS_TOKEN en backend/.env");
  }
  return accessToken;
};

const getPayerEmail = (userEmail: string) => {
  const testMode = process.env.MP_TEST_MODE?.trim().toLowerCase() === "true";
  if (!testMode) {
    return userEmail;
  }

  const testPayerEmail = process.env.MP_TEST_PAYER_EMAIL?.trim();
  if (!testPayerEmail) {
    throw new Error(
      "Falta configurar MP_TEST_PAYER_EMAIL con el email del comprador de prueba",
    );
  }

  return testPayerEmail;
};

const mercadoPagoRequest = async (
  path: string,
  options: { method?: "GET" | "POST" | "PUT"; body?: unknown } = {},
) => {
  const response = await fetch(`${API_URL}${path}`, {
    method: options.method ?? "GET",
    headers: {
      Authorization: `Bearer ${getAccessToken()}`,
      "Content-Type": "application/json",
      ...((options.method === "POST" || options.method === "PUT")
        ? { "X-Idempotency-Key": crypto.randomUUID() }
        : {}),
    },
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
  });

  const data = (await response.json()) as MercadoPagoResponse & {
    message?: string;
    error?: string;
  };

  if (!response.ok) {
    throw new Error(data.message || data.error || "Mercado Pago rechazo la solicitud");
  }

  return data;
};

const optionalNotificationUrl = () => {
  const url = process.env.MP_WEBHOOK_URL?.trim();
  return url ? { notification_url: url } : {};
};

const serializeSubscription = (row?: SubscriptionRow) => {
  if (!row) {
    return {
      isPro: false,
      subscription: null,
    };
  }

  return {
    isPro: row.estado === "active",
    subscription: {
      id: row.id_suscripcion,
      plan: row.plan,
      status: row.estado,
      currency: row.moneda,
      amount: Number(row.monto),
      startsAt: row.fecha_inicio,
      endsAt: row.fecha_fin,
      cancelledAt: row.fecha_cancelacion,
    },
  };
};

export const getUserSubscription = async (userId: number) => {
  const result = await pool.query<SubscriptionRow>(
    `SELECT *
     FROM suscripcion
     WHERE usuario_id = $1
     ORDER BY
       CASE estado WHEN 'active' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END,
       fecha_creacion DESC
     LIMIT 1`,
    [userId],
  );

  return serializeSubscription(result.rows[0]);
};

export const isUserPro = async (userId: number) => {
  const result = await pool.query(
    `SELECT 1
     FROM suscripcion
     WHERE usuario_id = $1
       AND estado = 'active'
       AND (plan = 'lifetime' OR fecha_fin IS NULL OR fecha_fin > NOW())
     LIMIT 1`,
    [userId],
  );

  return result.rowCount === 1;
};

const isMockPaymentEnabled = () =>
  process.env.MP_MOCK_PAYMENTS?.trim().toLowerCase() === "true";

const activateMockSubscription = async (
  subscriptionId: number,
  planId: SubscriptionPlanId,
) => {
  const endDateSql =
    planId === "monthly"
      ? "NOW() + INTERVAL '1 month'"
      : planId === "yearly"
        ? "NOW() + INTERVAL '1 year'"
        : "NULL";

  await pool.query(
    `UPDATE suscripcion
     SET estado = 'active',
         fecha_inicio = NOW(),
         fecha_fin = ${endDateSql},
         fecha_cancelacion = NULL,
         fecha_actualizacion = NOW()
     WHERE id_suscripcion = $1`,
    [subscriptionId],
  );
};

export const createCheckout = async (
  user: { id: number; email: string },
  planId: SubscriptionPlanId,
) => {
  const plans = getPlans();
  const plan = plans[planId];
  const currency = (process.env.MP_CURRENCY || "USD").trim().toUpperCase();
  const frontendUrl = (process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/$/, "");
  const externalReference = `gymmaxxing-pro-${user.id}-${crypto.randomUUID()}`;
  const payerEmail = getPayerEmail(user.email);

  if (await isUserPro(user.id)) {
    throw new Error("El usuario ya tiene GymMaxxing PRO activo");
  }

  const inserted = await pool.query<{ id_suscripcion: number }>(
    `INSERT INTO suscripcion
       (usuario_id, plan, estado, external_reference, moneda, monto)
     VALUES ($1, $2, 'pending', $3, $4, $5)
     RETURNING id_suscripcion`,
    [user.id, plan.id, externalReference, currency, plan.amount],
  );
  const subscriptionId = inserted.rows[0]?.id_suscripcion;

  if (!subscriptionId) {
    throw new Error("No se pudo registrar el intento de suscripcion");
  }

  try {
    if (plan.id === "lifetime") {
      const preference = await mercadoPagoRequest("/checkout/preferences", {
        method: "POST",
        body: {
          items: [
            {
              id: "gymmaxxing-pro-lifetime",
              title: "GymMaxxing PRO - Para Siempre",
              quantity: 1,
              currency_id: currency,
              unit_price: plan.amount,
            },
          ],
          payer: { email: payerEmail },
          external_reference: externalReference,
          metadata: {
            gymmaxxing_subscription_id: subscriptionId,
            gymmaxxing_user_id: user.id,
            plan: plan.id,
          },
          back_urls: {
            success: `${frontendUrl}/pro?payment=success`,
            pending: `${frontendUrl}/pro?payment=pending`,
            failure: `${frontendUrl}/pro?payment=failure`,
          },
          auto_return: "approved",
          ...optionalNotificationUrl(),
        },
      });

      await pool.query(
        `UPDATE suscripcion
         SET mp_preference_id = $1, fecha_actualizacion = NOW()
         WHERE id_suscripcion = $2`,
        [String(preference.id), subscriptionId],
      );

      const mockActivated = isMockPaymentEnabled();
      if (mockActivated) {
        await activateMockSubscription(subscriptionId, plan.id);
      }

      return {
        checkoutUrl: preference.init_point || preference.sandbox_init_point,
        subscriptionId,
        mockActivated,
      };
    }

    const preapproval = await mercadoPagoRequest("/preapproval", {
      method: "POST",
      body: {
        reason: `GymMaxxing PRO - Plan ${plan.name}`,
        external_reference: externalReference,
        payer_email: payerEmail,
        auto_recurring: {
          frequency: plan.frequency,
          frequency_type: "months",
          transaction_amount: plan.amount,
          currency_id: currency,
        },
        back_url: `${frontendUrl}/pro?payment=return`,
        status: "pending",
        ...optionalNotificationUrl(),
      },
    });

    await pool.query(
      `UPDATE suscripcion
       SET mp_preapproval_id = $1, fecha_actualizacion = NOW()
       WHERE id_suscripcion = $2`,
      [String(preapproval.id), subscriptionId],
    );

    const mockActivated = isMockPaymentEnabled();
    if (mockActivated) {
      await activateMockSubscription(subscriptionId, plan.id);
    }

    return {
      checkoutUrl: preapproval.init_point,
      subscriptionId,
      mockActivated,
    };
  } catch (error) {
    await pool.query(
      `UPDATE suscripcion
       SET estado = 'payment_failed', fecha_actualizacion = NOW()
       WHERE id_suscripcion = $1`,
      [subscriptionId],
    );
    throw error;
  }
};

const findByExternalReference = async (externalReference: string) => {
  const result = await pool.query<SubscriptionRow>(
    "SELECT * FROM suscripcion WHERE external_reference = $1 LIMIT 1",
    [externalReference],
  );
  return result.rows[0];
};

const saveEvent = async (key: string, type: string, resourceId: string, payload: unknown) => {
  const result = await pool.query(
    `INSERT INTO evento_pago (clave_evento, tipo, recurso_id, payload)
     VALUES ($1, $2, $3, $4::jsonb)
     ON CONFLICT (clave_evento) DO NOTHING`,
    [key, type, resourceId, JSON.stringify(payload)],
  );
  return result.rowCount === 1;
};

export const processPaymentNotification = async (
  resourceId: string,
  eventKey: string,
  payload: unknown,
) => {
  const payment = await mercadoPagoRequest(`/v1/payments/${encodeURIComponent(resourceId)}`);
  if (!payment.external_reference) {
    return;
  }

  const subscription = await findByExternalReference(payment.external_reference);
  if (!subscription || subscription.plan !== "lifetime") {
    return;
  }

  const eventIsNew = await saveEvent(eventKey, "payment", resourceId, payload);
  if (!eventIsNew) {
    return;
  }

  const expectedAmount = Number(subscription.monto);
  const amountMatches = Math.abs(Number(payment.transaction_amount) - expectedAmount) < 0.01;
  const currencyMatches = payment.currency_id === subscription.moneda;
  const nextStatus =
    payment.status === "approved" && amountMatches && currencyMatches
      ? "active"
      : payment.status === "pending" || payment.status === "in_process"
        ? "pending"
        : "payment_failed";

  await pool.query(
    `UPDATE suscripcion
     SET estado = $1,
         mp_payment_id = $2,
         fecha_inicio = CASE WHEN $1 = 'active' THEN COALESCE(fecha_inicio, NOW()) ELSE fecha_inicio END,
         fecha_fin = NULL,
         fecha_actualizacion = NOW()
     WHERE id_suscripcion = $3`,
    [nextStatus, resourceId, subscription.id_suscripcion],
  );
};

export const processPreapprovalNotification = async (
  resourceId: string,
  eventKey: string,
  payload: unknown,
) => {
  const preapproval = await mercadoPagoRequest(`/preapproval/${encodeURIComponent(resourceId)}`);
  if (!preapproval.external_reference) {
    return;
  }

  const subscription = await findByExternalReference(preapproval.external_reference);
  if (!subscription || subscription.plan === "lifetime") {
    return;
  }

  const eventIsNew = await saveEvent(eventKey, "subscription_preapproval", resourceId, payload);
  if (!eventIsNew) {
    return;
  }

  const amountMatches =
    Math.abs(Number(preapproval.auto_recurring?.transaction_amount) - Number(subscription.monto)) < 0.01;
  const currencyMatches = preapproval.auto_recurring?.currency_id === subscription.moneda;
  const statuses: Record<string, string> = {
    authorized: "active",
    paused: "paused",
    cancelled: "cancelled",
    canceled: "cancelled",
    pending: "pending",
  };
  const nextStatus =
    amountMatches && currencyMatches
      ? statuses[preapproval.status || ""] || "payment_failed"
      : "payment_failed";

  await pool.query(
    `UPDATE suscripcion
     SET estado = $1,
         mp_preapproval_id = $2,
         fecha_inicio = CASE WHEN $1 = 'active' THEN COALESCE(fecha_inicio, NOW()) ELSE fecha_inicio END,
         fecha_fin = NULL,
         fecha_cancelacion = CASE WHEN $1 = 'cancelled' THEN NOW() ELSE fecha_cancelacion END,
         fecha_actualizacion = NOW()
     WHERE id_suscripcion = $3`,
    [
      nextStatus,
      resourceId,
      subscription.id_suscripcion,
    ],
  );
};

export const cancelUserSubscription = async (userId: number) => {
  const result = await pool.query<SubscriptionRow>(
    `SELECT *
     FROM suscripcion
     WHERE usuario_id = $1 AND estado = 'active'
     ORDER BY fecha_creacion DESC
     LIMIT 1`,
    [userId],
  );
  const subscription = result.rows[0];

  if (!subscription) {
    throw new Error("No hay una suscripcion activa");
  }
  if (subscription.plan === "lifetime") {
    throw new Error("El plan Para Siempre no es una suscripcion recurrente");
  }
  const mockPayment = isMockPaymentEnabled();

  if (!mockPayment && !subscription.mp_preapproval_id) {
    throw new Error("La suscripcion no tiene un identificador de Mercado Pago");
  }

  if (!mockPayment) {
    await mercadoPagoRequest(
      `/preapproval/${encodeURIComponent(subscription.mp_preapproval_id!)}`,
      {
        method: "PUT",
        body: { status: "cancelled" },
      },
    );
  }

  await pool.query(
    `UPDATE suscripcion
     SET estado = 'cancelled', fecha_cancelacion = NOW(), fecha_actualizacion = NOW()
     WHERE id_suscripcion = $1`,
    [subscription.id_suscripcion],
  );

  return getUserSubscription(userId);
};
