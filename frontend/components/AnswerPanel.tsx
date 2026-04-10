"use client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import CopyButton from "./CopyButton";

export default function AnswerPanel({ answer }: { answer: string }) {
  // Defensive formatting:
  // 1. Strip out the "## Sources" section entirely from the left side
  // 2. Ensure vertical spacing between findings if needed
  const cleanedAnswer = answer.split(/## Sources/i)[0].trim();

  // Optimized regex to catch any clumpy citation blocks in the remaining text
  const formattedAnswer = cleanedAnswer.replace(
    /(\[\d+\].*? — https?:\/\/\b\S+?)([\s\.]*)(\[\d+\])/g,
    "$1$2\n\n$3"
  );

  return (
    <div
      className="relative rounded-2xl p-6 animate-fade-in"
      style={{
        background: "var(--bg-elevated)",
        border: "1px solid var(--border-normal)",
        boxShadow: "0 0 40px rgba(139,92,246,0.08)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between mb-5 pb-4"
        style={{ borderBottom: "1px solid var(--border-subtle)" }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full"
            style={{
              background: "linear-gradient(135deg, #8b5cf6, #06b6d4)",
              boxShadow: "0 0 8px rgba(139,92,246,0.6)",
            }}
          />
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            Research Brief
          </span>
        </div>
        <CopyButton text={formattedAnswer} />
      </div>

      {/* Markdown answer */}
      <div
        className="prose prose-sm max-w-none prose-dark prose-invert
          prose-headings:text-white prose-headings:font-semibold
          prose-h2:text-base prose-h2:mb-3 prose-h2:mt-5
          prose-p:leading-relaxed prose-p:text-sm
          prose-li:text-sm prose-li:leading-relaxed
          prose-a:text-violet-400 prose-a:no-underline hover:prose-a:text-violet-300 hover:prose-a:underline prose-a:break-all
          prose-strong:text-white prose-strong:font-medium
          prose-code:text-cyan-400 prose-code:bg-slate-800/50 prose-code:px-1 prose-code:rounded"
        style={{ color: "var(--text-secondary)" }}
      >
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{formattedAnswer}</ReactMarkdown>
      </div>
    </div>
  );
}
