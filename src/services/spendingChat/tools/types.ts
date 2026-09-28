import type { SpendingChatToolName } from './allowlist';

export interface ToolResult {
  tool: SpendingChatToolName;
  ok: boolean;
  data?: unknown;
  error?: string;
}
