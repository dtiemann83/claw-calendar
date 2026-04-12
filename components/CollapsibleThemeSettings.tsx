"use client"

import {
  CollapsibleRoot,
  CollapsibleTrigger,
  CollapsibleContent,
  CollapsibleIndicator,
} from "@chakra-ui/react"
import { ChevronDown } from "lucide-react"
import type { CalendarTheme, ThemeOverrides } from "@/themes/types"
import { ThemeSettingsForm } from "./ThemeSettingsForm"
import { ThemeSettingsPreview } from "./ThemeSettingsPreview"

interface Props {
  theme: CalendarTheme
  overrides: ThemeOverrides
  onOverrideChange: (patch: ThemeOverrides) => void
  onReset: () => void
  drawerBorder: string
}

export function CollapsibleThemeSettings({
  theme,
  overrides,
  onOverrideChange,
  onReset,
  drawerBorder,
}: Props) {
  return (
    <div style={{ marginBottom: 24 }}>
      <CollapsibleRoot>
        <CollapsibleTrigger
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
            padding: "11px 14px",
            background: "rgba(255,255,255,0.04)",
            border: `1px solid ${drawerBorder}`,
            borderRadius: 8,
            color: "#fff",
            fontFamily: "inherit",
            fontSize: "0.82rem",
            fontWeight: 500,
            cursor: "pointer",
            transition: "background 0.15s",
          }}
          _open={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}
          _hover={{ background: "rgba(255,255,255,0.07)" }}
        >
          Theme Settings
          <CollapsibleIndicator>
            <ChevronDown size={12} color="rgba(255,255,255,0.4)" />
          </CollapsibleIndicator>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 0,
              border: `1px solid ${drawerBorder}`,
              borderTop: "none",
              borderBottomLeftRadius: 8,
              borderBottomRightRadius: 8,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: 16,
                borderRight: `1px solid ${drawerBorder}`,
              }}
            >
              <ThemeSettingsForm
                theme={theme}
                overrides={overrides}
                onOverrideChange={onOverrideChange}
                onReset={onReset}
              />
            </div>
            <div style={{ padding: 16 }}>
              <ThemeSettingsPreview theme={theme} />
            </div>
          </div>
        </CollapsibleContent>
      </CollapsibleRoot>
    </div>
  )
}
