import { afterEach, describe, expect, it } from "vitest";
import type { FriendsList, FriendStatus, FriendUser } from "@sequence/shared";
import { NoopPersistence } from "../src/services/persistence";
import { guestLogin, startServer, type TestServer } from "./helpers";

/** Route-level stand-in for the friends tables; mirrors PrismaPersistence's rules. */
class InMemoryFriends extends NoopPersistence {
  private readonly users = new Map<string, string>();
  private readonly rows: {
    from: string;
    to: string;
    status: "pending" | "accepted";
  }[] = [];

  override async upsertUser(u: { id: string; nickname: string }) {
    this.users.set(u.id, u.nickname);
  }
  private find(a: string, b: string) {
    return this.rows.find(
      (r) => (r.from === a && r.to === b) || (r.from === b && r.to === a),
    );
  }
  private statusFor(row: ReturnType<InMemoryFriends["find"]>, viewer: string) {
    if (!row) return "none" as const;
    if (row.status === "accepted") return "friends" as const;
    return row.from === viewer ? ("request_sent" as const) : ("request_received" as const);
  }
  override async getFriendStatus(viewer: string, other: string) {
    return this.statusFor(this.find(viewer, other), viewer);
  }
  override async sendFriendRequest(from: string, to: string) {
    if (!this.users.has(to)) return null;
    const row = this.find(from, to);
    if (!row) {
      this.rows.push({ from, to, status: "pending" });
      return "request_sent" as const;
    }
    if (row.status === "pending" && row.to === from) row.status = "accepted";
    return this.statusFor(row, from);
  }
  override async respondFriendRequest(user: string, from: string, accept: boolean) {
    const row = this.rows.find(
      (r) => r.from === from && r.to === user && r.status === "pending",
    );
    if (!row) return null;
    if (accept) {
      row.status = "accepted";
      return "friends" as const;
    }
    this.rows.splice(this.rows.indexOf(row), 1);
    return "none" as const;
  }
  override async removeFriendship(a: string, b: string) {
    const row = this.find(a, b);
    if (row) this.rows.splice(this.rows.indexOf(row), 1);
  }
  override async listFriends(userId: string): Promise<FriendsList> {
    const list: FriendsList = { friends: [], incoming: [], outgoing: [] };
    for (const r of this.rows) {
      if (r.from !== userId && r.to !== userId) continue;
      const other = r.from === userId ? r.to : r.from;
      const entry = { userId: other, nickname: this.users.get(other)! };
      if (r.status === "accepted") list.friends.push(entry);
      else (r.from === userId ? list.outgoing : list.incoming).push(entry);
    }
    return list;
  }
}

let ctx: TestServer | null = null;
afterEach(async () => {
  if (ctx) await ctx.server.close();
  ctx = null;
});

describe("friends", () => {
  it("supports request, accept, listing, cancel and remove", async () => {
    ctx = await startServer({}, new InMemoryFriends());
    const { url } = ctx;
    const alice = await guestLogin(url, "Alice");
    const bob = await guestLogin(url, "Bob");

    const call = async (
      who: { token: string },
      method: string,
      path: string,
      body?: unknown,
    ) => {
      const res = await fetch(`${url}/api/friends${path}`, {
        method,
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${who.token}`,
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      return {
        status: res.status,
        body: (await res.json()) as {
          status: FriendStatus;
          friends: FriendUser[];
          incoming: FriendUser[];
        },
      };
    };
    const statusOf = async (who: { token: string }, other: { user: { id: string } }) =>
      (await call(who, "GET", `/${other.user.id}/status`)).body.status;

    expect((await call(alice, "POST", `/${alice.user.id}/request`)).status).toBe(400);
    expect((await call(alice, "POST", "/nope/request")).status).toBe(404);
    expect(
      (await call(alice, "POST", "/00000000-0000-4000-8000-000000000000/request")).status,
    ).toBe(404);

    expect((await call(alice, "POST", `/${bob.user.id}/request`)).body.status).toBe("request_sent");
    expect(await statusOf(alice, bob)).toBe("request_sent");
    expect(await statusOf(bob, alice)).toBe("request_received");
    expect((await call(bob, "GET", "")).body.incoming).toEqual([
      { userId: alice.user.id, nickname: "Alice" },
    ]);

    // Only the addressee can accept.
    expect((await call(alice, "POST", `/${bob.user.id}/respond`, { accept: true })).status).toBe(404);
    expect((await call(bob, "POST", `/${alice.user.id}/respond`, { accept: true })).body.status).toBe("friends");
    expect((await call(alice, "GET", "")).body.friends).toEqual([
      { userId: bob.user.id, nickname: "Bob" },
    ]);

    expect((await call(alice, "DELETE", `/${bob.user.id}`)).body.status).toBe("none");
    expect(await statusOf(bob, alice)).toBe("none");
  });

  it("reports 503 when friends are not backed by a database", async () => {
    ctx = await startServer();
    const alice = await guestLogin(ctx.url, "Alice");
    const res = await fetch(`${ctx.url}/api/friends`, {
      headers: { authorization: `Bearer ${alice.token}` },
    });
    expect(res.status).toBe(503);
  });
});
