"use client";
import type { AgentEvent } from "@/types";
import { useEffect, useRef } from "react";

function EventRow({ event }: { event: AgentEvent }) {
  const { event: type, data } = event;

  const label = (): string => {
    if (type === "action") {
      if (data.type === "search") return `Searching: "${data.query as string}"`;
      if (data.type === "fetch") return `Reading: ${data.url as string}`;
    }
    if (type === "result") {
      if (data.type === "search_done")
        return `Found ${data.count as number} results for "${data.query as string}"`;
      if (data.type === "fetch_done") return `Read: ${(data.title as string) || (data.url as string)}`;
    }
    if (type === "thinking") return `Reasoning — iteration ${data.iteration as number}`;
    if (type === "compressing") return "Compressing context to save tokens...";
    if (type === "concluding")
      return `Concluding — ${Math.round((data.confidence as number) * 100)}% confidence`;
    if (type === "synthesising")
      return `Writing final answer (${data.sources_count as number} sources)...`;
    if (type === "start") return `Starting ${data.depth as string} research`;
    if (type === "done")
      return `Done in ${data.iterations as number} iterations`;
    if (type === "error") return `Error: ${data.message as string}`;
    return type;
  };

  const styles: Record<string, { dot: string; text: string; bg: string }> = {
    start:       { dot: "#a78bfa", text: "#c4b5fd", bg: "rgba(139,92,246,0.08)" },
    thinking:    { dot: "#6b7280", text: "#9ca3af", bg: "transparent" },
    action:      { dot: "#f59e0b", text: "#fbbf24", bg: "rgba(245,158,11,0.08)" },
    result:      { dot: "#10b981", text: "#34d399", bg: "rgba(16,185,129,0.06)" },
    compressing: { dot: "#8b5cf6", text: "#a78bfa", bg: "rgba(139,92,246,0.06)" },
    concluding:  { dot: "#06b6d4", text: "#22d3ee", bg: "rgba(6,182,212,0.08)" },
    synthesising:{ dot: "#06b6d4", text: "#22d3ee", bg: "rgba(6,182,212,0.08)" },
    done:        { dot: "#10b981", text: "#34d399", bg: "rgba(16,185,129,0.08)" },
    error:       { dot: "#ef4444", text: "#f87171", bg: "rgba(239,68,68,0.08)" },
  };

  const s = styles[type] || styles.thinking;

  return (
    <div
      className="feed-item-enter flex items-start gap-3 px-3 py-2 rounded-lg"
      style={{ background: s.bg }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5"
        style={{ background: s.dot }}
      />
      <span className="text-xs leading-5 break-all" style={{ color: s.text }}>
        {label()}
      </span>
    </div>
  );
}

export default function AgentFeed({
  events,
  done,
}: {
  events: AgentEvent[];
  done: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [events]);

  if (events.length === 0) {
    return (
      <div className="flex items-center gap-3 p-2">
        <div className="dots-loading flex gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-violet-500" />
          <span className="w-1.5 h-1.5 rounded-full bg-violet-500" />
          <span className="w-1.5 h-1.5 rounded-full bg-violet-500" />
        </div>
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          Connecting to agent...
        </span>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="space-y-1 max-h-full overflow-y-auto pr-2">
      {events
        .filter((e) => e.event !== "done")
        .map((e, i) => (
          <EventRow key={i} event={e} />
        ))}
      {!done && (
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="dots-loading flex gap-1">
            <span className="w-1 h-1 rounded-full" style={{ background: "var(--text-muted)" }} />
            <span className="w-1 h-1 rounded-full" style={{ background: "var(--text-muted)" }} />
            <span className="w-1 h-1 rounded-full" style={{ background: "var(--text-muted)" }} />
          </div>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            Working...
          </span>
        </div>
      )}

    </div>
  );
}
