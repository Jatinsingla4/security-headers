/**
 * Security Headers Middleware for Cloudflare Workers.
 *
 * Applies strict security headers to all responses:
 * - Content-Security-Policy (CSP)
 * - Strict-Transport-Security (HSTS)
 * - X-Content-Type-Options
 * - X-Frame-Options
 * - Referrer-Policy
 * - Permissions-Policy
 */

export interface SecurityHeadersConfig {
  /** Trusted domains for CSP (e.g., CDN, analytics) */
  trustedDomains: string[];
  /** Whether to enable report-only mode for CSP */
  cspReportOnly: boolean;
  /** CSP report URI endpoint */
  cspReportUri?: string;
  /** Environment — relaxes some headers in development */
  environment: "production" | "development";
}

const DEFAULT_CONFIG: SecurityHeadersConfig = {
  trustedDomains: [],
  cspReportOnly: false,
  environment: "production",
};

/** Build a strict CSP header value */
function buildCsp(config: SecurityHeadersConfig): string {
  const selfAndTrusted = ["'self'", ...config.trustedDomains].join(" ");

  const directives: string[] = [
    `default-src 'self'`,
    // Allow Next.js inline scripts via nonce in production; unsafe-inline only in dev
    `script-src 'self' ${config.environment === "development" ? "'unsafe-inline' 'unsafe-eval'" : "'strict-dynamic'"} ${config.trustedDomains.join(" ")}`.trim(),
    `style-src 'self' 'unsafe-inline' ${config.trustedDomains.join(" ")}`.trim(),
    `img-src ${selfAndTrusted} data: blob:`,
    `font-src 'self' ${config.trustedDomains.join(" ")}`.trim(),
    `connect-src ${selfAndTrusted} wss://*.securityheaders.com`,
    `media-src 'self'`,
    `object-src 'none'`,
    `frame-src 'none'`,
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `upgrade-insecure-requests`,
  ];

  if (config.cspReportUri) {
    directives.push(`report-uri ${config.cspReportUri}`);
  }

  return directives.join("; ");
}

/** Build Permissions-Policy header */
function buildPermissionsPolicy(): string {
  return [
    "accelerometer=()",
    "camera=()",
    "geolocation=()",
    "gyroscope=()",
    "magnetometer=()",
    "microphone=()",
    "payment=()",
    "usb=()",
    "interest-cohort=()",
  ].join(", ");
}

/**
 * Apply security headers to a Response.
 * This function clones the response and adds/overrides security headers.
 */
export function applySecurityHeaders(
  response: Response,
  config: Partial<SecurityHeadersConfig> = {}
): Response {
  const merged = { ...DEFAULT_CONFIG, ...config };
  const headers = new Headers(response.headers);

  // Content-Security-Policy
  const cspHeaderName = merged.cspReportOnly
    ? "Content-Security-Policy-Report-Only"
    : "Content-Security-Policy";
  headers.set(cspHeaderName, buildCsp(merged));

  // HSTS — 2 years, include subdomains, preload
  headers.set(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload"
  );

  // Prevent MIME type sniffing
  headers.set("X-Content-Type-Options", "nosniff");

  // Prevent framing (clickjacking)
  headers.set("X-Frame-Options", "DENY");

  // Referrer policy — send origin only on cross-origin, full on same-origin
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  // Permissions policy — disable sensitive browser features
  headers.set("Permissions-Policy", buildPermissionsPolicy());

  // Remove server identification headers
  headers.delete("Server");
  headers.delete("X-Powered-By");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/**
 * Middleware wrapper: intercepts the response and applies security headers.
 * Use as the outermost middleware in the Worker.
 */
export function securityHeadersMiddleware(
  config: Partial<SecurityHeadersConfig> = {}
) {
  return async (
    request: Request,
    next: () => Promise<Response>
  ): Promise<Response> => {
    const response = await next();
    return applySecurityHeaders(response, config);
  };
}
