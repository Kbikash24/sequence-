import jwt from "jsonwebtoken";
import type { GuestUser } from "@sequence/shared";

export interface TokenService {
  sign(user: GuestUser): string;
  verify(token: string): GuestUser | null;
}

const ISSUER = "sequence-arena";

export function createTokenService(
  secret: string,
  expiresIn: jwt.SignOptions["expiresIn"] = "7d",
): TokenService {
  return {
    sign(user) {
      return jwt.sign({ nickname: user.nickname }, secret, {
        algorithm: "HS256",
        subject: user.id,
        issuer: ISSUER,
        expiresIn,
      });
    },
    verify(token) {
      try {
        const payload = jwt.verify(token, secret, {
          algorithms: ["HS256"],
          issuer: ISSUER,
        });
        if (
          typeof payload === "string" ||
          typeof payload.sub !== "string" ||
          typeof payload.nickname !== "string"
        ) {
          return null;
        }
        return { id: payload.sub, nickname: payload.nickname };
      } catch {
        return null;
      }
    },
  };
}
