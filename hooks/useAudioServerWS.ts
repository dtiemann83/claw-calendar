"use client";

import { useEffect, useRef, useState, useCallback } from "react";

// From packages/shared/src/messages.ts (AudioServerEvent)
type AudioServerEvent =
  | { type: "wake"; timestamp: number; room?: string }
  | { type: "partial_transcript"; text: string }
  | { type: "final_transcript"; text: string }
  | { type: "error"; message: string };

type WSState = "connecting" | "open" | "closed";

export function useAudioServerWS() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const [wsState, setWsState] = useState<WSState>("connecting");
  const [lastEvent, setLastEvent] = useState<AudioServerEvent | null>(null);

  const connect = useCallback(() => {
    const url = process.env.NEXT_PUBLIC_AUDIO_SERVER_WS_URL;
    if (!url) return;

    const ws = new WebSocket(url);
    wsRef.current = ws;
    setWsState("connecting");

    ws.onopen = () => {
      if (!mountedRef.current) return;
      setWsState("open");
      // Announce audio format — browser AudioContext defaults to 48kHz on most devices
      ws.send(JSON.stringify({ type: "audio_config", sample_rate: 48000 }));
    };

    ws.onmessage = (e) => {
      if (!mountedRef.current) return;
      try {
        const event = JSON.parse(e.data) as AudioServerEvent;
        setLastEvent(event);
      } catch {
        // ignore malformed messages
      }
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      setWsState("closed");
      // Reconnect after 3s
      reconnectTimerRef.current = setTimeout(() => {
        if (mountedRef.current) connect();
      }, 3000);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const sendAudioChunk = useCallback((buffer: ArrayBuffer) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(buffer);
    }
  }, []);

  return { lastEvent, wsState, sendAudioChunk };
}
