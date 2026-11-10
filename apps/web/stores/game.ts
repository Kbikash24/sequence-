import { create } from "zustand";
import type {
  ActivityEntry,
  Card,
  ChatMessage,
  GameOverPayload,
  HandPayload,
  PublicGameState,
  RoomInfo,
  RoomSnapshot,
} from "@sequence/shared";

export type ConnectionState =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "replaced";

export interface Notice {
  id: number;
  message: string;
  tone: "error" | "info";
}

interface GameStore {
  connection: ConnectionState;
  room: RoomInfo | null;
  game: PublicGameState | null;
  hand: Card[];
  handKey: { gameId: string; version: number } | null;
  chat: ChatMessage[];
  log: ActivityEntry[];
  gameOver: GameOverPayload | null;
  disconnects: Record<string, number>;
  rematchVotes: string[];
  selectedCardId: string | null;
  clockOffset: number;
  fatal: {
    code?: string;
    message: string;
    details?: Record<string, string>;
  } | null;
  notice: Notice | null;

  hydrate: (snapshot: RoomSnapshot) => void;
  setRoom: (room: RoomInfo) => void;
  setGame: (game: PublicGameState) => void;
  setHand: (hand: HandPayload) => void;
  addChat: (message: ChatMessage) => void;
  addLog: (entry: ActivityEntry) => void;
  setGameOver: (payload: GameOverPayload) => void;
  setRematchVotes: (votes: string[]) => void;
  markDisconnected: (userId: string, deadline: number) => void;
  markReconnected: (userId: string) => void;
  selectCard: (cardId: string | null) => void;
  setConnection: (state: ConnectionState) => void;
  setFatal: (fatal: GameStore["fatal"]) => void;
  notify: (message: string, tone?: Notice["tone"]) => void;
  reset: () => void;
}

const initialState = {
  connection: "idle" as ConnectionState,
  room: null,
  game: null,
  hand: [],
  handKey: null,
  chat: [],
  log: [],
  gameOver: null,
  disconnects: {},
  rematchVotes: [],
  selectedCardId: null,
  clockOffset: 0,
  fatal: null,
  notice: null,
};

let noticeId = 0;

export const useGameStore = create<GameStore>()((set, get) => ({
  ...initialState,

  hydrate: (s) =>
    set({
      room: s.room,
      game: s.game,
      hand: s.hand,
      handKey: s.game
        ? { gameId: s.game.gameId, version: s.game.version }
        : null,
      chat: s.chat,
      log: s.log,
      gameOver: s.gameOver,
      disconnects: s.disconnects,
      rematchVotes: s.room.rematchVotes,
      clockOffset: s.game ? s.game.serverTime - Date.now() : get().clockOffset,
      selectedCardId: null,
      fatal: null,
    }),

  setRoom: (room) =>
    set(
      room.status === "lobby"
        ? {
            room,
            game: null,
            hand: [],
            handKey: null,
            gameOver: null,
            rematchVotes: [],
            selectedCardId: null,
          }
        : { room, rematchVotes: room.rematchVotes },
    ),

  setGame: (game) => {
    const current = get().game;
    const sameGame = current?.gameId === game.gameId;
    if (sameGame && game.version < current!.version) return;
    set({
      game,
      clockOffset: game.serverTime - Date.now(),
      ...(sameGame
        ? {}
        : {
            selectedCardId: null,
            gameOver: game.status === "playing" ? null : get().gameOver,
          }),
    });
  },

  setHand: (h) => {
    const key = get().handKey;
    if (key && key.gameId === h.gameId && h.version < key.version) return;
    const selected = get().selectedCardId;
    set({
      hand: h.cards,
      handKey: { gameId: h.gameId, version: h.version },
      selectedCardId:
        selected && h.cards.some((c) => c.id === selected) ? selected : null,
    });
  },

  addChat: (message) => set((s) => ({ chat: [...s.chat.slice(-99), message] })),
  addLog: (entry) => set((s) => ({ log: [...s.log.slice(-199), entry] })),
  setGameOver: (gameOver) => set({ gameOver }),
  setRematchVotes: (rematchVotes) => set({ rematchVotes }),
  markDisconnected: (userId, deadline) =>
    set((s) => ({ disconnects: { ...s.disconnects, [userId]: deadline } })),
  markReconnected: (userId) =>
    set((s) => {
      const { [userId]: _removed, ...rest } = s.disconnects;
      return { disconnects: rest };
    }),
  selectCard: (selectedCardId) => set({ selectedCardId }),
  setConnection: (connection) => set({ connection }),
  setFatal: (fatal) => set({ fatal }),
  notify: (message, tone = "error") =>
    set({ notice: { id: ++noticeId, message, tone } }),
  reset: () => set({ ...initialState }),
}));
