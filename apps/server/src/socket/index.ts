import type { z } from "zod";
import { eventSchemas, type Ack, type ClientEventName } from "@sequence/shared";
import type { TokenService } from "../auth/tokens";
import { RoomError } from "../rooms/errors";
import type { RoomManager } from "../rooms/RoomManager";
import type { AppServer } from "../rooms/types";
import type { Logger } from "../services/logger";
import { TokenBucket } from "./rateLimiter";

type Payload<E extends ClientEventName> = z.output<(typeof eventSchemas)[E]>;
type RawSocket = {
  on(event: string, listener: (...args: unknown[]) => void): void;
};

export function registerSocketHandlers(
  io: AppServer,
  rooms: RoomManager,
  tokens: TokenService,
  logger: Logger,
) {
  // userId -> the single socket allowed to act for that user.
  const activeSockets = new Map<string, string>();

  io.use((socket, next) => {
    const token: unknown = socket.handshake.auth?.token;
    const user = typeof token === "string" ? tokens.verify(token) : null;
    if (!user) return next(new Error("unauthorized"));
    socket.data.user = user;
    next();
  });

  io.on("connection", (socket) => {
    const user = socket.data.user;

    const previousId = activeSockets.get(user.id);
    activeSockets.set(user.id, socket.id);
    if (previousId && previousId !== socket.id) {
      const previous = io.sockets.sockets.get(previousId);
      if (previous) {
        previous.emit("session:replaced");
        previous.disconnect(true);
      }
    }

    socket.join(`user:${user.id}`);
    rooms.handleConnect(user);

    const limiter = new TokenBucket(30, 10);
    const chatLimiter = new TokenBucket(5, 0.5);

    const handle = <E extends ClientEventName>(
      event: E,
      fn: (payload: Payload<E>) => unknown,
      extraLimiter?: TokenBucket,
    ) => {
      (socket as unknown as RawSocket).on(
        event,
        (raw: unknown, maybeAck: unknown) => {
          const ack = (
            typeof maybeAck === "function" ? maybeAck : () => {}
          ) as (r: Ack<unknown>) => void;
          if (activeSockets.get(user.id) !== socket.id) {
            return ack({
              ok: false,
              code: "UNAUTHORIZED",
              error: "Session replaced",
            });
          }
          if (!limiter.take() || (extraLimiter && !extraLimiter.take())) {
            return ack({
              ok: false,
              code: "RATE_LIMITED",
              error: "Too many requests, slow down",
            });
          }
          const parsed = eventSchemas[event].safeParse(raw);
          if (!parsed.success) {
            return ack({
              ok: false,
              code: "INVALID_PAYLOAD",
              error: "Invalid request",
            });
          }
          try {
            const result = fn(parsed.data as Payload<E>);
            // game:action returns its own Ack (it may be a cached idempotent response).
            if (event === "game:action") return ack(result as Ack<unknown>);
            ack({ ok: true, data: result ?? null });
          } catch (err) {
            if (err instanceof RoomError) {
              return ack({
                ok: false,
                code: err.code,
                error: err.message,
                details: err.details,
              });
            }
            logger.error("socket handler failed", {
              event,
              error:
                err instanceof Error ? (err.stack ?? err.message) : String(err),
            });
            ack({ ok: false, code: "INTERNAL", error: "Something went wrong" });
          }
        },
      );
    };

    handle("room:create", (p) => rooms.createRoom(user, p.mode));
    handle("room:join", (p) => rooms.joinRoom(user, p.code));
    handle("room:leave", () => rooms.leaveRoom(user));
    handle("room:ready", (p) => rooms.setReady(user, p.ready));
    handle("room:setTeam", (p) => rooms.setTeam(user, p.team));
    handle("room:setMode", (p) => rooms.setMode(user, p.mode));
    handle("room:start", () => rooms.startGame(user));
    handle("room:toLobby", () => rooms.returnToLobby(user));
    handle("game:action", (p) => rooms.handleAction(user, p));
    handle("game:sync", () => rooms.sync(user));
    handle("game:rematch", (p) => rooms.voteRematch(user, p.vote));
    handle("chat:send", (p) => rooms.sendChat(user, p.text), chatLimiter);

    socket.on("disconnect", () => {
      if (activeSockets.get(user.id) !== socket.id) return;
      activeSockets.delete(user.id);
      rooms.handleDisconnect(user);
    });
  });
}
