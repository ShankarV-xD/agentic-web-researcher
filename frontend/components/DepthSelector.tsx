"use client";
import type { Depth } from "@/types";

const OPTIONS: { value: Depth; label: string; desc: string; emoji: string }[] = [
  { value: "quick", label: "Quick", desc: "3 iterations — fast overview", emoji: "⚡" },
  { value: "standard", label: "Standard", desc: "5 iterations — balanced", emoji: "◎" },
  { value: "deep", label: "Deep", desc: "6 iterations — thorough", emoji: "🔬" },
];

export default function DepthSelector({
  value,
  onChange,
}: {
  value: Depth;
  onChange: (v: Depth) => void;
}) {
  return (
    <div className="flex gap-1">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          title={o.desc}
          className="px-3 py-1.5 text-xs rounded-lg font-medium transition-all"
          style={
            value === o.value
              ? {
                  background: "rgba(139,92,246,0.2)",
                  color: "#a78bfa",
                  border: "1px solid rgba(139,92,246,0.4)",
                }
              : {
                  background: "transparent",
                  color: "var(--text-muted)",
                  border: "1px solid var(--border-subtle)",
                }
          }
        >
          <span className="mr-1">{o.emoji}</span>
          {o.label}
        </button>
      ))}
    </div>
  );
}
