import { useEffect, useRef, useState } from "react";
import { AgentEvent, AgentEventType } from "@/types";

interface UseSSEOptions {
  url: string | null;
  onEvent?: (event: AgentEvent) => void;
}

export function useSSE({ url, onEvent }: UseSSEOptions) {
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!url) return;

    const es = new EventSource(url);
    esRef.current = es;
    setConnected(true);
    setDone(false);
    setError(null);
    setEvents([]);

    const handleEvent = (type: AgentEventType) => (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as Record<string, unknown>;
        const event: AgentEvent = { event: type, data, timestamp: Date.now() };
        setEvents((prev) => [...prev, event]);
        onEventRef.current?.(event);
        if (type === "done" || type === "error") {
          setDone(true);
          es.close();
          setConnected(false);
        }
      } catch {
        // ignore JSON parse errors
      }
    };

    const eventTypes: AgentEventType[] = [
      "start",
      "thinking",
      "action",
      "result",
      "compressing",
      "concluding",
      "synthesising",
      "done",
      "error",
    ];

    eventTypes.forEach((type) => {
      es.addEventListener(type, handleEvent(type) as EventListener);
    });

    es.onerror = () => {
      setError("Connection lost — the agent may still be running.");
      setConnected(false);
    };

    return () => {
      es.close();
      setConnected(false);
    };
  }, [url]);

  return { events, connected, done, error };
}
