// lib/connectors/types.ts
interface ConnectorBase {
  id: string
  name: string
  color: string
  iconRules?: Record<string, string>
}

export interface AgentApiConnector extends ConnectorBase {
  type: "agent-api"
  baseUrl: string
  calendarSlug: string
}

export interface IcalUrlConnector extends ConnectorBase {
  type: "ical-url"
  url: string
}

export interface LocalFileConnector extends ConnectorBase {
  type: "local-file"
  path: string
}

export interface CaldavConnector extends ConnectorBase {
  type: "caldav"
  /** Display name of the calendar in the iCloud account (e.g. "Family") */
  calendarName: string
}

export type ConnectorConfig =
  | AgentApiConnector
  | IcalUrlConnector
  | LocalFileConnector
  | CaldavConnector

export interface CalendarConfig {
  connectors: ConnectorConfig[]
  font?: string
}

/** Shape sent to the browser — no internal URLs or file paths */
export interface ConnectorMeta {
  id: string
  name: string
  color: string
  proxyUrl: string
  iconRules?: Record<string, string>
}
