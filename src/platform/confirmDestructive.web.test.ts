import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  answerConfirmDestructive,
  confirmDestructive,
  getPendingConfirmDestructive,
} from './confirmDestructive.web.ts';

describe('confirmDestructive.web', () => {
  beforeEach(() => {
    const pending = getPendingConfirmDestructive();
    if (pending) answerConfirmDestructive(false);
  });

  it('starts with no pending confirmation', () => {
    assert.equal(getPendingConfirmDestructive(), null);
  });

  it('request opens pending confirmation', async () => {
    const promise = confirmDestructive({
      title: 'Xoá giao dịch?',
      message: 'Giao dịch này sẽ bị xoá vĩnh viễn.',
    });
    const pending = getPendingConfirmDestructive();
    assert.ok(pending);
    assert.equal(pending?.title, 'Xoá giao dịch?');
    assert.equal(pending?.confirmLabel, 'Xoá');
    answerConfirmDestructive(false);
    assert.equal(await promise, false);
    assert.equal(getPendingConfirmDestructive(), null);
  });

  it('cancel does not confirm', async () => {
    const promise = confirmDestructive({
      title: 'Xoá?',
      message: 'msg',
    });
    answerConfirmDestructive(false);
    assert.equal(await promise, false);
  });

  it('confirm resolves true once', async () => {
    let deletes = 0;
    const promise = confirmDestructive({
      title: 'Xoá?',
      message: 'msg',
    }).then((ok) => {
      if (ok) deletes += 1;
      return ok;
    });
    answerConfirmDestructive(true);
    assert.equal(await promise, true);
    assert.equal(deletes, 1);
    assert.equal(getPendingConfirmDestructive(), null);
  });
});
