import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { GuestUser } from "@sequence/shared";

interface SessionState {
  token: string | null;
  user: GuestUser | null;
  setSession: (token: string, user: GuestUser) => void;
  clear: () => void;
}

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setSession: (token, user) => set({ token, user }),
      clear: () => set({ token: null, user: null }),
    }),
    { name: "sequence-arena-session" },
  ),
);
