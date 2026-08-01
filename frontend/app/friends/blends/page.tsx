"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Navbar from "../../../components/Navbar";
import { apiFetch } from "../../../utils/api";
import PronunciationEngine from "../../../components/PronunciationEngine";

interface Definition {
  partOfSpeech: string;
  definition: string;
}

interface WordItem {
  _id: string;
  word: string;
  phonetic?: string;
  definitions: Definition[];
  synonyms: string[];
  antonyms: string[];
  examples: string[];
  note?: string;
  isStarred?: boolean;
  createdAt?: string;
  createdBy?: {
    _id: string;
    username: string;
  };
}

interface BlendData {
  _id: string;
  title: string;
  members: { _id: string; username: string; fullname: string }[];
}

function BlendDetailsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const blendId = searchParams.get("id");

  const [blend, setBlend] = useState<BlendData | null>(null);
  const [words, setWords] = useState<WordItem[]>([]);
  const [currentUser, setCurrentUser] = useState<{ _id: string } | null>(null);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"all" | "mine" | "important">("all");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [starringWordId, setStarringWordId] = useState<string | null>(null);
  const [deletingBlend, setDeletingBlend] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!blendId) return;
    Promise.all([
      apiFetch("/WoahCab/users/getProfile"),
      apiFetch(`/WoahCab/social/blend/${blendId}`),
      apiFetch(`/WoahCab/social/blend/${blendId}/words`),
    ])
      .then(([profileRes, blendRes, wordsRes]) => {
        setCurrentUser(profileRes?.data || null);
        setBlend(blendRes?.data || null);
        setWords(wordsRes?.data || []);
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : "Failed to load blend";
        if (message.includes("Unauthorized") || message.includes("401")) {
          router.push("/login");
          return;
        }
        setError(message);
      })
      .finally(() => setLoading(false));
  }, [blendId, router]);

  useEffect(() => {
    if (!blendId) return;

    if (!search.trim()) {
      apiFetch(`/WoahCab/social/blend/${blendId}/words`)
        .then((res) => setWords(res?.data || []))
        .catch((err: unknown) =>
          setError(err instanceof Error ? err.message : "Failed to load blend words")
        )
        .finally(() => setSearchLoading(false));
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const response = await apiFetch(
          `/WoahCab/social/blend/${blendId}/search?q=${encodeURIComponent(search.trim())}`
        );
        setWords(response?.data || []);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Semantic search failed");
      } finally {
        setSearchLoading(false);
      }
    }, 550);

    return () => clearTimeout(timer);
  }, [blendId, search]);

  const handleToggleStar = async (wordId: string) => {
    if (!currentUser) {
      router.push("/login");
      return;
    }
    setStarringWordId(wordId);
    setError("");
    try {
      const response = await apiFetch(`/WoahCab/words/star/${wordId}`, {
        method: "PATCH",
      });
      setWords((current) =>
        current.map((entry) => (entry._id === wordId ? response.data : entry))
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update important words");
    } finally {
      setStarringWordId(null);
    }
  };

  const handleDeleteBlend = async () => {
    if (!blendId) return;
    if (!window.confirm("Delete this blend for all members?")) {
      return;
    }
    setDeletingBlend(true);
    setError("");
    try {
      await apiFetch(`/WoahCab/social/blend/${blendId}`, { method: "DELETE" });
      router.push("/friends");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not delete blend");
      setDeletingBlend(false);
    }
  };

  const filteredWords = useMemo(() => {
    return [...words]
      .filter((word) => {
        if (filterType === "mine") {
          return Boolean(currentUser && word.createdBy?._id === currentUser._id);
        }
        if (filterType === "important") {
          return Boolean(word.isStarred);
        }
        return true;
      })
      .sort((firstWord, secondWord) => {
        const difference =
          new Date(firstWord.createdAt || 0).getTime() -
          new Date(secondWord.createdAt || 0).getTime();
        return sortOrder === "newest" ? -difference : difference;
      });
  }, [words, filterType, currentUser, sortOrder]);

  if (!blendId) {
    return (
      <div className="min-h-screen bg-background text-slate-900 dark:text-slate-100 flex flex-col">
        <Navbar />
        <main className="flex-1 max-w-6xl w-full mx-auto p-6 md:p-8">
          <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4 text-sm font-medium text-red-600 dark:text-red-400">
            Blend ID is missing. Open this page from the blends list in Friends.
          </div>
        </main>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-slate-900 dark:text-slate-100 flex flex-col">
        <Navbar />
        <main className="flex-1 max-w-6xl w-full mx-auto p-6 md:p-8 flex items-center justify-center">
          <div className="w-10 h-10 rounded-full border-4 border-violet-500/15 border-t-violet-500 animate-spin" />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-slate-900 dark:text-slate-100 flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-6xl w-full mx-auto p-6 md:p-8">
        <div className="mb-5">
          <div className="flex items-center justify-between gap-3">
            <Link href="/friends" className="text-sm font-semibold text-violet-600 hover:underline">
              ← Back to Friends
            </Link>
            <button
              type="button"
              onClick={handleDeleteBlend}
              disabled={deletingBlend}
              className="rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 text-xs font-bold px-3 py-2 disabled:opacity-60 cursor-pointer"
            >
              {deletingBlend ? "Deleting…" : "Delete Blend"}
            </button>
          </div>
        </div>

        <section className="rounded-[2rem] border border-violet-500/15 bg-gradient-to-br from-violet-600/12 via-indigo-500/8 to-transparent p-7 md:p-10 mb-8">
          <h1 className="text-3xl md:text-4xl font-black tracking-tight">
            {blend?.title || "Blend"}
          </h1>
          <p className="mt-2 text-sm font-medium text-slate-600 dark:text-slate-400 max-w-2xl">
            Blended vocabulary from {blend?.members?.length || 0} members including you.
          </p>
        </section>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-6">
          <div className="flex gap-1.5 p-1 bg-card border border-border rounded-2xl w-fit">
            <button type="button" onClick={() => setFilterType("all")} className={`py-2 px-4 text-xs font-bold rounded-xl transition-all cursor-pointer ${filterType === "all" ? "bg-violet-600 text-white shadow-sm" : "text-slate-600 dark:text-slate-450 hover:text-slate-800 dark:hover:text-slate-200"}`}>
              All Words
            </button>
            <button type="button" onClick={() => setFilterType("mine")} className={`py-2 px-4 text-xs font-bold rounded-xl transition-all cursor-pointer ${filterType === "mine" ? "bg-violet-600 text-white shadow-sm" : "text-slate-600 dark:text-slate-450 hover:text-slate-800 dark:hover:text-slate-200"}`}>
              My Words
            </button>
            <button type="button" onClick={() => setFilterType("important")} className={`py-2 px-4 text-xs font-bold rounded-xl transition-all cursor-pointer ${filterType === "important" ? "bg-violet-600 text-white shadow-sm" : "text-slate-600 dark:text-slate-450 hover:text-slate-800 dark:hover:text-slate-200"}`}>
              Important
            </button>
          </div>

          <select
            value={sortOrder}
            onChange={(event) => setSortOrder(event.target.value as "newest" | "oldest")}
            className="appearance-none bg-card border border-border rounded-2xl py-3 pl-4 pr-10 text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30 cursor-pointer"
          >
            <option value="newest">Newest to Oldest</option>
            <option value="oldest">Oldest to Newest</option>
          </select>
        </div>

        <div className="relative mb-8">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
            {searchLoading ? (
              <div className="w-4 h-4 rounded-full border-2 border-t-violet-500 border-indigo-500/10 animate-spin" />
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            )}
          </span>
          <input
            type="text"
            placeholder="Semantic search in this blend..."
            value={search}
            onChange={(event) => {
              const value = event.target.value;
              setSearch(value);
              setSearchLoading(Boolean(value.trim()));
            }}
            className="w-full pl-10 pr-4 py-3 bg-card border border-border rounded-2xl text-slate-900 dark:text-slate-100 placeholder-slate-450 dark:placeholder-slate-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30 transition-all text-sm font-semibold"
          />
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-sm text-center font-medium">
            {error}
          </div>
        )}

        {filteredWords.length ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredWords.map((item) => (
              <article key={item._id} className="group flex flex-col justify-between bg-card hover:bg-card-hover border border-border rounded-3xl p-6 shadow-lg transition-all duration-300 hover:shadow-violet-650/5 hover:-translate-y-0.5 cursor-pointer relative overflow-hidden">
                <button
                  type="button"
                  onClick={() => handleToggleStar(item._id)}
                  disabled={starringWordId === item._id}
                  aria-label={item.isStarred ? `Remove ${item.word} from important words` : `Mark ${item.word} as important`}
                  aria-pressed={Boolean(item.isStarred)}
                  title={item.isStarred ? "Remove from important words" : "Mark as important"}
                  className={`absolute top-5 right-5 z-10 flex h-9 w-9 items-center justify-center rounded-xl border transition-all disabled:cursor-wait disabled:opacity-60 ${item.isStarred ? "border-amber-400/40 bg-amber-400/15 text-amber-500" : "border-border bg-background text-slate-400 hover:border-amber-400/40 hover:text-amber-500"}`}
                >
                  <svg className="h-4 w-4" fill={item.isStarred ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m12 3 2.78 5.63 6.22.9-4.5 4.39 1.06 6.2L12 17.24l-5.56 2.92 1.06-6.2L3 9.53l6.22-.9L12 3Z" />
                  </svg>
                </button>
                <Link href={`/words/details?id=${item._id}`} className="block h-full">
                  <div>
                    <div className="flex flex-col gap-1 mb-4 pr-10">
                      <div className="flex items-center gap-2">
                        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 group-hover:text-violet-650 dark:group-hover:text-violet-400 transition-colors capitalize">
                          {item.word}
                        </h2>
                        <PronunciationEngine word={item.word} showAccentSelector={false} size="sm" />
                      </div>
                      {item.createdBy && (
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                          by @{item.createdBy.username}
                        </span>
                      )}
                    </div>
                    <p className="text-slate-650 dark:text-slate-400 text-sm line-clamp-2 mb-4 leading-relaxed font-semibold">
                      {item.definitions[0]?.definition || "No definition available."}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-4 border-t border-border">
                    {Array.from(new Set(item.definitions.map((definition) => definition.partOfSpeech))).map((partOfSpeech) => (
                      <span key={partOfSpeech} className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-violet-600/10 text-violet-650 dark:text-violet-400 border border-violet-500/10">
                        {partOfSpeech}
                      </span>
                    ))}
                  </div>

                  {item.note && (
                    <div className="mt-4 pt-4 border-t border-border">
                      <span className="inline-flex text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-violet-600/10 text-violet-650 dark:text-violet-400 border border-violet-500/10 mb-2">
                        Your note
                      </span>
                      <p className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-slate-650 dark:text-slate-400 leading-relaxed font-medium line-clamp-3 whitespace-pre-wrap">
                        {item.note}
                      </p>
                    </div>
                  )}
                </Link>
              </article>
            ))}
          </div>
        ) : (
          <div className="backdrop-blur-xl bg-card border border-border rounded-3xl p-16 text-center shadow-xl max-w-lg mx-auto mt-12">
            <h2 className="text-xl font-bold mb-2">No Words Found</h2>
            <p className="text-slate-550 dark:text-slate-450 text-sm font-semibold">
              {search
                ? "No matching vocabulary found for this blend. Try another query."
                : filterType === "mine"
                  ? "No words from your account in this blend yet."
                  : filterType === "important"
                    ? "No important words in this blend yet."
                    : "This blend has no words yet."}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

export default function BlendDetailsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background text-slate-900 dark:text-slate-100 flex flex-col">
          <Navbar />
          <main className="flex-1 max-w-6xl w-full mx-auto p-6 md:p-8 flex items-center justify-center">
            <div className="w-10 h-10 rounded-full border-4 border-violet-500/15 border-t-violet-500 animate-spin" />
          </main>
        </div>
      }
    >
      <BlendDetailsContent />
    </Suspense>
  );
}
