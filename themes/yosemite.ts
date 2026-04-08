import type { CalendarTheme } from "./types"

export const yosemiteTheme: CalendarTheme = {
  name: "yosemite",
  backgrounds: [
    "https://commons.wikimedia.org/wiki/Special:FilePath/Tunnel_View,_Yosemite_Valley,_Yosemite_NP_-_Diliff.jpg",
    "https://commons.wikimedia.org/wiki/Special:FilePath/Half_Dome_from_Glacier_Point,_Yosemite_NP_-_Diliff.jpg",
    "https://commons.wikimedia.org/wiki/Special:FilePath/Yosemite_Falls_from_trail,_Yosemite_NP,_CA,_US_-_Diliff.jpg",
    "https://commons.wikimedia.org/wiki/Special:FilePath/Cathedral_Peak_and_Lake_in_Yosemite.jpg",
  ],
  cycleIntervalMs: 30000,
  calendar: {
    cellBg: "transparent",
    cellBorder: "rgba(255, 255, 255, 0.2)",
    textColor: "#ffffff",
    todayBg: "rgba(255, 255, 255, 0.15)",
    headerBg: "rgba(0, 0, 0, 0.35)",
    eventBg: "rgba(30, 100, 200, 0.85)",
    eventBorder: "rgba(100, 160, 255, 0.9)",
  },
}
