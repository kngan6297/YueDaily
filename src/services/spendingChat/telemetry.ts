/** __DEV__ only spending-chat telemetry — never log keys, chat content, or tx payloads. */

import { aiDevLog } from '../ai/devLog';

export function spendingChatDevLog(
  stage: string,
  payload: Record<string, unknown> = {},
): void {
  aiDevLog('SpendingChat', stage, payload);
}
