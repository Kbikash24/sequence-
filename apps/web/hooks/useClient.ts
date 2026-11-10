"use client";

import { useEffect, useState } from "react";

/** True after the first client render; gates UI that depends on localStorage. */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

/** Milliseconds remaining until `deadline` (server clock), corrected by `offset`. */
export function useCountdown(
  deadline: number | null,
  offset = 0,
  intervalMs = 250,
): number {
  const compute = () =>
    deadline ? Math.max(0, deadline - (Date.now() + offset)) : 0;
  const [remaining, setRemaining] = useState(compute);
  useEffect(() => {
    setRemaining(compute());
    if (!deadline) return;
    const id = setInterval(() => setRemaining(compute()), intervalMs);
    return () => clearInterval(id);
  }, [deadline, offset, intervalMs]);
  return remaining;
}
