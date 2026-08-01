import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import {
  getSocialOverview,
  searchUsers,
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  createBlend,
  getBlendById,
  getBlendWords,
  searchBlendWords,
} from "../controllers/social.controllers.js";

const router = Router();

router.route("/overview").get(verifyJWT, getSocialOverview);
router.route("/search-users").get(verifyJWT, searchUsers);
router.route("/friend-request").post(verifyJWT, sendFriendRequest);
router.route("/friend-request/:requesterId/accept").post(verifyJWT, acceptFriendRequest);
router.route("/friend-request/:requesterId/reject").post(verifyJWT, rejectFriendRequest);
router.route("/blends").post(verifyJWT, createBlend);
router.route("/blend/:blendId").get(verifyJWT, getBlendById);
router.route("/blend/:blendId/words").get(verifyJWT, getBlendWords);
router.route("/blend/:blendId/search").get(verifyJWT, searchBlendWords);

export default router;
