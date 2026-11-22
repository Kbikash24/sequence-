import { create } from "zustand";
import type {
  Challenge,
  ChallengeResolved,
  OnlineUser,
} from "@sequence/shared";

export interface PresenceMessage {
  id: number;
  text: string;
}

interface PresenceStore {
  online: OnlineUser[];
  incoming: Challenge[];
  outgoing: Challenge | null;
  message: PresenceMessage | null;

  setOnline: (users: OnlineUser[]) => void;
  receive: (challenge: Challenge) => void;
  setOutgoing: (challenge: Challenge | null) => void;
  resolve: (payload: ChallengeResolved) => void;
  dismissIncoming: (id: string) => void;
  clearMessage: () => void;
  reset: () => void;
}

let messageId = 0;
const say = (text: string): PresenceMessage => ({ id: ++messageId, text });

export const usePresence = create<PresenceStore>()((set) => ({
  online: [],
  incoming: [],
  outgoing: null,
  message: null,

  setOnline: (online) => set({ online }),
  receive: (challenge) =>
    set((s) =>
      s.incoming.some((c) => c.id === challenge.id)
        ? s
        : { incoming: [...s.incoming, challenge] },
    ),
  setOutgoing: (outgoing) => set({ outgoing }),
  resolve: ({ challengeId, outcome }) =>
    set((s) => {
      const received = s.incoming.find((c) => c.id === challengeId);
      const sent = s.outgoing?.id === challengeId ? s.outgoing : null;
      const next = {
        incoming: s.incoming.filter((c) => c.id !== challengeId),
        outgoing: sent ? null : s.outgoing,
      };
      if (sent) {
        const name = sent.toNickname;
        const text =
          outcome === "declined"
            ? `${name} declined your challenge`
            : outcome === "expired"
              ? `${name} didn't respond in time`
              : outcome === "offline"
                ? `${name} went offline`
                : null;
        return text ? { ...next, message: say(text) } : next;
      }
      if (received) {
        const name = received.fromNickname;
        const text =
          outcome === "expired"
            ? `Challenge from ${name} expired`
            : outcome === "cancelled"
              ? `${name} cancelled the challenge`
              : null;
        return text ? { ...next, message: say(text) } : next;
      }
      return next;
    }),
  dismissIncoming: (id) =>
    set((s) => ({ incoming: s.incoming.filter((c) => c.id !== id) })),
  clearMessage: () => set({ message: null }),
  reset: () => set({ online: [], incoming: [], outgoing: null, message: null }),
}));

export const notifyPresence = (text: string) =>
  usePresence.setState({ message: say(text) });
