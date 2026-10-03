// ============================================================
// Web Compatibility Foundation bootstrap marker
// P2.1 adds Auth; production finance data still waits for P2.2 cloud repos.
// Do NOT treat browser-local SQLite as the web system of record.
// ============================================================

export const WEB_FOUNDATION_PHASE = 'P2.1' as const;

export const WEB_FOUNDATION_TITLE = 'YueDaily Web Foundation';

export const WEB_FOUNDATION_HEADLINE =
  'Đăng nhập riêng tư (P2.1). Màn hình chi tiêu Web sẽ đến ở P2.2.';

export const WEB_FOUNDATION_BODY =
  'Android vẫn dùng SQLite local-first. Web production dùng Supabase Auth + dữ liệu riêng từng người (không phải SQLite trình duyệt).';

export const WEB_FOUNDATION_NEXT_STEPS = [
  'P2.2 — Core Web expense UI trên cloud',
  'P2.3 — Web receipt scan + Edge AI proxy',
  'P2.4 — AI Spending Chat (Edge turn)',
  'P2.5 — Android → cloud migration / backup hardening',
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
