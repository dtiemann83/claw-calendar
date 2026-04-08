"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { CalendarTheme } from "@/themes/types"

interface Props {
  theme: CalendarTheme
}

export function ThemeBackground({ theme }: Props) {
  const { backgrounds, cycleIntervalMs, fallbackBackground, backgroundOverlay } = theme
  const n = backgrounds.length
  const hasImages = n > 0

  // Deterministic index: which "slot" is the current time in?
  const getSlot = useCallback(
    () => Math.floor(Date.now() / cycleIntervalMs) % Math.max(n, 1),
    [cycleIntervalMs, n]
  )

  const [photoIndex, setPhotoIndex] = useState(getSlot)
  const [transitioning, setTransitioning] = useState(false)
  const crossfadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Re-sync index when interval length or photo count changes
  useEffect(() => {
    setPhotoIndex(getSlot())
  }, [getSlot])

  // Schedule a crossfade at the exact moment the next slot begins
  useEffect(() => {
    if (!hasImages || n <= 1) return

    const now = Date.now()
    const currentSlot = Math.floor(now / cycleIntervalMs)
    const nextBoundary = (currentSlot + 1) * cycleIntervalMs
    const delay = nextBoundary - now

    const outerTimer = setTimeout(() => {
      setTransitioning(true)
      crossfadeTimer.current = setTimeout(() => {
        setPhotoIndex(Math.floor(Date.now() / cycleIntervalMs) % n)
        setTransitioning(false)
        crossfadeTimer.current = null
      }, 1500)
    }, delay)

    return () => {
      clearTimeout(outerTimer)
      if (crossfadeTimer.current) {
        clearTimeout(crossfadeTimer.current)
        crossfadeTimer.current = null
      }
    }
  }, [cycleIntervalMs, n, photoIndex, hasImages])

  const nextIndex = (photoIndex + 1) % Math.max(n, 1)

  const base: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    backgroundSize: "cover",
    backgroundPosition: "center",
    transition: "opacity 1.5s ease-in-out",
    zIndex: -2,
  }

  return (
    <>
      {/* Fallback gradient — visible before images load or when no images are set */}
      <div style={{ ...base, background: fallbackBackground, zIndex: -4, transition: "none" }} />

      {hasImages && (
        <>
          {/* Current photo — fades out during transition */}
          <div
            style={{
              ...base,
              backgroundImage: `url(${backgrounds[photoIndex]})`,
              opacity: transitioning ? 0 : 1,
            }}
          />
          {/* Next photo — revealed as current fades */}
          <div
            style={{
              ...base,
              backgroundImage: `url(${backgrounds[nextIndex]})`,
              opacity: 1,
              zIndex: -3,
            }}
          />
        </>
      )}

      {/* Overlay — improves text legibility over bright photos */}
      {backgroundOverlay && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: backgroundOverlay,
            zIndex: -1,
            transition: "none",
          }}
        />
      )}
    </>
  )
}
