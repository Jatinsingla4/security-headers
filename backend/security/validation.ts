/**
 * Input validation schemas using Zod.
 * Used across tRPC procedures and direct API handlers.
 */

import { z } from "zod";

// ─── Common Validators ─────────────────────────────────────────

export const paginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
});

export const idParamSchema = z.object({
  id: z.string().uuid("Invalid ID format"),
});

// ─── Auth Schemas ───────────────────────────────────────────────

export const loginSchema = z.object({
  email: z
    .string()
    .email("Invalid email format")
    .max(255)
    .transform((v) => v.toLowerCase().trim()),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128),
});

export const registerSchema = loginSchema.extend({
  name: z
    .string()
    .min(1, "Name is required")
    .max(100)
    .transform((v) => v.trim()),
});

// ─── File Upload Schema ─────────────────────────────────────────

export const uploadSchema = z.object({
  filename: z
    .string()
    .min(1)
    .max(255)
    .regex(/^[a-zA-Z0-9._-]+$/, "Filename contains invalid characters"),
  contentType: z.enum([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "application/pdf",
    "text/plain",
    "text/csv",
  ]),
  sizeBytes: z
    .number()
    .int()
    .min(1)
    .max(50 * 1024 * 1024, "File size exceeds 50MB limit"),
});

// ─── Redirect Mapping Schema ────────────────────────────────────

export const redirectSchema = z.object({
  oldPath: z
    .string()
    .min(1)
    .startsWith("/", "Path must start with /")
    .max(2048),
  newPath: z
    .string()
    .min(1)
    .startsWith("/", "Path must start with /")
    .max(2048),
  statusCode: z.enum(["301", "302"]).transform(Number) as unknown as z.ZodType<301 | 302>,
});

// ─── Search / Query Schema ──────────────────────────────────────

export const searchSchema = z.object({
  query: z
    .string()
    .min(1)
    .max(500)
    .transform((v) => v.trim()),
  filters: z
    .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
    .optional(),
});

// ─── Error Sanitization ─────────────────────────────────────────

/**
 * Sanitize an error before sending to the client.
 * Strips stack traces and internal details in production.
 */
export function sanitizeError(
  error: unknown,
  isProduction: boolean
): { message: string; code: string } {
  if (error instanceof z.ZodError) {
    return {
      message: error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; "),
      code: "VALIDATION_ERROR",
    };
  }

  if (error instanceof Error) {
    return {
      message: isProduction ? "An unexpected error occurred" : error.message,
      code: "INTERNAL_ERROR",
    };
  }

  return {
    message: "An unexpected error occurred",
    code: "INTERNAL_ERROR",
  };
}
