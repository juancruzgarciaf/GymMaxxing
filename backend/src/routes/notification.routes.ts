import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware";
import {
  getNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  getNotificationPreferences,
  updateNotificationPreferences,
  sendTestNotificationEmail,
} from "../controllers/notification.controller";

const router = Router();

router.get("/", requireAuth, getNotifications);
router.get("/preferences", requireAuth, getNotificationPreferences);
router.post("/test-email", requireAuth, sendTestNotificationEmail);
router.put("/preferences", requireAuth, updateNotificationPreferences);
router.patch("/read-all", requireAuth, markAllNotificationsAsRead);
router.patch("/:id/read", requireAuth, markNotificationAsRead);

export default router;
