import { z } from "zod";

export const nicknameSchema = z
  .string()
  .trim()
  .min(2, "Nickname must be at least 2 characters")
  .max(20, "Nickname must be at most 20 characters")
  .regex(/^[\p{L}\p{N} _.-]+$/u, "Nickname contains invalid characters");

export const roomCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9]{6}$/, "Room code must be 6 letters/numbers");

export const teamSchema = z.enum(["red", "blue"]);
export const modeSchema = z.enum(["1v1", "2v2"]);

const cardIdSchema = z.string().min(1).max(16);
const cellSchema = z.number().int().min(0).max(99);

export const gameActionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("place"),
    cardId: cardIdSchema,
    cell: cellSchema,
  }),
  z.object({
    type: z.literal("remove"),
    cardId: cardIdSchema,
    cell: cellSchema,
  }),
  z.object({ type: z.literal("exchangeDead"), cardId: cardIdSchema }),
]);

export const emptyPayloadSchema = z
  .object({})
  .strict()
  .optional()
  .transform(() => ({}) as Record<string, never>);

export const eventSchemas = {
  "room:create": z.object({ mode: modeSchema }),
  "room:join": z.object({ code: roomCodeSchema }),
  "room:leave": emptyPayloadSchema,
  "room:ready": z.object({ ready: z.boolean() }),
  "room:setTeam": z.object({ team: teamSchema }),
  "room:setMode": z.object({ mode: modeSchema }),
  "room:start": emptyPayloadSchema,
  "room:toLobby": emptyPayloadSchema,
  "game:action": z.object({
    actionId: z
      .string()
      .min(8)
      .max(64)
      .regex(/^[A-Za-z0-9_-]+$/),
    expectedVersion: z.number().int().min(0),
    action: gameActionSchema,
  }),
  "game:sync": emptyPayloadSchema,
  "game:rematch": z.object({ vote: z.boolean() }),
  "chat:send": z.object({ text: z.string().trim().min(1).max(200) }),
} as const;

export const guestLoginSchema = z.object({ nickname: nicknameSchema });
