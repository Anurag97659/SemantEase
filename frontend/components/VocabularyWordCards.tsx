"use client";

import Link from "next/link";
import PronunciationEngine from "./PronunciationEngine";

export interface VocabularyWord {
  _id: string;
  word: string;
  phonetic?: string;
  definitions: { partOfSpeech: string; definition: string }[];
  synonyms?: string[];
  antonyms?: string[];
  createdAt?: string;
  createdBy?: {
    _id: string;
    username: string;
    fullname?: string;
  };
}

interface VocabularyWordCardsProps {
  words: VocabularyWord[];
  showAttribution?: boolean;
}

const formatUploadDate = (date?: string) => {
  if (!date) return "";
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
};

export default function VocabularyWordCards({
  words,
  showAttribution = true,
}: VocabularyWordCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
      {words.map((word) => {
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
                    <h2 className="text-xl font-bold capitalize text-slate-900 transition-colors group-hover:text-violet-650 dark:text-slate-100 dark:group-hover:text-violet-400">
                      {word.word}
                    </h2>
                    <PronunciationEngine
                      word={word.word}
                      showAccentSelector={false}
                      size="sm"
                    />
                  </div>
                  {showAttribution && word.createdBy && (
                    <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      by @{word.createdBy.username}
                      {word.createdAt &&
                        ` · ${formatUploadDate(word.createdAt)}`}
                    </span>
                  )}
                  {!showAttribution && word.phonetic && (
                    <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      {word.phonetic}
                    </span>
                  )}
                </div>

                <p className="mb-4 line-clamp-2 text-sm font-semibold leading-relaxed text-slate-650 dark:text-slate-400">
                  {word.definitions?.[0]?.definition ||
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
  );
}
