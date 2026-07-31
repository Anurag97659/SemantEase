"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { apiFetch } from "../../utils/api";

function OAuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const called = useRef(false);

  useEffect(() => {
    if (called.current) return;
    called.current = true;

    const token = searchParams.get("token");

    if (!token) {
      router.replace("/login?error=oauth_failed");
      return;
    }


    apiFetch("/WoahCab/oauth/verify-handoff", {
      method: "POST",
      body: JSON.stringify({ token }),
    })
      .then(() => {
        router.replace("/words");
      })
      .catch(() => {
        router.replace("/login?error=oauth_failed");
      });
  }, [router, searchParams]);

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center bg-background text-slate-900 dark:text-slate-100 overflow-hidden transition-colors duration-300">
   
      <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-violet-600/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-indigo-600/10 blur-[120px] pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center gap-6">
       
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 rounded-full border-4 border-violet-500/20" />
          <div className="absolute inset-0 rounded-full border-4 border-t-violet-500 animate-spin" />
        </div>

        <div className="text-center">
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-1">
            Signing you in…
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
            Just a moment, setting up your session.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function OAuthCallbackPage() {
  return (
    <Suspense>
      <OAuthCallbackContent />
    </Suspense>
  );
}
