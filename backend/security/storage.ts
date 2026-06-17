/**
 * Storage & Data Security for R2, D1, and Vectorize.
 *
 * R2:  Secure file uploads with type/size validation, signed URLs
 * D1:  Prepared statements only (prevents SQL injection)
 * Vectorize: Scrub PII before embedding
 */

import type { Env, UploadConstraints } from "../../types" ;
import { uploadSchema } from "./validation";

// ─── R2 Secure Upload ───────────────────────────────────────────

const DEFAULT_UPLOAD_CONSTRAINTS: UploadConstraints = {
  maxSizeBytes: 50 * 1024 * 1024, // 50 MB
  allowedMimeTypes: [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "application/pdf",
    "text/plain",
    "text/csv",
  ],
};

export interface UploadResult {
  success: boolean;
  key?: string;
  error?: string;
}

/**
 * Securely upload a file to R2 with validation.
 * - Validates MIME type against allowlist
 * - Validates file size against max
 * - Generates a safe, unique key
 */
export async function secureUpload(
  r2: R2Bucket,
  file: ReadableStream | ArrayBuffer,
  metadata: { filename: string; contentType: string; sizeBytes: number },
  constraints: UploadConstraints = DEFAULT_UPLOAD_CONSTRAINTS
): Promise<UploadResult> {
  // Validate with Zod schema
  const parsed = uploadSchema.safeParse(metadata);
  if (!parsed.success) {
    return { success: false, error: parsed.error.message };
  }

  // Double-check constraints
  if (!constraints.allowedMimeTypes.includes(metadata.contentType)) {
    return { success: false, error: `Content type ${metadata.contentType} is not allowed` };
  }

  if (metadata.sizeBytes > constraints.maxSizeBytes) {
    return {
      success: false,
      error: `File size ${metadata.sizeBytes} exceeds limit of ${constraints.maxSizeBytes} bytes`,
    };
  }

  // Generate safe key: uploads/<date>/<uuid>-<sanitized-filename>
  const date = new Date().toISOString().slice(0, 10);
  const uuid = crypto.randomUUID();
  const safeFilename = metadata.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const key = `uploads/${date}/${uuid}-${safeFilename}`;

  try {
    await r2.put(key, file, {
      httpMetadata: {
        contentType: metadata.contentType,
      },
      customMetadata: {
        originalFilename: metadata.filename,
        uploadedAt: new Date().toISOString(),
      },
    });

    return { success: true, key };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Upload failed",
    };
  }
}

/**
 * Generate a time-limited signed URL for R2 object access.
 * Uses HMAC-SHA256 to create a signature the Worker can verify.
 */
export async function generateSignedUrl(
  key: string,
  expiresInSeconds: number,
  secret: string,
  baseUrl: string
): Promise<string> {
  const expires = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const message = `${key}:${expires}`;

  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    encoder.encode(message)
  );

  const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));

  const url = new URL(`/files/${key}`, baseUrl);
  url.searchParams.set("expires", String(expires));
  url.searchParams.set("sig", signature);

  return url.href;
}

/**
 * Verify a signed URL's signature and expiry.
 */
export async function verifySignedUrl(
  key: string,
  expires: string,
  signature: string,
  secret: string
): Promise<boolean> {
  // Check expiry
  const expiresNum = parseInt(expires, 10);
  if (isNaN(expiresNum) || expiresNum < Math.floor(Date.now() / 1000)) {
    return false;
  }

  const message = `${key}:${expires}`;
  const encoder = new TextEncoder();

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const expectedBuffer = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    encoder.encode(message)
  );

  const expected = btoa(String.fromCharCode(...new Uint8Array(expectedBuffer)));

  // Constant-time comparison
  if (expected.length !== signature.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return mismatch === 0;
}

// ─── D1 Safe Queries ────────────────────────────────────────────

/**
 * Execute a parameterized query against D1.
 * ALWAYS uses prepared statements — never interpolate user input into SQL.
 */
export async function safeQuery<T>(
  db: D1Database,
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const stmt = db.prepare(sql);
  const bound = params.length > 0 ? stmt.bind(...params) : stmt;
  const result = await bound.all<T>();
  return result.results;
}

export async function safeQueryFirst<T>(
  db: D1Database,
  sql: string,
  params: unknown[] = []
): Promise<T | null> {
  const stmt = db.prepare(sql);
  const bound = params.length > 0 ? stmt.bind(...params) : stmt;
  return bound.first<T>();
}

export async function safeRun(
  db: D1Database,
  sql: string,
  params: unknown[] = []
): Promise<D1Result> {
  const stmt = db.prepare(sql);
  const bound = params.length > 0 ? stmt.bind(...params) : stmt;
  return bound.run();
}

// ─── Vectorize Safety ───────────────────────────────────────────

/** PII patterns to scrub before embedding */
const PII_PATTERNS = [
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // Email
  /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,                           // Phone numbers
  /\b\d{3}-\d{2}-\d{4}\b/g,                                     // SSN
  /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,             // Credit card
];

/**
 * Scrub PII from text before creating vector embeddings.
 * Replaces sensitive patterns with redaction markers.
 */
export function scrubPiiForEmbedding(text: string): string {
  let scrubbed = text;
  for (const pattern of PII_PATTERNS) {
    scrubbed = scrubbed.replace(pattern, "[REDACTED]");
  }
  return scrubbed;
}
