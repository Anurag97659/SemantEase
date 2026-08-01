"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "../../components/Navbar";
import { apiFetch } from "../../utils/api";

interface UserCard {
  _id: string;
  username: string;
  fullname: string;
}

interface SearchUser extends UserCard {
  status: "none" | "friend" | "requested" | "incoming_request";
}

interface BlendCard {
  _id: string;
  title: string;
  members: UserCard[];
  createdAt: string;
}

type TabType = "friends" | "requests" | "blends";

export default function FriendsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>("friends");
  const [searchInput, setSearchInput] = useState("");
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingRequestId, setSavingRequestId] = useState<string | null>(null);
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const [friends, setFriends] = useState<UserCard[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<UserCard[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<UserCard[]>([]);
  const [blends, setBlends] = useState<BlendCard[]>([]);

  const [showBlendModal, setShowBlendModal] = useState(false);
  const [selectedBlendFriendIds, setSelectedBlendFriendIds] = useState<string[]>([]);
  const [creatingBlend, setCreatingBlend] = useState(false);
  const [deletingBlendId, setDeletingBlendId] = useState<string | null>(null);

  const applyOverview = (overview: {
    friends?: UserCard[];
    incomingRequests?: UserCard[];
    outgoingRequests?: UserCard[];
    blends?: BlendCard[];
  }) => {
    setFriends(overview?.friends || []);
    setIncomingRequests(overview?.incomingRequests || []);
    setOutgoingRequests(overview?.outgoingRequests || []);
    setBlends(overview?.blends || []);
  };

  const loadOverview = async () => {
    const response = await apiFetch("/WoahCab/social/overview");
    applyOverview(response?.data || {});
  };

  useEffect(() => {
    apiFetch("/WoahCab/social/overview")
      .then((response) => {
        applyOverview(response?.data || {});
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : "Failed to load social data";
        if (message.includes("Unauthorized") || message.includes("401")) {
          router.push("/login");
          return;
        }
        setError(message);
      })
      .finally(() => setLoading(false));
  }, [router]);

  useEffect(() => {
    if (!searchInput.trim()) {
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const response = await apiFetch(
          `/WoahCab/social/search-users?q=${encodeURIComponent(searchInput.trim())}`
        );
        setSearchResults(response?.data || []);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to search users";
        setError(message);
      } finally {
        setSearching(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchInput]);

  const sendFriendRequest = async (userId: string) => {
    setSavingRequestId(userId);
    setError("");
    try {
      await apiFetch("/WoahCab/social/friend-request", {
        method: "POST",
        body: JSON.stringify({ userId }),
      });
      setSearchResults((current) =>
        current.map((entry) =>
          entry._id === userId ? { ...entry, status: "requested" } : entry
        )
      );
      await loadOverview();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not send friend request");
    } finally {
      setSavingRequestId(null);
    }
  };

  const updateIncomingRequest = async (requesterId: string, action: "accept" | "reject") => {
    setProcessingRequestId(requesterId);
    setError("");
    try {
      await apiFetch(`/WoahCab/social/friend-request/${requesterId}/${action}`, {
        method: "POST",
      });
      await loadOverview();
      setSearchResults((current) =>
        current.map((entry) =>
          entry._id === requesterId
            ? { ...entry, status: action === "accept" ? "friend" : "none" }
            : entry
        )
      );
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : `Could not ${action} friend request`
      );
    } finally {
      setProcessingRequestId(null);
    }
  };

  const toggleBlendSelection = (friendId: string) => {
    setSelectedBlendFriendIds((current) =>
      current.includes(friendId)
        ? current.filter((id) => id !== friendId)
        : [...current, friendId]
    );
  };

  const createBlend = async () => {
    if (selectedBlendFriendIds.length === 0) return;
    setCreatingBlend(true);
    setError("");
    try {
      await apiFetch("/WoahCab/social/blends", {
        method: "POST",
        body: JSON.stringify({ memberIds: selectedBlendFriendIds }),
      });
      setSelectedBlendFriendIds([]);
      setShowBlendModal(false);
      setActiveTab("blends");
      await loadOverview();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not create blend");
    } finally {
      setCreatingBlend(false);
    }
  };

  const deleteBlend = async (blendId: string) => {
    if (!window.confirm("Are you sure you want to delete this blend for all members?")) {
      return;
    }
    setDeletingBlendId(blendId);
    setError("");
    try {
      await apiFetch(`/WoahCab/social/blend/${blendId}`, { method: "DELETE" });
      await loadOverview();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not delete blend");
    } finally {
      setDeletingBlendId(null);
    }
  };

  const requestedIds = useMemo(
    () => new Set(outgoingRequests.map((user) => user._id)),
    [outgoingRequests]
  );

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
        <section className="rounded-[2rem] border border-violet-500/15 bg-gradient-to-br from-violet-600/12 via-indigo-500/8 to-transparent p-7 md:p-10 mb-8">
          <h1 className="text-3xl md:text-4xl font-black tracking-tight">Friends</h1>
          <p className="mt-2 text-sm font-medium text-slate-600 dark:text-slate-400 max-w-2xl">
            Find friends, manage requests, and build collaborative blends for shared
            vocabulary practice.
          </p>
        </section>

        <div className="mb-6">
          <label className="relative block w-full">
            <span className="sr-only">Search users</span>
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
              value={searchInput}
              onChange={(event) => {
                const value = event.target.value;
                setSearchInput(value);
                setSearching(Boolean(value.trim()));
                if (!value.trim()) {
                  setSearchResults([]);
                }
              }}
              placeholder="Search user by username or full name"
              className="w-full rounded-xl border border-border bg-card py-3 pl-10 pr-4 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/15"
            />
          </label>
        </div>

        {searchInput.trim() && (
          <div className="mb-8 rounded-2xl border border-border bg-card p-4">
            <h2 className="text-sm font-bold mb-3">Search results</h2>
            {searching ? (
              <div className="text-sm text-slate-500">Searching…</div>
            ) : searchResults.length ? (
              <div className="space-y-2">
                {searchResults.map((result) => (
                  <div
                    key={result._id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-background px-4 py-3"
                  >
                    <div>
                      <p className="font-semibold">@{result.username}</p>
                      <p className="text-xs text-slate-500">{result.fullname}</p>
                    </div>
                    <div>
                      {result.status === "friend" ? (
                        <span className="text-xs font-bold text-emerald-600">Friends</span>
                      ) : result.status === "requested" || requestedIds.has(result._id) ? (
                        <span className="text-xs font-bold text-violet-600">Requested</span>
                      ) : result.status === "incoming_request" ? (
                        <span className="text-xs font-bold text-amber-600">
                          Requested you (check Requests tab)
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => sendFriendRequest(result._id)}
                          disabled={savingRequestId === result._id}
                          className="rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold px-3 py-2 disabled:opacity-60 cursor-pointer"
                        >
                          {savingRequestId === result._id ? "Sending…" : "Send Request"}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-slate-500">No users found.</div>
            )}
          </div>
        )}

        <div className="flex gap-1.5 p-1 bg-card border border-border rounded-2xl w-fit mb-6">
          <button
            type="button"
            onClick={() => setActiveTab("friends")}
            className={`py-2 px-4 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              activeTab === "friends"
                ? "bg-violet-600 text-white shadow-sm"
                : "text-slate-600 dark:text-slate-450 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            Friends ({friends.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("requests")}
            className={`py-2 px-4 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              activeTab === "requests"
                ? "bg-violet-600 text-white shadow-sm"
                : "text-slate-600 dark:text-slate-450 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            Requests ({incomingRequests.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("blends")}
            className={`py-2 px-4 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              activeTab === "blends"
                ? "bg-violet-600 text-white shadow-sm"
                : "text-slate-600 dark:text-slate-450 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            Blends ({blends.length})
          </button>
        </div>

        {error && (
          <p className="mb-5 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm font-medium text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        {activeTab === "friends" && (
          <section className="rounded-2xl border border-border bg-card p-5">
            {friends.length ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {friends.map((friend) => (
                  <div key={friend._id} className="rounded-xl border border-border bg-background px-4 py-3">
                    <p className="font-semibold">@{friend.username}</p>
                    <p className="text-xs text-slate-500">{friend.fullname}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No friends yet.</p>
            )}
          </section>
        )}

        {activeTab === "requests" && (
          <section className="rounded-2xl border border-border bg-card p-5">
            {incomingRequests.length ? (
              <div className="space-y-3">
                {incomingRequests.map((requester) => (
                  <div
                    key={requester._id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-background px-4 py-3"
                  >
                    <div>
                      <p className="font-semibold">@{requester.username}</p>
                      <p className="text-xs text-slate-500">{requester.fullname}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => updateIncomingRequest(requester._id, "accept")}
                        disabled={processingRequestId === requester._id}
                        className="rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-2 disabled:opacity-60 cursor-pointer"
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        onClick={() => updateIncomingRequest(requester._id, "reject")}
                        disabled={processingRequestId === requester._id}
                        className="rounded-lg bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold px-3 py-2 cursor-pointer"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No pending requests.</p>
            )}
          </section>
        )}

        {activeTab === "blends" && (
          <section className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center justify-between gap-4 mb-4">
              <h2 className="font-bold">Your blends</h2>
              <button
                type="button"
                onClick={() => setShowBlendModal(true)}
                disabled={!friends.length}
                className="rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold px-3 py-2 disabled:opacity-60 cursor-pointer"
              >
                Add Blend
              </button>
            </div>

            {blends.length ? (
              <div className="space-y-3">
                {blends.map((blend) => (
                  <div
                    key={blend._id}
                    className="rounded-xl border border-border bg-background hover:border-violet-500/30 px-4 py-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <Link href={`/friends/blends?id=${blend._id}`} className="flex-1">
                        <p className="font-semibold">{blend.title}</p>
                        <p className="text-xs text-slate-500 mt-1">
                          {blend.members.length} members
                        </p>
                      </Link>
                      <button
                        type="button"
                        onClick={() => deleteBlend(blend._id)}
                        disabled={deletingBlendId === blend._id}
                        className="rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 text-xs font-bold px-2.5 py-1.5 disabled:opacity-60 cursor-pointer"
                      >
                        {deletingBlendId === blend._id ? "Deleting…" : "Delete"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">
                No blends yet. Create one by selecting your existing friends.
              </p>
            )}
          </section>
        )}
      </main>

      {showBlendModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-950/45 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-border bg-background p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black">Create blend</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Choose one or more existing friends.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowBlendModal(false);
                  setSelectedBlendFriendIds([]);
                }}
                className="h-8 w-8 text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                ×
              </button>
            </div>

            <div className="mt-5 max-h-72 overflow-y-auto space-y-2">
              {friends.map((friend) => {
                const checked = selectedBlendFriendIds.includes(friend._id);
                return (
                  <label
                    key={friend._id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 cursor-pointer"
                  >
                    <div>
                      <p className="font-semibold">@{friend.username}</p>
                      <p className="text-xs text-slate-500">{friend.fullname}</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleBlendSelection(friend._id)}
                      className="h-4 w-4"
                    />
                  </label>
                );
              })}
            </div>

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowBlendModal(false);
                  setSelectedBlendFriendIds([]);
                }}
                className="rounded-xl px-4 py-2.5 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-card-hover cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={createBlend}
                disabled={creatingBlend || selectedBlendFriendIds.length === 0}
                className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-violet-500 disabled:opacity-50 cursor-pointer"
              >
                {creatingBlend ? "Creating…" : "Create blend"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
