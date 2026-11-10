import { afterEach, describe, expect, it } from "vitest";
import { getCardTargets } from "@sequence/game-engine";
import { isOneEyedJack, type RoomSnapshot } from "@sequence/shared";
import {
  connectSocket,
  startServer,
  TestPlayer,
  until,
  waitFor,
  type TestServer,
} from "./helpers";

let ctx: TestServer | null = null;
const players: TestPlayer[] = [];

afterEach(async () => {
  for (const p of players.splice(0)) p.socket.disconnect();
  if (ctx) await ctx.server.close();
  ctx = null;
});

async function setup(overrides: Parameters<typeof startServer>[0] = {}) {
  ctx = await startServer(overrides);
  return ctx;
}

async function player(nickname: string) {
  const p = await TestPlayer.create(ctx!.url, nickname);
  players.push(p);
  return p;
}

async function startOneVsOne() {
  const host = await player("Host");
  const guest = await player("Guest");
  const created = await host.emit<RoomSnapshot>("room:create", { mode: "1v1" });
  if (!created.ok) throw new Error(created.error);
  const code = created.data.room.code;
  const joined = await guest.emit<RoomSnapshot>("room:join", { code });
  expect(joined.ok).toBe(true);
  expect((await guest.emit("room:ready", { ready: true })).ok).toBe(true);
  expect((await host.emit("room:start")).ok).toBe(true);
  await until(
    () =>
      !!host.state &&
      !!guest.state &&
      host.hand.length > 0 &&
      guest.hand.length > 0,
  );
  return { host, guest, code };
}

function currentAndOther(a: TestPlayer, b: TestPlayer) {
  const state = a.state!;
  const currentId = state.players[state.currentSeat]!.userId;
  return currentId === a.user.id
    ? { current: a, other: b }
    : { current: b, other: a };
}

function playableAction(p: TestPlayer) {
  const state = p.state!;
  const me = state.players.find((x) => x.userId === p.user.id)!;
  for (const card of p.hand) {
    if (isOneEyedJack(card.code)) continue;
    const targets = getCardTargets(
      state.chips,
      state.sequences,
      card.code,
      me.team,
    );
    if (targets.length > 0)
      return { type: "place" as const, cardId: card.id, cell: targets[0]! };
  }
  throw new Error("no playable card");
}

describe("http", () => {
  it("validates guest nicknames and authenticates requests", async () => {
    const { url } = await setup();
    const bad = await fetch(`${url}/api/auth/guest`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ nickname: "<script>" }),
    });
    expect(bad.status).toBe(400);
    expect((await fetch(`${url}/api/auth/me`)).status).toBe(401);
    const p = await player("Alice");
    const me = await fetch(`${url}/api/auth/me`, {
      headers: { authorization: `Bearer ${p.token}` },
    });
    expect(await me.json()).toEqual({ user: p.user });
  });
});

