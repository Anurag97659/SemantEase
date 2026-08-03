
const otpMap = new Map();

/**
 * Store an OTP for a given key (e.g., email or username).
 * @param {string} key 
 * @param {string} otp 
 * @param {number} ttlMs Default 10 minutes
 */
export const setOtp = (key, otp, ttlMs = 10 * 60 * 1000) => {
  const normalizedKey = key.toLowerCase().trim();
  const expiresAt = Date.now() + ttlMs;
  otpMap.set(normalizedKey, { otp: String(otp).trim(), expiresAt });
};

/**
 * Verify an OTP for a given key.
 * If valid, automatically consumes (deletes) the OTP.
 * @param {string} key 
 * @param {string} inputOtp 
 * @returns {{ valid: boolean, message?: string }}
 */
export const verifyOtp = (key, inputOtp) => {
  const normalizedKey = key.toLowerCase().trim();
  const record = otpMap.get(normalizedKey);

  if (!record) {
    return { valid: false, message: "OTP not found or expired. Please request a new OTP." };
  }

  if (Date.now() > record.expiresAt) {
    otpMap.delete(normalizedKey);
    return { valid: false, message: "OTP has expired. Please request a new OTP." };
  }

  if (record.otp !== String(inputOtp).trim()) {
    return { valid: false, message: "Invalid OTP. Please check and try again." };
  }

  
  otpMap.delete(normalizedKey);
  return { valid: true };
};

/**
 * Manually delete an OTP record.
 * @param {string} key 
 */
export const deleteOtp = (key) => {
  otpMap.get(key.toLowerCase().trim());
  otpMap.delete(key.toLowerCase().trim());
};
