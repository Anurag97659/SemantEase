"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Navbar from "../../../components/Navbar";
import VocabularyWordCards, {
  VocabularyWord,
} from "../../../components/VocabularyWordCards";
import { apiFetch } from "../../../utils/api";

interface Friend {
  _id: string;
  username: string;
  fullname: string;
}

interface PlaylistSummary {
  _id: string;
  name: string;
  wordCount: number;
  updatedAt: string;
}

type FriendTab = "added" | "favorites" | "playlists";

function FriendProfileContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const friendId = searchParams.get("id");
  const [friend, setFriend] = useState<Friend | null>(null);
  const [addedWords, setAddedWords] = useState<VocabularyWord[]>([]);
  const [favoriteWords, setFavoriteWords] = useState<VocabularyWord[]>([]);
  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);
  const [activeTab, setActiveTab] = useState<FriendTab>("added");
  const [loading, setLoading] = useState(() => Boolean(friendId));
  const [loadingPlaylists, setLoadingPlaylists] = useState(false);
  const [playlistsLoaded, setPlaylistsLoaded] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!friendId) return;

    apiFetch(`/WoahCab/social/friend/${friendId}/profile`)
      .then((response) => {
        setFriend(response?.data?.friend || null);
        setAddedWords(response?.data?.addedWords || []);
        setFavoriteWords(response?.data?.favoriteWords || []);
      })
      .catch((err: unknown) => {
        const message =
          err instanceof Error ? err.message : "Could not load friend profile";
        if (message.includes("Unauthorized") || message.includes("401"))
          router.push("/login");
        else setError(message);
      })
      .finally(() => setLoading(false));
  }, [friendId, router]);

  const openPlaylists = () => {
    setActiveTab("playlists");
    if (!friendId || playlistsLoaded || loadingPlaylists) return;

    setLoadingPlaylists(true);
    setError("");
    apiFetch(`/WoahCab/social/friend/${friendId}/playlists`)
      .then((response) => {
        setPlaylists(response?.data?.playlists || []);
        setPlaylistsLoaded(true);
      })
      .catch((err: unknown) =>
        setError(
          err instanceof Error
            ? err.message
            : "Could not load friend playlists",
        ),
      )
      .finally(() => setLoadingPlaylists(false));
  };

  const formatDate = (date: string) =>
    new Intl.DateTimeFormat("en", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(date));
  const activeWords = activeTab === "added" ? addedWords : favoriteWords;
  const activeTitle = activeTab === "added" ? "Words added" : "Favourite words";

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-slate-900 dark:text-slate-100 flex flex-col">
        <Navbar />
        <main className="flex flex-1 items-center justify-center">
          <span className="h-10 w-10 rounded-full border-4 border-violet-500/15 border-t-violet-500 animate-spin" />
        </main>
      </div>
    );
  }

  if (!friendId) {
    return (
      <div className="min-h-screen bg-background text-slate-900 dark:text-slate-100 flex flex-col">
        <Navbar />
        <main className="flex flex-1 flex-col items-center justify-center p-6 text-center">
          <h1 className="text-2xl font-black">Friend profile unavailable</h1>
          <p className="mt-2 text-sm text-slate-500">
            Friend information is missing.
          </p>
          <Link
            href="/friends"
            className="mt-6 text-sm font-bold text-violet-600 hover:underline dark:text-violet-400"
          >
            Back to friends
          </Link>
        </main>
      </div>
    );
  }

  if (error && !friend) {
    return (
      <div className="min-h-screen bg-background text-slate-900 dark:text-slate-100 flex flex-col">
        <Navbar />
        <main className="flex flex-1 flex-col items-center justify-center p-6 text-center">
          <h1 className="text-2xl font-black">Friend profile unavailable</h1>
          <p className="mt-2 text-sm text-slate-500">{error}</p>
          <Link
            href="/friends"
            className="mt-6 text-sm font-bold text-violet-600 hover:underline dark:text-violet-400"
          >
            Back to friends
          </Link>
        </main>
      </div>
    );
  }

  if (!friend) return null;

  return (
    <div className="min-h-screen bg-background text-slate-900 dark:text-slate-100 flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-6xl w-full mx-auto p-6 md:p-8">
        <Link
          href="/friends"
          className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-violet-600 dark:text-slate-400 dark:hover:text-violet-400"
        >
          <span aria-hidden="true">←</span> Back to friends
        </Link>

        <section className="mt-6 rounded-[2rem] border border-violet-500/15 bg-gradient-to-br from-violet-600/12 via-indigo-500/8 to-transparent p-7 md:p-9">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-violet-600 dark:text-violet-400">
            Friend profile
          </p>
          <h1 className="mt-2 text-3xl md:text-4xl font-black tracking-tight">
            @{friend.username}
          </h1>
          <p className="mt-2 text-sm font-medium text-slate-600 dark:text-slate-400">
            {friend.fullname}’s vocabulary and study collections.
          </p>
        </section>

        <div className="mt-8 flex flex-wrap gap-1.5 rounded-2xl border border-border bg-card p-1 w-fit">
          <button
            type="button"
            onClick={() => setActiveTab("added")}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${activeTab === "added" ? "bg-violet-600 text-white shadow-sm" : "text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"}`}
          >
            Words added ({addedWords.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("favorites")}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${activeTab === "favorites" ? "bg-violet-600 text-white shadow-sm" : "text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"}`}
          >
            Favourite words ({favoriteWords.length})
          </button>
          <button
            type="button"
            onClick={openPlaylists}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${activeTab === "playlists" ? "bg-violet-600 text-white shadow-sm" : "text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"}`}
          >
            Playlists
          </button>
        </div>

        {error && (
          <p className="mt-6 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm font-medium text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        {activeTab === "playlists" ? (
          <section className="mt-8">
            <div className="mb-5">
              <h2 className="text-lg font-black">
                {friend.username}’s playlists
              </h2>
              <p className="mt-1 text-sm font-medium text-slate-500">
                Study collections shared with you as a friend.
              </p>
            </div>
            {loadingPlaylists ? (
              <div className="flex justify-center py-16">
                <span className="h-9 w-9 rounded-full border-4 border-violet-500/15 border-t-violet-500 animate-spin" />
              </div>
            ) : playlists.length ? (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {playlists.map((playlist) => (
                  <Link
                    key={playlist._id}
                    href={`/friends/playlist?friendId=${friendId}&playlistId=${playlist._id}`}
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
              <div className="rounded-3xl border border-dashed border-border bg-card/40 px-6 py-16 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/10 text-2xl">
                  ☷
                </div>
                <h3 className="text-lg font-bold">No playlists yet</h3>
                <p className="mt-2 text-sm text-slate-500">
                  {friend.username} has not created any playlists.
                </p>
              </div>
            )}
          </section>
        ) : (
          <section className="mt-8">
            <div className="mb-5">
              <h2 className="text-lg font-black">{activeTitle}</h2>
              <p className="mt-1 text-sm font-medium text-slate-500">
                {activeTab === "added"
                  ? `Vocabulary contributed by ${friend.username}.`
                  : `Words ${friend.username} has marked as favourites.`}
              </p>
            </div>
            {activeWords.length ? (
              <VocabularyWordCards words={activeWords} />
            ) : (
              <div className="rounded-3xl border border-dashed border-border bg-card/40 px-6 py-16 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/10 text-2xl">
                  {activeTab === "added" ? "Aa" : "★"}
                </div>
                <h3 className="text-lg font-bold">No words here yet</h3>
                <p className="mt-2 text-sm text-slate-500">
                  {activeTab === "added"
                    ? `${friend.username} has not added vocabulary yet.`
                    : `${friend.username} has not marked any favourite words yet.`}
                </p>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

export default function FriendProfilePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background text-slate-900 dark:text-slate-100 flex flex-col">
          <Navbar />
          <main className="flex flex-1 items-center justify-center">
            <span className="h-10 w-10 rounded-full border-4 border-violet-500/15 border-t-violet-500 animate-spin" />
          </main>
        </div>
      }
    >
      <FriendProfileContent />
    </Suspense>
  );
}
