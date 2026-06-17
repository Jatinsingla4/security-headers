/**
 * Cloudflare Worker environment bindings.
 * Typed interface for all bindings declared in wrangler.toml.
 */
export interface Env {
  // D1 Database
  DB: D1Database;
  // R2 Object Storage
  R2: R2Bucket;
  // Vectorize Index
  VECTORIZE: VectorizeIndex;
  // Durable Objects
  WEBSOCKET_ROOM: DurableObjectNamespace;
  RATE_LIMITER: DurableObjectNamespace;
  // Environment variables
  ENVIRONMENT: string;
  ALLOWED_ORIGINS: string;
  RATE_LIMIT_MAX: string;
  RATE_LIMIT_WINDOW_MS: string;
  // Secrets (set via `wrangler secret put`)
  JWT_SECRET: string;
  R2_SIGNING_SECRET: string;
}