describe("rooms", () => {
  it("rejects unauthenticated sockets", async () => {
    const { url } = await setup();
    await expect(connectSocket(url, "not-a-token")).rejects.toThrow(
      /unauthorized/,
    );
  });

  it("creates, joins, validates capacity, team balance and readiness", async () => {
    await setup();
    const host = await player("Host");
    const guest = await player("Guest");
    const third = await player("Third");

    const created = await host.emit<RoomSnapshot>("room:create", {
      mode: "1v1",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const code = created.data.room.code;
    expect(code).toMatch(/^[A-Z0-9]{6}$/);

    expect(await third.emit("room:join", { code: "ZZZZZZ" })).toMatchObject({
      ok: false,
      code: "NOT_FOUND",
    });
    expect(await third.emit("room:join", { code: "bad" })).toMatchObject({
      ok: false,
      code: "INVALID_PAYLOAD",
    });

    const joined = await guest.emit<RoomSnapshot>("room:join", {
      code: code.toLowerCase(),
    });
    expect(joined.ok && joined.data.room.players.map((p) => p.team)).toEqual([
      "red",
      "blue",
    ]);
    expect(await third.emit("room:join", { code })).toMatchObject({
      ok: false,
      code: "ROOM_FULL",
    });

    expect(await guest.emit("room:setTeam", { team: "red" })).toMatchObject({
      ok: false,
      code: "TEAM_FULL",
    });
    expect(await guest.emit("room:start")).toMatchObject({
      ok: false,
      code: "NOT_HOST",
    });
    expect(await host.emit("room:start")).toMatchObject({
      ok: false,
      code: "NOT_READY",
    });
    await guest.emit("room:ready", { ready: true });
    expect((await host.emit("room:start")).ok).toBe(true);
    expect(await third.emit("room:join", { code })).toMatchObject({
      ok: false,
      code: "GAME_IN_PROGRESS",
    });
  });

  it("supports 2v2 with alternating teams and 6-card hands", async () => {
    await setup();
    const ps = [
      await player("P1"),
      await player("P2"),
      await player("P3"),
      await player("P4"),
    ];
    const created = await ps[0]!.emit<RoomSnapshot>("room:create", {
      mode: "2v2",
    });
    if (!created.ok) throw new Error(created.error);
    const code = created.data.room.code;
    for (const p of ps.slice(1)) {
      expect((await p.emit("room:join", { code })).ok).toBe(true);
      await p.emit("room:ready", { ready: true });
    }
    expect((await ps[0]!.emit("room:start")).ok).toBe(true);
    await until(() => ps.every((p) => p.hand.length === 6 && p.state));
    expect(ps[0]!.state!.players.map((p) => p.team)).toEqual([
      "red",
      "blue",
      "red",
      "blue",
    ]);
  });

  it("transfers host when the host leaves the lobby", async () => {
    await setup();
    const host = await player("Host");
    const guest = await player("Guest");
    const created = await host.emit<RoomSnapshot>("room:create", {
      mode: "1v1",
    });
    if (!created.ok) throw new Error(created.error);
    await guest.emit("room:join", { code: created.data.room.code });
    const update = waitFor<{ hostId: string; players: unknown[] }>(
      guest.socket,
      "room:state",
      (r) => r.players.length === 1,
    );
    expect((await host.emit("room:leave")).ok).toBe(true);
    expect((await update).hostId).toBe(guest.user.id);
  });
});

describe("gameplay", () => {
  it("deals private hands and never leaks them", async () => {
    await setup();
    const { host, guest } = await startOneVsOne();
    expect(host.hand).toHaveLength(7);
    expect(guest.hand).toHaveLength(7);
    const hostIds = new Set(host.hand.map((c) => c.id));
    expect(guest.handHistory.flat().some((c) => hostIds.has(c.id))).toBe(false);
    const json = JSON.stringify(host.state);
    for (const c of [...host.hand, ...guest.hand])
      expect(json).not.toContain(c.id);
    expect(json).not.toContain('"deck"');
  });

  it("applies valid moves and treats duplicate events idempotently", async () => {
    await setup();
    const { host, guest, code } = await startOneVsOne();
    const { current, other } = currentAndOther(host, guest);
    const action = playableAction(current);
    const request = { actionId: "action-dup-0001", expectedVersion: 0, action };

    const first = await current.emit<{ version: number }>(
      "game:action",
      request,
    );
    const second = await current.emit<{ version: number }>(
      "game:action",
      request,
    );
    expect(first).toEqual({ ok: true, data: { version: 1 } });
    expect(second).toEqual(first);
    expect(ctx!.server.rooms.getRoom(code)!.game!.version).toBe(1);

    await until(() => other.state?.version === 1);
    expect(other.state!.chips[action.cell]).not.toBeNull();
    expect(other.state!.lastAction).toMatchObject({
      type: "place",
      cell: action.cell,
    });
    expect(current.hand.some((c) => c.id === action.cardId)).toBe(false);
    expect(current.hand).toHaveLength(7);
  });

  it("rejects invalid, out-of-turn and simultaneous moves", async () => {
    await setup();
    const { host, guest } = await startOneVsOne();
    const { current, other } = currentAndOther(host, guest);

    const outOfTurn = await other.emit("game:action", {
      actionId: "action-oot-0001",
      expectedVersion: 0,
      action: playableAction(other),
    });
    expect(outOfTurn).toMatchObject({
      ok: false,
      code: "ILLEGAL_MOVE",
      details: { reason: "NOT_YOUR_TURN" },
    });

    const bad = await current.emit("game:action", {
      actionId: "action-bad-0001",
      expectedVersion: 0,
      action: { type: "place", cardId: current.hand[0]!.id, cell: 500 },
    });
    expect(bad).toMatchObject({ ok: false, code: "INVALID_PAYLOAD" });

    const notMine = await current.emit("game:action", {
      actionId: "action-steal-001",
      expectedVersion: 0,
      action: { type: "place", cardId: other.hand[0]!.id, cell: 1 },
    });
    expect(notMine).toMatchObject({
      ok: false,
      details: { reason: "CARD_NOT_IN_HAND" },
    });

    // Two different actions racing on the same version: exactly one wins.
    const action = playableAction(current);
    const [a, b] = await Promise.all([
      current.emit("game:action", {
        actionId: "race-aaaaaaaa",
        expectedVersion: 0,
        action,
      }),
      current.emit("game:action", {
        actionId: "race-bbbbbbbb",
        expectedVersion: 0,
        action,
      }),
    ]);
    expect([a.ok, b.ok].sort()).toEqual([false, true]);
    expect([a, b].find((r) => !r.ok)).toMatchObject({ code: "STALE_STATE" });
  });

  it("skips the turn when the timer expires", async () => {
    await setup({ turnMs: 300 });
    const { host } = await startOneVsOne();
    const start = host.state!.currentSeat;
    await until(() => host.state!.lastAction?.type === "timeout");
    expect(host.state!.currentSeat).not.toBe(start);
  });

  it("declares a winner and supports a rematch vote", async () => {
    await setup();
    const { host, guest, code } = await startOneVsOne();
    const room = ctx!.server.rooms.getRoom(code)!;
    const game = room.game!;
    const seat = game.currentSeat;
    const team = game.players[seat]!.team;
    const current = game.players[seat]!.userId === host.user.id ? host : guest;
    // Rig the board: one finished sequence and four of a second in column 0.
    for (const c of [10, 11, 12, 13, 14, 50, 70, 80]) game.chips[c] = team;
    game.sequences = [
      { id: "rigged", team, direction: "H", cells: [10, 11, 12, 13, 14] },
    ];
    game.players[seat]!.hand[0] = { id: "QC-9", code: "QC" };

    const res = await current.emit("game:action", {
      actionId: "winning-move-01",
      expectedVersion: game.version,
      action: { type: "place", cardId: "QC-9", cell: 60 },
    });
    expect(res.ok).toBe(true);
    await until(() => !!host.gameOver && !!guest.gameOver);
    expect(host.gameOver).toMatchObject({
      winner: team,
      reason: "sequences",
      totalMoves: 1,
    });
    expect(host.gameOver!.sequences).toHaveLength(2);

    const firstGameId = host.state!.gameId;
    await host.emit("game:rematch", { vote: true });
    expect(room.status).toBe("finished");
    await guest.emit("game:rematch", { vote: true });
    await until(
      () =>
        host.state!.gameId !== firstGameId &&
        guest.state!.gameId !== firstGameId,
    );
    expect(host.state).toMatchObject({
      status: "playing",
      version: 0,
      currentSeat: (seat + 1) % 2,
    });
    expect(host.hand).toHaveLength(7);
  });

  it("forfeits when a player leaves mid-game", async () => {
    await setup();
    const { host, guest } = await startOneVsOne();
    const over = waitFor<{ winner: string; reason: string }>(
      host.socket,
      "game:over",
    );
    await guest.emit("room:leave");
    expect(await over).toMatchObject({ winner: "red", reason: "forfeit" });
  });
});

describe("reliability", () => {
  it("restores state and private hand on reconnect", async () => {
    await setup();
    const { host, guest, code } = await startOneVsOne();
    const handBefore = guest.hand.map((c) => c.id);

    const disconnected = waitFor<{ userId: string }>(
      host.socket,
      "player:disconnected",
    );
    guest.socket.disconnect();
    expect((await disconnected).userId).toBe(guest.user.id);
    expect(
      ctx!.server.rooms
        .getRoom(code)!
        .players.find((p) => p.userId === guest.user.id)!.connected,
    ).toBe(false);

    const reconnected = waitFor<{ userId: string }>(
      host.socket,
      "player:reconnected",
    );
    await guest.reconnect(ctx!.url);
    expect((await reconnected).userId).toBe(guest.user.id);

    const snap = await guest.emit<RoomSnapshot>("room:join", { code });
    expect(snap.ok).toBe(true);
    if (!snap.ok) return;
    expect(snap.data.hand.map((c) => c.id)).toEqual(handBefore);
    expect(snap.data.game!.status).toBe("playing");
    expect(snap.data.room.players).toHaveLength(2);
  });

  it("forfeits a player who does not reconnect in time", async () => {
    await setup({ reconnectMs: 300 });
    const { host, guest } = await startOneVsOne();
    const over = waitFor<{ winner: string; reason: string }>(
      host.socket,
      "game:over",
    );
    guest.socket.disconnect();
    expect(await over).toMatchObject({ winner: "red", reason: "disconnect" });
  });

  it("replaces duplicate sessions without creating extra seats", async () => {
    await setup();
    const { host, guest, code } = await startOneVsOne();
    const replaced = waitFor(guest.socket, "session:replaced");
    const second = await connectSocket(ctx!.url, guest.token);
    await replaced;
    const snap = await new Promise<RoomSnapshot>((resolve) =>
      second.emit("room:join", { code }, (r) => r.ok && resolve(r.data)),
    );
    expect(snap.room.players).toHaveLength(2);
    expect(snap.room.players.every((p) => p.connected)).toBe(true);
    second.disconnect();
    expect(host.socket.connected).toBe(true);
  });

  it("rate limits chat spam", async () => {
    await setup();
    const { host } = await startOneVsOne();
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        host.emit("chat:send", { text: `hi ${i}` }),
      ),
    );
    expect(results.filter((r) => r.ok).length).toBeLessThanOrEqual(5);
    expect(results.some((r) => !r.ok && r.code === "RATE_LIMITED")).toBe(true);
  });
});
