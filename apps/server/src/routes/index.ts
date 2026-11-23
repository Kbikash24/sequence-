import { randomUUID } from "node:crypto";
import { Router } from "express";
import rateLimit from "express-rate-limit";
import { guestLoginSchema, roomCodeSchema } from "@sequence/shared";
import { currentUser, requireAuth } from "../auth/middleware";
import type { TokenService } from "../auth/tokens";
import type { RoomManager } from "../rooms/RoomManager";
import type { Logger } from "../services/logger";
import type { Persistence } from "../services/persistence";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface RouteDeps {
  tokens: TokenService;
  rooms: RoomManager;
  persistence: Persistence;
  logger: Logger;
}

export function createRoutes({
  tokens,
  rooms,
  persistence,
  logger,
}: RouteDeps): Router {
  const router = Router();
  const auth = requireAuth(tokens);

  router.use(
    rateLimit({
      windowMs: 60_000,
      limit: 120,
      standardHeaders: "draft-7",
      legacyHeaders: false,
    }),
  );
  const loginLimiter = rateLimit({
    windowMs: 60_000,
    limit: 10,
    standardHeaders: "draft-7",
    legacyHeaders: false,
  });

  router.get("/health", (_req, res) => {
    res.json({
      ok: true,
      rooms: rooms.roomCount,
      uptime: Math.round(process.uptime()),
    });
  });

  router.post("/auth/guest", loginLimiter, async (req, res) => {
    const parsed = guestLoginSchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: parsed.error.issues[0]?.message ?? "Invalid nickname" });
      return;
    }
    const user = { id: randomUUID(), nickname: parsed.data.nickname };
    try {
      await persistence.upsertUser(user);
    } catch (err) {
      // Guests can still play if the database is temporarily unavailable.
      logger.error("failed to persist guest", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
    res.status(201).json({ token: tokens.sign(user), user });
  });

  router.get("/auth/me", auth, (_req, res) => {
    res.json({ user: currentUser(res) });
  });

  router.get("/rooms/:code", auth, (req, res) => {
    const parsed = roomCodeSchema.safeParse(req.params.code);
    const room = parsed.success ? rooms.getRoom(parsed.data) : undefined;
    if (!room) {
      res.status(404).json({ error: "Room not found" });
      return;
    }
    res.json({
      code: room.code,
      mode: room.mode,
      status: room.status,
      players: room.players.length,
      capacity: rooms.capacity(room),
    });
  });

  router.get("/stats/me", auth, async (_req, res) => {
    try {
      const stats = await persistence.getUserStats(currentUser(res).id);
      res.json({
        stats: stats ?? {
          gamesPlayed: 0,
          wins: 0,
          losses: 0,
          draws: 0,
          sequencesCompleted: 0,
        },
      });
    } catch (err) {
      logger.error("failed to load stats", {
        error: err instanceof Error ? err.message : String(err),
      });
      res.status(503).json({ error: "Stats unavailable" });
    }
  });

  router.get("/profile/:userId", auth, async (req, res) => {
    try {
      const profile = await persistence.getPlayerProfile(req.params.userId);
      if (!profile) {
        res.status(404).json({ error: "Player not found" });
        return;
      }
      const level = Math.floor(profile.stats.gamesPlayed / 10);
      const winRate = profile.stats.gamesPlayed > 0
        ? Math.round((profile.stats.wins / profile.stats.gamesPlayed) * 100)
        : 0;
      res.json({
        profile: {
          userId: req.params.userId,
          nickname: profile.nickname,
          createdAt: profile.createdAt,
          stats: profile.stats,
          winRate,
          level,
        },
      });
    } catch (err) {
      logger.error("failed to load profile", {
        error: err instanceof Error ? err.message : String(err),
      });
      res.status(503).json({ error: "Profile unavailable" });
    }
  });

  router.get("/profile/:userId/head-to-head", auth, async (req, res) => {
    const viewerId = currentUser(res).id;
    const otherId = req.params.userId;
    if (!UUID_RE.test(otherId)) {
      res.status(404).json({ error: "Player not found" });
      return;
    }
    if (otherId === viewerId) {
      res.status(400).json({ error: "Pick a different player" });
      return;
    }
    try {
      const result = await persistence.getHeadToHead(viewerId, otherId);
      if (!result) {
        res.status(404).json({ error: "Player not found" });
        return;
      }
      res.json({ headToHead: result });
    } catch (err) {
      logger.error("failed to load head-to-head", {
        error: err instanceof Error ? err.message : String(err),
      });
      res.status(503).json({ error: "Match history unavailable" });
    }
  });

  return router;
}
