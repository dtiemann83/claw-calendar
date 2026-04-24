// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAudioServerWS } from "@/hooks/useAudioServerWS";

// Mock WebSocket globally
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;

  sentMessages: (string | ArrayBuffer)[] = [];
  static instances: MockWebSocket[] = [];

  constructor(public url: string) {
    MockWebSocket.instances.push(this);
  }

  send(data: string | ArrayBuffer) {
    this.sentMessages.push(data);
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.();
  }

  // Test helper
  simulateOpen() {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.();
  }

  simulateMessage(data: object) {
    this.onmessage?.({ data: JSON.stringify(data) });
  }
}

describe("useAudioServerWS", () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
    vi.stubGlobal("WebSocket", MockWebSocket);
    vi.stubEnv("NEXT_PUBLIC_AUDIO_SERVER_WS_URL", "ws://localhost:3010/ws");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it("starts in connecting state", () => {
    const { result } = renderHook(() => useAudioServerWS());
    expect(result.current.wsState).toBe("connecting");
  });

  it("transitions to open when WS opens", () => {
    const { result } = renderHook(() => useAudioServerWS());
    act(() => MockWebSocket.instances[0].simulateOpen());
    expect(result.current.wsState).toBe("open");
  });

  it("sends audio_config on open", () => {
    const { result } = renderHook(() => useAudioServerWS());
    act(() => MockWebSocket.instances[0].simulateOpen());
    const sent = MockWebSocket.instances[0].sentMessages;
    expect(sent.length).toBeGreaterThan(0);
    const config = JSON.parse(sent[0] as string);
    expect(config.type).toBe("audio_config");
    expect(typeof config.sample_rate).toBe("number");
  });

  it("exposes wake event via lastEvent", () => {
    const { result } = renderHook(() => useAudioServerWS());
    act(() => MockWebSocket.instances[0].simulateOpen());
    act(() => MockWebSocket.instances[0].simulateMessage({ type: "wake", timestamp: 12345 }));
    expect(result.current.lastEvent).toMatchObject({ type: "wake", timestamp: 12345 });
  });

  it("transitions to closed when WS closes", () => {
    const { result } = renderHook(() => useAudioServerWS());
    act(() => MockWebSocket.instances[0].simulateOpen());
    act(() => MockWebSocket.instances[0].close());
    expect(result.current.wsState).toBe("closed");
  });

  it("sendAudioChunk does nothing when not open", () => {
    const { result } = renderHook(() => useAudioServerWS());
    // Still connecting — should not throw
    expect(() => result.current.sendAudioChunk(new ArrayBuffer(10))).not.toThrow();
  });
});
