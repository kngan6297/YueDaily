import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  runSpendingChatTurn,
  spendingChatOrchestratorTestUtils,
} from './orchestrator.ts';
import { buildPresetToolPlan, findPresetById } from './presets.ts';
import type { ToolResult } from './tools/types.ts';

describe('spending chat orchestrator', () => {
  it('rejects invalid tools and caps calls', () => {
    const bad = spendingChatOrchestratorTestUtils.validateToolCalls([
      { name: 'deleteTransaction', args: {} },
    ]);
    assert.equal(bad.ok, false);

    const tooMany = spendingChatOrchestratorTestUtils.validateToolCalls(
      Array.from(
        { length: spendingChatOrchestratorTestUtils.MAX_TOOL_CALLS_PER_TURN + 1 },
        () => ({ name: 'getPeriodSummary', args: { year: 2026, month: 9 } }),
      ),
    );
    assert.equal(tooMany.ok, false);
  });

  it('preset skips planner and maps tools', () => {
    const preset = findPresetById('summary');
    assert.ok(preset);
    const plan = buildPresetToolPlan('summary', 2026, 9);
    assert.ok(plan);
    assert.equal(plan!.some((c) => c.name === 'getPeriodSummary'), true);
    assert.equal(plan!.some((c) => c.name === 'getBreakdown'), true);

    const woori = buildPresetToolPlan('woori_cycle', 2026, 9);
    assert.deepEqual(woori?.[0]?.args?.mode, 'budget_cycle');

    const vp = buildPresetToolPlan('vpbank', 2026, 9);
    assert.equal(vp?.[0]?.name, 'getTrackedSourceBalance');

    const vs = buildPresetToolPlan('vs_prev', 2026, 9);
    assert.equal(vs?.[0]?.name, 'comparePeriods');
  });

  it('filters evidence IDs to tool-returned set', () => {
    const allowed = new Set([1, 2, 3]);
    assert.deepEqual(
      spendingChatOrchestratorTestUtils.filterEvidenceIds([1, 99, 2], allowed),
      [1, 2],
    );
  });

  it('collects evidence only from tool payloads', () => {
    const results: ToolResult[] = [
      {
        tool: 'getLargestTransactions',
        ok: true,
        data: { transactions: [{ id: 7 }, { id: 8 }] },
      },
    ];
    const ids = spendingChatOrchestratorTestUtils.collectEvidenceIds(results);
    assert.equal(ids.has(7), true);
    assert.equal(ids.has(8), true);
  });

  it('blocks write-like mutation requests as read-only', async () => {
    const result = await runSpendingChatTurn({
      question: 'Đổi khoản này sang Gia đình',
      year: 2026,
      month: 9,
      context: {},
      runText: async () => {
        throw new Error('AI should not be called for write block');
      },
    });
    assert.equal(result.kind, 'readonly_blocked');
    assert.match(result.answer, /chỉ đọc|read-only|P1\.8A/i);
  });

  it('preset path skips planner AI call', async () => {
    let calls = 0;
    const result = await runSpendingChatTurn({
      question: findPresetById('summary')!.body,
      year: 2026,
      month: 9,
      context: {},
      presetId: 'summary',
      executeTools: async (toolCalls) =>
        toolCalls.map((c) => ({
          tool: c.name,
          ok: true,
          data: {
            totalChi: 1000,
            transactionCount: 1,
            rows: [{ name: 'Mua sắm', amount: 1000 }],
            transactions: [{ id: 5, amount: 1000 }],
          },
        })),
      runText: async () => {
        calls += 1;
        return {
          text: JSON.stringify({
            answer: 'Tóm tắt ok',
            evidenceTransactionIds: [5],
            followUps: ['So với tháng trước'],
          }),
          provider: 'groq',
          model: 'test',
          aiMs: 1,
          fallbackUsed: false,
        };
      },
    });
    assert.equal(result.skippedPlanner, true);
    assert.equal(calls, 1);
    assert.equal(result.kind, 'answer');
    assert.deepEqual(result.evidenceTransactionIds, [5]);
  });

  it('clarification path when planner asks', async () => {
    const result = await runSpendingChatTurn({
      question: 'tiền của mình',
      year: 2026,
      month: 9,
      context: {},
      executeTools: async () => [],
      runText: async () => ({
        text: JSON.stringify({
          action: 'clarify',
          clarificationQuestion:
            'Bạn muốn theo người hưởng (Yue) hay nguồn tiền cá nhân?',
          toolCalls: [],
        }),
        provider: 'groq',
        model: 'test',
        aiMs: 1,
        fallbackUsed: false,
      }),
    });
    assert.equal(result.kind, 'clarify');
    assert.match(result.answer, /người hưởng|nguồn/);
  });

  it('context exclusions survive follow-up merge intent', async () => {
    const result = await runSpendingChatTurn({
      question: 'Bỏ khoản này ra thì sao?',
      year: 2026,
      month: 9,
      context: {
        lastReferencedTransactionIds: [42],
        excludedTransactionIds: [10],
      },
      executeTools: async (calls) =>
        calls.map((c) => ({
          tool: c.name,
          ok: true,
          data: { totalChi: 500, transactionCount: 1 },
        })),
      runText: async () => ({
        text: JSON.stringify({
          answer: 'Đã loại khoản 42 khỏi phân tích.',
          evidenceTransactionIds: [],
          followUps: [],
        }),
        provider: 'groq',
        model: 'test',
        aiMs: 1,
        fallbackUsed: false,
      }),
    });
    assert.equal(result.kind, 'answer');
    assert.ok(result.context.excludedTransactionIds?.includes(42));
    assert.ok(result.context.excludedTransactionIds?.includes(10));
  });

  it('rejects evidence IDs not returned by tools', async () => {
    const result = await runSpendingChatTurn({
      question: findPresetById('largest_txs')!.body,
      year: 2026,
      month: 9,
      context: {},
      presetId: 'largest_txs',
      executeTools: async () => [
        {
          tool: 'getLargestTransactions',
          ok: true,
          data: { transactions: [{ id: 1 }, { id: 2 }] },
        },
      ],
      runText: async () => ({
        text: JSON.stringify({
          answer: 'Top ok',
          evidenceTransactionIds: [1, 999],
          followUps: [],
        }),
        provider: 'groq',
        model: 'test',
        aiMs: 1,
        fallbackUsed: false,
      }),
    });
    assert.deepEqual(result.evidenceTransactionIds, [1]);
  });
});
