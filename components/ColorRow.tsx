"use client"

import {
  ColorPickerRoot,
  ColorPickerControl,
  ColorPickerTrigger,
  ColorPickerPositioner,
  ColorPickerContent,
  ColorPickerArea,
  ColorPickerAreaBackground,
  ColorPickerAreaThumb,
  ColorPickerChannelSlider,
  ColorPickerChannelSliderTrack,
  ColorPickerChannelSliderThumb,
  ColorPickerTransparencyGrid,
  ColorPickerInput,
  parseColor,
} from "@chakra-ui/react"

interface Props {
  label: string
  value: string      // CSS color string, e.g. "rgba(59, 130, 246, 0.85)"
  onChange: (css: string) => void
}

function safeParse(css: string) {
  try {
    return parseColor(css)
  } catch {
    return parseColor("rgba(255,255,255,1)")
  }
}

export function ColorRow({ label, value, onChange }: Props) {
  const parsed = safeParse(value)

  return (
    <ColorPickerRoot
      value={parsed}
      onValueChange={(details) => onChange(details.value.toString("css"))}
      format="rgba"
    >
      <ColorPickerControl>
        <ColorPickerTrigger
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            width: "100%",
            padding: "6px 9px",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.05)",
            borderRadius: 6,
            cursor: "pointer",
            color: "#fff",
            fontFamily: "inherit",
            transition: "background 0.15s",
          }}
          _hover={{ background: "rgba(255,255,255,0.08)" }}
        >
          <div
            style={{
              width: 18,
              height: 18,
              borderRadius: 3,
              border: "1px solid rgba(255,255,255,0.2)",
              flexShrink: 0,
              background: value,
            }}
          />
          <span style={{ fontSize: "0.72rem", opacity: 0.7, flex: 1, textAlign: "left" }}>
            {label}
          </span>
          <span style={{ fontSize: "0.65rem", opacity: 0.25 }}>✎</span>
        </ColorPickerTrigger>
      </ColorPickerControl>

      <ColorPickerPositioner>
        <ColorPickerContent
          style={{
            background: "#1e293b",
            border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: 10,
            padding: 14,
            display: "flex",
            flexDirection: "column",
            gap: 10,
            width: 220,
          }}
        >
          <ColorPickerArea style={{ borderRadius: 6, overflow: "hidden", height: 100 }}>
            <ColorPickerAreaBackground />
            <ColorPickerAreaThumb />
          </ColorPickerArea>

          <ColorPickerChannelSlider channel="hue">
            <ColorPickerChannelSliderTrack style={{ borderRadius: 4, height: 10 }} />
            <ColorPickerChannelSliderThumb />
          </ColorPickerChannelSlider>

          <ColorPickerChannelSlider channel="alpha">
            <ColorPickerTransparencyGrid />
            <ColorPickerChannelSliderTrack style={{ borderRadius: 4, height: 10 }} />
            <ColorPickerChannelSliderThumb />
          </ColorPickerChannelSlider>

          <ColorPickerInput
            style={{
              width: "100%",
              background: "rgba(255,255,255,0.07)",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: 5,
              color: "#fff",
              fontSize: "0.72rem",
              padding: "5px 8px",
              fontFamily: "monospace",
            }}
          />
        </ColorPickerContent>
      </ColorPickerPositioner>
    </ColorPickerRoot>
  )
}
