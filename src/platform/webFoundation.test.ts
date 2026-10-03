import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createWebFoundationBootstrap,
  isWebFoundationBootstrap,
  WEB_FOUNDATION_PHASE,
} from './webFoundation.ts';

describe('webFoundation bootstrap', () => {
  it('creates a non-SQLite pending-cloud bootstrap', () => {
    const boot = createWebFoundationBootstrap();
    assert.equal(boot.kind, 'web_foundation_pending_cloud');
    assert.equal(boot.phase, WEB_FOUNDATION_PHASE);
    assert.equal(boot.dataReady, false);
    assert.equal(boot.usesBrowserSqlite, false);
    assert.equal(isWebFoundationBootstrap(boot), true);
  });

  it('rejects unrelated objects', () => {
    assert.equal(isWebFoundationBootstrap(null), false);
    assert.equal(isWebFoundationBootstrap({ kind: 'native_sqlite' }), false);
    assert.equal(
      isWebFoundationBootstrap({
        kind: 'web_foundation_pending_cloud',
        phase: WEB_FOUNDATION_PHASE,
        dataReady: true,
        usesBrowserSqlite: false,
      }),
      false,
    );
  });
});
