import { randomBytes } from "node:crypto";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.coerce.number().int().min(0).max(65535).default(4000),
  CLIENT_ORIGIN: z.string().default("http://localhost:3000"),
  JWT_SECRET: z
    .string()
    .min(32, "JWT_SECRET must be at least 32 characters")
    .optional(),
  DATABASE_URL: z
    .string()
    .url()
    .optional()
    .or(z.literal("").transform(() => undefined)),
  TURN_SECONDS: z.coerce.number().min(1).max(600).default(60),
  RECONNECT_SECONDS: z.coerce.number().min(1).max(600).default(60),
});

export interface AppConfig {
  nodeEnv: "development" | "production" | "test";
  port: number;
  clientOrigins: string[];
  jwtSecret: string;
  databaseUrl?: string;
  turnMs: number;
  reconnectMs: number;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    throw new Error(
      `Invalid environment: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
    );
  }
  const e = parsed.data;
  if (!e.JWT_SECRET && e.NODE_ENV === "production") {
    throw new Error("JWT_SECRET is required in production");
  }
  return {
    nodeEnv: e.NODE_ENV,
    port: e.PORT,
    clientOrigins: e.CLIENT_ORIGIN.split(",")
      .map((o) => o.trim())
      .filter(Boolean),
    // Dev fallback: sessions are invalidated on restart.
    jwtSecret: e.JWT_SECRET ?? randomBytes(48).toString("base64url"),
    databaseUrl: e.DATABASE_URL,
    turnMs: e.TURN_SECONDS * 1000,
    reconnectMs: e.RECONNECT_SECONDS * 1000,
  };
}
