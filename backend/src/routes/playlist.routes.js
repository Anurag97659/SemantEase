import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import {
  addWordsToPlaylist,
  createPlaylist,
  getPlaylistById,
  getPlaylists,
} from "../controllers/playlist.controllers.js";

const router = Router();

router.use(verifyJWT);
router.route("/").get(getPlaylists).post(createPlaylist);
router.route("/:id").get(getPlaylistById);
router.route("/:id/words").post(addWordsToPlaylist);

export default router;
