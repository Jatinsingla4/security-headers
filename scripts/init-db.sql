-- Security Headers D1 Database Schema Initialization
-- Run with: wrangler d1 execute security-headers-db --file=scripts/init-db.sql

-- ─── Redirects Table ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS redirects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  old_path TEXT NOT NULL UNIQUE,
  new_path TEXT NOT NULL,
  status_code INTEGER NOT NULL DEFAULT 301,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_redirects_old_path ON redirects(old_path);

-- ─── Security Logs Table ────────────────────────────────────────
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

-- ─── Seed some default redirects ────────────────────────────────
INSERT OR IGNORE INTO redirects (old_path, new_path, status_code)
VALUES
  ('/blog', '/articles', 301),
  ('/app', '/dashboard', 302),
  ('/docs/v1', '/docs/v2', 301);
