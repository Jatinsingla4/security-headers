/**
 * Structured Logging & Monitoring for Cloudflare Workers.
 *
 * Logs security events (broken links, unauthorized access, rate limits)
 * in a structured JSON format compatible with Cloudflare's logging pipeline.
 *
 * In production, logs go to:
 * - console (picked up by Cloudflare Logpush / Workers Trace Events)
 * - D1 for persistent queryable storage
 */

import type { Env, SecurityLogEntry } from "../../types" ;

export type LogLevel = "info" | "warn" | "error";

interface LogPayload {
  level: LogLevel;
  event: SecurityLogEntry["type"] | "request" | "response";
  path: string;
  method: string;
  statusCode?: number;
  ip: string;
  userAgent: string;
  durationMs?: number;
  details?: string;
  requestId: string;
  timestamp: string;
}

/**
 * Create a logger scoped to a single request.
 */
export function createRequestLogger(request: Request) {
  const requestId =
    request.headers.get("X-Request-ID") ??
    request.headers.get("CF-Ray") ??
    crypto.randomUUID();

  const url = new URL(request.url);
  const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
  const userAgent = request.headers.get("User-Agent") ?? "unknown";

  function log(level: LogLevel, event: LogPayload["event"], details?: string): void {
    const payload: LogPayload = {
      level,
      event,
      path: url.pathname,
      method: request.method,
      ip,
      userAgent,
      details,
      requestId,
      timestamp: new Date().toISOString(),
    };

    // Structured log to stdout — Cloudflare picks this up
    switch (level) {
      case "error":
        console.error(JSON.stringify(payload));
        break;
      case "warn":
        console.warn(JSON.stringify(payload));
        break;
      default:
        console.log(JSON.stringify(payload));
    }
  }

  return {
    requestId,

    info(event: LogPayload["event"], details?: string) {
      log("info", event, details);
    },

    warn(event: LogPayload["event"], details?: string) {
      log("warn", event, details);
    },

    error(event: LogPayload["event"], details?: string) {
      log("error", event, details);
    },

    /** Log a broken link detection */
    brokenLink(path: string) {
      log("warn", "broken_link", `404 for path: ${path}`);
    },

    /** Log an unauthorized access attempt */
    unauthorized(reason: string) {
      log("warn", "unauthorized", reason);
    },

    /** Log a rate-limited request */
    rateLimited() {
      log("warn", "rate_limited", `IP: ${ip}`);
    },

    /** Log an API error (sanitized) */
    apiError(error: string) {
      log("error", "api_error", error);
    },

    /** Log WebSocket rejection */
    wsRejected(reason: string) {
      log("warn", "ws_rejected", reason);
    },
  };
}

/**
 * Persist a security log entry to D1 for long-term storage.
 * Fire-and-forget — uses waitUntil to avoid blocking the response.
 */
export async function persistLogEntry(
  db: D1Database,
  entry: SecurityLogEntry
): Promise<void> {
  try {
    await db
      .prepare(
        `INSERT INTO security_logs (timestamp, type, path, method, ip, user_agent, details)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        entry.timestamp,
        entry.type,
        entry.path,
        entry.method,
        entry.ip,
        entry.userAgent,
        entry.details ?? null
      )
      .run();
  } catch {
    // Logging should never break the request flow
    console.error("Failed to persist log entry");
  }
}

/** SQL schema for the security_logs table */
export const SECURITY_LOGS_SCHEMA = `
CREATE TABLE IF NOT EXISTS security_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL,
  type TEXT NOT NULL,
  path TEXT NOT NULL,
  method TEXT NOT NULL,
  ip TEXT NOT NULL,
  user_agent TEXT,
  details TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_security_logs_type ON security_logs(type);
CREATE INDEX IF NOT EXISTS idx_security_logs_timestamp ON security_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_security_logs_path ON security_logs(path);
`;
