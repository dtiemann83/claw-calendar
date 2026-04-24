import type { ConnectorConfig } from "./types"
import { fetchIcal as fetchAgentApi } from "./providers/agent-api"
import { fetchIcal as fetchIcalUrl } from "./providers/ical-url"
import { fetchIcal as fetchLocalFile } from "./providers/local-file"
import { fetchIcal as fetchCaldav } from "./providers/caldav"

export async function dispatchFetchIcal(config: ConnectorConfig): Promise<string> {
  switch (config.type) {
    case "agent-api":
      return fetchAgentApi(config)
    case "ical-url":
      return fetchIcalUrl(config)
    case "local-file":
      return fetchLocalFile(config)
    case "caldav":
      return fetchCaldav(config)
    default: {
      // Exhaustiveness check — compile error if a new type is added without a case
      const _exhaustive: never = config
      throw new Error(`Unknown connector type: ${(_exhaustive as ConnectorConfig).type}`)
    }
  }
}
