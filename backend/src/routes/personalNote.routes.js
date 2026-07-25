import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import {
  createPersonalNote,
  getPersonalNotes,
  getPersonalNoteById,
  updatePersonalNote,
  deletePersonalNote,
} from "../controllers/personalNote.controllers.js";

const router = Router();

router.use(verifyJWT);
router.route("/").get(getPersonalNotes).post(createPersonalNote);
router.route("/:id").get(getPersonalNoteById).put(updatePersonalNote).delete(deletePersonalNote);

export default router;
