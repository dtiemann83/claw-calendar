// components/ThemeSettingsForm.tsx
"use client"

import {
  NativeSelectRoot,
  NativeSelectField,
  NativeSelectIndicator,
  SliderRoot,
  SliderControl,
  SliderTrack,
  SliderRange,
  SliderThumb,
} from "@chakra-ui/react"
import type { CalendarTheme, ThemeOverrides } from "@/themes/types"
import { fonts } from "@/lib/fonts"
import { ColorRow } from "./ColorRow"

interface Props {
  theme: CalendarTheme       // current merged theme (base + overrides)
  onOverrideChange: (patch: ThemeOverrides) => void
  onReset: () => void
}

function parseOverlayOpacity(overlay: string): number {
  // Extract alpha from "rgba(0,0,0,0.45)" → 45
  const match = overlay.match(/rgba?\([^)]+,\s*([\d.]+)\)/)
  if (!match) return 45
  return Math.round(parseFloat(match[1]) * 100)
}

const FONT_OPTIONS = Object.entries(fonts).map(([id, { label }]) => ({ id, label }))

type StringCalendarKey = { [K in keyof CalendarTheme["calendar"]]: CalendarTheme["calendar"][K] extends string ? K : never }[keyof CalendarTheme["calendar"]]

const COLOR_FIELDS: { key: StringCalendarKey; label: string }[] = [
  { key: "cellBg",             label: "Cell Background" },
  { key: "cellBorder",         label: "Cell Border" },
  { key: "textColor",          label: "Text Color" },
  { key: "todayBg",            label: "Today Highlight" },
  { key: "headerBg",           label: "Header Background" },
  { key: "eventBg",            label: "Event Color" },
  { key: "drawerBg",           label: "Drawer Background" },
  { key: "toolbarButtonBg",    label: "Toolbar Buttons" },
]

export function ThemeSettingsForm({ theme, onOverrideChange, onReset }: Props) {
  const overlayOpacity = parseOverlayOpacity(theme.backgroundOverlay)

  const handleFontChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onOverrideChange({ font: e.target.value })
  }

  const handleOverlayChange = (details: { value: number[] }) => {
    const alpha = (details.value[0] / 100).toFixed(2)
    onOverrideChange({ backgroundOverlay: `rgba(0,0,0,${alpha})` })
  }

  const handleAllDayOpacityChange = (details: { value: number[] }) => {
    onOverrideChange({ calendar: { allDayEventOpacity: details.value[0] / 100 } })
  }

  const handleColorChange = (key: keyof CalendarTheme["calendar"]) => (css: string) => {
    onOverrideChange({ calendar: { [key]: css } })
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Font */}
      <div>
        <div style={subsectionLabelStyle}>Font</div>
        <NativeSelectRoot size="sm">
          <NativeSelectField
            value={theme.font ?? "nunito"}
            onChange={handleFontChange}
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.14)",
              borderRadius: 6,
              color: "#fff",
              fontFamily: "inherit",
            }}
          >
            {FONT_OPTIONS.map(({ id, label }) => (
              <option key={id} value={id} style={{ background: "#1e293b" }}>
                {label}
              </option>
            ))}
          </NativeSelectField>
          <NativeSelectIndicator color="rgba(255,255,255,0.4)" />
        </NativeSelectRoot>
      </div>

      {/* Background Overlay */}
      <div>
        <div style={subsectionLabelStyle}>Background Overlay</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 22,
              height: 22,
              borderRadius: 4,
              border: "1px solid rgba(255,255,255,0.2)",
              flexShrink: 0,
              background: theme.backgroundOverlay,
            }}
          />
          <SliderRoot
            min={0}
            max={100}
            step={1}
            value={[overlayOpacity]}
            onValueChange={handleOverlayChange}
            style={{ flex: 1 }}
          >
            <SliderControl>
              <SliderTrack>
                <SliderRange />
              </SliderTrack>
              <SliderThumb index={0} />
            </SliderControl>
          </SliderRoot>
          <span style={{ fontSize: "0.72rem", opacity: 0.5, width: 32, textAlign: "right", flexShrink: 0 }}>
            {overlayOpacity}%
          </span>
        </div>
      </div>

      {/* All-Day Event Opacity */}
      <div>
        <div style={subsectionLabelStyle}>All-Day Event Opacity</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <SliderRoot
            min={0}
            max={100}
            step={1}
            value={[Math.round(theme.calendar.allDayEventOpacity * 100)]}
            onValueChange={handleAllDayOpacityChange}
            style={{ flex: 1 }}
          >
            <SliderControl>
              <SliderTrack>
                <SliderRange />
              </SliderTrack>
              <SliderThumb index={0} />
            </SliderControl>
          </SliderRoot>
          <span style={{ fontSize: "0.72rem", opacity: 0.5, width: 32, textAlign: "right", flexShrink: 0 }}>
            {Math.round(theme.calendar.allDayEventOpacity * 100)}%
          </span>
        </div>
      </div>

      {/* Calendar Colors */}
      <div>
        <div style={subsectionLabelStyle}>Calendar Colors</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {COLOR_FIELDS.map(({ key, label }) => (
            <ColorRow
              key={key}
              label={label}
              value={theme.calendar[key]}
              onChange={handleColorChange(key)}
            />
          ))}
        </div>
      </div>

      {/* Reset */}
      <div style={{ textAlign: "right" }}>
        <button
          onClick={onReset}
          style={{
            background: "none",
            border: "none",
            color: "rgba(255,255,255,0.35)",
            fontSize: "0.7rem",
            cursor: "pointer",
            textDecoration: "underline",
            textUnderlineOffset: 3,
            fontFamily: "inherit",
            padding: 0,
          }}
        >
          Reset to theme defaults
        </button>
      </div>

    </div>
  )
}

const subsectionLabelStyle: React.CSSProperties = {
  fontSize: "0.68rem",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  opacity: 0.35,
  marginBottom: 6,
}
