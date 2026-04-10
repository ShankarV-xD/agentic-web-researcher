"use client";
import { useState } from "react";
import QueryInput from "@/components/QueryInput";
import type { Depth } from "@/types";

export default function Home() {
  const [query, setQuery] = useState("");
  const [depth, setDepth] = useState<Depth>("standard");

  const examples = [
    { label: "Frontend", q: "Latest trends in CSS Container queries and browser support in 2025" },
    { label: "Backend", q: "Bun vs Node.js for high-throughput WebSocket servers: Performance comparison" },
    { label: "Full Stack", q: "Architecture patterns for scaling Serverless Next.js apps with Postgres" },
    { label: "AI/ML", q: "Step-by-step guide to fine-tuning Llama 3 on custom documentation" },
  ];

  return (
    <div className="flex flex-col items-center justify-center min-h-[72vh] gap-10">
      {/* Hero */}
      <div className="text-center max-w-2xl">
        <div
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium mb-6"
          style={{
            background: "rgba(139,92,246,0.12)",
            border: "1px solid rgba(139,92,246,0.25)",
            color: "#a78bfa",
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
          Autonomous research agent
        </div>

        <h1 className="text-4xl font-bold tracking-tight mb-4">
          <span className="gradient-text">Research anything.</span>
          <br />
          <span style={{ color: "var(--text-primary)" }}>In depth, with citations.</span>
        </h1>
        <p className="text-base leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          Ask a question. The agent searches the web, reads sources, reasons about what it
          knows, and writes a structured, cited research brief — automatically.
        </p>
      </div>

      {/* Input */}
      <div className="w-full max-w-2xl">
        <QueryInput 
          externalQuery={query} 
          setExternalQuery={setQuery} 
          externalDepth={depth} 
          setExternalDepth={setDepth} 
        />
      </div>

      {/* Example queries */}
      <div className="w-full max-w-2xl">
        <p className="text-xs text-center mb-3" style={{ color: "var(--text-muted)" }}>
          Try one of these
        </p>
        <div className="grid grid-cols-2 gap-2">
          {examples.map((ex) => (
            <button
              key={ex.q}
              onClick={() => setQuery(ex.q)}
              className="text-xs px-3 py-2.5 rounded-lg text-left transition-all hover:border-violet-500/40 group"
              style={{
                background: "var(--bg-elevated)",
                border: "1px solid var(--border-subtle)",
                color: "var(--text-secondary)",
              }}
            >
              {/* <div className="text-[10px] font-bold uppercase tracking-wider mb-1 opacity-50 text-violet-400">
                {ex.label}
              </div> */}
              <span className="group-hover:text-violet-400 transition-colors line-clamp-1">{ex.q}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Feature pills */}
      {/* <div className="flex flex-wrap gap-2 justify-center">
        {[
          "Serper Search",
          "Jina Reader",
          "Gemini 1.5 Flash",
          "Multi-iteration reasoning",
          "Cited sources",
          "Free tier",
        ].map((f) => (
          <span
            key={f}
            className="text-xs px-2.5 py-1 rounded-full"
            style={{
              background: "var(--bg-elevated)",
              border: "1px solid var(--border-subtle)",
              color: "var(--text-muted)",
            }}
          >
            {f}
          </span>
        ))}
      </div> */}
    </div>
  );
}
