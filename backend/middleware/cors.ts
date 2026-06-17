/**
 * CORS Middleware for Cloudflare Workers.
 * Restricts cross-origin requests to explicitly allowed origins.
 */

export interface CorsConfig {
  /** Comma-separated list of allowed origins */
  allowedOrigins: string;
  /** Allowed HTTP methods */
  allowedMethods: string[];
  /** Allowed request headers */
  allowedHeaders: string[];
  /** Headers exposed to the client */
  exposedHeaders: string[];
  /** Max age for preflight cache (seconds) */
  maxAge: number;
  /** Whether to allow credentials (cookies, auth headers) */
  allowCredentials: boolean;
}

const DEFAULT_CORS: CorsConfig = {
  allowedOrigins: "",
  allowedMethods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Request-ID"],
  exposedHeaders: ["X-Request-ID"],
  maxAge: 86400,
  allowCredentials: true,
};

/** Check if the request's origin is in the allowed list */
function isOriginAllowed(origin: string, allowedOrigins: string): boolean {
  if (!origin) return false;
  const allowed = allowedOrigins.split(",").map((o) => o.trim().toLowerCase());
  return allowed.includes(origin.toLowerCase());
}

/** Apply CORS headers to a response */
export function applyCorsHeaders(
  response: Response,
  origin: string,
  config: Partial<CorsConfig> = {}
): Response {
  const merged = { ...DEFAULT_CORS, ...config };

  if (!isOriginAllowed(origin, merged.allowedOrigins)) {
    return response; // No CORS headers for disallowed origins
  }

  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Access-Control-Allow-Methods", merged.allowedMethods.join(", "));
  headers.set("Access-Control-Allow-Headers", merged.allowedHeaders.join(", "));
  headers.set("Access-Control-Expose-Headers", merged.exposedHeaders.join(", "));
  headers.set("Access-Control-Max-Age", String(merged.maxAge));

  if (merged.allowCredentials) {
    headers.set("Access-Control-Allow-Credentials", "true");
  }

  // Vary by Origin so caches don't serve wrong CORS headers
  headers.append("Vary", "Origin");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/** Handle preflight OPTIONS requests */
export function handlePreflight(
  request: Request,
  config: Partial<CorsConfig> = {}
): Response | null {
  if (request.method !== "OPTIONS") return null;

  const origin = request.headers.get("Origin") ?? "";
  const merged = { ...DEFAULT_CORS, ...config };

  if (!isOriginAllowed(origin, merged.allowedOrigins)) {
    return new Response(null, { status: 403 });
  }

  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": merged.allowedMethods.join(", "),
      "Access-Control-Allow-Headers": merged.allowedHeaders.join(", "),
      "Access-Control-Max-Age": String(merged.maxAge),
      "Access-Control-Allow-Credentials": merged.allowCredentials ? "true" : "false",
      Vary: "Origin",
    },
  });
}
