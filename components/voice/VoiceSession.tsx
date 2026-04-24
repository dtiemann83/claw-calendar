"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Mic, MicOff, Volume2, Loader2 } from "lucide-react";
import { useAudioServerWS } from "@/hooks/useAudioServerWS";
import { useWakeWordStream } from "@/hooks/useWakeWordStream";
import { WakeWordIndicator } from "./WakeWordIndicator";

type Message = {
  role: "user" | "assistant";
  text: string;
};

type VoiceState = "idle" | "listening" | "thinking" | "speaking" | "error";

export function VoiceSession() {
  const [state, setState] = useState<VoiceState>("idle");
  const [messages, setMessages] = useState<Message[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [wakeDetected, setWakeDetected] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const sessionId = useRef(crypto.randomUUID());
  const audioUrlRef = useRef<string | null>(null);

  const { lastEvent, wsState, sendAudioChunk } = useAudioServerWS();
  const streamingEnabled = wsState === "open" && state === "idle";
  useWakeWordStream(streamingEnabled, sendAudioChunk);

  useEffect(() => {
    return () => {
      mediaRecorderRef.current?.stop();
    };
  }, []);

  const startRecording = useCallback(async () => {
    setErrorMsg(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        await processAudio(blob);
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setState("listening");
    } catch {
      setErrorMsg("Microphone access denied");
      setState("error");
    }
  }, []);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
  }, []);

  useEffect(() => {
    if (lastEvent?.type === "wake" && state === "idle") {
      setWakeDetected(true);
      // Brief visual flash, then start recording
      setTimeout(() => {
        setWakeDetected(false);
        startRecording();
      }, 500);
    }
  }, [lastEvent, state, startRecording]);

  const processAudio = async (blob: Blob) => {
    setState("thinking");
    try {
      // Step 1: Transcribe
      const formData = new FormData();
      formData.append("file", blob, "audio.webm");
      const transcribeRes = await fetch("/api/voice/transcribe", {
        method: "POST",
        body: formData,
      });
      if (!transcribeRes.ok) throw new Error("Transcription failed");
      const { transcript } = await transcribeRes.json();
      if (!transcript?.trim()) {
        setState("idle");
        return;
      }

      setMessages((prev) => [...prev, { role: "user", text: transcript }]);

      // Step 2: Ask agent
      const agentRes = await fetch("/api/agent/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: transcript,
          sessionId: sessionId.current,
        }),
      });
      if (!agentRes.ok) throw new Error("Agent error");
      const agentData = await agentRes.json();
      const replyText: string =
        agentData.text ?? agentData.reply ?? agentData.content ?? JSON.stringify(agentData);

      setMessages((prev) => [...prev, { role: "assistant", text: replyText }]);

      // Step 3: Speak
      setState("speaking");
      const speakRes = await fetch("/api/voice/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: replyText }),
      });
      if (speakRes.ok) {
        const audioBlob = await speakRes.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        audioUrlRef.current = audioUrl;
        const audio = new Audio(audioUrl);
        audio.onended = () => {
          URL.revokeObjectURL(audioUrl);
          audioUrlRef.current = null;
          setState("idle");
        };
        audio.onerror = () => {
          URL.revokeObjectURL(audioUrl);
          audioUrlRef.current = null;
          setState("idle");
        };
        try {
          await audio.play();
        } catch {
          URL.revokeObjectURL(audioUrl);
          audioUrlRef.current = null;
          setState("idle");
        }
      } else {
        setState("idle");
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong");
      setState("error");
    }
  };

  const stateLabels: Record<VoiceState, string> = {
    idle: "Tap to speak",
    listening: "Listening…",
    thinking: "Thinking…",
    speaking: "Speaking…",
    error: "Error",
  };

  const isRecording = state === "listening";
  const isBusy = state === "thinking" || state === "speaking";

  return (
    <div className="flex flex-col items-center gap-4 p-6 max-w-lg mx-auto">
      {/* Mic button */}
      <button
        onPointerDown={!isBusy ? startRecording : undefined}
        onPointerUp={isRecording ? stopRecording : undefined}
        onPointerLeave={isRecording ? stopRecording : undefined}
        disabled={isBusy}
        aria-label={stateLabels[state]}
        className={[
          "w-24 h-24 rounded-full flex items-center justify-center text-white transition-all shadow-lg",
          "focus:outline-none focus:ring-4 focus:ring-offset-2",
          isRecording
            ? "bg-red-500 scale-110 focus:ring-red-400 animate-pulse"
            : isBusy
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-700 focus:ring-blue-400 active:scale-95",
        ].join(" ")}
      >
        {isBusy ? (
          <Loader2 className="w-10 h-10 animate-spin" />
        ) : isRecording ? (
          <MicOff className="w-10 h-10" />
        ) : (
          <Mic className="w-10 h-10" />
        )}
      </button>

      {/* State label */}
      <p className="text-sm font-medium text-gray-600">{stateLabels[state]}</p>

      {/* Wake word indicator */}
      <WakeWordIndicator wsState={wsState} wakeDetected={wakeDetected} />

      {/* Error */}
      {errorMsg && (
        <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-1">{errorMsg}</p>
      )}

      {/* Transcript */}
      {messages.length > 0 && (
        <div className="w-full mt-2 space-y-2 max-h-72 overflow-y-auto">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={[
                "rounded-lg px-4 py-2 text-sm",
                msg.role === "user"
                  ? "bg-blue-100 text-blue-900 ml-8"
                  : "bg-gray-100 text-gray-900 mr-8",
              ].join(" ")}
            >
              <span className="font-semibold mr-1">
                {msg.role === "user" ? "You" : <Volume2 className="inline w-3 h-3 mr-1" />}
              </span>
              {msg.text}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
