"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "../../components/Navbar";
import { apiFetch } from "../../utils/api";

interface NotePreviewElement {
  type?: string;
  text?: string;
  word?: string;
  cells?: string[];
}

interface PersonalNote {
  _id: string;
  title: string;
  elements: NotePreviewElement[];
  createdAt: string;
  updatedAt: string;
}

export default function MyNotesDashboard() {
  const router = useRouter();
  const [notes, setNotes] = useState<PersonalNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    apiFetch("/WoahCab/notes")
      .then((res) => setNotes(res?.data || []))
      .catch((err) => {
        if (err.message?.includes("Unauthorized") || err.message?.includes("401")) router.push("/login");
        else setError(err.message || "Could not load your notes");
      })
      .finally(() => setLoading(false));
  }, [router]);

  const visibleNotes = useMemo(
    () => notes.filter((note) => note.title.toLowerCase().includes(query.trim().toLowerCase())),
    [notes, query]
  );

  const createNote = async (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;
    setCreating(true);
    setError("");
    try {
      const res = await apiFetch("/WoahCab/notes", {
        method: "POST",
        body: JSON.stringify({ title }),
      });
      router.push(`/detailednotes?id=${res.data._id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not create note");
      setCreating(false);
    }
  };

  const formatDate = (date: string) => new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(date));
  const notePreview = (note: PersonalNote) => {
    const content = (note.elements || []).flatMap((element) => [element.text, element.word, ...(element.cells || [])]).filter((item): item is string => Boolean(item?.trim())).join(" · ");
    return content || "An empty canvas — start writing, drawing, or adding vocabulary.";
  };

  return (
    <div className="min-h-screen bg-background text-slate-900 dark:text-slate-100 flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-6xl w-full mx-auto p-6 md:p-8">
        <section className="relative overflow-hidden rounded-[2rem] border border-violet-500/15 bg-gradient-to-br from-violet-600/12 via-indigo-500/8 to-transparent p-7 md:p-10 mb-8">
          <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-violet-500/10 blur-3xl" />
          <div className="relative flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] font-bold text-violet-600 dark:text-violet-400">
                Private workspace
              </p>
              <h1 className="mt-2 text-3xl md:text-4xl font-black tracking-tight">
                My Notes
              </h1>
              <p className="mt-2 text-sm font-medium text-slate-600 dark:text-slate-400 max-w-lg">
                A flexible space for vocabulary, ideas, diagrams, and study
                plans.
              </p>
            </div>
            <button
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-violet-600 hover:bg-violet-500 px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-violet-600/20 transition-colors cursor-pointer"
            >
              <span className="text-lg leading-none">+</span> Add new note
            </button>
          </div>
        </section>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h2 className="font-bold text-lg">
            Your notes{" "}
            <span className="text-sm text-slate-500 font-medium">
              ({notes.length})
            </span>
          </h2>
          <label className="relative block w-full sm:w-72">
            <span className="sr-only">Search notes</span>
            <svg
              className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
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
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search your notes"
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
          <div className="py-20 flex justify-center">
            <div className="w-10 h-10 rounded-full border-4 border-violet-500/15 border-t-violet-500 animate-spin" />
          </div>
        ) : visibleNotes.length ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {visibleNotes.map((note) => (
              <button
                key={note._id}
                onClick={() => router.push(`/detailednotes?id=${note._id}`)}
                className="group text-left min-h-48 rounded-3xl border border-border bg-card p-6 hover:-translate-y-1 hover:border-violet-500/35 hover:shadow-xl hover:shadow-violet-500/5 transition-all cursor-pointer"
              >
                <div className="flex justify-between items-start gap-3">
                  <div className="min-h-14 flex-1 rounded-xl border border-border bg-background/70 px-3 py-2.5 text-xs leading-relaxed text-slate-550 dark:text-slate-400 line-clamp-3">
                    {notePreview(note)}
                  </div>
                  <span className="shrink-0 text-xs text-slate-500">
                    {formatDate(note.updatedAt)}
                  </span>
                </div>
                <h3 className="mt-5 font-bold text-lg leading-snug line-clamp-2 group-hover:text-violet-600 dark:group-hover:text-violet-400">
                  {note.title}
                </h3>
                <p className="mt-2 text-xs text-slate-500 font-medium">
                  {note.elements?.length || 0} canvas items
                </p>
              </button>
            ))}
          </div>
        ) : (
          <div className="border border-dashed border-border rounded-3xl py-20 px-6 text-center bg-card/40">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/10 text-2xl">
              ✎
            </div>
            <h3 className="font-bold text-lg">
              {query ? "No matching notes" : "Start your first note"}
            </h3>
            <p className="mt-2 text-sm text-slate-500">
              {query
                ? "Try a different title."
                : "Capture an idea, connect words, or build a study board."}
            </p>
            {!query && (
              <button
                onClick={() => setShowCreate(true)}
                className="mt-5 text-sm font-bold text-violet-600 dark:text-violet-400 hover:underline cursor-pointer"
              >
                Create a note
              </button>
            )}
          </div>
        )}
      </main>

      {showCreate && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-950/45 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-note-title"
        >
          <form
            onSubmit={createNote}
            className="w-full max-w-md rounded-3xl border border-border bg-background p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="new-note-title" className="text-xl font-black">
                  New note
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Give your canvas a clear title.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="h-8 w-8 text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              placeholder="e.g. Words for my next exam"
              className="mt-6 w-full rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/15"
            />
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="rounded-xl px-4 py-2.5 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-card-hover cursor-pointer"
              >
                Cancel
              </button>
              <button
                disabled={creating || !title.trim()}
                className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-violet-500 disabled:opacity-50 cursor-pointer"
              >
                {creating ? "Creating…" : "Create note"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
