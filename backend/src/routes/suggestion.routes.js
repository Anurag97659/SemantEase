import { Router } from "express";
import {
  createSuggestion,
  getSuggestions,
  updateSuggestionStatus,
  deleteSuggestion,
} from "../controllers/suggestion.controllers.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(verifyJWT);
router.route("/").post(createSuggestion).get(getSuggestions);
router.route("/:id/status").patch(updateSuggestionStatus);
router.route("/:id").delete(deleteSuggestion);

export default router;
