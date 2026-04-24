"use client";

// Scheduled workflow execution is now handled server-side by the Vercel cron
// job at /api/cron/run-schedules (runs every minute). This hook is kept as a
// no-op so existing call sites in the dashboard don't need to change.
export function useScheduler() {}
