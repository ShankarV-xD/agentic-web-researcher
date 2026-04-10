export type Depth = "quick" | "standard" | "deep";
export type SessionStatus = "pending" | "running" | "done" | "error";

export interface Source {
  url: string;
  title: string;
  snippet: string;
}

export interface Session {
  session_id: string;
  query: string;
  status: SessionStatus;
  depth: Depth;
  iterations: number;
  total_tokens: number;
  final_answer: string | null;
  sources: Source[];
  created_at: string;
}

export type AgentEventType =
  | "start"
  | "thinking"
  | "action"
  | "result"
  | "compressing"
  | "concluding"
  | "synthesising"
  | "done"
  | "error";

export interface AgentEvent {
  event: AgentEventType;
  data: Record<string, unknown>;
  timestamp: number;
}
