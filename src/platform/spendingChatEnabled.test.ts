import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  SPENDING_CHAT_ENABLED as nativeEnabled,
  SPENDING_CHAT_WEB_REDIRECT_HREF as nativeRedirect,
} from './spendingChatEnabled.ts';
import {
  SPENDING_CHAT_ENABLED as webEnabled,
  SPENDING_CHAT_WEB_REDIRECT_HREF as webRedirect,
} from './spendingChatEnabled.web.ts';

const here = dirname(fileURLToPath(import.meta.url));

describe('spendingChatEnabled platform flags', () => {
  it('keeps AI Spending Chat available on native', () => {
    assert.equal(nativeEnabled, true);
  });

  it('disables AI Spending Chat on Web/PWA', () => {
    assert.equal(webEnabled, false);
  });

  it('redirects direct Web /spending-chat to Reports (no deferred AI screen)', () => {
    assert.equal(webRedirect, '/reports');
    assert.equal(nativeRedirect, '/reports');
    const webRoute = readFileSync(join(here, '../app/spending-chat.web.tsx'), 'utf8');
    assert.match(webRoute, /Redirect/);
    assert.match(webRoute, /SPENDING_CHAT_WEB_REDIRECT_HREF/);
    assert.doesNotMatch(webRoute, /WebDeferredFeature|runSpendingChatTurn|aiChatRepository/);
  });

  it('gates Reports AI Chat CTA behind the platform flag', () => {
    const reports = readFileSync(join(here, '../app/(tabs)/reports.tsx'), 'utf8');
    assert.match(reports, /SPENDING_CHAT_ENABLED/);
    assert.match(reports, /Hỏi AI về chi tiêu/);
    assert.match(reports, /SPENDING_CHAT_ENABLED \? \(/);
  });
});
