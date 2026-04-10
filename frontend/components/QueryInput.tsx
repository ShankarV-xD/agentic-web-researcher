"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createResearch } from "@/lib/api";
import { getUserId } from "@/lib/user";
import DepthSelector from "./DepthSelector";
import type { Depth } from "@/types";

const API_KEY_STORAGE_KEY = "researcher_custom_api_key";

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
  
  // API Key state
  const [customApiKey, setCustomApiKey] = useState("");
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);

  // Load saved API key from localStorage on mount
  useEffect(() => {
    const savedKey = localStorage.getItem(API_KEY_STORAGE_KEY);
    if (savedKey) {
      setCustomApiKey(savedKey);
    }
  }, []);

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
      // Save API key to localStorage if provided
      if (customApiKey.trim()) {
        localStorage.setItem(API_KEY_STORAGE_KEY, customApiKey.trim());
      }
      const { session_id } = await createResearch(query.trim(), depth, userId, customApiKey.trim() || undefined);
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
          placeholder="Ask anything - What are the latest breakthroughs in quantum computing?"
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
          className="mt-1 text-xs px-1"
          style={{ color: "var(--error)" }}
        >
          {error}
        </p>
      )}
      
      {/* API Key Toggle - Small indicator */}
      <div className="mt-1 flex items-center justify-center">
        <button
          onClick={() => setShowApiKeyInput(true)}
          className="text-xs flex items-center gap-1.5 transition-all hover:opacity-80 px-2 py-1 rounded-full"
          style={{ 
            color: customApiKey ? "#10b981" : "var(--text-muted)",
            background: customApiKey ? "rgba(16, 185, 129, 0.1)" : "transparent"
          }}
          type="button"
          title={customApiKey ? "Custom API key configured" : "Configure custom API key"}
        >
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            width="10" 
            height="10" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          >
            <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
          </svg>
          {customApiKey ? "Custom key active" : "Add API key"}
        </button>
      </div>
      
      {/* API Key Modal */}
      {showApiKeyInput && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0, 0, 0, 0.6)" }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowApiKeyInput(false);
          }}
        >
          <div 
            className="w-full max-w-md rounded-2xl p-6 animate-fade-in"
            style={{ 
              background: "var(--bg-elevated)", 
              border: "1px solid var(--border-normal)",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)"
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                Configure Gemini API Key
              </h3>
              <button
                onClick={() => setShowApiKeyInput(false)}
                className="p-1 rounded-lg transition-colors hover:opacity-70"
                style={{ color: "var(--text-muted)" }}
                type="button"
              >
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  width="16" 
                  height="16" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            
            <p className="text-xs mb-4" style={{ color: "var(--text-secondary)" }}>
              Enter your own Gemini API key to use instead of the default. 
              This helps avoid rate limits.
            </p>
            
            <label className="block text-xs mb-1.5" style={{ color: "var(--text-secondary)" }}>
              API Key
            </label>
            <input
              type="password"
              value={customApiKey}
              onChange={(e) => setCustomApiKey(e.target.value)}
              placeholder="AIzaSy..."
              className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none"
              style={{ 
                background: "var(--bg-primary)", 
                border: "1px solid var(--border-normal)",
                color: "var(--text-primary)"
              }}
              autoFocus
            />
            
            <p className="mt-3 text-[10px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
              Your key is stored locally in your browser and only used for Gemini API calls.
              <a 
                href="https://aistudio.google.com/app/apikey" 
                target="_blank" 
                rel="noopener noreferrer"
                className="ml-1 underline hover:opacity-80"
                style={{ color: "#8b5cf6" }}
              >
                Get a free key →
              </a>
            </p>
            
            <div className="flex items-center gap-2 mt-5">
              <button
                onClick={() => {
                  if (customApiKey.trim()) {
                    localStorage.setItem(API_KEY_STORAGE_KEY, customApiKey.trim());
                  }
                  setShowApiKeyInput(false);
                }}
                className="flex-1 px-4 py-2 rounded-xl text-xs font-medium transition-all"
                style={{ 
                  background: "linear-gradient(135deg, #8b5cf6, #7c3aed)",
                  color: "white"
                }}
                type="button"
              >
                Save
              </button>
              {customApiKey && (
                <button
                  onClick={() => {
                    setCustomApiKey("");
                    localStorage.removeItem(API_KEY_STORAGE_KEY);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-medium transition-all"
                  style={{ 
                    background: "var(--bg-primary)",
                    border: "1px solid var(--border-normal)",
                    color: "var(--error)"
                  }}
                  type="button"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      
      <p className="mt-1 text-[10px] text-center" style={{ color: "var(--text-muted)" }}>
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
