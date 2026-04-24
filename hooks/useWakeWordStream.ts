"use client";

import { useEffect, useRef } from "react";

export function useWakeWordStream(
  enabled: boolean,
  sendAudioChunk: (buf: ArrayBuffer) => void
) {
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);

  useEffect(() => {
    if (!enabled) {
      // Cleanup
      workletNodeRef.current?.disconnect();
      workletNodeRef.current = null;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      audioCtxRef.current?.close();
      audioCtxRef.current = null;
      return;
    }

    let cancelled = false;

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;

        const ctx = new AudioContext({ sampleRate: 48000 });
        audioCtxRef.current = ctx;

        await ctx.audioWorklet.addModule("/audio-processor.js");
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); ctx.close(); return; }

        const source = ctx.createMediaStreamSource(stream);
        const worklet = new AudioWorkletNode(ctx, "audio-chunk-processor");
        workletNodeRef.current = worklet;

        worklet.port.onmessage = (e) => {
          sendAudioChunk((e.data as Int16Array).buffer);
        };

        source.connect(worklet);
      } catch {
        // Mic not available or permission denied — silent fail (UI handles it)
      }
    }

    start();

    return () => {
      cancelled = true;
      workletNodeRef.current?.disconnect();
      workletNodeRef.current = null;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      audioCtxRef.current?.close();
      audioCtxRef.current = null;
    };
  }, [enabled, sendAudioChunk]);
}
