"use client"

import { useEffect, useState } from "react"
import type { CalendarTheme } from "@/themes/types"

interface Props {
  theme: CalendarTheme
}

export function ThemeBackground({ theme }: Props) {
  const hasImages = theme.backgrounds.length > 0
  const [current, setCurrent] = useState(0)
  const [next, setNext] = useState(1)
  const [transitioning, setTransitioning] = useState(false)

  useEffect(() => {
    if (!hasImages) return
    const interval = setInterval(() => {
      setTransitioning(true)
      setTimeout(() => {
        setCurrent((c) => (c + 1) % theme.backgrounds.length)
        setNext((n) => (n + 1) % theme.backgrounds.length)
        setTransitioning(false)
      }, 1500)
    }, theme.cycleIntervalMs)
    return () => clearInterval(interval)
  }, [theme, hasImages])

  const base: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    backgroundSize: "cover",
    backgroundPosition: "center",
    transition: "opacity 1.5s ease-in-out",
    zIndex: -1,
  }

  return (
    <>
      {/* Fallback — always present behind everything, visible when images are absent or loading */}
      <div
        style={{
          ...base,
          background: theme.fallbackBackground,
          zIndex: -3,
          transition: "none",
        }}
      />

      {hasImages && (
        <>
          {/* Current image — fades out during transition */}
          <div
            style={{
              ...base,
              backgroundImage: `url(${theme.backgrounds[current]})`,
              opacity: transitioning ? 0 : 1,
            }}
          />
          {/* Next image — always underneath, becomes visible as current fades */}
          <div
            style={{
              ...base,
              backgroundImage: `url(${theme.backgrounds[next]})`,
              opacity: 1,
              zIndex: -2,
            }}
          />
        </>
      )}
    </>
  )
}
