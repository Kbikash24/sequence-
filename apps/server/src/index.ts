import "dotenv/config";
import { createSequenceServer } from "./app";
import { loadConfig } from "./config";
import { createLogger } from "./services/logger";
import { NoopPersistence, type Persistence } from "./services/persistence";

const config = loadConfig();
const logger = createLogger({ json: config.nodeEnv === "production" });

if (!process.env.JWT_SECRET) {
  logger.warn(
    "JWT_SECRET not set; using an ephemeral secret (sessions reset on restart)",
  );
}

let persistence: Persistence;
if (config.databaseUrl) {
  const { PrismaPersistence } = await import("./services/prismaPersistence");
  const prisma = new PrismaPersistence();
  await prisma.connect();
  persistence = prisma;
  logger.info("connected to database");
} else {
  logger.warn("DATABASE_URL not set; running without persistence");
  persistence = new NoopPersistence();
}

const server = createSequenceServer(config, { persistence, logger });
server.httpServer.listen(config.port, () => {
  logger.info(`Sequence Arena server listening on :${config.port}`, {
    origins: config.clientOrigins,
  });
});

let shuttingDown = false;
const shutdown = async (signal: string) => {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`received ${signal}, shutting down`);
  await server.close();
  process.exit(0);
};
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
