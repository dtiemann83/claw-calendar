import { spawnSync } from "node:child_process"

const KEYCHAIN_SERVICE = "iCloud CalDAV"

export interface Credentials {
  appleId: string
  password: string
}

export function getCredentials(): Credentials {
  const envUser = process.env.ICLOUD_APPLE_ID
  const envPass = process.env.ICLOUD_APP_PASSWORD
  if (envUser && envPass) return { appleId: envUser, password: envPass }

  const result = spawnSync("security", ["find-generic-password", "-s", KEYCHAIN_SERVICE, "-g"], {
    encoding: "utf-8",
  })
  const combined = (result.stdout ?? "") + (result.stderr ?? "")
  const acctMatch = combined.match(/"acct"<blob>="([^"]+)"/)
  const passMatch = combined.match(/password: "((?:[^"\\]|\\.)*)"/)

  if (result.status !== 0 || !acctMatch || !passMatch) {
    throw new Error(
      `iCloud CalDAV credentials not found. Run \`claw-cal setup\`, or set ICLOUD_APPLE_ID and ICLOUD_APP_PASSWORD env vars.`
    )
  }

  return {
    appleId: acctMatch[1],
    password: passMatch[1].replace(/\\(.)/g, "$1"),
  }
}

export function stashCredentials(appleId: string, password: string): void {
  const result = spawnSync(
    "security",
    ["add-generic-password", "-U", "-s", KEYCHAIN_SERVICE, "-a", appleId, "-w", password],
    { encoding: "utf-8" }
  )
  if (result.status !== 0) {
    throw new Error(`security add-generic-password failed: ${result.stderr}`)
  }
}
