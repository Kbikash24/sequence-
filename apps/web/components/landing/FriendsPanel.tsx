"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Check, Swords, UserMinus, UserPlus, X } from "lucide-react";
import type { FriendsList, FriendUser } from "@sequence/shared";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { usePresenceActions } from "@/hooks/usePresence";
import { api } from "@/services/api";
import { usePresence } from "@/stores/presence";
import { useSession } from "@/stores/session";

/** Friends and pending requests. Online status comes from the shared presence list. */
export function FriendsPanel() {
  const token = useSession((s) => s.token);
  const online = usePresence((s) => s.online);
  const outgoingChallenge = usePresence((s) => s.outgoing);
  const { challenge } = usePresenceActions();
  const [list, setList] = useState<FriendsList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setList(await api.friends(token));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load friends");
    }
  }, [token]);

  useEffect(() => {
    void load();
    // Requests arrive without a push event, so refresh periodically.
    const id = setInterval(() => void load(), 30_000);
    return () => clearInterval(id);
  }, [load]);

  const act = async (
    userId: string,
    action: (token: string) => Promise<unknown>,
  ) => {
    if (!token) return;
    setBusyId(userId);
    try {
      await action(token);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusyId(null);
    }
  };

  const statusOf = (userId: string) =>
    online.find((u) => u.userId === userId)?.status ?? null;

  return (
    <div className="rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/8">
      <p className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <UserPlus className="h-4 w-4 text-violet-300" /> Friends
        {list && list.incoming.length > 0 && (
          <span className="rounded-full bg-violet-500/30 px-2 py-0.5 text-xs font-medium text-violet-100">
            {list.incoming.length} new
          </span>
        )}
      </p>

      {error && !list && <p className="text-sm text-slate-400">{error}</p>}

      {list && (
        <div className="space-y-3">
          {list.incoming.length > 0 && (
            <ul className="space-y-1.5">
              {list.incoming.map((u) => (
                <Row key={u.userId} user={u}>
                  <span className="text-xs text-slate-400">wants to be friends</span>
                  <IconButton
                    label="Accept"
                    disabled={busyId === u.userId}
                    onClick={() =>
                      void act(u.userId, (t) =>
                        api.respondFriendRequest(t, u.userId, true),
                      )
                    }
                  >
                    <Check className="h-4 w-4 text-emerald-400" />
                  </IconButton>
                  <IconButton
                    label="Decline"
                    disabled={busyId === u.userId}
                    onClick={() =>
                      void act(u.userId, (t) =>
                        api.respondFriendRequest(t, u.userId, false),
                      )
                    }
                  >
                    <X className="h-4 w-4 text-red-400" />
                  </IconButton>
                </Row>
              ))}
            </ul>
          )}

          {list.friends.length === 0 && list.incoming.length === 0 ? (
            <p className="text-sm text-slate-400">
              No friends yet. Open a player&apos;s profile and tap Add Friend.
            </p>
          ) : (
            <ul className="max-h-56 space-y-1.5 overflow-y-auto pr-1">
              {list.friends.map((u) => {
                const status = statusOf(u.userId);
                return (
                  <Row
                    key={u.userId}
                    user={u}
                    subtitle={
                      status === null
                        ? "Offline"
                        : status === "available"
                          ? "Online"
                          : status === "in_lobby"
                            ? "In a lobby"
                            : "In a game"
                    }
                    online={status !== null}
                  >
                    {status === "available" || status === "in_lobby" ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={!!outgoingChallenge}
                        onClick={() => void challenge(u.userId)}
                      >
                        <Swords className="h-3.5 w-3.5" /> Challenge
                      </Button>
                    ) : null}
                    <IconButton
                      label="Remove friend"
                      disabled={busyId === u.userId}
                      onClick={() =>
                        void act(u.userId, (t) => api.removeFriend(t, u.userId))
                      }
                    >
                      <UserMinus className="h-4 w-4" />
                    </IconButton>
                  </Row>
                );
              })}
            </ul>
          )}

          {list.outgoing.length > 0 && (
            <p className="text-xs text-slate-500">
              Pending: {list.outgoing.map((u) => u.nickname).join(", ")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Row({
  user,
  subtitle,
  online,
  children,
}: {
  user: FriendUser;
  subtitle?: string;
  online?: boolean;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-center gap-3 rounded-xl bg-white/[0.04] px-3 py-2">
      <Link href={`/profile/${user.userId}`} className="shrink-0">
        <Avatar name={user.nickname} team="blue" size="sm" />
      </Link>
      <Link href={`/profile/${user.userId}`} className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{user.nickname}</p>
        {subtitle && (
          <p className="flex items-center gap-1.5 text-xs text-slate-400">
            <span
              className={`h-1.5 w-1.5 rounded-full ${online ? "bg-emerald-400" : "bg-slate-500"}`}
            />
            {subtitle}
          </p>
        )}
      </Link>
      {children}
    </li>
  );
}

function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="rounded-md p-1.5 text-slate-300 hover:bg-white/10 hover:text-white disabled:opacity-50"
    >
      {children}
    </button>
  );
}
