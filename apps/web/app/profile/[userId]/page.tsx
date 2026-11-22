"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Trophy, Flame, Zap } from "lucide-react";
import { useSession } from "@/stores/session";
import type { PlayerProfile } from "@sequence/shared";

export default function ProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const user = useSession((s) => s.user);
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    params.then((p) => setUserId(p.userId));
  }, [params]);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!userId || !user) return;
      try {
        const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:4000";
        const token = useSession.getState().token;
        const response = await fetch(
          `${serverUrl}/api/profile/${userId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        if (!response.ok) {
          throw new Error("Failed to load profile");
        }
        const data = await response.json();
        setProfile(data.profile);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load profile");
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [userId, user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-12 w-12 border-4 border-violet-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-slate-400">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error || "Profile not found"}</p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 glass glass-hover rounded-lg px-4 py-2 text-sm font-medium text-slate-200"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  const isOwnProfile = user?.id === userId;
  const { stats, winRate, level } = profile;
  const joinedDate = new Date(profile.createdAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950">
      <div className="mx-auto max-w-2xl px-4 py-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-slate-400 hover:text-slate-200 transition"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
          {isOwnProfile && (
            <Link
              href="/settings"
              className="glass glass-hover rounded-lg px-3 py-1.5 text-sm font-medium text-slate-200"
            >
              Edit Profile
            </Link>
          )}
        </div>

        {/* Profile Card */}
        <div className="glass rounded-3xl p-8 backdrop-blur-xl ring-1 ring-white/10">
          {/* Profile Header */}
          <div className="mb-8 text-center">
            <div className="mb-4 flex justify-center">
              <div className="relative">
                <div className="h-24 w-24 rounded-full bg-gradient-to-br from-violet-500/40 to-purple-500/40 ring-2 ring-violet-500/50 flex items-center justify-center">
                  <span className="text-3xl font-black text-gradient">
                    {profile.nickname.charAt(0).toUpperCase()}
                  </span>
                </div>
                {level >= 10 && (
                  <div className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full bg-yellow-500 flex items-center justify-center text-xs font-bold ring-2 ring-slate-950">
                    {level}
                  </div>
                )}
              </div>
            </div>
            <h1 className="text-3xl font-black mb-2">{profile.nickname}</h1>
            <p className="text-sm text-slate-400">
              Joined {joinedDate} • Level {level}
            </p>
          </div>

          {/* Stats Grid */}
          <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard
              icon={<Trophy className="h-5 w-5" />}
              label="Wins"
              value={stats.wins}
              color="text-amber-400"
            />
            <StatCard
              icon={<Flame className="h-5 w-5" />}
              label="Win Rate"
              value={`${winRate}%`}
              color="text-orange-400"
            />
            <StatCard
              icon={<Zap className="h-5 w-5" />}
              label="Games"
              value={stats.gamesPlayed}
              color="text-violet-400"
            />
            <StatCard
              label="Sequences"
              value={stats.sequencesCompleted}
              color="text-cyan-400"
            />
          </div>

          {/* Detailed Stats */}
          <div className="space-y-4 border-t border-white/10 pt-8">
            <div className="flex items-center justify-between py-3">
              <span className="text-slate-400">Total Wins</span>
              <span className="font-semibold text-emerald-400">{stats.wins}</span>
            </div>
            <div className="flex items-center justify-between py-3 border-t border-white/5">
              <span className="text-slate-400">Total Losses</span>
              <span className="font-semibold text-red-400">{stats.losses}</span>
            </div>
            <div className="flex items-center justify-between py-3 border-t border-white/5">
              <span className="text-slate-400">Draws</span>
              <span className="font-semibold text-slate-400">{stats.draws}</span>
            </div>
            <div className="flex items-center justify-between py-3 border-t border-white/5">
              <span className="text-slate-400">Sequences Formed</span>
              <span className="font-semibold text-cyan-400">
                {stats.sequencesCompleted}
              </span>
            </div>
            <div className="flex items-center justify-between py-3 border-t border-white/5">
              <span className="text-slate-400">Games Played</span>
              <span className="font-semibold text-violet-400">
                {stats.gamesPlayed}
              </span>
            </div>
          </div>

          {/* Win Rate Bar */}
          {stats.gamesPlayed > 0 && (
            <div className="mt-8 border-t border-white/10 pt-8">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-medium text-slate-300">
                  Win Rate
                </span>
                <span className="text-sm font-bold text-gradient">{winRate}%</span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-slate-800 ring-1 ring-white/5">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500"
                  style={{ width: `${winRate}%` }}
                />
              </div>
            </div>
          )}

          {/* Action Buttons */}
          {!isOwnProfile && user && (
            <div className="mt-8 flex gap-3 border-t border-white/10 pt-8">
              <button className="flex-1 glass glass-hover rounded-lg py-2.5 text-sm font-medium text-slate-200 transition">
                Challenge
              </button>
              <button className="flex-1 glass glass-hover rounded-lg py-2.5 text-sm font-medium text-slate-200 transition">
                Add Friend
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div className="rounded-xl bg-white/5 p-4 ring-1 ring-white/10">
      {icon && <div className={`mb-2 ${color}`}>{icon}</div>}
      <p className="mb-1 text-xs font-medium uppercase tracking-widest text-slate-400">
        {label}
      </p>
      <p className={`text-2xl font-black ${color}`}>{value}</p>
    </div>
  );
}
