// ============================================================
// Web: AI Spending Chat is not a product feature (P2.4 cancelled).
// Keep this platform file so Expo Router never falls back to native
// spending-chat.tsx (which would load SQLite + AI orchestration).
// ============================================================

import { Redirect } from 'expo-router';
import { SPENDING_CHAT_WEB_REDIRECT_HREF } from '../platform/spendingChatEnabled';

export default function SpendingChatWebRedirect() {
  return <Redirect href={SPENDING_CHAT_WEB_REDIRECT_HREF} />;
}
