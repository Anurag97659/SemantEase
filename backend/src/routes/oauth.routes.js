import { Router } from "express";
import {
  googleRedirect,
  googleCallback,
  microsoftRedirect,
  microsoftCallback,
} from "../controllers/oauth.controllers.js";

const router = Router();

router.get("/google", googleRedirect);
router.get("/google/callback", googleCallback);

router.get("/microsoft", microsoftRedirect);
router.get("/microsoft/callback", microsoftCallback);

export default router;
