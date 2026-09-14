"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Navbar from "../../../components/Navbar";
import PlaylistWordPicker, {
  PlaylistWord,
} from "../../../components/PlaylistWordPicker";
import PronunciationEngine from "../../../components/PronunciationEngine";
import { apiFetch } from "../../../utils/api";

interface Playlist {
  _id: string;
  name: string;
  words: PlaylistWord[];
  createdAt: string;
  updatedAt: string;
}

function PlaylistDetailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const playlistId = searchParams.get("id");
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isAddingWords, setIsAddingWords] = useState(false);
  const [selectedWordIds, setSelectedWordIds] = useState<string[]>([]);
  const [savingWords, setSavingWords] = useState(false);

  useEffect(() => {
    if (!playlistId) return;
    apiFetch(`/WoahCab/playlists/${playlistId}`)
      .then((response) => setPlaylist(response?.data || null))
      .catch((err: unknown) => {
        const message =
          err instanceof Error ? err.message : "Could not load playlist";
        if (message.includes("Unauthorized") || message.includes("401"))
          router.push("/login");
        else setError(message);
      })
      .finally(() => setLoading(false));
  }, [playlistId, router]);

  const toggleWord = (wordId: string) => {
    setSelectedWordIds((currentIds) =>
      currentIds.includes(wordId)
        ? currentIds.filter((id) => id !== wordId)
        : [...currentIds, wordId],
    );
  };

  const addWords = async () => {
    if (!selectedWordIds.length || !playlist) return;
    setSavingWords(true);
    setError("");
    try {
      const response = await apiFetch(
        `/WoahCab/playlists/${playlist._id}/words`,
        {
          method: "POST",
          body: JSON.stringify({ wordIds: selectedWordIds }),
        },
      );
      setPlaylist(response.data);
      setSelectedWordIds([]);
      setIsAddingWords(false);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Could not add words to playlist",
      );
    } finally {
      setSavingWords(false);
    }
  };

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

  if (error && !playlist) {
    return (
      <div className="min-h-screen bg-background text-slate-900 dark:text-slate-100 flex flex-col">
        <Navbar />
        <main className="flex flex-1 flex-col items-center justify-center p-6 text-center">
          <h1 className="text-2xl font-black">Playlist unavailable</h1>
          <p className="mt-2 text-sm text-slate-500">{error}</p>
          <Link
            href="/playlists"
            className="mt-6 text-sm font-bold text-violet-600 hover:underline dark:text-violet-400"
          >
            Back to playlists
          </Link>
        </main>
      </div>
    );
  }

  if (!playlist) return null;

  return (
    <div className="min-h-screen bg-background text-slate-900 dark:text-slate-100 flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-6xl w-full mx-auto p-6 md:p-8">
        <Link
          href="/playlists"
          className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-violet-600 dark:text-slate-400 dark:hover:text-violet-400"
        >
          <span aria-hidden="true">←</span> Back to playlists
        </Link>
        <section className="mt-6 rounded-[2rem] border border-violet-500/15 bg-gradient-to-br from-violet-600/12 via-indigo-500/8 to-transparent p-7 md:p-9">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-violet-600 dark:text-violet-400">
                Playlist
              </p>
              <h1 className="mt-2 break-words text-3xl md:text-4xl font-black tracking-tight">
                {playlist.name}
              </h1>
              <p className="mt-2 text-sm font-medium text-slate-600 dark:text-slate-400">
                {playlist.words.length}{" "}
                {playlist.words.length === 1 ? "word" : "words"} in this
                collection
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsAddingWords((visible) => !visible)}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-violet-600 px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-violet-600/20 transition-colors hover:bg-violet-500"
            >
              <span className="text-lg leading-none">+</span> Add words
            </button>
          </div>
        </section>

        {error && (
          <p className="mt-6 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm font-medium text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        {isAddingWords && (
          <section className="mt-7">
            <PlaylistWordPicker
              selectedWordIds={selectedWordIds}
              onToggleWord={toggleWord}
              unavailableWordIds={playlist.words.map((word) => word._id)}
            />
            <div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={savingWords}
                onClick={() => {
                  setIsAddingWords(false);
                  setSelectedWordIds([]);
                }}
                className="rounded-xl px-4 py-3 text-sm font-bold text-slate-600 hover:bg-card-hover dark:text-slate-300 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={addWords}
                disabled={savingWords || !selectedWordIds.length}
                className="rounded-xl bg-violet-600 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {savingWords
                  ? "Adding…"
                  : `Add ${selectedWordIds.length || ""} word${selectedWordIds.length === 1 ? "" : "s"}`}
              </button>
            </div>
          </section>
        )}

        <section className="mt-8">
          <div className="mb-5 flex items-center justify-between gap-4">
            <h2 className="text-lg font-black">Words in this playlist</h2>
          </div>
          {playlist.words.length ? (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {playlist.words.map((word) => {
                const firstDefinition = word.definitions?.[0];
                const partsOfSpeech = Array.from(
                  new Set(
                    (word.definitions || []).map(
                      (definition) => definition.partOfSpeech,
                    ),
                  ),
                );
                const synonyms = word.synonyms || [];
                const antonyms = word.antonyms || [];

                return (
                  <article
                    key={word._id}
                    className="group flex flex-col justify-between overflow-hidden rounded-3xl border border-border bg-card p-6 shadow-lg transition-all duration-300 hover:-translate-y-0.5 hover:bg-card-hover hover:shadow-violet-650/5"
                  >
                    <Link
                      href={`/words/details?id=${word._id}`}
                      className="block h-full"
                    >
                      <div>
                        <div className="mb-4 flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <h3 className="text-xl font-bold capitalize text-slate-900 transition-colors group-hover:text-violet-650 dark:text-slate-100 dark:group-hover:text-violet-400">
                              {word.word}
                            </h3>
                            <PronunciationEngine
                              word={word.word}
                              showAccentSelector={false}
                              size="sm"
                            />
                          </div>
                          {word.phonetic && (
                            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                              {word.phonetic}
                            </span>
                          )}
                        </div>

                        <p className="mb-4 line-clamp-2 text-sm font-semibold leading-relaxed text-slate-650 dark:text-slate-400">
                          {firstDefinition?.definition ||
                            "No definition available."}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-1.5 border-t border-border pt-4">
                        {partsOfSpeech.map((partOfSpeech) => (
                          <span
                            key={partOfSpeech}
                            className="rounded-md border border-violet-500/10 bg-violet-600/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-violet-650 dark:text-violet-400"
                          >
                            {partOfSpeech}
                          </span>
                        ))}
                        {synonyms.length > 0 && (
                          <span className="ml-auto rounded-md border border-indigo-500/5 bg-indigo-500/5 px-2 py-0.5 text-[10px] font-semibold text-indigo-650 dark:text-indigo-400">
                            {synonyms.length} synonyms
                          </span>
                        )}
                        {antonyms.length > 0 && (
                          <span className="ml-auto rounded-md border border-indigo-500/5 bg-indigo-500/5 px-2 py-0.5 text-[10px] font-semibold text-indigo-650 dark:text-indigo-400">
                            {antonyms.length} antonyms
                          </span>
                        )}
                      </div>
                    </Link>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-border bg-card/40 px-6 py-16 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/10 text-2xl">
                +
              </div>
              <h3 className="text-lg font-bold">This playlist is empty</h3>
              <p className="mt-2 text-sm text-slate-500">
                Add words now, or come back whenever you find useful vocabulary.
              </p>
              <button
                type="button"
                onClick={() => setIsAddingWords(true)}
                className="mt-5 text-sm font-bold text-violet-600 hover:underline dark:text-violet-400"
              >
                Add words
              </button>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default function PlaylistDetailPage() {
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
      <PlaylistDetailContent />
    </Suspense>
  );
}
