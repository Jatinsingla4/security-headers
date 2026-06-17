/**
 * Custom 404 Page for Security Headers
 * Provides graceful fallback UI with alternative navigation suggestions.
 */
import React from "react";

interface SuggestedLink {
  label: string;
  href: string;
}

const SUGGESTED_LINKS: SuggestedLink[] = [
  { label: "Home", href: "/" },
  { label: "Dashboard", href: "/dashboard" },
  { label: "Documentation", href: "/docs" },
  { label: "Support", href: "/support" },
];

export default function Custom404(): React.ReactElement {
  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.code}>404</h1>
        <h2 style={styles.title}>Page Not Found</h2>
        <p style={styles.description}>
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>

        <div style={styles.suggestions}>
          <p style={styles.suggestLabel}>Try one of these instead:</p>
          <nav style={styles.nav}>
            {SUGGESTED_LINKS.map((link) => (
              <a key={link.href} href={link.href} style={styles.link}>
                {link.label}
              </a>
            ))}
          </nav>
        </div>

        <div style={styles.searchBox}>
          <form action="/search" method="GET">
            <input
              type="text"
              name="q"
              placeholder="Search for what you need..."
              style={styles.searchInput}
              aria-label="Search"
            />
            <button type="submit" style={styles.searchButton}>
              Search
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "100vh",
    backgroundColor: "#f9fafb",
    fontFamily: "system-ui, -apple-system, sans-serif",
    padding: "1rem",
  },
  card: {
    textAlign: "center",
    maxWidth: "480px",
    width: "100%",
  },
  code: {
    fontSize: "6rem",
    fontWeight: 800,
    color: "#111827",
    margin: 0,
    lineHeight: 1,
  },
  title: {
    fontSize: "1.5rem",
    fontWeight: 600,
    color: "#374151",
    margin: "0.5rem 0",
  },
  description: {
    color: "#6b7280",
    margin: "0.5rem 0 2rem",
  },
  suggestions: {
    marginBottom: "2rem",
  },
  suggestLabel: {
    fontSize: "0.875rem",
    color: "#9ca3af",
    marginBottom: "0.75rem",
  },
  nav: {
    display: "flex",
    gap: "0.75rem",
    justifyContent: "center",
    flexWrap: "wrap" as const,
  },
  link: {
    padding: "0.5rem 1rem",
    borderRadius: "0.375rem",
    backgroundColor: "#111827",
    color: "#ffffff",
    textDecoration: "none",
    fontSize: "0.875rem",
    fontWeight: 500,
  },
  searchBox: {
    marginTop: "1rem",
  },
  searchInput: {
    padding: "0.625rem 1rem",
    borderRadius: "0.375rem 0 0 0.375rem",
    border: "1px solid #d1d5db",
    fontSize: "0.875rem",
    width: "200px",
    outline: "none",
  },
  searchButton: {
    padding: "0.625rem 1rem",
    borderRadius: "0 0.375rem 0.375rem 0",
    border: "1px solid #111827",
    backgroundColor: "#111827",
    color: "#ffffff",
    fontSize: "0.875rem",
    cursor: "pointer",
  },
};
