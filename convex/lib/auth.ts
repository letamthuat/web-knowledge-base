import { MutationCtx, QueryCtx } from "../_generated/server";
import { ConvexError } from "convex/values";

export async function requireAuth(ctx: QueryCtx | MutationCtx): Promise<string> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: "Authentication required",
      messageVi: "Bạn cần đăng nhập để thực hiện thao tác này",
    });
  }
  return identity.subject;
}
