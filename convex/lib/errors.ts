import { ConvexError } from "convex/values";

type ErrorCode = "NOT_FOUND" | "FORBIDDEN" | "VALIDATION" | "CONFLICT" | "RATE_LIMITED" | "INTERNAL";

export function convexError(
  code: ErrorCode,
  message: string,
  messageVi?: string,
) {
  return new ConvexError({ code, message, messageVi });
}
