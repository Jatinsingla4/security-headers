import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { CrawlReport, LinkStatus } from "../../types" ;

const COLORS = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
};

const STATUS_COLORS: Record<LinkStatus, string> = {
  healthy: COLORS.green,
  broken: COLORS.red,
  redirected: COLORS.yellow,
  timeout: COLORS.red,
  error: COLORS.red,
};

/** Print a human-readable report to the console */
export function printConsoleReport(report: CrawlReport): void {
  console.log(`\n${COLORS.bold}=== Security Headers Link Crawl Report ===${COLORS.reset}\n`);
  console.log(`  Base URL:    ${report.baseUrl}`);
  console.log(`  Started:     ${report.startedAt}`);
  console.log(`  Completed:   ${report.completedAt}`);
  console.log(`  Total Links: ${report.totalLinks}\n`);

  console.log(`${COLORS.bold}Summary:${COLORS.reset}`);
  for (const [status, count] of Object.entries(report.summary)) {
    const color = STATUS_COLORS[status as LinkStatus];
    console.log(`  ${color}${status.padEnd(12)}${COLORS.reset} ${count}`);
  }

  // Print broken/error links in detail
  const problems = report.results.filter(
    (r) => r.status === "broken" || r.status === "error" || r.status === "timeout"
  );

  if (problems.length > 0) {
    console.log(`\n${COLORS.red}${COLORS.bold}Broken / Error Links:${COLORS.reset}\n`);
    for (const result of problems) {
      console.log(`  ${COLORS.red}[${result.statusCode ?? "ERR"}]${COLORS.reset} ${result.url}`);
      if (result.parentUrl) {
        console.log(`    ${COLORS.dim}Found on: ${result.parentUrl}${COLORS.reset}`);
      }
      if (result.error) {
        console.log(`    ${COLORS.dim}Error: ${result.error}${COLORS.reset}`);
      }
    }
  }

  // Print redirected links
  const redirects = report.results.filter((r) => r.status === "redirected");
  if (redirects.length > 0) {
    console.log(`\n${COLORS.yellow}${COLORS.bold}Redirected Links:${COLORS.reset}\n`);
    for (const result of redirects) {
      console.log(`  ${COLORS.yellow}[${result.statusCode}]${COLORS.reset} ${result.url}`);
      if (result.redirectChain.length > 1) {
        console.log(
          `    ${COLORS.dim}-> ${result.redirectChain[result.redirectChain.length - 1]}${COLORS.reset}`
        );
      }
    }
  }

  console.log("");
}

/** Write the full report as JSON to disk */
export function writeJsonReport(report: CrawlReport, outputPath: string): void {
  const dir = dirname(outputPath);
  mkdirSync(dir, { recursive: true });
  writeFileSync(outputPath, JSON.stringify(report, null, 2), "utf-8");
  console.log(`${COLORS.cyan}JSON report written to: ${outputPath}${COLORS.reset}\n`);
}
