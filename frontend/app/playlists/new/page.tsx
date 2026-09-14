"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Navbar from "../../../components/Navbar";
import PlaylistWordPicker from "../../../components/PlaylistWordPicker";
import { apiFetch } from "../../../utils/api";

export default function NewPlaylistPage() {
  const router = useRouter();
  const [step, setStep] = useState<"name" | "words">("name");
  const [name, setName] = useState("");
  const [selectedWordIds, setSelectedWordIds] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const chooseName = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    setError("");
    setStep("words");
  };

  const toggleWord = (wordId: string) => {
    setSelectedWordIds((currentIds) =>
      currentIds.includes(wordId)
        ? currentIds.filter((id) => id !== wordId)
        : [...currentIds, wordId],
    );
  };

  const createPlaylist = async () => {
    setCreating(true);
    setError("");
    try {
      const response = await apiFetch("/WoahCab/playlists", {
        method: "POST",
        body: JSON.stringify({ name, wordIds: selectedWordIds }),
      });
      router.push(`/playlists/details?id=${response.data._id}`);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Could not create playlist";
      if (message.includes("Unauthorized") || message.includes("401"))
        router.push("/login");
      else setError(message);
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-slate-900 dark:text-slate-100 flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-4xl w-full mx-auto p-6 md:p-8">
        <Link
          href="/playlists"
          className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-violet-600 dark:text-slate-400 dark:hover:text-violet-400"
        >
          <span aria-hidden="true">←</span> Back to playlists
        </Link>

        <div className="mt-7 flex items-center gap-3 text-xs font-bold">
          <span
            className={`flex h-7 w-7 items-center justify-center rounded-full ${step === "name" ? "bg-violet-600 text-white" : "bg-violet-500/15 text-violet-600 dark:text-violet-400"}`}
          >
            1
          </span>
          <span
            className={
              step === "name"
                ? "text-slate-900 dark:text-slate-100"
                : "text-slate-500"
            }
          >
            Name
          </span>
          <span className="h-px w-10 bg-border" />
          <span
            className={`flex h-7 w-7 items-center justify-center rounded-full ${step === "words" ? "bg-violet-600 text-white" : "bg-slate-200 text-slate-500 dark:bg-slate-800"}`}
          >
            2
          </span>
          <span
            className={
              step === "words"
                ? "text-slate-900 dark:text-slate-100"
                : "text-slate-500"
            }
          >
            Choose words
          </span>
        </div>

        {error && (
          <p className="mt-6 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm font-medium text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        {step === "name" ? (
          <form
            onSubmit={chooseName}
            className="mt-8 rounded-3xl border border-border bg-card p-6 sm:p-8"
          >
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet-600 dark:text-violet-400">
              New playlist
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight">
              Give it a name
            </h1>
            <p className="mt-2 text-sm font-medium text-slate-500">
              Use a memorable title, such as “AFCAT revision” or “Words for
              essays.”
            </p>
            <label className="mt-7 block">
              <span className="text-sm font-bold">Playlist name</span>
              <input
                autoFocus
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={120}
                placeholder="e.g. Words for my next exam"
                className="mt-2 w-full rounded-2xl border border-border bg-background px-4 py-3.5 text-sm font-medium outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/15"
              />
            </label>
            <div className="mt-6 flex justify-end">
              <button
                disabled={!name.trim()}
                className="rounded-xl bg-violet-600 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next <span aria-hidden="true">→</span>
              </button>
            </div>
          </form>
        ) : (
          <section className="mt-8">
            <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet-600 dark:text-violet-400">
                  {name.trim()}
                </p>
                <h1 className="mt-2 text-3xl font-black tracking-tight">
                  Add words to your playlist
                </h1>
              </div>
              <button
                type="button"
                onClick={() => setStep("name")}
                className="self-start text-sm font-bold text-slate-600 hover:text-violet-600 dark:text-slate-400 dark:hover:text-violet-400"
              >
                Edit name
              </button>
            </div>
            <PlaylistWordPicker
              selectedWordIds={selectedWordIds}
              onToggleWord={toggleWord}
            />
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
              <button
                type="button"
                onClick={() => setStep("name")}
                className="rounded-xl px-4 py-3 text-sm font-bold text-slate-600 hover:bg-card-hover dark:text-slate-300"
              >
                Back
              </button>
              <button
                type="button"
                onClick={createPlaylist}
                disabled={creating}
                className="rounded-xl bg-violet-600 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {creating
                  ? "Creating…"
                  : `Done${selectedWordIds.length ? ` · ${selectedWordIds.length} selected` : ""}`}
              </button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
