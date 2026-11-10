"use client";

import clsx from "clsx";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Send } from "lucide-react";
import type { ActivityEntry, ChatMessage } from "@sequence/shared";

export function ChatPanel({
  messages,
  meId,
  onSend,
}: {
  messages: ChatMessage[];
  meId: string;
  onSend: (text: string) => Promise<unknown>;
}) {
  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({
      top: listRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages.length]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;
    setText("");
    await onSend(value);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        ref={listRef}
        className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1"
        aria-live="polite"
      >
        {messages.length === 0 && (
          <p className="py-6 text-center text-sm text-slate-500">
            Say hi to the table
          </p>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={clsx(
              "flex flex-col",
              m.userId === meId ? "items-end" : "items-start",
            )}
          >
            <span
              className={clsx(
                "text-[11px] font-semibold",
                m.team === "red" ? "text-rose-300" : "text-sky-300",
              )}
            >
              {m.nickname}
            </span>
            <p
              className={clsx(
                "max-w-[90%] break-words rounded-xl px-3 py-1.5 text-sm",
                m.userId === meId ? "bg-indigo-500/30" : "bg-white/8",
              )}
            >
              {m.text}
            </p>
          </div>
        ))}
      </div>
      <form onSubmit={submit} className="mt-2 flex gap-2">
        <label htmlFor="chat-input" className="sr-only">
          Chat message
        </label>
        <input
          id="chat-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={200}
          placeholder="Message…"
          autoComplete="off"
          className="h-10 min-w-0 flex-1 rounded-xl bg-white/6 px-3 text-sm ring-1 ring-white/10 placeholder:text-slate-500 focus:outline-none focus:ring-indigo-400"
        />
        <button
          type="submit"
          aria-label="Send message"
          className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-500 text-white transition hover:bg-indigo-400 disabled:opacity-40"
          disabled={!text.trim()}
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}

export function ActivityLog({ entries }: { entries: ActivityEntry[] }) {
  return (
    <ol
      className="h-full min-h-0 space-y-1.5 overflow-y-auto pr-1 text-sm"
      aria-label="Game activity"
    >
      {[...entries].reverse().map((e) => (
        <li
          key={e.id}
          className={clsx(
            "rounded-lg border-l-2 px-2.5 py-1.5",
            e.kind === "sequence"
              ? "bg-amber-400/10 font-semibold text-amber-200"
              : "bg-white/[0.03] text-slate-300",
            e.team === "red"
              ? "border-rose-400"
              : e.team === "blue"
                ? "border-sky-400"
                : "border-slate-600",
          )}
        >
          <span className="mr-2 font-mono text-[10px] text-slate-500">
            {new Date(e.at).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </span>
          {e.text}
        </li>
      ))}
    </ol>
  );
}
