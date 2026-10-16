import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { log } from "../utils/logger";

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  log.error(err);
  if (err instanceof ZodError) {
    return res.status(400).json({ message: "Validation failed", issues: err.issues });
  }
  return res.status(500).json({ message: "Internal server error" });
}
