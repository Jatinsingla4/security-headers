/**
 * Authentication middleware using JWT (via `jose` library).
 *
 * Validates Bearer tokens on protected routes.
 * Designed for stateless auth with Cloudflare Workers.
 */

import { jwtVerify, SignJWT, type JWTPayload } from "jose";

export interface AuthUser {
  sub: string;
  email: string;
  role: "user" | "admin";
}

export interface AuthResult {
  authenticated: boolean;
  user: AuthUser | null;
  error?: string;
}

/** Paths that don't require authentication */
const PUBLIC_PATHS = new Set([
  "/api/health",
  "/api/auth/login",
  "/api/auth/register",
  "/trpc/auth.login",
  "/trpc/auth.register",
]);

/** Check if a path requires authentication */
export function isPublicPath(path: string): boolean {
  return PUBLIC_PATHS.has(path) || !path.startsWith("/api/") && !path.startsWith("/trpc/");
}

/** Verify a JWT and extract the user payload */
export async function verifyToken(
  token: string,
  secret: string
): Promise<AuthResult> {
  try {
    const secretKey = new TextEncoder().encode(secret);
    const { payload } = await jwtVerify(token, secretKey, {
      algorithms: ["HS256"],
      issuer: "security-headers",
      audience: "security-headers-api",
    });

    const user = extractUser(payload);
    if (!user) {
      return { authenticated: false, user: null, error: "Invalid token payload" };
    }

    return { authenticated: true, user };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Token verification failed";
    return { authenticated: false, user: null, error: message };
  }
}

function extractUser(payload: JWTPayload): AuthUser | null {
  if (
    typeof payload.sub !== "string" ||
    typeof payload.email !== "string" ||
    (payload.role !== "user" && payload.role !== "admin")
  ) {
    return null;
  }

  return {
    sub: payload.sub,
    email: payload.email as string,
    role: payload.role as "user" | "admin",
  };
}

/** Create a signed JWT for a user */
export async function createToken(
  user: AuthUser,
  secret: string,
  expiresInSeconds = 3600
): Promise<string> {
  const secretKey = new TextEncoder().encode(secret);

  return new SignJWT({
    sub: user.sub,
    email: user.email,
    role: user.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("security-headers")
    .setAudience("security-headers-api")
    .setIssuedAt()
    .setExpirationTime(`${expiresInSeconds}s`)
    .sign(secretKey);
}

/**
 * Authentication middleware.
 * Extracts Bearer token from Authorization header, verifies it,
 * and returns the auth result. Does NOT return a response — caller decides.
 */
export async function authenticate(
  request: Request,
  jwtSecret: string
): Promise<AuthResult> {
  const url = new URL(request.url);

  if (isPublicPath(url.pathname)) {
    return { authenticated: true, user: null };
  }

  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return {
      authenticated: false,
      user: null,
      error: "Missing or malformed Authorization header",
    };
  }

  const token = authHeader.slice(7);
  return verifyToken(token, jwtSecret);
}

/** Build a 401 JSON response with no sensitive details */
export function unauthorizedResponse(message = "Unauthorized"): Response {
  return new Response(
    JSON.stringify({ error: "Unauthorized", message }),
    {
      status: 401,
      headers: { "Content-Type": "application/json" },
    }
  );
}
