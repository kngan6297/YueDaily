// ============================================================
// P2.0 — Web Compatibility Foundation (temporary bootstrap)
// Production web data remains P2.1+ (Supabase Auth + per-user RLS).
// Do NOT treat browser-local SQLite as the web system of record.
// ============================================================

export const WEB_FOUNDATION_PHASE = 'P2.0' as const;

export const WEB_FOUNDATION_TITLE = 'YueDaily Web Foundation';

export const WEB_FOUNDATION_HEADLINE =
  'Bản Web đang được chuẩn bị — dữ liệu tài khoản sẽ đến ở P2.1/P2.2.';

export const WEB_FOUNDATION_BODY =
  'Android vẫn dùng SQLite local-first. Web production sẽ dùng Supabase Auth và dữ liệu riêng từng người (không phải SQLite trình duyệt).';

export const WEB_FOUNDATION_NEXT_STEPS = [
  'P2.1 — Supabase Auth + per-user data / RLS',
  'P2.2 — Core Web expense UI trên cloud',
  'P2.3 — Web receipt scan + Edge AI proxy',
  'P2.4 — AI Spending Chat (Edge turn)',
] as const;

/** Explicit bootstrap kind so web never silently becomes a browser finance DB. */
export type WebDataBootstrapKind = 'web_foundation_pending_cloud';

export interface WebFoundationBootstrap {
  kind: WebDataBootstrapKind;
  phase: typeof WEB_FOUNDATION_PHASE;
  dataReady: false;
  usesBrowserSqlite: false;
}

export function createWebFoundationBootstrap(): WebFoundationBootstrap {
  return {
    kind: 'web_foundation_pending_cloud',
    phase: WEB_FOUNDATION_PHASE,
    dataReady: false,
    usesBrowserSqlite: false,
  };
}

export function isWebFoundationBootstrap(
  value: unknown,
): value is WebFoundationBootstrap {
  if (value == null || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    v.kind === 'web_foundation_pending_cloud' &&
    v.phase === WEB_FOUNDATION_PHASE &&
    v.dataReady === false &&
    v.usesBrowserSqlite === false
  );
}
