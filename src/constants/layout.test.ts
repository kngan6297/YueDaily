import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DAY_SHEET_MAX_HEIGHT_RATIO,
  DAY_SHEET_MIN_LIST_HEIGHT,
  daySheetListMaxHeight,
} from './layout.ts';

describe('daySheetListMaxHeight', () => {
  it('caps list so header + list + footer fit in 85% viewport', () => {
    const windowHeight = 800;
    const chrome = 220;
    const inset = 48;
    const topPad = 12;
    const list = daySheetListMaxHeight(windowHeight, chrome, inset, topPad);
    assert.equal(list, Math.round(800 * 0.85 - 12 - 48 - 220));
    assert.ok(topPad + chrome + list + inset <= windowHeight * DAY_SHEET_MAX_HEIGHT_RATIO + 0.5);
  });

  it('never shrinks below min list height', () => {
    assert.equal(daySheetListMaxHeight(400, 400, 80), DAY_SHEET_MIN_LIST_HEIGHT);
  });
});
