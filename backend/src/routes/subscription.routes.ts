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
  getMyExerciseProgress,
  getMyMuscleDistribution,
  getMyTrainedExercises,
  getMyWeeklyEvolution,
} from "../controllers/pro-stats.controller";
import {
  getMyBodyMeasurements,
  removeMyBodyMeasurement,
  upsertMyBodyMeasurement,
} from "../controllers/body-measurement.controller";

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
router.get("/stats/exercises", requireAuth, requirePro, getMyTrainedExercises);
router.get(
  "/stats/exercise-progress",
  requireAuth,
  requirePro,
  getMyExerciseProgress,
);
router.get("/body-measurements", requireAuth, requirePro, getMyBodyMeasurements);
router.post("/body-measurements", requireAuth, requirePro, upsertMyBodyMeasurement);
router.delete("/body-measurements/:id", requireAuth, requirePro, removeMyBodyMeasurement);
router.post("/checkout", requireAuth, startCheckout);
router.post("/cancel", requireAuth, cancelSubscription);

export default router;
