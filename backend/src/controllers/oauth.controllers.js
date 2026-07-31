import { OAuth2Client } from "google-auth-library";
import { ConfidentialClientApplication } from "@azure/msal-node";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import jwt from "jsonwebtoken";
import crypto from "crypto";


const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";


function generateUsername(name = "") {
  const base = name
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 20) || "user";
  return `${base}_${crypto.randomBytes(3).toString("hex")}`;
}

const generateAccessTokenAndRefreshToken = async (userId) => {
  const user = await User.findById(userId);
  const accessToken = user.generateAccessToken();
  const refreshToken = user.generateRefreshToken();
  user.refreshToken = refreshToken;
  await user.save({ validateBeforeSave: false });
  return { accessToken, refreshToken };
};

const cookieOptions = { httpOnly: true, secure: true, sameSite: "none" };



const googleClient = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);


export const googleRedirect = (req, res) => {
  const url = googleClient.generateAuthUrl({
    access_type: "offline",
    scope: ["openid", "profile", "email"],
    prompt: "select_account",
  });
  res.redirect(url);
};


export const googleCallback = async (req, res) => {
  const { code, error } = req.query;

  if (error || !code) {
    return res.redirect(`${FRONTEND_URL}/login?error=oauth_cancelled`);
  }

  try {
    const { tokens } = await googleClient.getToken(code);
    googleClient.setCredentials(tokens);

    const ticket = await googleClient.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const { sub: providerId, email, name } = payload;

    let user = await User.findOne({ provider: "google", providerId });

    if (!user && email) {
      user = await User.findOne({ email, provider: "local" });
      if (user) {
        user.provider = "google";
        user.providerId = providerId;
        await user.save({ validateBeforeSave: false });
      }
    }

    if (!user) {
      const username = generateUsername(name);
      user = await User.create({
        username,
        fullname: name || username,
        email: email || undefined,
        provider: "google",
        providerId,
        password: undefined,
        securityQuestion: undefined,
        securityAnswer: undefined,
      });
    }

    const { accessToken, refreshToken } = await generateAccessTokenAndRefreshToken(user._id);

    return res
      .cookie("accessToken", accessToken, cookieOptions)
      .cookie("refreshToken", refreshToken, cookieOptions)
      .redirect(`${FRONTEND_URL}/words`);
  } catch (err) {
    console.error("Google OAuth error:", err);
    return res.redirect(`${FRONTEND_URL}/login?error=oauth_failed`);
  }
};


let msalApp = null;

function getMsalApp() {
  if (!msalApp) {
    msalApp = new ConfidentialClientApplication({
      auth: {
        clientId: process.env.MICROSOFT_CLIENT_ID,
        clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
        authority: `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID || "common"}`,
      },
    });
  }
  return msalApp;
}

export const microsoftRedirect = async (req, res) => {
  try {
    const app = getMsalApp();
    const url = await app.getAuthCodeUrl({
      scopes: ["openid", "profile", "email", "User.Read"],
      redirectUri: process.env.MICROSOFT_REDIRECT_URI,
      prompt: "select_account",
    });
    res.redirect(url);
  } catch (err) {
    console.error("Microsoft redirect error:", err);
    res.redirect(`${FRONTEND_URL}/login?error=oauth_failed`);
  }
};


export const microsoftCallback = async (req, res) => {
  const { code, error } = req.query;

  if (error || !code) {
    return res.redirect(`${FRONTEND_URL}/login?error=oauth_cancelled`);
  }

  try {
    const app = getMsalApp();

    const tokenResponse = await app.acquireTokenByCode({
      code,
      scopes: ["openid", "profile", "email", "User.Read"],
      redirectUri: process.env.MICROSOFT_REDIRECT_URI,
    });

    const { oid: providerId, preferred_username, name, email } = tokenResponse.idTokenClaims;
    const userEmail = email || preferred_username;

    let user = await User.findOne({ provider: "microsoft", providerId });

    if (!user && userEmail) {
      user = await User.findOne({ email: userEmail, provider: "local" });
      if (user) {
        user.provider = "microsoft";
        user.providerId = providerId;
        await user.save({ validateBeforeSave: false });
      }
    }

    if (!user) {
      const username = generateUsername(name || preferred_username);
      user = await User.create({
        username,
        fullname: name || username,
        email: userEmail || undefined,
        provider: "microsoft",
        providerId,
        password: undefined,
        securityQuestion: undefined,
        securityAnswer: undefined,
      });
    }

    const { accessToken, refreshToken } = await generateAccessTokenAndRefreshToken(user._id);

    return res
      .cookie("accessToken", accessToken, cookieOptions)
      .cookie("refreshToken", refreshToken, cookieOptions)
      .redirect(`${FRONTEND_URL}/words`);
  } catch (err) {
    console.error("Microsoft OAuth error:", err);
    return res.redirect(`${FRONTEND_URL}/login?error=oauth_failed`);
  }
};
