/**
 * Security Headers — Main Cloudflare Worker Entry Point
 *
 * Composes all middleware and handlers:
 * 1. Request logging
 * 2. Security headers
 * 3. CORS (preflight + response headers)
 * 4. Rate limiting
 * 5. Authentication
 * 6. Routing (API, WebSocket, static, redirects, 404)
 */

import type { Env } from "../types";
import { applySecurityHeaders } from "./middleware/security-headers";
import { handlePreflight, applyCorsHeaders } from "./middleware/cors";
import { checkRateLimit, RateLimiterDO } from "./middleware/rate-limiter";
import { authenticate, unauthorizedResponse } from "./security/auth";
import { handleRedirect, handleNotFound } from "./handlers/redirect-handler";
import { secureUpload, verifySignedUrl } from "./security/storage";
import { sanitizeError } from "./security/validation";
import { createRequestLogger, persistLogEntry } from "./utils/logger";
import { WebSocketRoom } from "./durable-objects/websocket-room";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "./handlers/trpc-router";

// Re-export Durable Object classes so Wrangler can find them
export { RateLimiterDO, WebSocketRoom };

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const logger = createRequestLogger(request);
    const startTime = Date.now();

    try {
      // ── 1. CORS Preflight ──────────────────────────────────
      const preflightResponse = handlePreflight(request, {
        allowedOrigins: env.ALLOWED_ORIGINS,
      });
      if (preflightResponse) {
        return applySecurityHeaders(preflightResponse, {
          environment: env.ENVIRONMENT as "production" | "development",
        });
      }

      // ── 2. Rate Limiting ───────────────────────────────────
      const rateLimitResponse = await checkRateLimit(request, env);
      if (rateLimitResponse) {
        logger.rateLimited();
        return rateLimitResponse;
      }

      // ── 3. Redirect Check ─────────────────────────────────
      const redirectResponse = await handleRedirect(request, env);
      if (redirectResponse) {
        return redirectResponse;
      }

      // ── 4. Route Handling ──────────────────────────────────
      const url = new URL(request.url);
      let response: Response;

      // WebSocket upgrade route
      if (url.pathname.startsWith("/ws/")) {
        const roomName = url.pathname.split("/")[2] ?? "default";
        const roomId = env.WEBSOCKET_ROOM.idFromName(roomName);
        const room = env.WEBSOCKET_ROOM.get(roomId);
        return room.fetch(request);
      }

      // tRPC Handler
      if (url.pathname.startsWith("/api/trpc/")) {
        return fetchRequestHandler({
          endpoint: "/api/trpc",
          req: request,
          router: appRouter,
          createContext: async () => {
            const auth = await authenticate(request, env.JWT_SECRET);
            return {
              env,
              user: auth.authenticated ? auth.user : null,
              requestId: logger.requestId,
            };
          },
          onError({ error }) {
            logger.apiError(error.message);
          },
        });
      }

      // Legacy/Standard API routes — require authentication
      if (url.pathname.startsWith("/api/")) {
        const auth = await authenticate(request, env.JWT_SECRET);
        if (!auth.authenticated) {
          logger.unauthorized(auth.error ?? "Unknown auth failure");
          return unauthorizedResponse(auth.error);
        }

        // File upload endpoint
        if (url.pathname === "/api/upload" && request.method === "POST") {
          response = await handleUpload(request, env);
        }
        // Signed file download
        else if (url.pathname.startsWith("/files/")) {
          response = await handleSignedDownload(request, env);
        }
        // Health check (public, but included here for routing)
        else if (url.pathname === "/api/health") {
          response = new Response(
            JSON.stringify({ status: "ok", timestamp: new Date().toISOString() }),
            { headers: { "Content-Type": "application/json" } }
          );
        }
        else {
          response = handleNotFound(request);
          logger.brokenLink(url.pathname);
        }
      }
      // All other routes — 404
      else {
        response = handleNotFound(request);
        if (url.pathname !== "/favicon.ico") {
          logger.brokenLink(url.pathname);
          ctx.waitUntil(
            persistLogEntry(env.DB, {
              timestamp: new Date().toISOString(),
              type: "broken_link",
              path: url.pathname,
              method: request.method,
              ip: request.headers.get("CF-Connecting-IP") ?? "unknown",
              userAgent: request.headers.get("User-Agent") ?? "unknown",
            })
          );
        }
      }

      // ── 5. Apply Security Headers + CORS ───────────────────
      const origin = request.headers.get("Origin") ?? "";
      response = applyCorsHeaders(response, origin, {
        allowedOrigins: env.ALLOWED_ORIGINS,
      });
      response = applySecurityHeaders(response, {
        environment: env.ENVIRONMENT as "production" | "development",
        trustedDomains: ["https://cdn.securityheaders.com"],
      });

      // Add request ID header
      response = new Response(response.body, response);
      response.headers.set("X-Request-ID", logger.requestId);

      logger.info("response", `${response.status} in ${Date.now() - startTime}ms`);
      return response;
    } catch (error) {
      logger.apiError(error instanceof Error ? error.message : "Unknown error");

      const sanitized = sanitizeError(error, env.ENVIRONMENT === "production");
      return applySecurityHeaders(
        new Response(JSON.stringify(sanitized), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }),
        { environment: env.ENVIRONMENT as "production" | "development" }
      );
    }
  },
};

// ─── Route Handlers ───────────────────────────────────────────

async function handleUpload(request: Request, env: Env): Promise<Response> {
  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return new Response(
      JSON.stringify({ error: "No file provided" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const result = await secureUpload(env.R2, file.stream(), {
    filename: file.name,
    contentType: file.type,
    sizeBytes: file.size,
  });

  if (!result.success) {
    return new Response(
      JSON.stringify({ error: result.error }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({ key: result.key }),
    { status: 201, headers: { "Content-Type": "application/json" } }
  );
}

async function handleSignedDownload(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const key = url.pathname.replace("/files/", "");
  const expires = url.searchParams.get("expires") ?? "";
  const sig = url.searchParams.get("sig") ?? "";

  const valid = await verifySignedUrl(key, expires, sig, env.R2_SIGNING_SECRET);
  if (!valid) {
    return new Response(
      JSON.stringify({ error: "Invalid or expired download link" }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }

  const object = await env.R2.get(key);
  if (!object) {
    return new Response(
      JSON.stringify({ error: "File not found" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  return new Response(object.body, {
    headers: {
      "Content-Type": object.httpMetadata?.contentType ?? "application/octet-stream",
      "Content-Disposition": `attachment; filename="${key.split("/").pop()}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
