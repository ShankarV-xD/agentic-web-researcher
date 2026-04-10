"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createResearch } from "@/lib/api";
import { getUserId } from "@/lib/user";
import DepthSelector from "./DepthSelector";
import type { Depth } from "@/types";

interface QueryInputProps {
  externalQuery?: string;
  setExternalQuery?: (q: string) => void;
  externalDepth?: Depth;
  setExternalDepth?: (d: Depth) => void;
}

// Inner component that uses useSearchParams
function QueryInputInner({ 
  externalQuery, 
  setExternalQuery,
  externalDepth,
  setExternalDepth
}: QueryInputProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Internal state as fallback or for local control
  const [internalQuery, setInternalQuery] = useState("");
  const [internalDepth, setInternalDepth] = useState<Depth>("standard");
  
  const query = externalQuery !== undefined ? externalQuery : internalQuery;
  const setQuery = setExternalQuery || setInternalQuery;
  const depth = externalDepth !== undefined ? externalDepth : internalDepth;
  const setDepth = setExternalDepth || setInternalDepth;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-fill from ?q= param (for deep links)
  useEffect(() => {
    const q = searchParams.get("q");
    if (q) setQuery(q);
  }, [searchParams, setQuery]);

  const handleSubmit = async () => {
    if (!query.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const userId = getUserId();
      const { session_id } = await createResearch(query.trim(), depth, userId);
      router.push(`/research/${session_id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to start research");
      setLoading(false);
    }
  };

  return (
    <div className="w-full">
      {/* Textarea */}
      <div
        className="relative rounded-2xl overflow-hidden transition-all"
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-normal)",
          boxShadow: loading ? "0 0 30px rgba(139,92,246,0.15)" : "none",
        }}
      >
        <textarea
          id="research-query"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          placeholder="Ask anything — What are the latest breakthroughs in quantum computing?"
          rows={3}
          className="w-full bg-transparent px-5 py-4 text-sm resize-none focus:outline-none leading-relaxed"
          style={{ color: "var(--text-primary)" }}
          disabled={loading}
        />

        {/* Bottom toolbar */}
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ borderTop: "1px solid var(--border-subtle)" }}
        >
          <DepthSelector value={depth} onChange={setDepth} />
          <button
            id="submit-research"
            onClick={handleSubmit}
            disabled={!query.trim() || loading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: loading
                ? "rgba(139,92,246,0.2)"
                : "linear-gradient(135deg, #8b5cf6, #7c3aed)",
              color: "white",
              boxShadow: loading ? "none" : "0 0 20px rgba(139,92,246,0.3)",
            }}
          >
            {loading ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full spin-slow" />
                Starting...
              </>
            ) : (
              <>
                Research
                <span className="text-white/60">↵</span>
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <p
          className="mt-2 text-xs px-1"
          style={{ color: "var(--error)" }}
        >
          {error}
        </p>
      )}
      <p className="mt-2 text-xs text-center" style={{ color: "var(--text-muted)" }}>
        Enter to research · Shift+Enter for new line
      </p>
    </div>
  );
}

// Wrapper component with Suspense boundary
export default function QueryInput(props: QueryInputProps) {
  return (
    <Suspense fallback={<div className="w-full p-4 text-center" style={{ color: "var(--text-muted)" }}>Loading...</div>}>
      <QueryInputInner {...props} />
    </Suspense>
  );
}
