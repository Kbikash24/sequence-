import type { GuestUser, UserStatsDTO } from "@sequence/shared";
import { SERVER_URL } from "@/lib/utils";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

async function request<T>(
  path: string,
  init: RequestInit & { token?: string } = {},
): Promise<T> {
  const { token, headers, ...rest } = init;
  let res: Response;
  try {
    res = await fetch(`${SERVER_URL}/api${path}`, {
      ...rest,
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
    });
  } catch {
    throw new ApiError("Cannot reach the game server", 0);
  }
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok)
    throw new ApiError(
      body.error ?? `Request failed (${res.status})`,
      res.status,
    );
  return body as T;
}

export const api = {
  guestLogin: (nickname: string) =>
    request<{ token: string; user: GuestUser }>("/auth/guest", {
      method: "POST",
      body: JSON.stringify({ nickname }),
    }),
  me: (token: string) => request<{ user: GuestUser }>("/auth/me", { token }),
  stats: (token: string) =>
    request<{ stats: UserStatsDTO }>("/stats/me", { token }),
};
