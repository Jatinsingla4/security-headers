/**
 * Example tRPC Router with Zod validation and error sanitization.
 * Shows the pattern for building secure tRPC procedures on Workers.
 */

import { initTRPC, TRPCError } from "@trpc/server";
import { z } from "zod";
import type { Env } from "../../types" ;
import type { AuthUser } from "../security/auth";
import { paginationSchema, searchSchema } from "../security/validation";
import { safeQuery } from "../security/storage";
import { LinkCrawler } from "../crawler/crawler";
import { DEFAULT_CONFIG } from "../crawler/config";

// ─── Context ────────────────────────────────────────────────────

export interface TrpcContext {
  env: Env;
  user: AuthUser | null;
  requestId: string;
}

const t = initTRPC.context<TrpcContext>().create({
  errorFormatter({ shape }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        // Strip stack traces in production
        stack: undefined,
      },
    };
  },
});

// ─── Middleware ──────────────────────────────────────────────────

/** Require authenticated user */
const requireAuth = t.middleware(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Authentication required",
    });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

/** Require admin role */
const requireAdmin = t.middleware(({ ctx, next }) => {
  if (!ctx.user || ctx.user.role !== "admin") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Admin access required",
    });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

const publicProcedure = t.procedure;
const protectedProcedure = t.procedure.use(requireAuth);
const adminProcedure = t.procedure.use(requireAdmin);

// ─── Router ─────────────────────────────────────────────────────

export const appRouter = t.router({
  /** Public: health check */
  health: publicProcedure.query(() => ({
    status: "ok",
    timestamp: new Date().toISOString(),
  })),

  /** Protected: search with validated input */
  search: protectedProcedure
    .input(searchSchema)
    .query(async ({ ctx, input }) => {
      const results = await safeQuery<{ id: string; title: string }>(
        ctx.env.DB,
        "SELECT id, title FROM documents WHERE title LIKE ? LIMIT 20",
        [`%${input.query}%`]
      );
      return { results, query: input.query };
    }),

  /** Protected: paginated list */
  listItems: protectedProcedure
    .input(paginationSchema)
    .query(async ({ ctx, input }) => {
      const offset = (input.page - 1) * input.limit;
      const items = await safeQuery<{ id: string; name: string }>(
        ctx.env.DB,
        "SELECT id, name FROM items ORDER BY created_at DESC LIMIT ? OFFSET ?",
        [input.limit, offset]
      );
      return { items, page: input.page, limit: input.limit };
    }),

  /** Admin: manage redirects */
  addRedirect: adminProcedure
    .input(
      z.object({
        oldPath: z.string().startsWith("/").max(2048),
        newPath: z.string().startsWith("/").max(2048),
        statusCode: z.union([z.literal(301), z.literal(302)]).default(301),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.env.DB
        .prepare(
          "INSERT INTO redirects (old_path, new_path, status_code) VALUES (?, ?, ?)"
        )
        .bind(input.oldPath, input.newPath, input.statusCode)
        .run();

      return { success: true };
    }),

  /** Public: Start a live scan */
  startScan: publicProcedure
    .input(z.object({ url: z.string().url() }))
    .mutation(async ({ input }) => {
      const crawler = new LinkCrawler({
        ...DEFAULT_CONFIG,
        baseUrl: input.url,
        maxDepth: 3, 
        maxUrls: 100,
      });

      const report = await crawler.crawl();
      return report;
    }),
});

export type AppRouter = typeof appRouter;
