"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { Mic, MicOff, Volume2, Loader2, X } from "lucide-react"
import { useAudioServerWS } from "@/hooks/useAudioServerWS"
import { useWakeWordStream } from "@/hooks/useWakeWordStream"

type VoiceState = "idle" | "listening" | "thinking" | "speaking" | "error"
type Message = { role: "user" | "assistant"; text: string; speakerName?: string }

export function FloatingVoiceButton() {
  const [voiceState, setVoiceState] = useState<VoiceState>("idle")
  const [expanded, setExpanded] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [profiles, setProfiles] = useState<{ id: string; name: string }[]>([])
  const [correctionIdx, setCorrectionIdx] = useState<number | null>(null)
  const [wakeDetected, setWakeDetected] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const sessionId = useRef(crypto.randomUUID())

  const { lastEvent, wsState, sendAudioChunk } = useAudioServerWS()
  const streamingEnabled = wsState === "open" && voiceState === "idle"
  useWakeWordStream(streamingEnabled, sendAudioChunk)

  useEffect(() => {
    fetch("/api/profiles").then(r => r.json()).then(setProfiles).catch(() => {})
  }, [])

  const startRecording = useCallback(async () => {
    setErrorMsg(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        await processAudio(new Blob(chunksRef.current, { type: "audio/webm" }))
      }
      recorder.start()
      mediaRecorderRef.current = recorder
      setVoiceState("listening")
    } catch {
      setErrorMsg("Microphone access denied")
      setVoiceState("error")
    }
  }, [])

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop()
    mediaRecorderRef.current = null
  }, [])

  const dismiss = useCallback(() => {
    if (voiceState === "listening") {
      mediaRecorderRef.current?.stop()
      mediaRecorderRef.current = null
    }
    setExpanded(false)
    setVoiceState("idle")
    setErrorMsg(null)
  }, [voiceState])

  useEffect(() => {
    if (lastEvent?.type === "wake" && voiceState === "idle") {
      setWakeDetected(true)
      setTimeout(() => {
        setWakeDetected(false)
        setExpanded(true)
        startRecording()
      }, 500)
    }
  }, [lastEvent, voiceState, startRecording])

  const processAudio = async (blob: Blob) => {
    setVoiceState("thinking")
    try {
      const formData = new FormData()
      formData.append("file", blob, "audio.webm")
      const transcribeRes = await fetch("/api/voice/transcribe", { method: "POST", body: formData })
      if (!transcribeRes.ok) throw new Error("Transcription failed")
      const { transcript, speaker } = await transcribeRes.json()
      if (!transcript?.trim()) { setVoiceState("idle"); return }

      let speakerName: string | undefined
      if (speaker?.user_id) {
        try {
          const r = await fetch(`/api/profiles/${speaker.user_id}`)
          if (r.ok) speakerName = (await r.json()).name
        } catch {}
      }
      setMessages(prev => [...prev, { role: "user", text: transcript, speakerName }])

      const agentRes = await fetch("/api/agent/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: transcript, sessionId: sessionId.current }),
      })
      if (!agentRes.ok) throw new Error("Agent error")
      const agentData = await agentRes.json()
      const replyText: string = agentData.text ?? agentData.reply ?? agentData.content ?? JSON.stringify(agentData)
      setMessages(prev => [...prev, { role: "assistant", text: replyText }])

      setVoiceState("speaking")
      const speakRes = await fetch("/api/voice/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: replyText }),
      })
      if (speakRes.ok) {
        const audioUrl = URL.createObjectURL(await speakRes.blob())
        const audio = new Audio(audioUrl)
        audio.onended = () => { URL.revokeObjectURL(audioUrl); setVoiceState("idle") }
        audio.onerror = () => { URL.revokeObjectURL(audioUrl); setVoiceState("idle") }
        try { await audio.play() } catch { setVoiceState("idle") }
      } else {
        setVoiceState("idle")
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong")
      setVoiceState("error")
    }
  }

  const isRecording = voiceState === "listening"
  const isBusy = voiceState === "thinking" || voiceState === "speaking"

  const stateLabel: Record<VoiceState, string> = {
    idle: "Tap to speak",
    listening: "Listening…",
    thinking: "Thinking…",
    speaking: "Speaking…",
    error: "Error",
  }

  // Button is always at bottom-right. When expanded, CSS transform animates it to screen center.
  // 52px button: center is (right: 24 + 26 = 50px from right, 50px from bottom)
  const btnTransform = expanded
    ? `translate(calc(-50vw + 50px), calc(-50vh + 50px)) scale(${72 / 52})`
    : "translate(0, 0) scale(1)"

  return (
    <>
      {/* Backdrop */}
      {expanded && (
        <div
          onClick={dismiss}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.65)",
            backdropFilter: "blur(6px)",
            zIndex: 200,
            animation: "fadeIn 0.25s ease",
          }}
        />
      )}

      {/* Conversation card */}
      {expanded && (messages.length > 0 || errorMsg) && (
        <div
          style={{
            position: "fixed",
            left: "50%",
            top: "14%",
            transform: "translateX(-50%)",
            width: "min(500px, 88vw)",
            maxHeight: "42vh",
            overflowY: "auto",
            background: "rgba(15,15,25,0.88)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 16,
            padding: "16px 18px",
            zIndex: 202,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          {errorMsg && (
            <p style={{ margin: 0, color: "#f87171", fontSize: "0.85rem" }}>{errorMsg}</p>
          )}
          {messages.map((msg, i) => (
            <div
              key={i}
              style={{
                alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
                maxWidth: "84%",
                background: msg.role === "user" ? "rgba(59,130,246,0.28)" : "rgba(255,255,255,0.07)",
                borderRadius: 10,
                padding: "8px 12px",
                color: "#fff",
                fontSize: "0.9rem",
                lineHeight: 1.45,
              }}
            >
              {msg.role === "user" && (
                <div style={{ fontSize: "0.72rem", opacity: 0.55, marginBottom: 4, position: "relative" }}>
                  {msg.speakerName ?? "You"}
                  {" · "}
                  <button
                    onClick={() => setCorrectionIdx(correctionIdx === i ? null : i)}
                    style={{ background: "none", border: "none", color: "inherit", textDecoration: "underline", cursor: "pointer", fontFamily: "inherit", fontSize: "inherit" }}
                  >
                    Not you?
                  </button>
                  {correctionIdx === i && (
                    <div style={{
                      position: "absolute",
                      top: "100%",
                      right: 0,
                      background: "rgba(15,15,25,0.97)",
                      border: "1px solid rgba(255,255,255,0.15)",
                      borderRadius: 8,
                      padding: 8,
                      zIndex: 210,
                      minWidth: 140,
                      marginTop: 4,
                    }}>
                      {profiles.map(p => (
                        <button
                          key={p.id}
                          onClick={() => {
                            setMessages(prev => prev.map((m, j) => j === i ? { ...m, speakerName: p.name } : m))
                            setCorrectionIdx(null)
                          }}
                          style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", color: "#fff", cursor: "pointer", padding: "6px 8px", borderRadius: 4, fontSize: "0.85rem", fontFamily: "inherit" }}
                        >
                          {p.name}
                        </button>
                      ))}
                      <button
                        onClick={() => setCorrectionIdx(null)}
                        style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", padding: "6px 8px", borderRadius: 4, fontSize: "0.85rem", fontFamily: "inherit" }}
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              )}
              {msg.role === "assistant" && (
                <Volume2 size={11} style={{ opacity: 0.45, marginRight: 5, display: "inline", verticalAlign: "middle" }} />
              )}
              {msg.text}
            </div>
          ))}
        </div>
      )}

      {/* State label */}
      {expanded && (
        <div
          style={{
            position: "fixed",
            bottom: "calc(24px + 52px + 16px)",
            right: 0,
            left: 0,
            textAlign: "center",
            color: "rgba(255,255,255,0.65)",
            fontSize: "0.82rem",
            zIndex: 203,
            pointerEvents: "none",
          }}
        >
          {wakeDetected
            ? <span style={{ color: "#4ade80" }}>Wake word detected!</span>
            : stateLabel[voiceState]}
          {wsState !== "open" && voiceState === "idle" && (
            <span style={{ marginLeft: 10, color: wsState === "connecting" ? "#93c5fd" : "#f87171", fontSize: "0.75rem" }}>
              {wsState === "connecting" ? "● Connecting…" : "● Wake word offline"}
            </span>
          )}
        </div>
      )}

      {/* Dismiss X */}
      {expanded && !isRecording && !isBusy && (
        <button
          onClick={dismiss}
          aria-label="Close"
          style={{
            position: "fixed",
            top: 56,
            right: 16,
            zIndex: 204,
            background: "rgba(255,255,255,0.1)",
            border: "1px solid rgba(255,255,255,0.18)",
            borderRadius: "50%",
            width: 32,
            height: 32,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            color: "#fff",
          }}
        >
          <X size={15} />
        </button>
      )}

      {/* Mic button — always at bottom-right, animates to center when expanded */}
      <button
        onPointerDown={() => {
          if (isBusy) return
          if (!expanded) setExpanded(true)
          startRecording()
        }}
        onPointerUp={() => { if (isRecording) stopRecording() }}
        onPointerLeave={() => { if (isRecording) stopRecording() }}
        aria-label={stateLabel[voiceState]}
        style={{
          position: "fixed",
          right: 24,
          bottom: 24,
          width: 52,
          height: 52,
          borderRadius: "50%",
          border: "none",
          cursor: isBusy ? "default" : "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 201,
          transform: btnTransform,
          transition: "transform 0.4s cubic-bezier(0.34,1.56,0.64,1), background 0.25s, box-shadow 0.25s",
          background: isRecording
            ? "rgba(239,68,68,0.9)"
            : expanded
              ? "rgba(59,130,246,0.85)"
              : "rgba(255,255,255,0.12)",
          backdropFilter: "blur(8px)",
          boxShadow: expanded
            ? "0 0 40px rgba(59,130,246,0.35), 0 4px 20px rgba(0,0,0,0.5)"
            : "0 2px 14px rgba(0,0,0,0.45)",
        }}
      >
        {isBusy
          ? <Loader2 size={22} style={{ color: "#fff", animation: "spin 1s linear infinite" }} />
          : isRecording
            ? <MicOff size={22} style={{ color: "#fff" }} />
            : <Mic size={22} style={{ color: expanded ? "#fff" : "rgba(255,255,255,0.65)" }} />
        }
      </button>
    </>
  )
}
