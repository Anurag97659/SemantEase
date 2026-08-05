"use client";

import { useEffect, useState, Suspense } from "react";
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
  updatedAt?: string;
  createdBy?: {
    _id: string;
    username: string;
    fullname: string;
  };
}

function WordDetailsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get("id");

  const [currentUser, setCurrentUser] = useState<{ _id: string; username: string } | null>(null);
  const [wordData, setWordData] = useState<WordItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [note, setNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [deletingNote, setDeletingNote] = useState(false);
  const [noteError, setNoteError] = useState("");
  const [togglingStar, setTogglingStar] = useState(false);
  const [starError, setStarError] = useState("");
  const [error, setError] = useState("");


  useEffect(() => {
    // 1. Fetch current logged-in user profile
    apiFetch("/WoahCab/users/getProfile")
      .then((res) => {
        if (res?.data) {
          setCurrentUser(res.data);
        }
      })
      .catch(() => {});

    // 2. Fetch word details
    if (!id) return;
    apiFetch(`/WoahCab/words/getword/${id}`)
      .then((res) => {
        if (res?.data) {
          setWordData(res.data);
          setNote(res.data.note || "");
        }
      })
      .catch((err) => {
        setError(err.message || "Failed to load word details");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [id]);

  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to delete this word?")) return;
    setDeleting(true);
    setError("");

    try {
      await apiFetch(`/WoahCab/words/deleteword/${id}`, {
        method: "DELETE",
      });
      router.push("/words");
    } catch (err: any) {
      setError(err.message || "Failed to delete word");
      setDeleting(false);
    }
  };

  const handleToggleStar = async () => {
    if (!id || !currentUser) {
      router.push("/login");
      return;
    }

    setTogglingStar(true);
    setStarError("");
    try {
      const res = await apiFetch(`/WoahCab/words/star/${id}`, { method: "PATCH" });
      if (res?.data) {
        setWordData(res.data);
      }
    } catch (err: unknown) {
      setStarError(err instanceof Error ? err.message : "Failed to update important words");
    } finally {
      setTogglingStar(false);
    }
  };

  const handleSaveNote = async () => {
    if (!id || !currentUser || !note.trim()) return;

    setSavingNote(true);
    setNoteError("");

    try {
      const res = await apiFetch(`/WoahCab/words/note/${id}`, {
        method: "PUT",
        body: JSON.stringify({ note }),
      });
      if (res?.data) {
        setWordData(res.data);
        setNote(res.data.note || "");
      }
    } catch (err: unknown) {
      setNoteError(err instanceof Error ? err.message : "Failed to save note");
    } finally {
      setSavingNote(false);
    }
  };

const handleDeleteNote = async () => {
    if (!id || !currentUser || !wordData?.note ) return;

    if (!window.confirm("Are you sure you want to delete your note?")) return;
    setDeletingNote(true);
    setNoteError("");
    try {
      const res = await apiFetch(`/WoahCab/words/note/${id}`, {
        method: "DELETE",
      });
      if (res?.data) {
        setWordData(res.data);
        setNote("");
      }
    } catch (err: unknown) {
      setNoteError(err instanceof Error ? err.message : "Failed to delete note");
    } finally {
      setDeletingNote(false);
    }
  };

  const isAuthor = currentUser && wordData && currentUser._id === wordData.createdBy?._id;

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-slate-900 dark:text-slate-100 flex flex-col transition-colors duration-300">
        <Navbar />
        <main className="flex-1 max-w-3xl w-full mx-auto p-6 md:p-8 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 rounded-full border-4 border-t-violet-500 border-indigo-500/10 animate-spin" />
            <span className="text-slate-600 dark:text-slate-400 text-sm font-semibold">Loading word details...</span>
          </div>
        </main>
      </div>
    );
  }

  if (error || !wordData) {
    return (
      <div className="min-h-screen bg-background text-slate-900 dark:text-slate-100 flex flex-col transition-colors duration-300">
        <Navbar />
        <main className="flex-1 max-w-3xl w-full mx-auto p-6 md:p-8 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 text-red-650 dark:text-red-400 rounded-2xl flex items-center justify-center mb-6">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold mb-2">Error Loading Word</h2>
          <p className="text-slate-600 dark:text-slate-400 text-sm mb-8 font-medium">{error || "Word not found."}</p>
          <Link
            href="/words"
            className="py-3 px-6 bg-card border border-border hover:bg-card-hover text-slate-700 dark:text-slate-350 font-semibold rounded-2xl transition-all"
          >
            Back to Word Bank
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-slate-900 dark:text-slate-100 flex flex-col transition-colors duration-300">
      <Navbar />

      <main className="flex-1 max-w-4xl w-full mx-auto p-6 md:p-8 relative">
        <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-violet-600/5 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-indigo-600/5 blur-[120px] pointer-events-none" />

        <div className="relative z-10 space-y-6">
          <div className="flex justify-between items-center">
            <Link
              href="/words"
              className="flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 text-sm font-semibold transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Word Bank
            </Link>

            {isAuthor && (
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="py-2.5 px-4 bg-red-500/10 border border-red-500/20 hover:border-red-500/40 text-red-650 dark:text-red-400 text-xs font-bold rounded-xl transition-all disabled:opacity-50 cursor-pointer"
              >
                {deleting ? "Deleting..." : "Delete Word"}
              </button>
            )}
          </div>

          <div className="backdrop-blur-xl bg-card border border-border rounded-3xl p-8 shadow-2xl">
            <div className="border-b border-border pb-6 mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div className="flex items-start gap-3">
                <div>
                  <div className="flex items-center gap-4 flex-wrap">
                    <h1 className="text-4xl sm:text-5xl font-black capitalize bg-gradient-to-r from-violet-600 via-indigo-500 to-indigo-600 dark:from-violet-400 dark:via-indigo-200 dark:to-indigo-400 bg-clip-text text-transparent tracking-tight">
                      {wordData.word}
                    </h1>
                    <PronunciationEngine word={wordData.word} showAccentSelector={true} size="md" />
                  </div>
                  {wordData.phonetic && (
                    <p className="text-violet-600 dark:text-violet-400 font-mono font-bold text-lg mt-1.5 tracking-wide">
                      {wordData.phonetic}
                    </p>
                  )}
                  {wordData.createdBy && (
                    <p className="text-slate-550 dark:text-slate-400 text-xs mt-2 font-semibold">
                      Submitted by <span className="text-slate-800 dark:text-slate-355 font-bold">@{wordData.createdBy.username}</span> ({wordData.createdBy.fullname}) ({wordData.createdAt && `${new Date(wordData.createdAt).toLocaleDateString()}`})
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleToggleStar}
                  disabled={togglingStar}
                  aria-label={wordData.isStarred ? `Remove ${wordData.word} from important words` : `Mark ${wordData.word} as important`}
                  aria-pressed={Boolean(wordData.isStarred)}
                  title={wordData.isStarred ? "Remove from important words" : "Mark as important"}
                  className={`mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-all disabled:cursor-wait disabled:opacity-60 ${
                    wordData.isStarred
                      ? "border-amber-400/40 bg-amber-400/15 text-amber-500"
                      : "border-border bg-background text-slate-400 hover:border-amber-400/40 hover:text-amber-500"
                  }`}
                >
                  <svg className="h-5 w-5" fill={wordData.isStarred ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m12 3 2.78 5.63 6.22.9-4.5 4.39 1.06 6.2L12 17.24l-5.56 2.92 1.06-6.2L3 9.53l6.22-.9L12 3Z" />
                  </svg>
                </button>
              </div>
              {starError && (
                <p className="mt-3 text-sm text-red-600 dark:text-red-400 font-medium">{starError}</p>
              )}
            </div>

            <div className="space-y-8 mb-8">
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-4">Definitions</h2>
                <div className="space-y-6">
                  {wordData.definitions.map((def, idx) => (
                    <div key={idx} className="flex gap-4 items-start group">
                      <span className="text-xs font-bold font-mono uppercase px-2 py-0.5 rounded bg-violet-600/10 text-violet-600 dark:text-violet-400 border border-violet-500/10 shrink-0 mt-0.5 select-none">
                        {def.partOfSpeech}
                      </span>
                      <p className="text-slate-800 dark:text-slate-300 text-sm sm:text-base leading-relaxed font-medium">
                        {def.definition}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t border-border pt-8 mb-8">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-505 dark:text-slate-400 mb-3">Synonyms</h3>
                {wordData.synonyms.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {wordData.synonyms.map((syn, idx) => (
                      <span
                        key={idx}
                        className="text-xs py-1.5 px-3 rounded-xl bg-background border border-border text-indigo-600 dark:text-indigo-400 font-semibold capitalize"
                      >
                        {syn}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-500 text-xs italic">No synonyms available.</p>
                )}
              </div>

              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-505 dark:text-slate-400 mb-3">Antonyms</h3>
                {wordData.antonyms.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {wordData.antonyms.map((ant, idx) => (
                      <span
                        key={idx}
                        className="text-xs py-1.5 px-3 rounded-xl bg-background border border-border text-pink-650 dark:text-pink-400 font-semibold capitalize"
                      >
                        {ant}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-500 text-xs italic">No antonyms available.</p>
                )}
              </div>
            </div>

            <div className="border-t border-border pt-8">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-4">Sentence Examples</h3>
              {wordData.examples.length > 0 ? (
                <ul className="space-y-4">
                  {wordData.examples.map((ex, idx) => (
                    <li key={idx} className="flex gap-4 items-start text-sm sm:text-base">
                      <span className="w-6 h-6 rounded-full bg-background border border-border text-[10px] font-bold text-slate-550 dark:text-slate-400 flex items-center justify-center shrink-0 mt-0.5 select-none">
                        {idx + 1}
                      </span>
                      <p className="text-slate-800 dark:text-slate-300 italic leading-relaxed font-medium">
                        "{ex}"
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-slate-500 text-xs italic">No example sentences available.</p>
              )}
            </div>

            {currentUser && (
              <div className="border-t border-border pt-8 mt-8">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Your Note</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-450 mt-1 font-medium">
                      Private to you — only visible to you on this word.
                    </p>
                  </div>
                  <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-450 shrink-0">
                    {note.length}/1000
                  </span>
                </div>

                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  maxLength={1000}
                  rows={4}
                  placeholder="Add a memory tip, context, or anything useful about this word..."
                  className="w-full resize-y px-4 py-3 bg-background border border-border rounded-2xl text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30 transition-all font-medium"
                />

                {noteError && (
                  <p className="mt-3 text-sm text-red-600 dark:text-red-400 font-medium">{noteError}</p>
                )}
                <div className="flex justify-end gap-3 mt-4">
                  {wordData.note && (
                    <button
                      type="button"
                      onClick={handleDeleteNote}
                      disabled={deletingNote}
                      className="py-2.5 px-4 bg-red-500/10 border border-red-500/20 hover:border-red-500/40 text-red-650 dark:text-red-400 text-xs font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer mr-2"
                    >
                      {deletingNote ? "Deleting..." : "Delete Note"}
                    </button>
                  )}

                
                  <button
                    type="button"
                    onClick={handleSaveNote}
                    disabled={savingNote || !note.trim()}
                    className="py-2.5 px-4 bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {savingNote ? "Saving..." : wordData.note ? "Update Note" : "Save Note"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default function WordDetailsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background text-slate-900 dark:text-slate-100 flex flex-col transition-colors duration-300">
        <Navbar />
        <main className="flex-1 max-w-3xl w-full mx-auto p-6 md:p-8 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 rounded-full border-4 border-t-violet-500 border-indigo-500/10 animate-spin" />
            <span className="text-slate-650 dark:text-slate-400 text-sm font-semibold">Loading details...</span>
          </div>
        </main>
      </div>
    }>
      <WordDetailsContent />
    </Suspense>
  );
}
