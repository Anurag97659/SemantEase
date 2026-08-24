"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Navbar from "../../../components/Navbar";
import { apiFetch } from "../../../utils/api";

const loadingSteps = {
  "free-dictionary": [
    "Connecting to Free Dictionary...",
    "Retrieving dictionary definition...",
    "Organizing parts of speech...",
    "Collecting available synonyms and antonyms...",
    "Adding example sentences...",
    "Saving word entry to database...",
  ],
  gemini: [
    "Connecting to Gemini AI...",
    "Retrieving dictionary definition...",
    "Formatting parts of speech (noun, adjective, adverb)...",
    "Curating exact synonyms and antonyms...",
    "Composing contextual sentence examples...",
    "Saving word entry to database...",
  ],
};

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Failed to generate word details";

export default function SubmitWordPage() {
  const router = useRouter();
  const [words, setWords] = useState([""]);
  const [source, setSource] = useState<"free-dictionary" | "gemini">("gemini");
  const [loading, setLoading] = useState(false);
  const [loadingStepIdx, setLoadingStepIdx] = useState(0);
  const [error, setError] = useState("");
  const [duplicateWord, setDuplicateWord] = useState<string | null>(null);

  const updateWord = (index: number, value: string) => {
    setWords((currentWords) =>
      currentWords.map((currentWord, currentIndex) =>
        currentIndex === index ? value : currentWord
      )
    );
  };

  const addWordField = () => {
    setWords((currentWords) => [...currentWords, ""]);
  };

  const removeWordField = (index: number) => {
    setWords((currentWords) => currentWords.filter((_, currentIndex) => currentIndex !== index));
  };

  useEffect(() => {
    // Redirect to login if user is not authenticated
    apiFetch("/WoahCab/users/getProfile").catch(() => {
      router.push("/login");
    });
  }, [router]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (loading) {
      interval = setInterval(() => {
        setLoadingStepIdx((prev) => (prev + 1) % loadingSteps[source].length);
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [loading, source]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const submittedWords = words.map((currentWord) => currentWord.trim()).filter(Boolean);
    if (!submittedWords.length) return;

    setLoading(true);
    setLoadingStepIdx(0);
    setError("");
    setDuplicateWord(null);

    try {
      const normalizedWords = submittedWords.map((submittedWord) =>
        submittedWord.replace(/\s+/g, " ").toLowerCase()
      );
      const repeatedWord = normalizedWords.find(
        (submittedWord, index) => normalizedWords.indexOf(submittedWord) !== index
      );
      if (repeatedWord) {
        setError(`Remove the repeated word "${repeatedWord}" before adding this list.`);
        setLoading(false);
        return;
      }

      for (let index = 0; index < submittedWords.length; index += 1) {
        const submittedWord = submittedWords[index];
        try {
          await apiFetch("/WoahCab/words/createword", {
            method: "POST",
            body: JSON.stringify({ word: submittedWord, source }),
          });
        } catch (err) {
            setWords(submittedWords.slice(index));
          throw err;
        }
      }
      router.push("/words");
    } catch (err) {
      const message = getErrorMessage(err);
      const duplicateMatch = /^Word "(.+)" already exists in the dictionary$/.exec(message);
      if (duplicateMatch) {
        setDuplicateWord(duplicateMatch[1]);
      } else {
        setError(message);
      }
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-slate-900 dark:text-slate-100 flex flex-col transition-colors duration-300">
      <Navbar />

      <main className="flex-1 flex items-center justify-center p-6 relative">
        <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-violet-600/5 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-indigo-600/5 blur-[120px] pointer-events-none" />

        <div className="w-full max-w-lg relative z-10">
          {loading ? (
            <div className="backdrop-blur-xl bg-card border border-border rounded-3xl p-12 text-center shadow-2xl">
              <div className="relative w-24 h-24 mx-auto mb-8 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-4 border-violet-500/20 animate-ping" />
                <div className="absolute inset-2 rounded-full border-4 border-t-violet-500 border-indigo-500/10 animate-spin" />
                <svg className="w-8 h-8 text-violet-500 dark:text-violet-400 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>

              <h2 className="text-xl font-bold mb-2">
                Analyzing {words.filter((currentWord) => currentWord.trim()).length === 1 ? "word" : "words"}
              </h2>
              <p className="text-violet-650 dark:text-violet-450 font-bold text-sm min-h-[20px] transition-all duration-300">
                {loadingSteps[source][loadingStepIdx]}
              </p>
            </div>
          ) : (
            <div className="backdrop-blur-xl bg-card border border-border rounded-3xl p-8 shadow-2xl transition-all duration-300 hover:border-violet-500/20">
              <div className="mb-6">
                <h1 className="text-2xl font-bold mb-1">Add New Word</h1>
                <p className="text-slate-600 dark:text-slate-400 text-sm font-medium">
                  Choose a source for the word details. Gemini AI is selected by default.
                </p>
              </div>

              {error && (
                <div className="mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-sm text-center font-medium">
                  {error}
                </div>
              )}
              {duplicateWord && (
                <div className="mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-sm text-center font-medium">
                  Word <strong>{duplicateWord}</strong> already exists in the dictionary.
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-xs font-bold text-slate-800 dark:text-slate-300 uppercase tracking-wider mb-2">
                    English Words
                  </label>
                  <div className="space-y-3">
                    {words.map((currentWord, index) => (
                      <div key={index} className="flex gap-2">
                        <input
                          type="text"
                          required={index === 0}
                          value={currentWord}
                          onChange={(e) => updateWord(index, e.target.value)}
                          placeholder={index === 0 ? "e.g. ephemeral" : "e.g. serendipity"}
                          className="min-w-0 flex-1 px-5 py-4 bg-background border border-border rounded-2xl text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30 transition-all font-medium"
                        />
                        {words.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeWordField(index)}
                            aria-label={`Remove word ${index + 1}`}
                            className="w-12 shrink-0 rounded-2xl border border-border bg-card text-slate-500 transition-colors hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-500"
                          >
                            −
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={addWordField}
                    className="mt-3 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-violet-600 transition-colors hover:bg-violet-500/10 dark:text-violet-400"
                  >
                    <span className="flex h-5 w-5 items-center justify-center rounded-full border border-current text-base leading-none">+</span>
                    Add another word
                  </button>
                </div>

                <fieldset>
                  <legend className="block text-xs font-bold text-slate-800 dark:text-slate-300 uppercase tracking-wider mb-2">
                    Definition Source
                  </legend>
                  <select
                    value={source}
                    onChange={(event) => setSource(event.target.value as "free-dictionary" | "gemini")}
                    className="w-full appearance-none px-5 py-4 bg-background border border-border rounded-2xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30 transition-all font-medium cursor-pointer"
                  >
                    <option value="gemini">Gemini AI</option>
                    <option value="free-dictionary">Free Dictionary </option>
                  </select>
                </fieldset>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => router.push("/words")}
                    className="flex-1 py-4 px-6 bg-card border border-border hover:bg-card-hover text-slate-700 dark:text-slate-350 font-semibold rounded-2xl transition-all active:scale-95 text-sm cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-2 py-4 px-6 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold rounded-2xl transition-all duration-300 hover:shadow-lg hover:shadow-violet-600/20 active:scale-95 text-sm"
                  >
                    {source === "gemini" ? "Generate & Add" : "Find & Add"}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
