import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { Word } from "../models/word.model.js";
import jwt from "jsonwebtoken";
import { ApiResponse } from "../utils/ApiResponse.js";
import crypto from "crypto";
import bcrypt from "bcrypt";
import { setOtp, verifyOtp } from "../utils/otpStore.js";
import { sendOtpEmail } from "../utils/resend.js";

const generateAccessTokenAndRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();
    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });
    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      `Token generation failed: ${error.message}`
    );
  }
};

const sendRegistrationOtp = asyncHandler(async (req, res) => {
  const { email, username } = req.body;
  if (!email) {
    throw new ApiError(400, "Email is required");
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    throw new ApiError(400, "Invalid email format");
  }

  const existingEmail = await User.findOne({ email: email.trim().toLowerCase() });
  if (existingEmail) {
    throw new ApiError(409, "Email is already registered");
  }

  if (username) {
    const existingUsername = await User.findOne({ username: username.trim().toLowerCase() });
    if (existingUsername) {
      throw new ApiError(409, "Username is already taken");
    }
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  setOtp(`reg:${email.trim().toLowerCase()}`, otp);

  await sendOtpEmail(email.trim().toLowerCase(), otp, "Account Registration Verification");

  return res.status(200).json(
    new ApiResponse(200, {}, "Verification OTP sent successfully to your email")
  );
});

const registeruser = asyncHandler(async (req, res) => {
  const { username, fullname, email, password, securityQuestion, securityAnswer, otp } = req.body;

  if (!fullname || fullname.trim() === "") {
    throw new ApiError(400, "Fullname is required");
  }
  if (!username || username.trim() === "") {
    throw new ApiError(400, "Username is required");
  }
  if (!email || email.trim() === "") {
    throw new ApiError(400, "Email is required");
  }
  if (!otp || otp.trim() === "") {
    throw new ApiError(400, "OTP verification code is required");
  }
  if (!password) {
    throw new ApiError(400, "Password is required");
  }
  if (!securityQuestion || securityQuestion.trim() === "") {
    throw new ApiError(400, "Security question is required");
  }
  if (!securityAnswer || securityAnswer.trim() === "") {
    throw new ApiError(400, "Security answer is required");
  }

  const normalizedEmail = email.trim().toLowerCase();
  const normalizedUsername = username.trim().toLowerCase();

  // Verify OTP
  const otpVerification = verifyOtp(`reg:${normalizedEmail}`, otp);
  if (!otpVerification.valid) {
    throw new ApiError(400, otpVerification.message);
  }

  const existingUser = await User.findOne({
    $or: [{ username: normalizedUsername }, { email: normalizedEmail }]
  });

  if (existingUser) {
    if (existingUser.username === normalizedUsername) {
      throw new ApiError(409, "Username is already taken");
    }
    throw new ApiError(409, "Email is already registered");
  }

  const backupCodes = Array.from({ length: 3 }, () => crypto.randomBytes(4).toString("hex"));
  const hashedBackupCodes = await Promise.all(
    backupCodes.map(code => bcrypt.hash(code, 10))
  );

  const user = await User.create({
    username: normalizedUsername, 
    fullname, 
    email: normalizedEmail,
    emailVerified: true,
    password,
    securityQuestion,
    securityAnswer,
    backupCodes: hashedBackupCodes
  });

  const createUser = await User.findById(user._id).select("-password -refreshToken -securityAnswer -backupCodes");
  if (!createUser) {
    throw new ApiError(500, "User creation failed due to an internal server error");
  }

  return res.status(200).json(
    new ApiResponse(
      200, 
      {
        user: createUser,
        backupCodes 
      },
      "User created successfully"
    )
  );
});


const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken =
    req.cookies.refreshToken || req.body.refreshToken;
  if (!incomingRefreshToken) throw new ApiError(401, "Unauthorized request");

  try {
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );
    const user = await User.findById(decodedToken?._id);
    if (!user) throw new ApiError(401, "User not found");
    if (incomingRefreshToken !== user?.refreshToken)
      throw new ApiError(400, "Invalid refresh token");

    const options = { httpOnly: true, secure: true, sameSite: "none" };
    const { accessToken, newRefreshToken } =
      await generateAccessTokenAndRefreshToken(user._id);

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(
        new ApiResponse(
          200,
          { accessToken, refreshToken: newRefreshToken },
          "Access token refreshed"
        )
      );
  } catch (error) {
    throw new ApiError(400, `Invalid refresh token: ${error.message}`);
  }
});

const loginuser=asyncHandler(async(req,res)=>{
    const {email,username,password}=req.body;

    if(!email && !username){
        throw new ApiError(400,"Email or username is required");
   }

    const conditions = [];
    if (email) conditions.push({ email });
    if (username) conditions.push({ username });

    const user=await User.findOne({
        $or: conditions
    });

    if(!user){
        throw new ApiError(404,"User not found");
   }

    const isPasswordRight=await user.isPasswordCorrect(password);
    if(!isPasswordRight){
        throw new ApiError(401,"Password is incorrect");
   }

    const{accessToken,refreshToken}=await generateAccessTokenAndRefreshToken(user._id);
    const loggedUser=await User.findById(user._id).select("-password -refreshToken -securityAnswer -backupCodes");
    // console.log('accessToken = ',accessToken);
    // console.log('refreshToken = ',refreshToken);
    const options={
        httpOnly:true,
        secure:true,
        sameSite: "none"
   };
    return res
        .status(200)
        .cookie("accessToken",accessToken,options)
        .cookie("refreshToken",refreshToken,options)
        .json(
            new ApiResponse(200,{
                user:loggedUser,
                accessToken,
                refreshToken
           },"User logged in successfully")
        );
});

