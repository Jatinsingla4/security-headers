export type { Env } from "./env";

/** Link status categories for the crawler */
export type LinkStatus = "healthy" | "broken" | "redirected" | "timeout" | "error";

/** Result of crawling a single URL */
export interface CrawlResult {
  url: string;
  status: LinkStatus;
  statusCode: number | null;
  parentUrl: string | null;
  redirectChain: string[];
  responseTimeMs: number;
  error?: string;
  depth: number;
  timestamp: string;
}

/** Full crawl report */
export interface CrawlReport {
  baseUrl: string;
  startedAt: string;
  completedAt: string;
  totalLinks: number;
  summary: Record<LinkStatus, number>;
  results: CrawlResult[];
}

/** Security log entry */
export interface SecurityLogEntry {
  timestamp: string;
  type: "broken_link" | "unauthorized" | "rate_limited" | "api_error" | "ws_rejected";
  path: string;
  method: string;
  ip: string;
  userAgent: string;
  details?: string;
}

/** Redirect mapping for broken link recovery */
export interface RedirectMapping {
  oldPath: string;
  newPath: string;
  statusCode: 301 | 302;
  createdAt: string;
}

/** Upload validation constraints */
export interface UploadConstraints {
  maxSizeBytes: number;
  allowedMimeTypes: string[];
}
