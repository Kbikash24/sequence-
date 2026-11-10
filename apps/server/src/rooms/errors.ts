import type { ErrorCode } from "@sequence/shared";

export class RoomError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: Record<string, string>,
  ) {
    super(message);
    this.name = "RoomError";
  }
}
