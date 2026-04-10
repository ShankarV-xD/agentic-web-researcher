"use client";
import { useEffect, useState } from "react";
import { getHistory } from "@/lib/api";
import { getUserId } from "@/lib/user";
import SessionCard from "@/components/SessionCard";

interface SessionSummary {
  session_id: string;
  query: string;
  status: string;
  depth: string;
  iterations: number;
  created_at: string;
}

export default function HistoryPage() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userId = getUserId();
    getHistory(userId)
      .then((data) => setSessions(data || []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="dots-loading flex gap-2">
          <span className="w-2 h-2 rounded-full bg-violet-500" />
          <span className="w-2 h-2 rounded-full bg-violet-500" />
          <span className="w-2 h-2 rounded-full bg-violet-500" />
        </div>
      </div>
    );
  }

  if (!sessions.length) {
    return (
      <div
        className="flex flex-col items-center justify-center min-h-[50vh] text-center gap-4"
      >
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl"
          style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }}
        >
          ◎
        </div>
        <div>
          <p className="text-sm font-medium mb-1" style={{ color: "var(--text-primary)" }}>
            No research sessions yet
          </p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Start your first research to see it here.
          </p>
        </div>
        <a
          href="/"
          className="text-sm px-4 py-2 rounded-xl font-medium transition-all"
          style={{
            background: "linear-gradient(135deg, #8b5cf6, #7c3aed)",
            color: "white",
            boxShadow: "0 0 16px rgba(139,92,246,0.3)",
          }}
        >
          Start researching →
        </a>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      <div className="flex items-baseline justify-between mb-6">
        <h1 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
          Research history
        </h1>
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          {sessions.length} sessions
        </span>
      </div>

      <div className="space-y-2.5">
        {sessions.map((s) => (
          <SessionCard key={s.session_id} {...s} />
        ))}
      </div>
    </div>
  );
}
