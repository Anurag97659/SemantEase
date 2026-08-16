import { Router } from "express";
import {
  sendRegistrationOtp,
  registeruser,
  loginuser,
  logoutuser,
  changeCurrentPassword,
  updateDetails,
  sendEmailChangeOtp,
  changeEmail,
  refreshAccessToken,
  deleteUser,
  getUsername,
  getProfile,
  sendPasswordResetOtp,
  resetPassword,
  getSecurityQuestion
} from "../controllers/user.controllers.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";


const router = Router();
router.route("/send-registration-otp").post(sendRegistrationOtp);
router.route("/register").post(registeruser);
router.route("/login").post(loginuser);
router.route("/send-password-reset-otp").post(sendPasswordResetOtp);
router.route("/reset-password").post(resetPassword);

router.route("/question/:username").get(getSecurityQuestion);
router.route("/logout").post(verifyJWT, logoutuser);
router.route("/refreshToken").get(refreshAccessToken);

router.route("/getUsername").get(verifyJWT, getUsername);
router.route("/getProfile").get(verifyJWT, getProfile);
router.route("/updateDetails").post(verifyJWT, updateDetails);
router.route("/send-email-change-otp").post(verifyJWT, sendEmailChangeOtp);
router.route("/change-email").post(verifyJWT, changeEmail);
router.route("/changePassword").post(verifyJWT, changeCurrentPassword);
router.route("/delete").post(verifyJWT, deleteUser);

export default router;
