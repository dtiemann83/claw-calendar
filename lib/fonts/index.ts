// Import all font CSS files (side effects — registers @font-face rules in the bundle)
import "@fontsource-variable/geist"
import "@fontsource/lato"
import "@fontsource-variable/noto-sans"
import "@fontsource-variable/nunito"
import "@fontsource/arvo"
import "@fontsource-variable/noto-serif"
export const fonts = {
  geist:        { family: "Geist Variable",      label: "Geist" },
  lato:         { family: "Lato",                label: "Lato" },
  "noto-sans":  { family: "Noto Sans Variable",  label: "Noto Sans" },
  nunito:       { family: "Nunito Variable",     label: "Nunito" },
  arvo:         { family: "Arvo",                label: "Arvo" },
  "noto-serif": { family: "Noto Serif Variable", label: "Noto Serif" },
} as const

export type FontId = keyof typeof fonts

