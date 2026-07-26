"use client";

import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import { apiFetch } from "@/utils/api";
import Link from "next/link";

interface Suggestion {
  _id: string;
  user: {
    _id: string;
    username: string;
    fullname?: string;
  };
  username: string;
  title: string;
  message: string;
  category: "Feature Request" | "Bug Report" | "General Feedback" | "Other";
  status: "Pending" | "Reviewed" | "Resolved";
  createdAt: string;
}

const ADMIN_USERNAME = (process.env.NEXT_PUBLIC_ADMIN_USERNAME || "avasanam")
  .trim()
  .toLowerCase();

export default function SuggestionsPage() {
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [userLoading, setUserLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState<
    "Feature Request" | "Bug Report" | "General Feedback" | "Other"
  >("Feature Request");
  const [submitting, setSubmitting] = useState(false);
  const [formSuccess, setFormSuccess] = useState("");
  const [formError, setFormError] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [adminError, setAdminError] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("All");
  const [filterCategory, setFilterCategory] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [showFormForAdmin, setShowFormForAdmin] = useState(false);

  useEffect(() => {
    setUserLoading(true);
    apiFetch("/WoahCab/users/getProfile")
      .then((res) => {
        if (res?.data?.username) {
          const fetchedUsername = res.data.username;
          setCurrentUser(fetchedUsername);
          const adminCheck = fetchedUsername.toLowerCase() === ADMIN_USERNAME;
          setIsAdmin(adminCheck);

          if (adminCheck) {
            fetchSuggestionsForAdmin();
          }
        }
      })
      .catch(() => {
        setCurrentUser(null);
        setIsAdmin(false);
      })
      .finally(() => {
        setUserLoading(false);
      });
  }, []);

  const fetchSuggestionsForAdmin = async () => {
    setLoadingSuggestions(true);
    setAdminError("");
    try {
      const res = await apiFetch("/WoahCab/suggestions");
      if (res?.data) {
        setSuggestions(res.data);
      }
    } catch (err: any) {
      setAdminError(err.message || "Failed to load suggestions.");
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleSubmitSuggestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      setFormError(
        "Please fill in both title and detailed suggestion message.",
      );
      return;
    }

    setSubmitting(true);
    setFormError("");
    setFormSuccess("");

    try {
      await apiFetch("/WoahCab/suggestions", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          message: message.trim(),
          category,
        }),
      });

      setFormSuccess(
        "Thank you! Your suggestion has been sent privately to the admin.",
      );
      setTitle("");
      setMessage("");
      setCategory("Feature Request");

      if (isAdmin) {
        fetchSuggestionsForAdmin();
      }
    } catch (err: any) {
      setFormError(
        err.message || "Failed to submit suggestion. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    setUpdatingId(id);
    try {
      await apiFetch(`/WoahCab/suggestions/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
      setSuggestions((prev) =>
        prev.map((item) =>
          item._id === id ? { ...item, status: newStatus as any } : item,
        ),
      );
    } catch (err: any) {
      alert(`Error updating status: ${err.message}`);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDeleteSuggestion = async (id: string) => {
    if (!confirm("Are you sure you want to delete this suggestion?")) return;
    setUpdatingId(id);
    try {
      await apiFetch(`/WoahCab/suggestions/${id}`, {
        method: "DELETE",
      });
      setSuggestions((prev) => prev.filter((item) => item._id !== id));
    } catch (err: any) {
      alert(`Error deleting suggestion: ${err.message}`);
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredSuggestions = suggestions.filter((item) => {
    const matchesStatus =
      filterStatus === "All" || item.status === filterStatus;
    const matchesCategory =
      filterCategory === "All" || item.category === filterCategory;
    const matchesSearch =
      searchQuery === "" ||
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.username.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesCategory && matchesSearch;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Pending":
        return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30";
      case "Reviewed":
        return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30";
      case "Resolved":
        return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30";
      default:
        return "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30";
    }
  };

  const getCategoryBadge = (cat: string) => {
    switch (cat) {
      case "Feature Request":
        return "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/30";
      case "Bug Report":
        return "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30";
      case "General Feedback":
        return "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30";
      default:
        return "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30";
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 transition-colors duration-300">
      <Navbar />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {userLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-10 h-10 border-4 border-violet-500/20 border-t-violet-600 rounded-full animate-spin"></div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              Loading profile details...
            </p>
          </div>
        ) : !currentUser ? (
          /* Logged out state */
          <div className="max-w-md mx-auto text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 rounded-3xl shadow-xl">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-violet-600/10 flex items-center justify-center text-violet-600 dark:text-violet-400">
              <svg
                className="w-8 h-8"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
              Login Required
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
              Please sign in to your account to send suggestions and feature
              requests to the admin.
            </p>
            <div className="flex gap-3 justify-center">
              <Link
                href="/login"
                className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-semibold text-sm transition-all shadow-md shadow-violet-600/20"
              >
                Log In
              </Link>
              <Link
                href="/register"
                className="px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-sm transition-all"
              >
                Register
              </Link>
            </div>
          </div>
        ) : isAdmin && !showFormForAdmin ? (
          /* ADMIN DASHBOARD VIEW for user 'avasanam' */
          <div className="space-y-8 animate-fadeIn">
            {/* Header banner */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-violet-900/40 via-indigo-900/30 to-slate-900/50 p-6 sm:p-8 rounded-3xl border border-violet-500/20 shadow-xl backdrop-blur-xl">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/20 border border-violet-400/30 text-violet-300 text-xs font-semibold mb-3">
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                    />
                  </svg>
                  Admin Control Panel (@{currentUser})
                </div>
                <h1 className="text-3xl font-extrabold text-white">
                  Suggestions Inbox
                </h1>
                <p className="text-sm text-slate-300 mt-1 max-w-xl">
                  Private suggestion log visible only to admin. Review user
                  requests, update progress statuses, and manage feedback.
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowFormForAdmin(true)}
                  className="px-4 py-2.5 rounded-xl bg-violet-600/80 hover:bg-violet-600 text-white font-medium text-xs flex items-center gap-2 border border-violet-400/30 transition-all shadow-md"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  Submit Suggestion Form
                </button>
                <button
                  type="button"
                  onClick={fetchSuggestionsForAdmin}
                  disabled={loadingSuggestions}
                  className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium text-xs flex items-center gap-2 border border-white/10 transition-all"
                >
                  <svg
                    className={`w-4 h-4 ${loadingSuggestions ? "animate-spin" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  Refresh
                </button>
              </div>
            </div>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Total Suggestions
                </p>
                <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                  {suggestions.length}
                </p>
              </div>
              <div className="bg-amber-500/5 dark:bg-amber-500/10 p-4 rounded-2xl border border-amber-500/20 shadow-sm">
                <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                  Pending
                </p>
                <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
                  {suggestions.filter((s) => s.status === "Pending").length}
                </p>
              </div>
              <div className="bg-blue-500/5 dark:bg-blue-500/10 p-4 rounded-2xl border border-blue-500/20 shadow-sm">
                <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                  Reviewed
                </p>
                <p className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">
                  {suggestions.filter((s) => s.status === "Reviewed").length}
                </p>
              </div>
              <div className="bg-emerald-500/5 dark:bg-emerald-500/10 p-4 rounded-2xl border border-emerald-500/20 shadow-sm">
                <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  Resolved
                </p>
                <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                  {suggestions.filter((s) => s.status === "Resolved").length}
                </p>
              </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row gap-4 items-center justify-between shadow-sm">
              <div className="relative w-full md:w-80">
                <svg
                  className="w-4 h-4 absolute left-3.5 top-3 text-slate-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <input
                  type="text"
                  placeholder="Search suggestions or username..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-100 dark:bg-slate-800 border-none rounded-xl text-xs font-medium focus:ring-2 focus:ring-violet-500 outline-none transition-all"
                />
              </div>

              <div className="flex flex-wrap gap-2 w-full md:w-auto justify-end">
                {/* Status Filter */}
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-3 py-2 bg-slate-100 dark:bg-slate-800 border-none rounded-xl text-xs font-semibold cursor-pointer outline-none focus:ring-2 focus:ring-violet-500"
                >
                  <option value="All">All Statuses</option>
                  <option value="Pending">Pending</option>
                  <option value="Reviewed">Reviewed</option>
                  <option value="Resolved">Resolved</option>
                </select>

                {/* Category Filter */}
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="px-3 py-2 bg-slate-100 dark:bg-slate-800 border-none rounded-xl text-xs font-semibold cursor-pointer outline-none focus:ring-2 focus:ring-violet-500"
                >
                  <option value="All">All Categories</option>
                  <option value="Feature Request">Feature Request</option>
                  <option value="Bug Report">Bug Report</option>
                  <option value="General Feedback">General Feedback</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            {/* Error banner */}
            {adminError && (
              <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-rose-600 dark:text-rose-400 text-sm font-medium">
                {adminError}
              </div>
            )}

            {/* Suggestions list */}
            {loadingSuggestions ? (
              <div className="py-16 text-center text-slate-500 text-sm">
                Loading suggestions...
              </div>
            ) : filteredSuggestions.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-12 text-center">
                <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                    />
                  </svg>
                </div>
                <p className="text-base font-semibold text-slate-700 dark:text-slate-300">
                  No suggestions found
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  There are no user suggestions matching your current criteria.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {filteredSuggestions.map((item) => (
                  <div
                    key={item._id}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all space-y-4"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800/80 pb-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold ${getCategoryBadge(item.category)}`}
                        >
                          {item.category}
                        </span>
                        <span
                          className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold ${getStatusBadge(item.status)}`}
                        >
                          {item.status}
                        </span>
                      </div>

                      <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-3">
                        <span className="font-semibold text-violet-600 dark:text-violet-400">
                          @{item.user?.username || item.username}
                        </span>
                        {item.user?.fullname && (
                          <span className="text-slate-400">
                            ({item.user.fullname})
                          </span>
                        )}
                        <span>•</span>
                        <span>{new Date(item.createdAt).toLocaleString()}</span>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                        {item.title}
                      </h3>
                      <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed bg-slate-50 dark:bg-slate-950/60 p-4 rounded-xl border border-slate-100 dark:border-slate-800/50">
                        {item.message}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-semibold text-slate-500">
                          Update Status:
                        </label>
                        <select
                          value={item.status}
                          disabled={updatingId === item._id}
                          onChange={(e) =>
                            handleStatusChange(item._id, e.target.value)
                          }
                          className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 border-none rounded-lg text-xs font-semibold cursor-pointer outline-none focus:ring-2 focus:ring-violet-500"
                        >
                          <option value="Pending">Pending</option>
                          <option value="Reviewed">Reviewed</option>
                          <option value="Resolved">Resolved</option>
                        </select>
                      </div>

                      <button
                        type="button"
                        disabled={updatingId === item._id}
                        onClick={() => handleDeleteSuggestion(item._id)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-500/10 border border-rose-500/20 transition-all cursor-pointer flex items-center gap-1.5"
                      >
                        <svg
                          className="w-3.5 h-3.5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* REGULAR USER VIEW: Suggestion Form + GitHub Collaboration Section */
          <div className="space-y-10 animate-fadeIn">
            {/* Header Banner */}
            <div className="bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-700 text-white rounded-3xl p-6 sm:p-10 shadow-2xl relative overflow-hidden">
              <div className="absolute -right-10 -bottom-10 w-60 h-60 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>
              <div className="max-w-2xl relative z-10">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 border border-white/30 text-white text-xs font-medium mb-3">
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                  Community Driven
                </div>
                <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
                  Share Your Suggestions & Feedback
                </h1>
                <p className="text-sm sm:text-base text-violet-100 mt-2 font-normal">
                  Have ideas to make LexIconic better? Your feedback goes
                  directly to our admin team and helps shape future updates.
                </p>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => setShowFormForAdmin(false)}
                    className="mt-4 px-4 py-2 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-semibold border border-white/30 transition-all inline-flex items-center gap-1.5"
                  >
                    ← Back to Admin Inbox
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Suggestion Form Column (7 cols) */}
              <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 sm:p-8 rounded-3xl shadow-xl">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                      Submit a Suggestion
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Submissions are private and only visible to the admin.
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-2xl bg-violet-500/10 flex items-center justify-center text-violet-600 dark:text-violet-400">
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
                      />
                    </svg>
                  </div>
                </div>

                {formSuccess && (
                  <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-600 dark:text-emerald-400 text-sm font-medium flex items-center gap-3">
                    <svg
                      className="w-5 h-5 shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <span>{formSuccess}</span>
                  </div>
                )}

                {formError && (
                  <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-rose-600 dark:text-rose-400 text-sm font-medium flex items-center gap-3">
                    <svg
                      className="w-5 h-5 shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <span>{formError}</span>
                  </div>
                )}

                <form onSubmit={handleSubmitSuggestion} className="space-y-5">
                  {/* Title */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                      Suggestion Title
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Add dark mode toggle in vocabulary quiz"
                      value={title}
                      maxLength={150}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all"
                    />
                  </div>

                  {/* Category */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                      Category
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {(
                        [
                          "Feature Request",
                          "Bug Report",
                          "General Feedback",
                          "Other",
                        ] as const
                      ).map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setCategory(cat)}
                          className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all text-center ${
                            category === cat
                              ? "bg-violet-600 text-white border-violet-600 shadow-md shadow-violet-600/20"
                              : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-750"
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Message */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                      Detailed Description / Feedback
                    </label>
                    <textarea
                      required
                      rows={5}
                      placeholder="Describe your suggestion in detail, explaining how it will benefit users..."
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all resize-none"
                    ></textarea>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-bold text-sm shadow-lg shadow-violet-600/25 transition-all transform active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {submitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                        Sending Suggestion...
                      </>
                    ) : (
                      <>
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                          />
                        </svg>
                        Send Suggestion to Admin
                      </>
                    )}
                  </button>
                </form>
              </div>

              {/* GitHub Collaboration & Open Source Column (5 cols) */}
              <div className="lg:col-span-5 space-y-6">
                <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 text-white p-6 sm:p-8 rounded-3xl border border-slate-800 shadow-xl relative overflow-hidden">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-white border border-white/10">
                      <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
                        <path
                          fillRule="evenodd"
                          clipRule="evenodd"
                          d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                        />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold">
                        GitHub Collaboration
                      </h3>
                      <p className="text-xs text-slate-400">
                        Join the open source journey
                      </p>
                    </div>
                  </div>

                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mb-6">
                    LexIconic (WoahCab) is open to collaboration! If you are a
                    developer, designer, or language enthusiast, explore our
                    repository, submit pull requests, or file technical issues
                    on GitHub.
                  </p>

                  <div className="space-y-3">
                    <a
                      href="https://github.com/Anurag97659/WoahCab"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-3 px-4 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs flex items-center justify-between border border-white/10 transition-all group"
                    >
                      <span className="flex items-center gap-2">
                        <svg
                          className="w-4 h-4 text-violet-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                          />
                        </svg>
                        Anurag97659/WoahCab Repo
                      </span>
                      <svg
                        className="w-4 h-4 group-hover:translate-x-1 transition-transform"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M14 5l7 7m0 0l-7 7m7-7H3"
                        />
                      </svg>
                    </a>

                    <a
                      href="https://github.com/Anurag97659/WoahCab/issues"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-3 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white font-medium text-xs flex items-center justify-between border border-white/5 transition-all group"
                    >
                      <span className="flex items-center gap-2">
                        <svg
                          className="w-4 h-4 text-amber-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        Report Bugs / View Issues
                      </span>
                      <svg
                        className="w-4 h-4 group-hover:translate-x-1 transition-transform"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                        />
                      </svg>
                    </a>
                  </div>

                  <div className="mt-6 pt-6 border-t border-slate-800 grid grid-cols-3 gap-2 text-center">
                    <div className="bg-white/5 p-2 rounded-xl border border-white/5">
                      <p className="text-[10px] text-slate-400 font-semibold uppercase">
                        Framework
                      </p>
                      <p className="text-xs font-bold text-violet-300 mt-0.5">
                        Next.js
                      </p>
                    </div>
                    <div className="bg-white/5 p-2 rounded-xl border border-white/5">
                      <p className="text-[10px] text-slate-400 font-semibold uppercase">
                        Backend
                      </p>
                      <p className="text-xs font-bold text-indigo-300 mt-0.5">
                        Express JS
                      </p>
                    </div>
                    <div className="bg-white/5 p-2 rounded-xl border border-white/5">
                      <p className="text-[10px] text-slate-400 font-semibold uppercase">
                        Database
                      </p>
                      <p className="text-xs font-bold text-sky-300 mt-0.5">
                        MongoDB
                      </p>
                    </div>
                  </div>
                </div>

                {/* Collaboration Perks Box */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-sm">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                    <svg
                      className="w-4 h-4 text-violet-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M13 10V3L4 14h7v7l9-11h-7z"
                      />
                    </svg>
                    How to Contribute?
                  </h4>
                  <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-2.5">
                    <li className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                        1
                      </span>
                      <span>Fork the GitHub repo and clone locally.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                        2
                      </span>
                      <span>Create a feature branch for your changes.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                        3
                      </span>
                      <span>Submit a Pull Request for code review!</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
