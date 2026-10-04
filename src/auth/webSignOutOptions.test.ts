import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { WEB_SIGNOUT_OPTIONS } from './webSignOutOptions.ts';

describe('WEB_SIGNOUT_OPTIONS', () => {
  it('uses local scope so other devices stay signed in', () => {
    assert.deepEqual(WEB_SIGNOUT_OPTIONS, { scope: 'local' });
    assert.notEqual(WEB_SIGNOUT_OPTIONS.scope, 'global');
  });
});
