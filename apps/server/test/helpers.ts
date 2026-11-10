import type { AddressInfo } from "node:net";
import { io as ioc, type Socket } from "socket.io-client";
import type {
  Ack,
  Card,
  ClientToServerEvents,
  GameOverPayload,
  PublicGameState,
  RoomSnapshot,
  ServerToClientEvents,
} from "@sequence/shared";
import { createSequenceServer, type SequenceServer } from "../src/app";
import type { AppConfig } from "../src/config";
import { createLogger } from "../src/services/logger";
import { NoopPersistence } from "../src/services/persistence";

export type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export interface TestServer {
  server: SequenceServer;
  url: string;
}

export async function startServer(
  overrides: Partial<AppConfig> = {},
): Promise<TestServer> {
  const config: AppConfig = {
    nodeEnv: "test",
    port: 0,
    clientOrigins: ["http://localhost:3000"],
    jwtSecret: "test-secret-that-is-definitely-long-enough",
    turnMs: 30_000,
    reconnectMs: 30_000,
    ...overrides,
  };
  const server = createSequenceServer(config, {
    persistence: new NoopPersistence(),
    logger: createLogger({ level: "error" }),
  });
  await new Promise<void>((resolve) => server.httpServer.listen(0, resolve));
  const { port } = server.httpServer.address() as AddressInfo;
  return { server, url: `http://127.0.0.1:${port}` };
}

export async function guestLogin(url: string, nickname: string) {
  const res = await fetch(`${url}/api/auth/guest`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ nickname }),
  });
  if (res.status !== 201) throw new Error(`login failed: ${res.status}`);
  return (await res.json()) as {
    token: string;
    user: { id: string; nickname: string };
  };
}

export function connectSocket(
  url: string,
  token: string,
): Promise<ClientSocket> {
  const socket: ClientSocket = ioc(url, {
    auth: { token },
    transports: ["websocket"],
    forceNew: true,
    reconnection: false,
  });
  return new Promise((resolve, reject) => {
    socket.once("connect", () => resolve(socket));
    socket.once("connect_error", (err) => reject(err));
  });
}

export function emit<T = null>(
  socket: ClientSocket,
  event: keyof ClientToServerEvents,
  payload: unknown,
): Promise<Ack<T>> {
  return new Promise((resolve) => {
    (socket.emit as (e: string, p: unknown, cb: (r: Ack<T>) => void) => void)(
      event,
      payload,
      resolve,
    );
  });
}

export function waitFor<T>(
  socket: ClientSocket,
  event: keyof ServerToClientEvents,
  predicate: (payload: T) => boolean = () => true,
  timeoutMs = 5000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const s = socket as unknown as {
      on(e: string, l: (p: T) => void): void;
      off(e: string, l: (p: T) => void): void;
    };
    const timer = setTimeout(() => {
      s.off(event, listener);
      reject(new Error(`timed out waiting for ${event}`));
    }, timeoutMs);
    const listener = (payload: T) => {
      if (!predicate(payload)) return;
      clearTimeout(timer);
      s.off(event, listener);
      resolve(payload);
    };
    s.on(event, listener);
  });
}

/** A connected test player that tracks the latest state and hand it has received. */
export class TestPlayer {
  state: PublicGameState | null = null;
  hand: Card[] = [];
  handHistory: Card[][] = [];
  gameOver: GameOverPayload | null = null;

  constructor(
    public socket: ClientSocket,
    public readonly token: string,
    public readonly user: { id: string; nickname: string },
  ) {
    this.listen();
  }

  static async create(url: string, nickname: string) {
    const { token, user } = await guestLogin(url, nickname);
    return new TestPlayer(await connectSocket(url, token), token, user);
  }

  listen() {
    this.socket.on("game:state", (s) => {
      if (
        !this.state ||
        s.gameId !== this.state.gameId ||
        s.version >= this.state.version
      )
        this.state = s;
    });
    this.socket.on("game:hand", (h) => {
      this.hand = h.cards;
      this.handHistory.push(h.cards);
    });
    this.socket.on("game:over", (g) => (this.gameOver = g));
  }

  async reconnect(url: string) {
    this.socket = await connectSocket(url, this.token);
    this.listen();
  }

  emit<T = null>(event: keyof ClientToServerEvents, payload: unknown = {}) {
    return emit<T>(this.socket, event, payload);
  }

  hydrate(snapshot: RoomSnapshot) {
    this.state = snapshot.game;
    this.hand = snapshot.hand;
  }
}

export async function until(check: () => boolean, timeoutMs = 5000) {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > timeoutMs)
      throw new Error("condition not met in time");
    await new Promise((r) => setTimeout(r, 10));
  }
}
