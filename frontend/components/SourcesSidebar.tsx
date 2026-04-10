"use client";
import type { Source } from "@/types";

function getFaviconUrl(url: string): string {
  try {
    const { hostname } = new URL(url);
    return `https://www.google.com/s2/favicons?domain=${hostname}&sz=16`;
  } catch {
    return "";
  }
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return url;
  }
}

export default function SourcesSidebar({ sources }: { sources: Source[] }) {
  if (!sources.length) return null;

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <span
          className="text-xs font-semibold uppercase tracking-wider"
          style={{ color: "var(--text-muted)" }}
        >
          Sources
        </span>
        <span
          className="text-xs px-1.5 py-0.5 rounded-full font-medium"
          style={{
            background: "rgba(139,92,246,0.15)",
            color: "#a78bfa",
            border: "1px solid rgba(139,92,246,0.25)",
          }}
        >
          {sources.length}
        </span>
      </div>

      <ul className="space-y-2">
        {sources.map((s, i) => (
          <li key={i}>
            <a
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-2.5 p-2.5 rounded-xl group transition-all"
              style={{
                background: "var(--bg-highlight)",
                border: "1px solid var(--border-subtle)",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor =
                  "rgba(139,92,246,0.35)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor =
                  "var(--border-subtle)";
              }}
            >
              {/* Source number */}
              <span
                className="text-xs font-mono flex-shrink-0 mt-0.5 w-4 text-center font-semibold"
                style={{ color: "var(--text-muted)" }}
              >
                {i + 1}
              </span>

              {/* Favicon + text */}
              <div className="flex items-start gap-1.5 min-w-0">
                <img
                  src={getFaviconUrl(s.url)}
                  alt=""
                  width={14}
                  height={14}
                  className="mt-0.5 flex-shrink-0"
                  style={{ opacity: 0.7 }}
                  onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")}
                />
                <div className="min-w-0">
                  <p
                    className="text-xs font-medium leading-4 truncate transition-colors group-hover:text-violet-400"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {s.title || getDomain(s.url)}
                  </p>
                  <p
                    className="text-xs truncate mt-0.5"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {getDomain(s.url)}
                  </p>
                </div>
              </div>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
