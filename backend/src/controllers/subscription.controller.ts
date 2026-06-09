import crypto from "crypto";
import { Request, Response } from "express";
import {
  cancelUserSubscription,
  createCheckout,
  getUserSubscription,
  processPaymentNotification,
  processPreapprovalNotification,
  SubscriptionPlanId,
} from "../services/subscription.service";

const planIds: SubscriptionPlanId[] = ["monthly", "yearly", "lifetime"];

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Ocurrio un error inesperado";

export const getMySubscription = async (req: Request, res: Response) => {
  try {
    return res.json(await getUserSubscription(req.authUser!.id));
  } catch (error) {
    console.error("ERROR GET SUBSCRIPTION:", error);
    return res.status(500).json({ error: errorMessage(error) });
  }
};

export const startCheckout = async (req: Request, res: Response) => {
  try {
    const plan = String(req.body?.plan || "") as SubscriptionPlanId;
    if (!planIds.includes(plan)) {
      return res.status(400).json({ error: "Plan invalido" });
    }

    const checkout = await createCheckout(
      { id: req.authUser!.id, email: req.authUser!.email },
      plan,
    );

    if (!checkout.checkoutUrl) {
      return res.status(502).json({ error: "Mercado Pago no devolvio la URL de pago" });
    }

    return res.status(201).json(checkout);
  } catch (error) {
    console.error("ERROR CREATE CHECKOUT:", error);
    const message = errorMessage(error);
    return res.status(message.includes("ya tiene") ? 409 : 500).json({ error: message });
  }
};

const secureEquals = (left: string, right: string) => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

const validWebhookSignature = (req: Request, dataId: string) => {
  const secret = process.env.MP_WEBHOOK_SECRET?.trim();
  const signature = req.header("x-signature");
  const requestId = req.header("x-request-id");
  if (!secret || !signature || !requestId) {
    return false;
  }

  const parts = Object.fromEntries(
    signature.split(",").map((part) => {
      const [key, ...value] = part.trim().split("=");
      return [key, value.join("=")];
    }),
  );
  const timestamp = parts.ts;
  const receivedHash = parts.v1;
  if (!timestamp || !receivedHash) {
    return false;
  }

  const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${timestamp};`;
  const expectedHash = crypto.createHmac("sha256", secret).update(manifest).digest("hex");
  return secureEquals(expectedHash, receivedHash);
};

export const mercadoPagoWebhook = async (req: Request, res: Response) => {
  const dataId = String(req.query["data.id"] || req.body?.data?.id || "");
  const type = String(req.query.type || req.body?.type || "");

  if (!dataId || !validWebhookSignature(req, dataId)) {
    return res.status(401).json({ error: "Firma de webhook invalida" });
  }

  const eventId = String(req.body?.id || req.header("x-request-id") || crypto.randomUUID());
  const action = String(req.body?.action || "updated");
  const eventKey = `${type}:${eventId}:${action}`;

  try {
    if (type === "payment") {
      await processPaymentNotification(dataId, eventKey, req.body);
    } else if (type === "subscription_preapproval" || type === "preapproval") {
      await processPreapprovalNotification(dataId, eventKey, req.body);
    }

    return res.sendStatus(200);
  } catch (error) {
    console.error("ERROR MERCADO PAGO WEBHOOK:", error);
    return res.status(500).json({ error: "No se pudo procesar la notificacion" });
  }
};

export const cancelSubscription = async (req: Request, res: Response) => {
  try {
    return res.json(await cancelUserSubscription(req.authUser!.id));
  } catch (error) {
    console.error("ERROR CANCEL SUBSCRIPTION:", error);
    return res.status(400).json({ error: errorMessage(error) });
  }
};
