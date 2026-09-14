"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Navbar from "../../components/Navbar";
import { apiFetch } from "../../utils/api";

interface PlaylistSummary {
  _id: string;
  name: string;
  wordCount: number;
  createdAt: string;
  updatedAt: string;
}

export default function PlaylistsPage() {
  const router = useRouter();
  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    apiFetch("/WoahCab/playlists")
      .then((response) => setPlaylists(response?.data || []))
      .catch((err: unknown) => {
        const message =
          err instanceof Error ? err.message : "Could not load playlists";
        if (message.includes("Unauthorized") || message.includes("401"))
          router.push("/login");
        else setError(message);
      })
      .finally(() => setLoading(false));
  }, [router]);

  const visiblePlaylists = useMemo(
    () =>
      playlists.filter((playlist) =>
        playlist.name.toLowerCase().includes(query.trim().toLowerCase()),
      ),
    [playlists, query],
  );

  const formatDate = (date: string) =>
    new Intl.DateTimeFormat("en", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(date));

  return (
    <div className="min-h-screen bg-background text-slate-900 dark:text-slate-100 flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-6xl w-full mx-auto p-6 md:p-8">
        <section className="relative overflow-hidden rounded-[2rem] border border-violet-500/15 bg-gradient-to-br from-violet-600/12 via-indigo-500/8 to-transparent p-7 md:p-10 mb-8">
          <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-violet-500/10 blur-3xl" />
          <div className="relative flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] font-bold text-violet-600 dark:text-violet-400">
                Study collections
              </p>
              <h1 className="mt-2 text-3xl md:text-4xl font-black tracking-tight">
                Playlists
              </h1>
              <p className="mt-2 max-w-lg text-sm font-medium text-slate-600 dark:text-slate-400">
                Organize vocabulary into focused lists for topics, exams, and
                revision sessions.
              </p>
            </div>
            <Link
              href="/playlists/new"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-violet-600 hover:bg-violet-500 px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-violet-600/20 transition-colors"
            >
              <span className="text-lg leading-none">+</span> Create playlist
            </Link>
          </div>
        </section>

        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-bold">
            Your playlists{" "}
            <span className="text-sm font-medium text-slate-500">
              ({playlists.length})
            </span>
          </h2>
          <label className="relative block w-full sm:w-72">
            <span className="sr-only">Search playlists</span>
            <svg
              className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="m21 21-4.35-4.35m2.35-5.15a7.5 7.5 0 11-15 0 7.5 7.5 0 0115 0z"
              />
            </svg>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search your playlists"
              className="w-full rounded-xl border border-border bg-card py-2.5 pl-10 pr-4 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/15"
            />
          </label>
        </div>

        {error && (
          <p className="mb-5 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm font-medium text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        {loading ? (
          <div className="flex justify-center py-24">
            <span className="h-10 w-10 rounded-full border-4 border-violet-500/15 border-t-violet-500 animate-spin" />
          </div>
        ) : visiblePlaylists.length ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {visiblePlaylists.map((playlist) => (
              <Link
                key={playlist._id}
                href={`/playlists/details?id=${playlist._id}`}
                className="group min-h-48 rounded-3xl border border-border bg-card p-6 transition-all hover:-translate-y-1 hover:border-violet-500/35 hover:shadow-xl hover:shadow-violet-500/5"
              >
                <div className="flex items-start justify-between gap-4">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-600 dark:text-violet-400">
                    <svg
                      className="h-6 w-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M4 6.5A2.5 2.5 0 016.5 4h3.879a2 2 0 011.414.586l1.621 1.621a2 2 0 001.414.586H17.5A2.5 2.5 0 0120 9.293v8.207A2.5 2.5 0 0117.5 20h-11A2.5 2.5 0 014 17.5v-11z"
                      />
                    </svg>
                  </span>
                  <span className="text-xs font-medium text-slate-500">
                    {formatDate(playlist.updatedAt)}
                  </span>
                </div>
                <h3 className="mt-6 line-clamp-2 text-lg font-bold leading-snug group-hover:text-violet-600 dark:group-hover:text-violet-400">
                  {playlist.name}
                </h3>
                <p className="mt-2 text-xs font-semibold text-slate-500">
                  {playlist.wordCount}{" "}
                  {playlist.wordCount === 1 ? "word" : "words"}
                </p>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-border bg-card/40 px-6 py-20 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/10 text-2xl">
              ☷
            </div>
            <h3 className="text-lg font-bold">
              {query ? "No matching playlists" : "Create your first playlist"}
            </h3>
            <p className="mt-2 text-sm text-slate-500">
              {query
                ? "Try a different playlist name."
                : "Bring related vocabulary together for easier revision."}
            </p>
            {!query && (
              <Link
                href="/playlists/new"
                className="mt-5 inline-block text-sm font-bold text-violet-600 hover:underline dark:text-violet-400"
              >
                Create a playlist
              </Link>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
