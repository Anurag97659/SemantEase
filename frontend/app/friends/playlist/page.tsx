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

interface FriendPlaylist {
  _id: string;
  name: string;
  words: VocabularyWord[];
  friend: Friend;
}

function FriendPlaylistContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const friendId = searchParams.get("friendId");
  const playlistId = searchParams.get("playlistId");
  const [playlist, setPlaylist] = useState<FriendPlaylist | null>(null);
  const [loading, setLoading] = useState(() => Boolean(friendId && playlistId));
  const [error, setError] = useState("");

  useEffect(() => {
    if (!friendId || !playlistId) return;

    apiFetch(`/WoahCab/social/friend/${friendId}/playlists/${playlistId}`)
      .then((response) => setPlaylist(response?.data || null))
      .catch((err: unknown) => {
        const message =
          err instanceof Error ? err.message : "Could not load friend playlist";
        if (message.includes("Unauthorized") || message.includes("401"))
          router.push("/login");
        else setError(message);
      })
      .finally(() => setLoading(false));
  }, [friendId, playlistId, router]);

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

  if (!friendId || !playlistId) {
    return (
      <div className="min-h-screen bg-background text-slate-900 dark:text-slate-100 flex flex-col">
        <Navbar />
        <main className="flex flex-1 flex-col items-center justify-center p-6 text-center">
          <h1 className="text-2xl font-black">Playlist unavailable</h1>
          <p className="mt-2 text-sm text-slate-500">
            Playlist information is missing.
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

  if (error || !playlist) {
    return (
      <div className="min-h-screen bg-background text-slate-900 dark:text-slate-100 flex flex-col">
        <Navbar />
        <main className="flex flex-1 flex-col items-center justify-center p-6 text-center">
          <h1 className="text-2xl font-black">Playlist unavailable</h1>
          <p className="mt-2 text-sm text-slate-500">
            {error || "This playlist is no longer available."}
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

  return (
    <div className="min-h-screen bg-background text-slate-900 dark:text-slate-100 flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-6xl w-full mx-auto p-6 md:p-8">
        <Link
          href={`/friends/profile?id=${friendId}`}
          className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-violet-600 dark:text-slate-400 dark:hover:text-violet-400"
        >
          <span aria-hidden="true">←</span> Back to @{playlist.friend.username}
        </Link>
        <section className="mt-6 rounded-[2rem] border border-violet-500/15 bg-gradient-to-br from-violet-600/12 via-indigo-500/8 to-transparent p-7 md:p-9">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-violet-600 dark:text-violet-400">
            @{playlist.friend.username}’s playlist
          </p>
          <h1 className="mt-2 break-words text-3xl md:text-4xl font-black tracking-tight">
            {playlist.name}
          </h1>
          <p className="mt-2 text-sm font-medium text-slate-600 dark:text-slate-400">
            {playlist.words.length}{" "}
            {playlist.words.length === 1 ? "word" : "words"} in this collection
          </p>
        </section>
        <section className="mt-8">
          <h2 className="mb-5 text-lg font-black">Words in this playlist</h2>
          {playlist.words.length ? (
            <VocabularyWordCards words={playlist.words} />
          ) : (
            <div className="rounded-3xl border border-dashed border-border bg-card/40 px-6 py-16 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/10 text-2xl">
                ☷
              </div>
              <h3 className="text-lg font-bold">This playlist is empty</h3>
              <p className="mt-2 text-sm text-slate-500">
                There are no words in this collection yet.
              </p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default function FriendPlaylistPage() {
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
      <FriendPlaylistContent />
    </Suspense>
  );
}
