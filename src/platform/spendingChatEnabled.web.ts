/**
 * AI Spending Chat is intentionally unsupported on Web/PWA.
 * P2.4 (cloud/Edge turn) is cancelled — native P1.8A remains SQLite-only.
 */
export const SPENDING_CHAT_ENABLED: boolean = false;

/** Safe landing for manual /spending-chat navigation on Web. */
export const SPENDING_CHAT_WEB_REDIRECT_HREF = '/reports' as const;
