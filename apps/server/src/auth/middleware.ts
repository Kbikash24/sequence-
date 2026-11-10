import type { NextFunction, Request, Response } from "express";
import type { GuestUser } from "@sequence/shared";
import type { TokenService } from "./tokens";

export function requireAuth(tokens: TokenService) {
  return (req: Request, res: Response, next: NextFunction) => {
    const header = req.headers.authorization ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    const user = token ? tokens.verify(token) : null;
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    res.locals.user = user;
    next();
  };
}

export function currentUser(res: Response): GuestUser {
  return res.locals.user as GuestUser;
}
