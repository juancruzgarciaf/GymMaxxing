import { Router } from "express";
import {
  searchUsers,
  getUserProfile,
  getFollowers,
  getFollowing,
  followUser,
  unfollowUser,
  getFeed,
  updateUser,
  getUsuarios,
  getUsuarioPorId
} from "../controllers/user.controller";

const router = Router();

router.get("/search", searchUsers);
router.get("/:id/profile", getUserProfile);
router.get("/:id/followers", getFollowers);
router.get("/:id/following", getFollowing);
router.get("/:id/feed", getFeed);
router.post("/:id/follow", followUser);
router.delete("/:id/follow", unfollowUser);
router.get("/", getUsuarios);
router.get("/:id", getUsuarioPorId);
router.put("/:id", updateUser);

export default router;
