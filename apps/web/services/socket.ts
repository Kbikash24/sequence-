import { io, type Socket } from "socket.io-client";
import type {
  ClientEventName,
  ClientToServerEvents,
  ServerToClientEvents,
} from "@sequence/shared";
import { SERVER_URL } from "@/lib/utils";

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;
export type EventPayload<E extends ClientEventName> = Parameters<
  ClientToServerEvents[E]
>[0];
export type EventAck<E extends ClientEventName> = Parameters<
  Parameters<ClientToServerEvents[E]>[1]
>[0];

let socket: AppSocket | null = null;
let socketToken: string | null = null;

/** One shared socket per session token. */
export function getSocket(token: string): AppSocket {
  if (socket && socketToken === token) {
    if (socket.disconnected) socket.connect();
    return socket;
  }
  socket?.disconnect();
  socket = io(SERVER_URL, {
    auth: { token },
    transports: ["websocket", "polling"],
    reconnectionDelay: 500,
    reconnectionDelayMax: 4000,
  });
  socketToken = token;
  return socket;
}

export function closeSocket() {
  socket?.disconnect();
  socket = null;
  socketToken = null;
}

export function request<E extends ClientEventName>(
  s: AppSocket,
  event: E,
  payload: EventPayload<E>,
  timeoutMs = 10_000,
): Promise<EventAck<E>> {
  return new Promise((resolve) => {
    const emitter = s.timeout(timeoutMs) as unknown as {
      emit(
        e: string,
        p: unknown,
        cb: (err: Error | null, res: EventAck<E>) => void,
      ): void;
    };
    emitter.emit(event, payload, (err, res) => {
      resolve(
        err
          ? ({
              ok: false,
              error: "The server did not respond",
              code: "INTERNAL",
            } as EventAck<E>)
          : res,
      );
    });
  });
}
