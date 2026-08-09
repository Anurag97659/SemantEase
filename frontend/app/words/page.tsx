"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "../../components/Navbar";
import { apiFetch } from "../../utils/api";
import PronunciationEngine from "../../components/PronunciationEngine";

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

export default function WordListPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<{ _id: string; username: string } | null>(null);
  const [words, setWords] = useState<WordItem[]>([]);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"all" | "mine" | "important">("all");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest" | "username">("newest");
  const [usernameFilter, setUsernameFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [starringWordId, setStarringWordId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [hasRestoredScroll, setHasRestoredScroll] = useState(false);

  
  useEffect(() => {
    if (typeof window !== "undefined" && "scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }

    if (sessionStorage.getItem("words_restore_needed") === "true") {
      const savedSearch = sessionStorage.getItem("words_search");
      const savedFilterType = sessionStorage.getItem("words_filter_type");
      const savedSortOrder = sessionStorage.getItem("words_sort_order");
      const savedUsernameFilter = sessionStorage.getItem("words_username_filter");

      if (savedSearch !== null) setSearch(savedSearch);
      if (savedFilterType === "all" || savedFilterType === "mine" || savedFilterType === "important") {
        setFilterType(savedFilterType);
      }
      if (savedSortOrder === "newest" || savedSortOrder === "oldest" || savedSortOrder === "username") {
        setSortOrder(savedSortOrder);
      }
      if (savedUsernameFilter !== null) setUsernameFilter(savedUsernameFilter);
    }
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 0) {
        sessionStorage.setItem("words_scroll_pos", window.scrollY.toString());
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const saveStateBeforeNavigate = () => {
    sessionStorage.setItem("words_scroll_pos", window.scrollY.toString());
    sessionStorage.setItem("words_filter_type", filterType);
    sessionStorage.setItem("words_sort_order", sortOrder);
    sessionStorage.setItem("words_search", search);
    sessionStorage.setItem("words_username_filter", usernameFilter);
    sessionStorage.setItem("words_restore_needed", "true");
  };

  
  useEffect(() => {
    if (!loading && !searchLoading && words.length > 0 && !hasRestoredScroll) {
      if (sessionStorage.getItem("words_restore_needed") === "true") {
        const savedPos = sessionStorage.getItem("words_scroll_pos");
        if (savedPos) {
          const scrollY = parseInt(savedPos, 10);
          if (!isNaN(scrollY) && scrollY > 0) {
            setHasRestoredScroll(true);
            requestAnimationFrame(() => {
              window.scrollTo({ top: scrollY, behavior: "instant" });
              setTimeout(() => {
                window.scrollTo({ top: scrollY, behavior: "instant" });
              }, 60);
            });
          }
        }
        sessionStorage.removeItem("words_restore_needed");
      }
    }
  }, [loading, searchLoading, words, hasRestoredScroll]);

  useEffect(() => {
    apiFetch("/WoahCab/users/getProfile")
      .then((res) => {
        if (res?.data) {
          setCurrentUser(res.data);
        }
      })
      .catch(() => {})
      .finally(() => {
        setLoading(false);
      });
  }, []);

  // 2. Debounced API Semantic Search
  useEffect(() => {
    // If query is empty, fetch all words
    if (!search.trim()) {
      setSearchLoading(false);
      apiFetch("/WoahCab/words/getwords")
        .then((res) => {
          if (res?.data) {
            setWords(res.data);
          }
        })
        .catch((err) => {
          setError(err.message || "Failed to load vocabulary");
          if (err.message?.includes("Unauthorized") || err.message?.includes("401")) {
            router.push("/login");
          }
        });
      return;
    }

    setSearchLoading(true);
    const delayDebounce = setTimeout(async () => {
      try {
        const res = await apiFetch(`/WoahCab/words/search?q=${encodeURIComponent(search.trim())}`);
        if (res?.data) {
          setWords(res.data);
        }
      } catch (err: any) {
        console.error("Semantic search failed:", err);
      } finally {
        setSearchLoading(false);
      }
    }, 600); // 600ms debounce to give natural typing space

    return () => clearTimeout(delayDebounce);
  }, [search, router]);

  const handleToggleStar = async (wordId: string) => {
    if (!currentUser) {
      router.push("/login");
      return;
    }

    setStarringWordId(wordId);
    setError("");

    try {
      const res = await apiFetch(`/WoahCab/words/star/${wordId}`, {
        method: "PATCH",
      });
      if (res?.data) {
        setWords((currentWords) =>
          currentWords.map((word) => (word._id === wordId ? res.data : word))
        );
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update important words");
    } finally {
      setStarringWordId(null);
    }
  };

  const filteredWords = words.filter((item) => {
    if (filterType === "mine") {
      if (!currentUser || !item.createdBy || item.createdBy._id !== currentUser._id) {
        return false;
      }
    }
    if (filterType === "important" && !item.isStarred) {
      return false;
    }
    if (sortOrder === "username" && usernameFilter.trim()) {
      if (!item.createdBy || !item.createdBy.username.toLowerCase().includes(usernameFilter.trim().toLowerCase())) {
        return false;
      }
    }
    return true;
  })
  .sort((firstWord, secondWord) => {
      if (sortOrder === "username") return 0; // preserve API order when filtering by username
      const timeDifference = new Date(firstWord.createdAt || 0).getTime() - new Date(secondWord.createdAt || 0).getTime();
      return sortOrder === "newest" ? -timeDifference : timeDifference;
    });

const formatUploadDate = (date?: string) => {
    if (!date) return "";
    return new Intl.DateTimeFormat("en", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(date));
  };

  return (
    <div className="min-h-screen bg-background text-slate-900 dark:text-slate-100 flex flex-col transition-colors duration-300">
      <Navbar />

      <main className="flex-1 max-w-6xl w-full mx-auto p-6 md:p-8">
        
        {/* Dashboard Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">Your Vocabulary Bank</h1>
            <p className="text-slate-600 dark:text-slate-400 text-sm mt-1 font-medium">
              Browse, search, and manage words generated via Gemini AI.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            {/* Vocabulary sections */}
            <div className="flex gap-1.5 p-1 bg-card border border-border rounded-2xl w-fit shrink-0 shadow-sm">
              <button
                type="button"
                onClick={() => setFilterType("all")}
                className={`py-2 px-4 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  filterType === "all"
                    ? "bg-violet-600 text-white shadow-sm"
                    : "text-slate-600 dark:text-slate-450 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                All Words
              </button>
              <button
                type="button"
                onClick={() => setFilterType("mine")}
                className={`py-2 px-4 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  filterType === "mine"
                    ? "bg-violet-600 text-white shadow-sm"
                    : "text-slate-600 dark:text-slate-450 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                My Words
              </button>
              <button
                type="button"
                onClick={() => setFilterType("important")}
                className={`py-2 px-4 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                  filterType === "important"
                    ? "bg-violet-600 text-white shadow-sm"
                    : "text-slate-600 dark:text-slate-450 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="m12 2.5 2.94 5.96 6.58.96-4.76 4.64 1.12 6.56L12 17.54l-5.88 3.09 1.12-6.56-4.76-4.64 6.58-.96L12 2.5Z" />
                </svg>
                Important
              </button>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 shrink-0">
              <div className="relative">
                <label htmlFor="word-sort" className="sr-only">Sort words</label>
                <select
                  id="word-sort"
                  value={sortOrder}
                  onChange={(event) => {
                    setSortOrder(event.target.value as "newest" | "oldest" | "username");
                    if (event.target.value !== "username") setUsernameFilter("");
                  }}
                  className="appearance-none w-full bg-card border border-border rounded-2xl py-3 pl-4 pr-10 text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30 cursor-pointer"
                >
                  <option value="newest">Newest to Oldest</option>
                  <option value="oldest">Oldest to Newest</option>
                  <option value="username">By Username</option>
                </select>
                <svg className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m7 10 5 5 5-5" />
                </svg>
              </div>

              {/* Username filter input — visible only when "By Username" is selected */}
              {sortOrder === "username" && (
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </span>
                  <input
                    id="username-filter"
                    type="text"
                    autoFocus
                    placeholder="Enter username…"
                    value={usernameFilter}
                    onChange={(e) => setUsernameFilter(e.target.value)}
                    className="w-44 pl-9 pr-4 py-3 bg-card border border-violet-500 ring-1 ring-violet-500/30 rounded-2xl text-slate-900 dark:text-slate-100 placeholder-slate-450 dark:placeholder-slate-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30 transition-all text-xs font-bold"
                  />
                  {usernameFilter && (
                    <button
                      type="button"
                      onClick={() => setUsernameFilter("")}
                      aria-label="Clear username filter"
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Search Input (with loading indicator) */}
            <div className="relative flex-1 sm:w-80">
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
                placeholder="Ask Google-like semantic query (e.g. lasts very short time)..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-card border border-border rounded-2xl text-slate-900 dark:text-slate-100 placeholder-slate-450 dark:placeholder-slate-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30 transition-all text-sm font-semibold"
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-sm text-center font-medium">
            {error}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div key={idx} className="bg-card border border-border rounded-3xl p-6 h-48 animate-pulse flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="h-6 w-1/3 bg-slate-200 dark:bg-slate-800 rounded-lg" />
                  <div className="h-4 w-5/6 bg-slate-200 dark:bg-slate-800 rounded-lg" />
                  <div className="h-4 w-4/6 bg-slate-200 dark:bg-slate-800 rounded-lg" />
                </div>
                <div className="h-5 w-1/4 bg-slate-200 dark:bg-slate-800 rounded-lg" />
              </div>
            ))}
          </div>
        ) : filteredWords.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredWords.map((item) => {
              const isMine = currentUser && item.createdBy && item.createdBy._id === currentUser._id;
              return (
                <article
                  key={item._id}
                  className="group flex flex-col justify-between bg-card hover:bg-card-hover border border-border rounded-3xl p-6 shadow-lg transition-all duration-300 hover:shadow-violet-650/5 hover:-translate-y-0.5 cursor-pointer relative overflow-hidden"
                >
                  {/* Subtle color highlight if it's user's own word */}
                  {isMine && (
                    <div className="absolute top-0 right-0 w-3 h-3 bg-violet-650 rounded-bl-lg" />
                  )}

                  <button
                    type="button"
                    onClick={() => handleToggleStar(item._id)}
                    disabled={starringWordId === item._id}
                    aria-label={item.isStarred ? `Remove ${item.word} from important words` : `Mark ${item.word} as important`}
                    aria-pressed={Boolean(item.isStarred)}
                    title={item.isStarred ? "Remove from important words" : "Mark as important"}
                    className={`absolute top-5 right-5 z-10 flex h-9 w-9 items-center justify-center rounded-xl border transition-all disabled:cursor-wait disabled:opacity-60 ${
                      item.isStarred
                        ? "border-amber-400/40 bg-amber-400/15 text-amber-500"
                        : "border-border bg-background text-slate-400 hover:border-amber-400/40 hover:text-amber-500"
                    }`}
                  >
                    <svg className="h-4 w-4" fill={item.isStarred ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m12 3 2.78 5.63 6.22.9-4.5 4.39 1.06 6.2L12 17.24l-5.56 2.92 1.06-6.2L3 9.53l6.22-.9L12 3Z" />
                    </svg>
                  </button>

                  <Link href={`/words/details?id=${item._id}`} onClick={saveStateBeforeNavigate} className="block h-full">
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
                          by @{item.createdBy.username}{item.createdAt && ` · ${formatUploadDate(item.createdAt)}`}
                        </span>
                      )}
                    </div>

                    <p className="text-slate-650 dark:text-slate-400 text-sm line-clamp-2 mb-4 leading-relaxed font-semibold">
                      {item.definitions[0]?.definition || "No definition available."}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-4 border-t border-border">
                    {Array.from(new Set(item.definitions.map((d) => d.partOfSpeech))).map((pos) => (
                      <span
                        key={pos}
                        className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-violet-600/10 text-violet-650 dark:text-violet-400 border border-violet-500/10"
                      >
                        {pos}
                      </span>
                    ))}
                    {item.synonyms.length > 0 && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-indigo-500/5 text-indigo-650 dark:text-indigo-400 border border-indigo-500/5 ml-auto">
                        {item.synonyms.length} synonyms
                      </span>
                    )}
                    {item.antonyms.length > 0 && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-indigo-500/5 text-indigo-650 dark:text-indigo-400 border border-indigo-500/5 ml-auto">
                        {item.antonyms.length} antonyms
                      </span>
                    )}
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
              );
            })}
          </div>
        ) : (
          <div className="backdrop-blur-xl bg-card border border-border rounded-3xl p-16 text-center shadow-xl max-w-lg mx-auto mt-12 animate-fade-in">
            <div className="w-16 h-16 bg-background border border-border text-slate-450 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <h2 className="text-xl font-bold mb-2">No Words Found</h2>
            <p className="text-slate-550 dark:text-slate-450 text-sm mb-8 font-semibold">
              {search 
                ? "No matching vocabulary found. Try another description!" 
                : sortOrder === "username" && usernameFilter.trim()
                  ? `No words found for username "${usernameFilter.trim()}". Try a different username.`
                : filterType === "mine"
                  ? "You haven't generated any words yet. Switch back to 'All Words' or submit a new word!"
                  : filterType === "important"
                    ? "You haven't marked any words as important yet. Use the star beside a word to save it here."
                  : "Your vocabulary bank is empty. Get started by adding your first word!"}
            </p>
            {(!search && filterType === "all") && (
              <Link
                href="/words/submit"
                className="py-3.5 px-6 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold rounded-2xl transition-all shadow-lg shadow-violet-600/10 active:scale-95"
              >
                Add Your First Word
              </Link>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
