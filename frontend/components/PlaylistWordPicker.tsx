"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../utils/api";

export interface PlaylistWord {
  _id: string;
  word: string;
  phonetic?: string;
  definitions: { partOfSpeech: string; definition: string }[];
  synonyms?: string[];
  antonyms?: string[];
}

interface PlaylistWordPickerProps {
  selectedWordIds: string[];
  onToggleWord: (wordId: string) => void;
  unavailableWordIds?: string[];
}

export default function PlaylistWordPicker({
  selectedWordIds,
  onToggleWord,
  unavailableWordIds = [],
}: PlaylistWordPickerProps) {
  const [query, setQuery] = useState("");
  const [words, setWords] = useState<PlaylistWord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");

  const unavailableIds = useMemo(
    () => new Set(unavailableWordIds),
    [unavailableWordIds],
  );
  const selectedIds = useMemo(
    () => new Set(selectedWordIds),
    [selectedWordIds],
  );

  useEffect(() => {
    const trimmedQuery = query.trim();
    const controller = new AbortController();

    const loadWords = async () => {
      setError("");
      if (trimmedQuery) setSearching(true);
      else setLoading(true);

      try {
        const endpoint = trimmedQuery
          ? `/WoahCab/words/search?q=${encodeURIComponent(trimmedQuery)}`
          : "/WoahCab/words/getwords";
        const response = await apiFetch(endpoint, {
          signal: controller.signal,
        });
        if (!controller.signal.aborted) setWords(response?.data || []);
      } catch (err: unknown) {
        if (!controller.signal.aborted) {
          setError(
            err instanceof Error ? err.message : "Could not load vocabulary",
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
          setSearching(false);
        }
      }
    };

    const delay = trimmedQuery ? window.setTimeout(loadWords, 450) : undefined;
    if (!delay) loadWords();

    return () => {
      controller.abort();
      if (delay) window.clearTimeout(delay);
    };
  }, [query]);

  return (
    <section className="rounded-3xl border border-border bg-card overflow-hidden">
      <div className="border-b border-border p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-black">Choose words</h2>
            <p className="mt-1 text-sm font-medium text-slate-500">
              Search by meaning or topic, then select the words to include.
            </p>
          </div>
          <span className="self-start sm:self-auto rounded-full bg-violet-500/10 px-3 py-1.5 text-xs font-bold text-violet-600 dark:text-violet-400">
            {selectedWordIds.length} selected
          </span>
        </div>

        <label className="relative block mt-5">
          <span className="sr-only">Search words semantically</span>
          <svg
            className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
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
            placeholder="Semantic search, e.g. a person who avoids society"
            className="w-full rounded-2xl border border-border bg-background py-3 pl-11 pr-10 text-sm font-medium outline-none transition-all focus:border-violet-500 focus:ring-2 focus:ring-violet-500/15"
          />
          {searching && (
            <span
              className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border-2 border-violet-500/15 border-t-violet-500 animate-spin"
              aria-label="Searching"
            />
          )}
        </label>
      </div>

      {error && (
        <p className="mx-5 sm:mx-6 mt-5 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm font-medium text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <div className="max-h-[30rem] overflow-y-auto p-3 sm:p-4">
        {loading ? (
          <div className="flex justify-center py-12">
            <span className="h-8 w-8 rounded-full border-4 border-violet-500/15 border-t-violet-500 animate-spin" />
          </div>
        ) : words.length ? (
          <ul className="space-y-2">
            {words.map((word) => {
              const isUnavailable = unavailableIds.has(word._id);
              const isSelected = selectedIds.has(word._id);
              const firstDefinition = word.definitions?.[0];

              return (
                <li key={word._id}>
                  <button
                    type="button"
                    disabled={isUnavailable}
                    onClick={() => onToggleWord(word._id)}
                    className={`w-full flex items-start gap-3 rounded-2xl border px-4 py-3.5 text-left transition-all ${
                      isUnavailable
                        ? "cursor-not-allowed border-border bg-background/40 opacity-55"
                        : isSelected
                          ? "border-violet-500/45 bg-violet-500/8"
                          : "border-transparent hover:border-border hover:bg-background cursor-pointer"
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                        isSelected || isUnavailable
                          ? "border-violet-600 bg-violet-600 text-white"
                          : "border-slate-300 dark:border-slate-600"
                      }`}
                      aria-hidden="true"
                    >
                      {(isSelected || isUnavailable) && (
                        <svg
                          className="h-3.5 w-3.5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="3"
                            d="m5 12 4 4L19 6"
                          />
                        </svg>
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                        <span className="font-bold capitalize text-slate-900 dark:text-slate-100">
                          {word.word}
                        </span>
                        {word.phonetic && (
                          <span className="text-xs text-slate-500">
                            {word.phonetic}
                          </span>
                        )}
                      </span>
                      {firstDefinition && (
                        <span className="mt-1 block line-clamp-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                          <span className="font-semibold capitalize">
                            {firstDefinition.partOfSpeech}:
                          </span>{" "}
                          {firstDefinition.definition}
                        </span>
                      )}
                      {isUnavailable && (
                        <span className="mt-1 block text-[11px] font-bold text-violet-600 dark:text-violet-400">
                          Already in this playlist
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="py-12 text-center">
            <p className="font-bold">No matching words</p>
            <p className="mt-1 text-sm text-slate-500">
              Try another description or browse all words.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
