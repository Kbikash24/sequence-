"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Clock, UserMinus, UserPlus, X } from "lucide-react";
import type { FriendStatus } from "@sequence/shared";
import { api } from "@/services/api";
import { useSession } from "@/stores/session";

const BTN =
  "flex flex-1 items-center justify-center gap-2 glass glass-hover rounded-lg py-2.5 text-sm font-medium text-slate-200 transition disabled:opacity-50";

export function FriendButton({ userId }: { userId: string }) {
  const token = useSession((s) => s.token);
  const [status, setStatus] = useState<FriendStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setStatus(null);
    setError(null);
    api
      .friendStatus(token, userId)
      .then((res) => {
        if (!cancelled) setStatus(res.status);
      })
      .catch((err) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Failed to load");
      });
    return () => {
      cancelled = true;
    };
  }, [token, userId]);

  const run = useCallback(
    async (action: (token: string) => Promise<{ status: FriendStatus }>) => {
      if (!token) return;
      setBusy(true);
      setError(null);
      try {
        setStatus((await action(token)).status);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setBusy(false);
      }
    },
    [token],
  );

  if (error && !status) {
    return (
      <p className="flex-1 text-center text-sm text-red-400">{error}</p>
    );
  }
  if (!status) {
    return (
      <button disabled className={BTN}>
        Add Friend
      </button>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-2">
      {status === "none" && (
        <button
          disabled={busy}
          className={BTN}
          onClick={() => void run((t) => api.sendFriendRequest(t, userId))}
        >
          <UserPlus className="h-4 w-4" /> Add Friend
        </button>
      )}
      {status === "request_sent" && (
        <button
          disabled={busy}
          className={BTN}
          title="Cancel friend request"
          onClick={() => void run((t) => api.removeFriend(t, userId))}
        >
          <Clock className="h-4 w-4" /> Request Sent · Cancel
        </button>
      )}
      {status === "request_received" && (
        <div className="flex gap-2">
          <button
            disabled={busy}
            className={BTN}
            onClick={() =>
              void run((t) => api.respondFriendRequest(t, userId, true))
            }
          >
            <Check className="h-4 w-4 text-emerald-400" /> Accept
          </button>
          <button
            disabled={busy}
            className={BTN}
            onClick={() =>
              void run((t) => api.respondFriendRequest(t, userId, false))
            }
          >
            <X className="h-4 w-4 text-red-400" /> Decline
          </button>
        </div>
      )}
      {status === "friends" && (
        <button
          disabled={busy}
          className={BTN}
          title="Remove friend"
          onClick={() => void run((t) => api.removeFriend(t, userId))}
        >
          <UserMinus className="h-4 w-4" /> Friends · Remove
        </button>
      )}
      {error && <p className="text-center text-xs text-red-400">{error}</p>}
    </div>
  );
}
