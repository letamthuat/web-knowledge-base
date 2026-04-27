import { MutationCtx } from "../_generated/server";

export async function logTelemetry(
  ctx: MutationCtx,
  userId: string,
  event: string,
  meta?: { latencyMs?: number; deviceId?: string; [key: string]: unknown },
) {
  await ctx.db.insert("telemetry_events", {
    userId: userId as never,
    event,
    latencyMs: meta?.latencyMs,
    deviceId: meta?.deviceId,
    meta,
    createdAt: Date.now(),
  });
}
