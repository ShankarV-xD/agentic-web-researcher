"use client";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useSSE } from "@/lib/sse";
import { getStreamUrl, getSession } from "@/lib/api";
import AgentFeed from "@/components/AgentFeed";
import AnswerPanel from "@/components/AnswerPanel";
import SourcesSidebar from "@/components/SourcesSidebar";
import type { Source, AgentEvent } from "@/types";

const API_KEY_STORAGE_KEY = "researcher_custom_api_key";

export default function ResearchPage() {
  const params = useParams();
  const sessionId = params?.sessionId as string;

  const [answer, setAnswer] = useState<string | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [query, setQuery] = useState<string>("");
  const [depth, setDepth] = useState<string>("standard");
  const [iterations, setIterations] = useState<number>(0);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const onEvent = (event: AgentEvent) => {
    if (event.event === "done") {
      setAnswer(event.data.answer as string);
      setSources((event.data.sources as Source[]) || []);
      setIterations(event.data.iterations as number);
    }
  };

  const { events, done, error: sseError } = useSSE({ url: streamUrl, onEvent });

  // Auto-scroll to top when answer arrives
  useEffect(() => {
    if (answer && scrollRef.current) {
      scrollRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [answer]);

  // Auto-scroll to bottom of feed during research
  useEffect(() => {
    if (!answer && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events, answer]);

  // Body-lock effect to prevent whole-page shake
  useEffect(() => {
    document.body.classList.add("page-lock");
    return () => document.body.classList.remove("page-lock");
  }, []);

  // Load session metadata
  useEffect(() => {
    if (!sessionId) return;
    getSession(sessionId)
      .then((s) => {
        setQuery(s.query);
        setDepth(s.depth);
        if (s.status === "done" && s.final_answer) {
          setAnswer(s.final_answer);
          setSources(s.sources || []);
          setIterations(s.iterations);
        } else {
          // Get custom API key from localStorage if exists
          const customApiKey = localStorage.getItem(API_KEY_STORAGE_KEY);
          setStreamUrl(getStreamUrl(sessionId, customApiKey || undefined));
        }
      })
      .catch(() => setLoadError("Could not load session."));
  }, [sessionId]);

  if (loadError) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div
          className="text-center p-8 rounded-2xl"
          style={{
            background: "var(--bg-elevated)",
            border: "1px solid rgba(239,68,68,0.2)",
          }}
        >
          <p className="text-sm mb-3" style={{ color: "#f87171" }}>
            {loadError}
          </p>
          <a
            href="/"
            className="text-xs px-4 py-2 rounded-lg"
            style={{
              background: "var(--bg-highlight)",
              color: "var(--text-secondary)",
            }}
          >
            ← Back to home
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in lg:h-[calc(100vh-7.5rem)] lg:overflow-hidden">
      {/* ── Left: query + feed + answer ── */}
      <div className="lg:col-span-2 flex flex-col lg:h-full lg:overflow-hidden">
        {/* Header (Stationary) */}
        {query && (
          <div className="pb-5">
            <h1
              className="text-xl font-semibold leading-snug"
              style={{ color: "var(--text-primary)" }}
            >
              {query}
            </h1>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                {depth} depth
              </span>
              {iterations > 0 && (
                <>
                  <span style={{ color: "var(--text-muted)" }}>·</span>
                  <span
                    className="text-xs"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {iterations} iterations
                  </span>
                </>
              )}
            </div>
          </div>
        )}

        {/* Scrollable Content Area */}
        <div
          ref={scrollRef}
          className="flex-1 lg:overflow-y-auto scrollbar-hide space-y-5"
        >
          {/* Agent feed (only while running) */}
          {!answer && (
            <div
              className="rounded-2xl p-4"
              style={{
                background: "var(--bg-elevated)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              <div
                className="flex items-center gap-2 mb-3 pb-3"
                style={{ borderBottom: "1px solid var(--border-subtle)" }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{
                    background: "#8b5cf6",
                    boxShadow: "0 0 6px #8b5cf6",
                  }}
                />
                <span
                  className="text-xs font-semibold uppercase tracking-wider"
                  style={{ color: "var(--text-muted)" }}
                >
                  Agent Activity
                </span>
              </div>
              <AgentFeed events={events} done={done} />
              {sseError && (
                <p className="text-xs mt-2" style={{ color: "var(--error)" }}>
                  {sseError}
                </p>
              )}
            </div>
          )}

          {/* Final answer */}
          {answer && <AnswerPanel answer={answer} />}

          {/* New research CTA (shown after done) */}
          {answer && (
            <a
              href="/"
              className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all"
              style={{
                background: "var(--bg-elevated)",
                border: "1px solid var(--border-normal)",
                color: "var(--text-secondary)",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor =
                  "rgba(139,92,246,0.4)";
                (e.currentTarget as HTMLElement).style.color = "#a78bfa";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor =
                  "var(--border-normal)";
                (e.currentTarget as HTMLElement).style.color =
                  "var(--text-secondary)";
              }}
            >
              ← New research
            </a>
          )}
        </div>
      </div>

      <div className="lg:col-span-1 lg:h-full lg:overflow-y-auto">
        {sources.length > 0 ? (
          <div
            className="rounded-2xl p-4"
            style={{
              background: "var(--bg-elevated)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <SourcesSidebar sources={sources} />
          </div>
        ) : !done ? (
          <div
            className="rounded-2xl p-4"
            style={{
              background: "var(--bg-elevated)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Sources will appear here as the agent reads pages...
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
