interface ConnectorBase {
  id: string
  name: string
  color: string
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

export type ConnectorConfig =
  | AgentApiConnector
  | IcalUrlConnector
  | LocalFileConnector

export interface CalendarConfig {
  connectors: ConnectorConfig[]
}

/** Shape sent to the browser — no internal URLs or file paths */
export interface ConnectorMeta {
  id: string
  name: string
  color: string
  proxyUrl: string
}
