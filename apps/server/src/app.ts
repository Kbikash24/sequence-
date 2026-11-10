import { createServer } from "node:http";
import cors from "cors";
import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import helmet from "helmet";
import { Server } from "socket.io";
import { createTokenService } from "./auth/tokens";
import type { AppConfig } from "./config";
import { RoomManager } from "./rooms/RoomManager";
import type { AppServer } from "./rooms/types";
import { createRoutes } from "./routes";
import type { Logger } from "./services/logger";
import type { Persistence } from "./services/persistence";
import { registerSocketHandlers } from "./socket";

export interface ServerDeps {
  persistence: Persistence;
  logger: Logger;
}

export function createSequenceServer(
  config: AppConfig,
  { persistence, logger }: ServerDeps,
) {
  const app = express();
  app.disable("x-powered-by");
  if (config.nodeEnv === "production") app.set("trust proxy", 1);
  app.use(helmet());
  app.use(cors({ origin: config.clientOrigins }));
  app.use(express.json({ limit: "10kb" }));

  const httpServer = createServer(app);
  const io: AppServer = new Server(httpServer, {
    cors: { origin: config.clientOrigins },
    maxHttpBufferSize: 16 * 1024,
    pingInterval: 10_000,
    pingTimeout: 8_000,
  });

  const tokens = createTokenService(config.jwtSecret);
  const rooms = new RoomManager(io, {
    turnMs: config.turnMs,
    reconnectMs: config.reconnectMs,
    persistence,
    logger,
  });

  app.use("/api", createRoutes({ tokens, rooms, persistence, logger }));
  app.use((_req, res) => {
    res.status(404).json({ error: "Not found" });
  });
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const status =
      typeof err === "object" && err && "status" in err
        ? Number(err.status)
        : 500;
    if (status >= 500)
      logger.error("http error", {
        error: err instanceof Error ? err.message : String(err),
      });
    res
      .status(status)
      .json({ error: status >= 500 ? "Internal server error" : "Bad request" });
  });

  registerSocketHandlers(io, rooms, tokens, logger);

  return {
    app,
    httpServer,
    io,
    rooms,
    tokens,
    async close() {
      rooms.shutdown();
      await new Promise<void>((resolve) => io.close(() => resolve()));
      await persistence.close();
    },
  };
}

export type SequenceServer = ReturnType<typeof createSequenceServer>;
