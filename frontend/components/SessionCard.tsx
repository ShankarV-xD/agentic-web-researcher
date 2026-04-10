import Link from "next/link";

interface Props {
  session_id: string;
  query: string;
  status: string;
  depth: string;
  iterations: number;
  created_at: string;
}

const statusConfig: Record<
  string,
  { color: string; bg: string; border: string; label: string; dot: string }
> = {
  done:    { color: "#34d399", bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.25)", label: "Done", dot: "#10b981" },
  running: { color: "#fbbf24", bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.25)", label: "Running", dot: "#f59e0b" },
  error:   { color: "#f87171", bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.25)", label: "Error", dot: "#ef4444" },
  pending: { color: "#9ca3af", bg: "rgba(156,163,175,0.08)", border: "rgba(156,163,175,0.15)", label: "Pending", dot: "#6b7280" },
};

const depthEmoji: Record<string, string> = {
  quick: "⚡",
  standard: "◎",
  deep: "🔬",
};

export default function SessionCard(props: Props) {
  const date = new Date(props.created_at).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  const sc = statusConfig[props.status] || statusConfig.pending;

  return (
    <Link href={`/research/${props.session_id}`} className="block group">
      <div
        className="rounded-xl px-4 py-3.5 transition-all"
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-subtle)",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.borderColor =
            "rgba(139,92,246,0.35)";
          (e.currentTarget as HTMLElement).style.background = "var(--bg-highlight)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.borderColor =
            "var(--border-subtle)";
          (e.currentTarget as HTMLElement).style.background = "var(--bg-elevated)";
        }}
      >
        {/* Query */}
        <p
          className="text-sm font-medium leading-snug truncate mb-2 transition-colors group-hover:text-violet-400"
          style={{ color: "var(--text-primary)" }}
        >
          {props.query}
        </p>

        {/* Meta */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Status badge */}
          <span
            className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full font-medium"
            style={{ color: sc.color, background: sc.bg, border: `1px solid ${sc.border}` }}
          >
            <span className="w-1 h-1 rounded-full" style={{ background: sc.dot }} />
            {sc.label}
          </span>

          {/* Depth */}
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            {depthEmoji[props.depth] || "◎"} {props.depth}
          </span>

          {/* Iterations */}
          {props.iterations > 0 && (
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              {props.iterations} iterations
            </span>
          )}

          {/* Date */}
          <span className="text-xs ml-auto" style={{ color: "var(--text-muted)" }}>
            {date}
          </span>
        </div>
      </div>
    </Link>
  );
}
