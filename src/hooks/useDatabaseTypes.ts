import type { WebFoundationBootstrap } from '../platform/webFoundation';

export interface UseDatabaseResult {
  isReady: boolean;
  error: Error | null;
  isInitializing: boolean;
  retryDatabase: () => Promise<void>;
  /**
   * P2.0 web-only. When set, root layout shows the foundation shell and must
   * not mount SQLite-backed screens. Native never sets this field.
   */
  webFoundation?: WebFoundationBootstrap;
}
