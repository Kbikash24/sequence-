"use client";

import { useState, type FormEvent } from "react";
import { ArrowRight } from "lucide-react";
import { nicknameSchema } from "@sequence/shared";
import { Button } from "@/components/ui/Button";
import { api } from "@/services/api";
import { useSession } from "@/stores/session";

/** Guest sign-in: a nickname is exchanged for a signed session token. */
export function NicknameForm({
  cta = "Continue",
  onDone,
}: {
  cta?: string;
  onDone?: () => void;
}) {
  const setSession = useSession((s) => s.setSession);
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = nicknameSchema.safeParse(nickname);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid nickname");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { token, user } = await api.guestLogin(parsed.data);
      setSession(token, user);
      onDone?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-2">
      <label htmlFor="nickname" className="text-sm font-medium text-slate-300">
        Choose a nickname
      </label>
      <div className="flex gap-2">
        <input
          id="nickname"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          maxLength={20}
          autoComplete="nickname"
          placeholder="e.g. AceOfHearts"
          aria-invalid={!!error}
          aria-describedby={error ? "nickname-error" : undefined}
          className="h-12 min-w-0 flex-1 rounded-xl bg-white/6 px-4 ring-1 ring-white/12 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-fuchsia-400"
        />
        <Button type="submit" size="lg" disabled={busy}>
          {cta} <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
      {error && (
        <p id="nickname-error" role="alert" className="text-sm text-rose-300">
          {error}
        </p>
      )}
    </form>
  );
}
