const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export async function createResearch(
  query: string,
  depth: string,
  userId?: string
): Promise<{ session_id: string }> {
  const res = await fetch(`${BACKEND_URL}/api/research`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, depth, user_id: userId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(err.detail || "Failed to create research session");
  }
  return res.json();
}

export async function getSession(sessionId: string) {
  const res = await fetch(`${BACKEND_URL}/api/research/${sessionId}`);
  if (!res.ok) throw new Error("Session not found");
  return res.json();
}

export async function getHistory(userId: string) {
  const res = await fetch(`${BACKEND_URL}/api/history?user_id=${userId}`);
  if (!res.ok) return [];
  return res.json();
}

export function getStreamUrl(sessionId: string): string {
  return `${BACKEND_URL}/api/research/${sessionId}/stream`;
}
