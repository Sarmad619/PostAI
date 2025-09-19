export interface AgentLogEntry {
  step: string;
  message: string;
  timestamp: string;
}

export interface GenerateResponse {
  linkedin: string;
  x: string;
  log: AgentLogEntry[];
}
