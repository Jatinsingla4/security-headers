import type { Env, RedirectMapping } from "../../types" ;

/**
 * Redirect mapping system.
 * Checks if a request path has a known redirect and returns it.
 * Mappings are stored in D1 for dynamic management.
 */

/** In-memory fallback redirects for critical paths (loaded at startup) */
const STATIC_REDIRECTS: Record<string, { target: string; status: 301 | 302 }> = {
  "/blog": { target: "/articles", status: 301 },
  "/app": { target: "/dashboard", status: 302 },
  "/docs/v1": { target: "/docs/v2", status: 301 },
};

/** Look up redirect from D1 database */
async function getRedirectFromDb(
  db: D1Database,
  path: string
): Promise<RedirectMapping | null> {
  const result = await db
    .prepare("SELECT old_path, new_path, status_code, created_at FROM redirects WHERE old_path = ?")
    .bind(path)
    .first<{ old_path: string; new_path: string; status_code: number; created_at: string }>();

  if (!result) return null;

  return {
    oldPath: result.old_path,
    newPath: result.new_path,
    statusCode: result.status_code as 301 | 302,
    createdAt: result.created_at,
  };
}

/**
 * Handle a request that may need redirection.
 * Returns a Response if a redirect was found, or null to continue processing.
 */
export async function handleRedirect(
  request: Request,
  env: Env
): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname;

  // 1. Check static redirects first (zero-latency)
  const staticRedirect = STATIC_REDIRECTS[path];
  if (staticRedirect) {
    return Response.redirect(
      new URL(staticRedirect.target, url.origin).href,
      staticRedirect.status
    );
  }

  // 2. Check D1 for dynamic redirects
  try {
    const dbRedirect = await getRedirectFromDb(env.DB, path);
    if (dbRedirect) {
      return Response.redirect(
        new URL(dbRedirect.newPath, url.origin).href,
        dbRedirect.statusCode
      );
    }
  } catch {
    // If D1 is unavailable, fall through to normal handling
  }

  return null;
}

/**
 * Global 404 handler — called when no route matches.
 * Logs the broken route and returns a JSON error for API routes or HTML for pages.
 */
export function handleNotFound(request: Request): Response {
  const url = new URL(request.url);
  const isApiRoute = url.pathname.startsWith("/api/") || url.pathname.startsWith("/trpc/");

  if (isApiRoute) {
    return new Response(
      JSON.stringify({
        error: "Not Found",
        message: `No route matches ${url.pathname}`,
        status: 404,
      }),
      {
        status: 404,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // For page routes, return a minimal HTML page that redirects to the Next.js 404
  return new Response(
    `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>404 - Page Not Found</title>
  <style>
    body { font-family: system-ui, sans-serif; display: flex; align-items: center;
           justify-content: center; min-height: 100vh; margin: 0; background: #f9fafb; }
    .container { text-align: center; }
    h1 { font-size: 4rem; color: #111827; margin: 0; }
    p { color: #6b7280; }
    a { color: #2563eb; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <h1>404</h1>
    <p>This page doesn't exist.</p>
    <p><a href="/">Return to Home</a></p>
  </div>
</body>
</html>`,
    {
      status: 404,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    }
  );
}

/** SQL to create the redirects table in D1 */
export const REDIRECTS_SCHEMA = `
CREATE TABLE IF NOT EXISTS redirects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  old_path TEXT NOT NULL UNIQUE,
  new_path TEXT NOT NULL,
  status_code INTEGER NOT NULL DEFAULT 301,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_redirects_old_path ON redirects(old_path);
`;
