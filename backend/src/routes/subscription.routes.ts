import { Router } from "express";
import {
  cancelSubscription,
  getMySubscription,
  mercadoPagoWebhook,
  startCheckout,
} from "../controllers/subscription.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { requirePro } from "../middleware/pro.middleware";
import {
  getMyMuscleDistribution,
  getMyWeeklyEvolution,
} from "../controllers/pro-stats.controller";

const router = Router();

router.post("/webhook/mercadopago", mercadoPagoWebhook);
router.get("/me", requireAuth, getMySubscription);
router.get("/stats/evolution", requireAuth, requirePro, getMyWeeklyEvolution);
router.get(
  "/stats/muscle-distribution",
  requireAuth,
  requirePro,
  getMyMuscleDistribution,
);
router.post("/checkout", requireAuth, startCheckout);
router.post("/cancel", requireAuth, cancelSubscription);

export default router;
