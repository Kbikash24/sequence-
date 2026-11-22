"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Save, User } from "lucide-react";
import { useSession } from "@/stores/session";
import { Button } from "@/components/ui/Button";

interface ProfileSettings {
  nickname: string;
  bio: string;
}

export default function SettingsPage() {
  const user = useSession((s) => s.user);
  const [settings, setSettings] = useState<ProfileSettings>({
    nickname: "",
    bio: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const initSettings = async () => {
      try {
        setSettings({
          nickname: user.nickname || "",
          bio: "", // Future: load from API
        });
      } catch (err) {
        console.error("Failed to load settings", err);
      } finally {
        setLoading(false);
      }
    };

    initSettings();
  }, [user]);

  const handleSave = useCallback(async () => {
    if (!user) return;

    setSaving(true);
    setMessage(null);

    try {
      const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:4000";
      const token = useSession.getState().token;

      const response = await fetch(`${serverUrl}/api/profile/update`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          nickname: settings.nickname,
          bio: settings.bio,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save settings");
      }

      setMessage({ type: "success", text: "Profile updated successfully!" });
      
      // Update local user state
      useSession.setState((state) => ({
        user: state.user ? { ...state.user, nickname: settings.nickname } : null,
      }));
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to save settings",
      });
    } finally {
      setSaving(false);
    }
  }, [settings, user]);

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-slate-300 mb-4">Please log in to access settings</p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 glass glass-hover rounded-lg px-6 py-3 text-sm font-medium text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <p className="text-slate-300">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-4 py-8">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
            Back
          </Link>
          <h1 className="text-3xl font-bold text-white">Profile Settings</h1>
          <div className="w-12" /> {/* Spacer for centering */}
        </div>

        {/* Settings Card */}
        <div className="rounded-2xl bg-white/[0.03] p-8 ring-1 ring-white/8 backdrop-blur-sm space-y-6">
          {/* Success/Error Messages */}
          {message && (
            <div
              className={`rounded-lg px-4 py-3 text-sm font-medium ${
                message.type === "success"
                  ? "bg-emerald-500/10 text-emerald-200 ring-1 ring-emerald-500/20"
                  : "bg-red-500/10 text-red-200 ring-1 ring-red-500/20"
              }`}
            >
              {message.text}
            </div>
          )}

          {/* Avatar Section */}
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm font-semibold text-white">
              <User className="h-4 w-4 text-violet-300" />
              Profile Avatar
            </label>
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-purple-600 text-2xl font-bold text-white">
                {settings.nickname.charAt(0).toUpperCase()}
              </div>
              <div className="text-sm text-slate-400">
                <p>Your avatar is generated from your nickname</p>
                <p className="text-xs mt-1">Change your nickname to update avatar</p>
              </div>
            </div>
          </div>

          <hr className="border-white/10" />

          {/* Nickname Input */}
          <div className="space-y-3">
            <label htmlFor="nickname" className="text-sm font-semibold text-white">
              Nickname
            </label>
            <input
              id="nickname"
              type="text"
              value={settings.nickname}
              onChange={(e) => setSettings({ ...settings, nickname: e.target.value })}
              placeholder="Enter your nickname"
              maxLength={32}
              className="w-full rounded-lg bg-white/5 px-4 py-2.5 text-white placeholder-slate-500 ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all"
            />
            <p className="text-xs text-slate-400">
              {settings.nickname.length}/32 characters
            </p>
          </div>

          {/* Bio Input */}
          <div className="space-y-3">
            <label htmlFor="bio" className="text-sm font-semibold text-white">
              Bio / Status (Coming Soon)
            </label>
            <textarea
              id="bio"
              value={settings.bio}
              onChange={(e) => setSettings({ ...settings, bio: e.target.value })}
              placeholder="Tell other players about yourself..."
              maxLength={150}
              disabled
              className="w-full h-24 rounded-lg bg-white/5 px-4 py-2.5 text-white placeholder-slate-500 ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed resize-none"
            />
            <p className="text-xs text-slate-400">
              {settings.bio.length}/150 characters • Feature coming soon
            </p>
          </div>

          <hr className="border-white/10" />

          {/* Account Info */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-white">Account Information</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between py-2 px-3 rounded bg-white/5">
                <span className="text-slate-400">Player ID:</span>
                <span className="text-white font-mono text-xs">{user.id.substring(0, 12)}...</span>
              </div>
              <div className="flex justify-between py-2 px-3 rounded bg-white/5">
                <span className="text-slate-400">Status:</span>
                <span className="text-emerald-300">Active</span>
              </div>
            </div>
          </div>

          <hr className="border-white/10" />

          {/* Save Button */}
          <div className="flex gap-3 pt-4">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {saving ? "Saving..." : "Save Changes"}
            </Button>
            <Link
              href="/"
              className="flex items-center justify-center gap-2 glass glass-hover rounded-lg px-6 py-2.5 text-sm font-medium text-white"
            >
              Cancel
            </Link>
          </div>
        </div>

        {/* Future Features */}
        <div className="mt-8 rounded-2xl bg-white/[0.02] p-6 ring-1 ring-white/5">
          <h3 className="text-sm font-semibold text-white mb-3">Coming Soon</h3>
          <ul className="space-y-2 text-sm text-slate-400">
            <li>✨ Avatar Customization</li>
            <li>🎨 Theme Settings</li>
            <li>🔔 Notification Preferences</li>
            <li>🔐 Change Password</li>
            <li>🗑️ Delete Account</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
