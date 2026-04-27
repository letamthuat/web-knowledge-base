import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Prune tài liệu trong thùng rác đã quá 30 ngày
crons.weekly(
  "prune-trashed-documents",
  { hourUTC: 20, minuteUTC: 0, dayOfWeek: "sunday" }, // Chủ nhật 03:00 ICT = 20:00 UTC
  internal.documents.cronActions.pruneTrashedDocuments,
);

// Prune upload_sessions hết hạn 24h
crons.daily(
  "prune-expired-upload-sessions",
  { hourUTC: 18, minuteUTC: 0 }, // 01:00 ICT
  internal.documents.cronActions.pruneExpiredUploadSessions,
);

export default crons;
