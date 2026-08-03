"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "../../utils/api";

type RecoveryType = "email_otp" | "question" | "backup_code";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [type, setType] = useState<RecoveryType>("email_otp");
  
 
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [maskedEmail, setMaskedEmail] = useState("");

  const [securityQuestion, setSecurityQuestion] = useState("");
  const [securityAnswer, setSecurityAnswer] = useState("");
  const [fetchingQuestion, setFetchingQuestion] = useState(false);


  const [backupCode, setBackupCode] = useState("");


  const [newPassword, setNewPassword] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSendEmailOtp = async () => {
    if (!username.trim()) {
      setError("Please enter your username first");
      return;
    }
    setSendingOtp(true);
    setError("");
    setSuccess("");

    try {
      const response = await apiFetch("/WoahCab/users/send-password-reset-otp", {
        method: "POST",
        body: JSON.stringify({ username: username.trim() }),
      });

      if (response?.data?.maskedEmail) {
        setMaskedEmail(response.data.maskedEmail);
      }
      setOtpSent(true);
      setSuccess(response?.message || "OTP code sent to your registered email.");
    } catch (err: any) {
      setError(err.message || "Failed to send OTP code");
    } finally {
      setSendingOtp(false);
    }
  };

  const handleFetchQuestion = async () => {
    if (!username.trim()) {
      setError("Please enter your username first");
      return;
    }
    setFetchingQuestion(true);
    setError("");
    setSecurityQuestion("");

    try {
      const response = await apiFetch(`/WoahCab/users/question/${username.trim()}`);
      if (response?.data?.securityQuestion) {
        setSecurityQuestion(response.data.securityQuestion);
      } else {
        setError("Could not retrieve security question");
      }
    } catch (err: any) {
      setError(err.message || "User not found");
    } finally {
      setFetchingQuestion(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      await apiFetch("/WoahCab/users/reset-password", {
        method: "POST",
        body: JSON.stringify({
          username: username.trim(),
          type,
          otp: type === "email_otp" ? otp.trim() : undefined,
          securityAnswer: type === "question" ? securityAnswer.trim() : undefined,
          backupCode: type === "backup_code" ? backupCode.trim() : undefined,
          newPassword,
        }),
      });

      setSuccess("Password reset successfully! Redirecting to login...");
      setTimeout(() => {
        router.push("/login");
      }, 2000);
    } catch (err: any) {
      setError(err.message || "Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-background text-slate-900 dark:text-slate-100 overflow-hidden px-4 py-12 transition-colors duration-300">
      <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-violet-600/10 blur-[120px]" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-indigo-650/10 blur-[120px]" />

      <div className="w-full max-w-md relative z-10">
        <div className="backdrop-blur-xl bg-card border border-border rounded-3xl p-8 shadow-2xl transition-all duration-300 hover:border-violet-500/20">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-violet-600 to-indigo-600 dark:from-violet-400 dark:to-indigo-400 bg-clip-text text-transparent">
              Reset Password
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mt-2 text-sm font-medium">
              Recover access using Email OTP, Security Questions, or Backup Code.
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-650 dark:text-red-400 text-sm text-center font-medium">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-650 dark:text-emerald-400 text-sm text-center font-medium">
              {success}
            </div>
          )}

          <form onSubmit={handleResetPassword} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-300 uppercase tracking-wider mb-2">
                Username
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. anurag"
                  className="flex-1 px-4 py-3 bg-background border border-border rounded-2xl text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30 transition-all text-sm font-medium"
                />
                {type === "email_otp" && (
                  <button
                    type="button"
                    onClick={handleSendEmailOtp}
                    disabled={sendingOtp || !username.trim()}
                    className="px-4 bg-background hover:bg-card-hover text-violet-600 dark:text-violet-400 text-xs font-bold rounded-2xl border border-border transition-all active:scale-95 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1"
                  >
                    {sendingOtp ? "Sending..." : otpSent ? "Resend OTP" : "Send OTP"}
                  </button>
                )}
                {type === "question" && (
                  <button
                    type="button"
                    onClick={handleFetchQuestion}
                    disabled={fetchingQuestion}
                    className="px-4 bg-background hover:bg-card-hover text-slate-850 dark:text-slate-200 text-xs font-bold rounded-2xl border border-border transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                  >
                    {fetchingQuestion ? "Fetching..." : "Get Question"}
                  </button>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-300 uppercase tracking-wider mb-2">
                Recovery Method
              </label>
              <div className="grid grid-cols-3 gap-1.5 p-1 bg-background border border-border rounded-2xl">
                <button
                  type="button"
                  onClick={() => {
                    setType("email_otp");
                    setError("");
                  }}
                  className={`py-2 px-2 text-xs font-semibold rounded-xl transition-all cursor-pointer text-center ${
                    type === "email_otp"
                      ? "bg-violet-600 text-white shadow-sm"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                >
                  Verify Email
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setType("question");
                    setError("");
                  }}
                  className={`py-2 px-2 text-xs font-semibold rounded-xl transition-all cursor-pointer text-center ${
                    type === "question"
                      ? "bg-violet-600 text-white shadow-sm"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                >
                  Security Q&A
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setType("backup_code");
                    setError("");
                  }}
                  className={`py-2 px-2 text-xs font-semibold rounded-xl transition-all cursor-pointer text-center ${
                    type === "backup_code"
                      ? "bg-violet-600 text-white shadow-sm"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                >
                  Backup Code
                </button>
              </div>
            </div>

            {type === "email_otp" && (
              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-300 uppercase tracking-wider mb-2">
                  Verification Code (OTP)
                </label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.trim())}
                  placeholder="Enter 6-digit OTP sent to email"
                  className="w-full px-4 py-3 bg-background border border-border rounded-2xl text-violet-600 dark:text-violet-400 font-mono text-center font-bold tracking-widest text-lg focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30 transition-all placeholder:font-sans placeholder:tracking-normal placeholder:font-medium placeholder:text-sm"
                />
                {maskedEmail && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 text-center">
                    Sent to: <span className="font-semibold text-slate-700 dark:text-slate-300">{maskedEmail}</span>
                  </p>
                )}
              </div>
            )}

            {type === "question" && (
              <>
                {securityQuestion && (
                  <div className="p-4 bg-background border border-border rounded-2xl text-slate-900 dark:text-slate-100 text-sm italic font-medium">
                    <span className="font-bold text-xs uppercase text-violet-600 dark:text-violet-400 block not-italic mb-1">
                      Your Security Question:
                    </span>
                    {securityQuestion}
                  </div>
                )}
                <div>
                  <label className="block text-xs font-bold text-slate-800 dark:text-slate-300 uppercase tracking-wider mb-2">
                    Security Answer
                  </label>
                  <input
                    type="text"
                    required
                    value={securityAnswer}
                    onChange={(e) => setSecurityAnswer(e.target.value)}
                    placeholder="Enter security answer"
                    className="w-full px-4 py-3 bg-background border border-border rounded-2xl text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30 transition-all text-sm font-medium"
                  />
                </div>
              </>
            )}

            {type === "backup_code" && (
              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-300 uppercase tracking-wider mb-2">
                  Backup Code
                </label>
                <input
                  type="text"
                  required
                  value={backupCode}
                  onChange={(e) => setBackupCode(e.target.value)}
                  placeholder="e.g. 1bf00f64"
                  className="w-full px-4 py-3 bg-background border border-border rounded-2xl text-indigo-650 dark:text-indigo-400 font-mono font-bold tracking-wider focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30 transition-all text-sm placeholder:font-sans placeholder:tracking-normal placeholder:font-medium"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-300 uppercase tracking-wider mb-2">
                New Password (min 8 chars)
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 bg-background border border-border rounded-2xl text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30 transition-all text-sm font-medium"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 px-6 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold rounded-2xl transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-violet-500/50 hover:shadow-lg hover:shadow-violet-600/20 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none text-sm mt-2 cursor-pointer"
            >
              {loading ? "Resetting password..." : "Reset Password"}
            </button>
          </form>

          <div className="mt-6 text-center text-xs text-slate-550 dark:text-slate-400 font-semibold">
            Remembered your password?{" "}
            <Link
              href="/login"
              className="text-violet-600 dark:text-violet-400 font-bold hover:underline transition-colors ml-1"
            >
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
