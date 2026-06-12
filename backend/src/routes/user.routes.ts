import { Router } from "express";
import { optionalAuth, requireAuth } from "../middleware/auth.middleware";
import {
  searchUsers,
  getTrends,
  getUserProfile,
  getUserProfileByUsername,
  getFollowers,
  getFollowing,
  getSuggestedUsers,
  followUser,
  unfollowUser,
  getFeed,
  searchUserTrainings,
  updateUser,
  getUsuarios,
  getUsuarioPorId
} from "../controllers/user.controller";

const router = Router();

router.get("/search", searchUsers);
router.get("/trends", getTrends);
router.get("/profile/:username", optionalAuth, getUserProfileByUsername);
router.get("/:id/profile", optionalAuth, getUserProfile);
router.get("/:id/followers", getFollowers);
router.get("/:id/following", getFollowing);
router.get("/:id/suggestions", getSuggestedUsers);
router.get("/:id/trainings/search", optionalAuth, searchUserTrainings);
router.get("/:id/feed", getFeed);
router.post("/:id/follow", followUser);
router.delete("/:id/follow", unfollowUser);
router.get("/", getUsuarios);
router.get("/:id", getUsuarioPorId);
router.put("/:id", requireAuth, updateUser);

export default router;
