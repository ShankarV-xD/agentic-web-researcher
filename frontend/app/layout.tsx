import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agentic Researcher — AI-powered web research",
  description:
    "Autonomous AI research agent — searches the web, reads sources, and synthesises a cited answer.",
  keywords: ["AI research", "web search", "autonomous agent", "Perplexity alternative"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
      </head>
      <body className="bg-mesh min-h-screen" style={{ backgroundColor: "var(--bg-base)" }}>
        {/* Navigation */}
        <nav
          className="glass border-b sticky top-0 z-50"
          style={{ borderColor: "var(--border-subtle)" }}
        >
          <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
            <a href="/" className="flex items-center gap-2.5 group">
              {/* Logo mark */}
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold"
                style={{
                  background: "linear-gradient(135deg, #8b5cf6, #06b6d4)",
                  boxShadow: "0 0 12px rgba(139,92,246,0.4)",
                }}
              >
                ◎
              </div>
              <span
                className="text-sm font-semibold tracking-tight"
                style={{ color: "var(--text-primary)" }}
              >
                Agentic Researcher
              </span>
              <span
                className="text-xs px-1.5 py-0.5 rounded-full font-medium"
                style={{
                  background: "rgba(139,92,246,0.15)",
                  color: "#a78bfa",
                  border: "1px solid rgba(139,92,246,0.3)",
                }}
              >
                Beta
              </span>
            </a>
            <div className="flex items-center gap-4">
              <a
                href="/history"
                className="text-xs font-medium transition-colors hover:text-white"
                style={{ color: "var(--text-muted)" }}
              >
                History
              </a>
              <div
                className="w-px h-4"
                style={{ background: "var(--border-subtle)" }}
              />
              {/* <span
                className="text-xs"
                style={{ color: "var(--text-muted)" }}
              >
                Powered by Gemini
              </span> */}
            </div>
          </div>
        </nav>

        <main className="max-w-6xl mx-auto px-4 py-8 lg:overflow-x-hidden">{children}</main>

        {/* Subtle footer */}
        {/* <footer className="mt-16 pb-8 text-center">
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Free-tier · Serper Search · Jina Reader · Gemini 1.5 Flash
          </p>
        </footer> */}
      </body>
    </html>
  );
}
