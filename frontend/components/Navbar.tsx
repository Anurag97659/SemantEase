"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "../utils/api";

export default function Navbar() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") {
      return "light";
    }
    return localStorage.getItem("theme") === "dark" ? "dark" : "light";
  });
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    apiFetch("/WoahCab/users/getProfile")
      .then((res) => {
        if (res?.data?.username) {
          setUsername(res.data.username);
        }
      })
      .catch(() => {
        // user not logged in or error
      });
  }, []);

  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [theme]);

  useEffect(() => {
    const closeMenuOnOutsideClick = (event: PointerEvent) => {
      if (!accountMenuRef.current?.contains(event.target as Node)) {
        setIsAccountMenuOpen(false);
      }
    };

    const closeMenuOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsAccountMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", closeMenuOnOutsideClick);
    document.addEventListener("keydown", closeMenuOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeMenuOnOutsideClick);
      document.removeEventListener("keydown", closeMenuOnEscape);
    };
  }, []);

  const toggleTheme = () => {
    if (theme === "dark") {
      setTheme("light");
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    } else {
      setTheme("dark");
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    }
  };

  const handleLogout = async () => {
    setIsAccountMenuOpen(false);
    try {
      await apiFetch("/WoahCab/users/logout", { method: "POST" });
      setUsername("");
      router.push("/login");
    } catch {
      router.push("/login");
    }
  };

  return (
    <nav className="sticky top-0 z-50 backdrop-blur-md bg-white/70 dark:bg-slate-950/70 border-b border-slate-200 dark:border-slate-900/80 px-4 sm:px-6 py-4 transition-all duration-300">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        {/* Logo */}
        <Link href="/words" className="flex items-center gap-2.5 group">
          <img
            src="/logo.jpg"
            alt="SemantEase Logo"
            className="w-8 h-8 rounded-lg shadow-md border border-violet-500/20 group-hover:scale-105 transition-transform object-cover"
          />
          <span className="text-2xl font-extrabold bg-gradient-to-r from-violet-600 via-indigo-500 to-indigo-600 dark:from-violet-400 dark:via-indigo-200 dark:to-indigo-400 bg-clip-text text-transparent group-hover:opacity-95 transition-all">
            SemantEase
          </span>
        </Link>

        {/* Right side menu actions */}
        <div className="flex items-center gap-2 sm:gap-4">
          <Link
            href="/words/submit"
            className="flex items-center gap-2 py-2 px-3 sm:px-4 rounded-xl bg-violet-600/10 hover:bg-violet-600/20 text-violet-600 dark:text-violet-400 border border-violet-500/20 hover:border-violet-500/30 transition-all font-medium text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            <span className="hidden sm:inline">Add Word</span>
          </Link>

          {/* User dropdown area */}
          <div ref={accountMenuRef} className="relative group py-2">
            <button
              type="button"
              onClick={() => setIsAccountMenuOpen((isOpen) => !isOpen)}
              aria-expanded={isAccountMenuOpen}
              aria-controls="account-menu"
              className="flex items-center gap-2 text-slate-700 dark:text-slate-350 hover:text-violet-600 dark:hover:text-violet-400 transition-colors font-semibold text-sm cursor-pointer"
            >
              <span className="max-w-24 truncate sm:max-w-none">{username ? `@${username}` : "User"}</span>
              <svg className={`w-4 h-4 transition-transform ${isAccountMenuOpen ? "rotate-180" : "md:group-hover:rotate-180"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Dropdown Menu Container */}
            <div
              id="account-menu"
              className={`absolute right-0 top-full pt-1.5 w-52 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-2 transition-all duration-300 z-50 ${
                isAccountMenuOpen ? "block" : "hidden md:group-hover:block"
              }`}
            >
              {/* Conditional options depending on Auth */}
              {username ? (
                <>
                  <Link
                    href="/test"
                    onClick={() => setIsAccountMenuOpen(false)}
                    className="flex items-center gap-2.5 px-3.5 py-3 text-xs font-semibold text-slate-700 dark:text-slate-350 hover:bg-slate-100 dark:hover:bg-slate-800/60 rounded-xl transition-all"
                  >
                    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                    </svg>
                    Test
                  </Link>

                  <Link
                    href="/mynotes-dashboard"
                    onClick={() => setIsAccountMenuOpen(false)}
                    className="flex items-center gap-2.5 px-3.5 py-3 text-xs font-semibold text-slate-700 dark:text-slate-350 hover:bg-slate-100 dark:hover:bg-slate-800/60 rounded-xl transition-all"
                  >
                    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 20h9M12 4h9M4 9h16M4 15h16" />
                    </svg>
                    My Notes
                  </Link>

                  <Link
                    href="/playlists"
                    onClick={() => setIsAccountMenuOpen(false)}
                    className="flex items-center gap-2.5 px-3.5 py-3 text-xs font-semibold text-slate-700 dark:text-slate-350 hover:bg-slate-100 dark:hover:bg-slate-800/60 rounded-xl transition-all"
                  >
                    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6.5A2.5 2.5 0 016.5 4h3.879a2 2 0 011.414.586l1.621 1.621a2 2 0 001.414.586H17.5A2.5 2.5 0 0120 9.293v8.207A2.5 2.5 0 0117.5 20h-11A2.5 2.5 0 014 17.5v-11z" />
                    </svg>
                    Playlists
                  </Link>

                  <Link
                    href="/friends"
                    onClick={() => setIsAccountMenuOpen(false)}
                    className="flex items-center gap-2.5 px-3.5 py-3 text-xs font-semibold text-slate-700 dark:text-slate-350 hover:bg-slate-100 dark:hover:bg-slate-800/60 rounded-xl transition-all"
                  >
                    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a4 4 0 00-5-3.87M17 20H7m10 0v-2c0-.654-.126-1.279-.356-1.851M7 20H2v-2a4 4 0 015-3.87M7 20v-2c0-.654.126-1.279.356-1.851m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 2a2 2 0 11-4 0 2 2 0 014 0zM7 9a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    Friends
                  </Link>

                  <Link
                    href="/settings"
                    onClick={() => setIsAccountMenuOpen(false)}
                    className="flex items-center gap-2.5 px-3.5 py-3 text-xs font-semibold text-slate-700 dark:text-slate-350 hover:bg-slate-100 dark:hover:bg-slate-800/60 rounded-xl transition-all"
                  >
                    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    Settings
                  </Link>

                  <Link
                    href="/suggestions"
                    onClick={() => setIsAccountMenuOpen(false)}
                    className="flex items-center gap-2.5 px-3.5 py-3 text-xs font-semibold text-slate-700 dark:text-slate-350 hover:bg-slate-100 dark:hover:bg-slate-800/60 rounded-xl transition-all"
                  >
                    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                    </svg>
                    Suggestions
                  </Link>

                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-3.5 py-3 text-xs font-semibold text-red-500 hover:bg-red-500/5 dark:hover:bg-red-500/10 rounded-xl transition-all text-left cursor-pointer"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    onClick={() => setIsAccountMenuOpen(false)}
                    className="flex items-center gap-2.5 px-3.5 py-3 text-xs font-semibold text-slate-700 dark:text-slate-350 hover:bg-slate-100 dark:hover:bg-slate-800/60 rounded-xl transition-all"
                  >
                    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Login
                  </Link>
                  <Link
                    href="/register"
                    onClick={() => setIsAccountMenuOpen(false)}
                    className="flex items-center gap-2.5 px-3.5 py-3 text-xs font-semibold text-slate-700 dark:text-slate-350 hover:bg-slate-100 dark:hover:bg-slate-800/60 rounded-xl transition-all"
                  >
                    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                    </svg>
                    Register
                  </Link>
                  <Link
                    href="/test"
                    onClick={() => setIsAccountMenuOpen(false)}
                    className="flex items-center gap-2.5 px-3.5 py-3 text-xs font-semibold text-slate-700 dark:text-slate-350 hover:bg-slate-100 dark:hover:bg-slate-800/60 rounded-xl transition-all"
                  >
                    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                    </svg>
                    Test
                  </Link>
                  <Link
                    href="/mynotes-dashboard"
                    onClick={() => setIsAccountMenuOpen(false)}
                    className="flex items-center gap-2.5 px-3.5 py-3 text-xs font-semibold text-slate-700 dark:text-slate-350 hover:bg-slate-100 dark:hover:bg-slate-800/60 rounded-xl transition-all"
                  >
                    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 20h9M12 4h9M4 9h16M4 15h16" />
                    </svg>
                    My Notes
                  </Link>
                </>
              )}

              {/* Theme Selector item (with Gear Switch) */}
              <div className="border-t border-slate-200 dark:border-slate-800/60 my-1 pt-1">
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="w-full flex items-center justify-between px-3.5 py-3 text-xs font-semibold text-slate-700 dark:text-slate-350 hover:bg-slate-100 dark:hover:bg-slate-800/60 rounded-xl transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    {/* Dial gear SVG */}
                    <svg
                      className={`w-4 h-4 text-slate-400 transition-all duration-[750ms] ease-out ${
                        theme === "dark" ? "rotate-90 text-violet-400" : ""
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                    <span>Theme</span>
                  </div>
                  <span className="text-[10px] uppercase font-bold text-violet-500">
                    {theme === "dark" ? "Dark" : "Light"}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
