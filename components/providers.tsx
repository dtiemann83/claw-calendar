"use client"

import { ChakraProvider, createSystem, defaultConfig } from "@chakra-ui/react"

const system = createSystem(defaultConfig, {
  theme: {
    tokens: {
      colors: {
        brand: {
          50:  { value: "#e8f4fd" },
          500: { value: "#2a7ae2" },
          900: { value: "#0d2a52" },
        },
      },
    },
    semanticTokens: {
      colors: {
        "chakra-body-bg": { value: "transparent" },
      },
    },
  },
})

export function Providers({ children }: { children: React.ReactNode }) {
  return <ChakraProvider value={system}>{children}</ChakraProvider>
}
