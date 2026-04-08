import fs from "fs"
import path from "path"
import type { LocalFileConnector } from "../types"

export async function fetchIcal(config: LocalFileConnector): Promise<string> {
  const resolved = path.isAbsolute(config.path)
    ? config.path
    : path.join(process.cwd(), config.path)

  if (!fs.existsSync(resolved)) {
    throw new Error(
      `local-file connector "${config.id}": file not found at "${resolved}"`
    )
  }

  return fs.readFileSync(resolved, "utf-8")
}
