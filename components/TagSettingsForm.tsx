"use client"

import {
  NativeSelectRoot,
  NativeSelectField,
  NativeSelectIndicator,
} from "@chakra-ui/react"
import type { TagConfig } from "@/lib/events/tags"
import { ColorRow } from "./ColorRow"

interface Props {
  tagConfigs: TagConfig[]
  onTagConfigsChange: (configs: TagConfig[]) => void
}

export function TagSettingsForm({ tagConfigs, onTagConfigsChange }: Props) {
  const updateTag = (index: number, patch: Partial<TagConfig>) => {
    const next = tagConfigs.map((t, i) => (i === index ? { ...t, ...patch } : t))
    onTagConfigsChange(next)
  }

  const deleteTag = (index: number) => {
    onTagConfigsChange(tagConfigs.filter((_, i) => i !== index))
  }

  if (tagConfigs.length === 0) {
    return (
      <p style={{ margin: 0, opacity: 0.45, fontSize: "0.88rem", lineHeight: 1.6 }}>
        No tags discovered yet. Add hashtags like <code>#sports</code> or{" "}
        <code>#emma</code> to your calendar event descriptions.
      </p>
    )
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {tagConfigs.map((tag, i) => (
        <div
          key={tag.name}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 10px",
            background: "rgba(255,255,255,0.04)",
            borderRadius: 6,
          }}
        >
          {/* Tag name */}
          <span
            style={{
              fontSize: "0.82rem",
              fontWeight: 500,
              minWidth: 80,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            #{tag.name}
          </span>

          {/* Type dropdown */}
          <NativeSelectRoot size="xs" style={{ width: 100, flexShrink: 0 }}>
            <NativeSelectField
              value={tag.type}
              onChange={(e) => {
                const type = e.target.value as "category" | "who"
                const patch: Partial<TagConfig> = { type }
                if (type === "who" && !tag.initial) {
                  patch.initial = tag.name[0].toUpperCase()
                }
                updateTag(i, patch)
              }}
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.14)",
                borderRadius: 4,
                color: "#fff",
                fontFamily: "inherit",
                fontSize: "0.72rem",
              }}
            >
              <option value="category" style={{ background: "#1e293b" }}>Category</option>
              <option value="who" style={{ background: "#1e293b" }}>Who</option>
            </NativeSelectField>
            <NativeSelectIndicator color="rgba(255,255,255,0.4)" />
          </NativeSelectRoot>

          {/* Color picker */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <ColorRow
              label=""
              value={tag.color}
              onChange={(css) => updateTag(i, { color: css })}
            />
          </div>

          {/* Initial field (who only) */}
          {tag.type === "who" && (
            <input
              value={tag.initial ?? tag.name[0].toUpperCase()}
              onChange={(e) => updateTag(i, { initial: e.target.value.slice(0, 2).toUpperCase() })}
              maxLength={2}
              style={{
                width: 32,
                textAlign: "center",
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.14)",
                borderRadius: 4,
                color: "#fff",
                fontSize: "0.78rem",
                fontWeight: 700,
                padding: "3px 0",
                fontFamily: "inherit",
                flexShrink: 0,
              }}
            />
          )}

          {/* Delete button */}
          <button
            onClick={() => deleteTag(i)}
            title={`Remove #${tag.name}`}
            style={{
              background: "none",
              border: "none",
              color: "rgba(255,255,255,0.3)",
              cursor: "pointer",
              fontSize: "0.9rem",
              padding: "0 2px",
              flexShrink: 0,
              fontFamily: "inherit",
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
