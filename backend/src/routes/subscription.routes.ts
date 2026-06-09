import { Router } from "express";
import {
  cancelSubscription,
  getMySubscription,
  mercadoPagoWebhook,
  startCheckout,
} from "../controllers/subscription.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

router.post("/webhook/mercadopago", mercadoPagoWebhook);
router.get("/me", requireAuth, getMySubscription);
router.post("/checkout", requireAuth, startCheckout);
router.post("/cancel", requireAuth, cancelSubscription);

export default router;