const logoutuser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    { $unset: { refreshToken: 1 } },
    { new: true }
  );
  const options = { httpOnly: true, secure: true, sameSite: "none" };
  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged out successfully"));
});

const changeCurrentPassword=asyncHandler(async(req,res)=>{
    const{oldPassword,newPassword,confirmPassword}=req.body;
    if(newPassword !==confirmPassword){
        throw new ApiError(401,"New password and confirm password are different");
   }
    const user=await User.findById(req.user?._id);
    const isPasswordCorrect=await user.isPasswordCorrect(oldPassword);
    if(!isPasswordCorrect){
        throw new ApiError(401,"Wrong old password");
   }
    user.password=newPassword;
    await user.save({validateBeforeSave:false});
    return res
        .status(200)
        .json(
            new ApiResponse(200,{},"Password changed successfully")
        );
});

const updateDetails=asyncHandler(async(req,res)=>{
    const {username,fullname}=req.body;
    if(!username && !fullname){
        throw new ApiError(400,"At least one field is required to update");
   }
    const user=await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                username,
                fullname
           }
       },
        {new:true}
    ).select("-password -securityAnswer -backupCodes");
    return res
        .status(200)
        .json(
            new ApiResponse(200,user,"Details updated successfully")
        );
});

const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findByIdAndDelete(req.user?._id);
  if (!user) throw new ApiError(404, "User not found");
  return res
    .status(200)
    .json(new ApiResponse(200, user, "User deleted successfully"));
});

const getUsername = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user?._id).select("username");
  return res
    .status(200)
    .json(new ApiResponse(200, user, "Username fetched successfully"));
});

const getProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user?._id).select(
    "-password -refreshToken -securityAnswer -backupCodes"
  );
  return res
    .status(200)
    .json(new ApiResponse(200, user, "Profile fetched successfully"));
});


const sendPasswordResetOtp = asyncHandler(async (req, res) => {
  const { username } = req.body;
  if (!username || username.trim() === "") {
    throw new ApiError(400, "Username is required");
  }

  const normalizedUsername = username.trim().toLowerCase();
  const user = await User.findOne({
    $or: [{ username: normalizedUsername }, { email: normalizedUsername }]
  });

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  if (!user.email) {
    throw new ApiError(400, "No registered email found for this account. Please use Security Question or Backup Code.");
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  setOtp(`reset:${user.username}`, otp);

  await sendOtpEmail(user.email, otp, "Password Reset Verification");

  const parts = user.email.split("@");
  const local = parts[0];
  const domain = parts[1];
  const maskedLocal = local.length <= 2 
    ? local[0] + "*" 
    : local[0] + "*".repeat(Math.max(1, local.length - 2)) + local[local.length - 1];
  const maskedEmail = `${maskedLocal}@${domain}`;

  return res.status(200).json(
    new ApiResponse(200, { maskedEmail }, `OTP sent successfully to ${maskedEmail}`)
  );
});

const resetPassword = asyncHandler(async (req, res) => {
  const { username, type, securityAnswer, backupCode, otp, newPassword } = req.body;

  if (!username) {
    throw new ApiError(400, "Username is required");
  }
  if (!newPassword) {
    throw new ApiError(400, "New password is required");
  }
  if (newPassword.length < 8) {
    throw new ApiError(400, "New password must be at least 8 characters");
  }

  const user = await User.findOne({
    $or: [{ username: username.trim().toLowerCase() }, { email: username.trim().toLowerCase() }]
  });
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  if (type === "question") {
    if (!securityAnswer) {
      throw new ApiError(400, "Security answer is required");
    }
    const isAnswerCorrect = await bcrypt.compare(
      securityAnswer.trim().toLowerCase(),
      user.securityAnswer
    );
    if (!isAnswerCorrect) {
      throw new ApiError(400, "Incorrect security answer");
    }
  } 
  else if (type === "backup_code") {
    if (!backupCode) {
      throw new ApiError(400, "Backup code is required");
    }

    let matchedIndex = -1;
    for (let i = 0; i < user.backupCodes.length; i++) {
      const match = await bcrypt.compare(backupCode.trim(), user.backupCodes[i]);
      if (match) {
        matchedIndex = i;
        break;
      }
    }

    if (matchedIndex === -1) {
      throw new ApiError(400, "Invalid backup code");
    }
    user.backupCodes.splice(matchedIndex, 1);
  } 
  else if (type === "email_otp") {
    if (!otp) {
      throw new ApiError(400, "OTP is required");
    }
    const otpVerification = verifyOtp(`reset:${user.username}`, otp);
    if (!otpVerification.valid) {
      throw new ApiError(400, otpVerification.message);
    }
  }
  else {
    throw new ApiError(400, "Invalid verification type. Must be 'question', 'backup_code', or 'email_otp'");
  }

  user.password = newPassword;
  await user.save();

  return res.status(200).json(
    new ApiResponse(200, {}, "Password reset successfully")
  );
});

const getSecurityQuestion = asyncHandler(async (req, res) => {
  const { username } = req.params;
  const user = await User.findOne({ username: username.toLowerCase() });
  if (!user) {
    throw new ApiError(404, "User not found");
  }
  res.status(200).json(new ApiResponse(200, { securityQuestion: user.securityQuestion }, "Security question fetched"));
});

export {
  sendRegistrationOtp,
  registeruser,
  loginuser,
  logoutuser,
  changeCurrentPassword,
  updateDetails,
  refreshAccessToken,
  deleteUser,
  getUsername,
  getProfile,
  sendPasswordResetOtp,
  resetPassword,
  getSecurityQuestion
};

