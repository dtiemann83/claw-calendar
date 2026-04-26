"use client"

import { useState, useEffect } from "react"

interface VoiceSettings {
  sttProvider: string
  ttsProvider: string
  wakeWordProvider: string
  wakeWordModel: string
  wakeWordThreshold: number
  speakerIdProvider: string
  speakerIdThreshold: number
}

const STT_OPTIONS = ["faster_whisper_local", "openai_whisper_api", "stub"]
const TTS_OPTIONS = ["apple_say", "piper", "stub"]
const WAKE_OPTIONS = ["open_wake_word", "stub"]
const SPEAKER_OPTIONS = ["resemblyzer", "stub"]

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.08em", opacity: 0.4, marginBottom: 12 }}>
      {children}
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
      <span style={{ fontSize: "0.88rem", opacity: 0.85 }}>{label}</span>
      {children}
    </div>
  )
}

function Select({ value, options, onChange }: { value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        background: "rgba(255,255,255,0.1)",
        border: "1px solid rgba(255,255,255,0.15)",
        borderRadius: 6,
        color: "#fff",
        fontFamily: "inherit",
        fontSize: "0.85rem",
        padding: "4px 8px",
        cursor: "pointer",
      }}
    >
      {options.map((o) => <option key={o} value={o} style={{ background: "#1a1a2e" }}>{o}</option>)}
    </select>
  )
}

export function VoiceSection() {
  const [settings, setSettings] = useState<VoiceSettings | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch("/api/settings/voice").then(r => r.json()).then(setSettings).catch(() => {})
  }, [])

  const update = (patch: Partial<VoiceSettings>) => {
    setSettings(prev => prev ? { ...prev, ...patch } : null)
    setSaved(false)
  }

  const save = async () => {
    if (!settings) return
    setSaving(true)
    try {
      await fetch("/api/settings/voice", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      })
      setSaved(true)
    } finally {
      setSaving(false)
    }
  }

  if (!settings) return <p style={{ opacity: 0.45, fontSize: "0.88rem" }}>Loading…</p>

  return (
    <div style={{ maxWidth: 520 }}>
      <div style={{ marginBottom: 28 }}>
        <SectionLabel>Speech Recognition</SectionLabel>
        <Row label="Provider">
          <Select value={settings.sttProvider} options={STT_OPTIONS} onChange={(v) => update({ sttProvider: v })} />
        </Row>
      </div>

      <div style={{ marginBottom: 28 }}>
        <SectionLabel>Text to Speech</SectionLabel>
        <Row label="Provider">
          <Select value={settings.ttsProvider} options={TTS_OPTIONS} onChange={(v) => update({ ttsProvider: v })} />
        </Row>
      </div>

      <div style={{ marginBottom: 28 }}>
        <SectionLabel>Wake Word</SectionLabel>
        <Row label="Provider">
          <Select value={settings.wakeWordProvider} options={WAKE_OPTIONS} onChange={(v) => update({ wakeWordProvider: v })} />
        </Row>
        <Row label="Model">
          <input
            value={settings.wakeWordModel}
            onChange={(e) => update({ wakeWordModel: e.target.value })}
            style={{
              background: "rgba(255,255,255,0.1)",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: 6,
              color: "#fff",
              fontFamily: "inherit",
              fontSize: "0.85rem",
              padding: "4px 8px",
              width: 180,
            }}
          />
        </Row>
        <Row label={`Threshold  (${settings.wakeWordThreshold.toFixed(2)})`}>
          <input
            type="range" min={0} max={1} step={0.05}
            value={settings.wakeWordThreshold}
            onChange={(e) => update({ wakeWordThreshold: parseFloat(e.target.value) })}
            className="claw-range"
            style={{ width: 160 }}
          />
        </Row>
      </div>

      <div style={{ marginBottom: 28 }}>
        <SectionLabel>Speaker Identification</SectionLabel>
        <Row label="Provider">
          <Select value={settings.speakerIdProvider} options={SPEAKER_OPTIONS} onChange={(v) => update({ speakerIdProvider: v })} />
        </Row>
        <Row label={`Threshold  (${settings.speakerIdThreshold.toFixed(2)})`}>
          <input
            type="range" min={0} max={1} step={0.05}
            value={settings.speakerIdThreshold}
            onChange={(e) => update({ speakerIdThreshold: parseFloat(e.target.value) })}
            className="claw-range"
            style={{ width: 160 }}
          />
        </Row>
      </div>

      <button
        onClick={save}
        disabled={saving}
        style={{
          background: "rgba(59,130,246,0.7)",
          border: "1px solid rgba(59,130,246,0.5)",
          borderRadius: 8,
          color: "#fff",
          cursor: saving ? "default" : "pointer",
          fontFamily: "inherit",
          fontSize: "0.88rem",
          padding: "8px 20px",
          transition: "background 0.15s",
        }}
      >
        {saving ? "Saving…" : "Save"}
      </button>

      {saved && (
        <div style={{
          marginTop: 14,
          padding: "8px 14px",
          background: "rgba(234,179,8,0.15)",
          border: "1px solid rgba(234,179,8,0.3)",
          borderRadius: 6,
          fontSize: "0.82rem",
          color: "rgba(253,224,71,0.9)",
        }}>
          Settings saved. Restart the audio server for provider changes to take effect.
        </div>
      )}
    </div>
  )
}
