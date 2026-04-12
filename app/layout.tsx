import type { Metadata } from "next"
import type { CSSProperties } from "react"
import "./globals.css"
import { fonts } from "@/lib/fonts"
import { getActiveFont } from "@/lib/fonts/server"
import { Providers } from "@/components/providers"

export const metadata: Metadata = {
  title: "Claw Calendar",
  description: "Full-screen family calendar",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const fontFamily = fonts[getActiveFont()].family

  return (
    <html lang="en" style={{ "--font-family": fontFamily } as CSSProperties}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
