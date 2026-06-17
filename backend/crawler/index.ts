#!/usr/bin/env tsx
/**
 * Security Headers Broken Link Crawler
 *
 * Usage:
 *   npx tsx src/crawler/index.ts --url https://securityheaders.com --depth 3 --concurrency 10
 *   npm run crawl -- --url https://securityheaders.com --ci
 */

import { parseConfig } from "./config";
import { LinkCrawler } from "./crawler";
import { printConsoleReport, writeJsonReport } from "./reporter";

async function main(): Promise<void> {
  const config = parseConfig(process.argv.slice(2));

  console.log(`Starting crawl of ${config.baseUrl}`);
  console.log(`  Depth: ${config.maxDepth}, Concurrency: ${config.concurrency}, Timeout: ${config.timeoutMs}ms\n`);

  const crawler = new LinkCrawler(config);
  const report = await crawler.crawl();

  printConsoleReport(report);
  writeJsonReport(report, config.outputPath);

  // CI mode: exit with non-zero if broken links found
  if (config.failOnBrokenLinks) {
    const brokenCount = report.summary.broken + report.summary.error + report.summary.timeout;
    if (brokenCount > 0) {
      console.error(`CI FAILURE: Found ${brokenCount} broken/error links.`);
      process.exit(1);
    }
    console.log("CI PASS: No broken links found.");
  }
}

main().catch((err) => {
  console.error("Crawler failed:", err);
  process.exit(1);
});
