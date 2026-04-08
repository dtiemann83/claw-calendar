"use client"

import {
  DrawerBackdrop,
  DrawerBody,
  DrawerCloseTrigger,
  DrawerContent,
  DrawerHeader,
  DrawerPositioner,
  DrawerRoot,
  DrawerTitle,
} from "@chakra-ui/react"
import type { EventApi } from "@fullcalendar/core"
import type { CalendarTheme } from "@/themes/types"
import type { ConnectorMeta } from "@/lib/connectors/types"
import { resolveIcon } from "@/lib/icons"

interface Props {
  event: EventApi | null
  onClose: () => void
  theme: CalendarTheme
  connectors: ConnectorMeta[]
}

function formatDateTime(date: Date | null, allDay: boolean): string {
  if (!date) return ""
  if (allDay) {
    return date.toLocaleDateString([], {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    })
  }
  return date.toLocaleString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

export function EventDrawer({ event, onClose, theme, connectors }: Props) {
  const { calendar: c } = theme
  const CloseIcon = resolveIcon("close", theme)
  const connector = connectors.find((conn) => conn.id === event?.source?.id)

  return (
    <DrawerRoot
      open={event !== null}
      onOpenChange={({ open }) => { if (!open) onClose() }}
      placement="end"
      size="sm"
    >
      <DrawerBackdrop />
      <DrawerPositioner>
        <DrawerContent
          style={{
            background: c.drawerBg,
            backdropFilter: "blur(16px)",
            borderLeft: `1px solid ${c.drawerBorder}`,
            color: "#fff",
          }}
        >
          <DrawerHeader
            style={{
              borderBottom: `1px solid ${c.drawerBorder}`,
              paddingBottom: 16,
              position: "relative",
            }}
          >
            <DrawerTitle style={{ fontSize: "1.1rem", fontWeight: 600 }}>
              {event?.title ?? ""}
            </DrawerTitle>
            <DrawerCloseTrigger
              style={{
                position: "absolute",
                top: 12,
                right: 16,
                color: "rgba(255,255,255,0.6)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "transparent",
                border: "none",
                padding: 4,
                borderRadius: 4,
              }}
            >
              <CloseIcon size={18} />
            </DrawerCloseTrigger>
          </DrawerHeader>

          <DrawerBody style={{ paddingTop: 16 }}>
            {event && (
              <dl style={{ display: "grid", gap: "12px" }}>
                <Row
                  label="Calendar"
                  value={
                    <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span
                        style={{
                          display: "inline-block",
                          width: 12,
                          height: 12,
                          borderRadius: "50%",
                          background: connector?.color || event.backgroundColor || "#60a5fa",
                          flexShrink: 0,
                        }}
                      />
                      {connector?.name ?? event.source?.id ?? "Unknown"}
                    </span>
                  }
                />

                <Row label="Start" value={formatDateTime(event.start, event.allDay)} />

                {event.end && !event.allDay && (
                  <Row label="End" value={formatDateTime(event.end, false)} />
                )}

                {event.allDay && (
                  <Row label="Type" value="All day" />
                )}

                {event.url && (
                  <Row
                    label="Link"
                    value={
                      <a
                        href={event.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          color: "#93c5fd",
                          textDecoration: "underline",
                          wordBreak: "break-all",
                        }}
                      >
                        {event.url}
                      </a>
                    }
                  />
                )}
              </dl>
            )}
          </DrawerBody>
        </DrawerContent>
      </DrawerPositioner>
    </DrawerRoot>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "contents" }}>
      <dt
        style={{
          fontSize: "0.75rem",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          opacity: 0.5,
          marginBottom: 2,
        }}
      >
        {label}
      </dt>
      <dd style={{ margin: 0, fontSize: "0.9rem" }}>{value}</dd>
    </div>
  )
}
