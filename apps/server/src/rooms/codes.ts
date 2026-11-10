import { randomInt } from "node:crypto";

// Excludes look-alike characters (0/O, 1/I).
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const ROOM_CODE_LENGTH = 6;

export function generateRoomCode(isTaken: (code: string) => boolean): string {
  for (let attempt = 0; attempt < 100; attempt++) {
    let code = "";
    for (let i = 0; i < ROOM_CODE_LENGTH; i++)
      code += ALPHABET[randomInt(ALPHABET.length)];
    if (!isTaken(code)) return code;
  }
  throw new Error("Unable to allocate a unique room code");
}
