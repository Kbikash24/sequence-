import type {
  Ack,
  ActivityEntry,
  ChatMessage,
  GameAction,
  GameMode,
  GameOverPayload,
  HandPayload,
  PublicGameState,
  RoomInfo,
  RoomSnapshot,
  Team,
} from "./types";

export type EmptyPayload = Record<string, never>;
export type AckFn<T = null> = (response: Ack<T>) => void;

export interface ActionRequest {
  actionId: string;
  expectedVersion: number;
  action: GameAction;
}

export interface ClientToServerEvents {
  "room:create": (
    payload: { mode: GameMode },
    ack: AckFn<RoomSnapshot>,
  ) => void;
  "room:join": (payload: { code: string }, ack: AckFn<RoomSnapshot>) => void;
  "room:leave": (payload: EmptyPayload, ack: AckFn) => void;
  "room:ready": (payload: { ready: boolean }, ack: AckFn) => void;
  "room:setTeam": (payload: { team: Team }, ack: AckFn) => void;
  "room:setMode": (payload: { mode: GameMode }, ack: AckFn) => void;
  "room:start": (payload: EmptyPayload, ack: AckFn) => void;
  "room:toLobby": (payload: EmptyPayload, ack: AckFn) => void;
  "game:action": (
    payload: ActionRequest,
    ack: AckFn<{ version: number }>,
  ) => void;
  "game:sync": (payload: EmptyPayload, ack: AckFn<RoomSnapshot>) => void;
  "game:rematch": (payload: { vote: boolean }, ack: AckFn) => void;
  "chat:send": (payload: { text: string }, ack: AckFn) => void;
}

export interface ServerToClientEvents {
  "room:state": (room: RoomInfo) => void;
  "room:closed": (payload: { reason: string }) => void;
  "game:state": (state: PublicGameState) => void;
  "game:hand": (hand: HandPayload) => void;
  "game:event": (entry: ActivityEntry) => void;
  "game:over": (payload: GameOverPayload) => void;
  "game:rematch": (payload: { votes: string[]; required: number }) => void;
  "player:disconnected": (payload: {
    userId: string;
    deadline: number;
  }) => void;
  "player:reconnected": (payload: { userId: string }) => void;
  "chat:message": (message: ChatMessage) => void;
  "session:replaced": () => void;
}

export type ClientEventName = keyof ClientToServerEvents;
