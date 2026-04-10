/**
 * Provides a stable guest user ID for history tracking on the free tier.
 * In a real app, this would be replaced by or combined with NextAuth.
 */
export function getUserId(): string {
  if (typeof window === "undefined") return "";
  
  const KEY = "agentic_researcher_user_id";
  // Check for the existing key used in history page or the new one
  const stored = localStorage.getItem(KEY) || localStorage.getItem("demo_user_id");
  
  if (stored) {
    // If it was stored under the old key, migrate it
    if (!localStorage.getItem(KEY)) {
      localStorage.setItem(KEY, stored);
    }
    return stored;
  }
  
  const id = crypto.randomUUID();
  localStorage.setItem(KEY, id);
  return id;
}
