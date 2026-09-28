// ============================================================
// P1.8A — Default preset prompts (code constants, not DB-seeded)
// ============================================================

import type { ToolCallRequest } from './tools/allowlist';
import { previousMonth } from './tools/pureHelpers';

export interface SpendingChatPreset {
  id: string;
  title: string;
  /** Explicit wording sent as the user question */
  body: string;
}

export const SPENDING_CHAT_PRESETS: readonly SpendingChatPreset[] = [
  {
    id: 'summary',
    title: 'Tóm tắt tháng này',
    body: 'Tóm tắt chi tiêu tháng này (calendar 01→cuối tháng): tổng chi, danh mục và nguồn chính.',
  },
  {
    id: 'top_category',
    title: 'Tiêu nhiều nhất ở đâu?',
    body: 'Tháng này mình tiêu gì nhiều nhất theo danh mục? Dùng breakdown danh mục lịch tháng.',
  },
  {
    id: 'largest_txs',
    title: 'Top giao dịch lớn nhất',
    body: 'Liệt kê các giao dịch chi lớn nhất trong tháng này (đủ cả tháng, không cắt LIMIT báo cáo).',
  },
  {
    id: 'vs_prev',
    title: 'So với tháng trước',
    body: 'So sánh tổng chi tháng này với tháng trước (cùng bộ lọc hiện tại).',
  },
  {
    id: 'yue_only',
    title: 'Chi cho riêng Yue',
    body: 'Riêng mình thôi — chỉ các khoản expense_audience = Yue (wife) trong tháng này.',
  },
  {
    id: 'couple',
    title: 'Chi chung Yue + Kai',
    body: 'Chi chung Yue + Kai (expense_audience = couple) trong tháng này thế nào?',
  },
  {
    id: 'woori_cycle',
    title: 'Woori quỹ ăn kỳ này',
    body: 'Woori quỹ ăn kỳ này còn bao nhiêu? Dùng kỳ ngân sách payday 05→04 (budget_cycle), không nhầm với lịch tháng.',
  },
  {
    id: 'vpbank',
    title: 'VPBank tháng này',
    body: 'VPBank tháng này thế nào? Số dư đầu kỳ / thu / chi / số dư hiện tại (calendar month). Nếu chưa nhập số dư đầu kỳ thì nói rõ.',
  },
  {
    id: 'food_drink',
    title: 'Ăn uống + Trà & Cà phê',
    body: 'Trong tháng này, chi Ăn uống và Trà & Cà phê gồm những gì / bao nhiêu?',
  },
  {
    id: 'unusual',
    title: 'Có khoản nào bất thường?',
    body: 'Có khoản nào đáng chú ý trong tháng này không? Chỉ dựa trên facts heuristic (so tháng trước, so trung bình, top lớn) — không bịa anomaly.',
  },
] as const;

export function findPresetById(id: string): SpendingChatPreset | undefined {
  return SPENDING_CHAT_PRESETS.find((p) => p.id === id);
}

export function findPresetByBody(body: string): SpendingChatPreset | undefined {
  const trimmed = body.trim();
  return SPENDING_CHAT_PRESETS.find((p) => p.body === trimmed || p.title === trimmed);
}

/** Deterministic tool plan for known presets — skips planner AI call. */
export function buildPresetToolPlan(
  presetId: string,
  year: number,
  month: number,
): ToolCallRequest[] | null {
  const prev = previousMonth(year, month);
  switch (presetId) {
    case 'summary':
      return [
        { name: 'getPeriodSummary', args: { year, month } },
        { name: 'getBreakdown', args: { year, month, dimension: 'category' } },
        { name: 'getBreakdown', args: { year, month, dimension: 'source' } },
      ];
    case 'top_category':
      return [{ name: 'getBreakdown', args: { year, month, dimension: 'category' } }];
    case 'largest_txs':
      return [{ name: 'getLargestTransactions', args: { year, month, limit: 10 } }];
    case 'vs_prev':
      return [
        {
          name: 'comparePeriods',
          args: {
            primaryYear: year,
            primaryMonth: month,
            comparisonYear: prev.year,
            comparisonMonth: prev.month,
          },
        },
      ];
    case 'yue_only':
      return [
        {
          name: 'getPeriodSummary',
          args: { year, month, filters: { audience: 'wife' } },
        },
        {
          name: 'getBreakdown',
          args: { year, month, dimension: 'category', filters: { audience: 'wife' } },
        },
      ];
    case 'couple':
      return [
        {
          name: 'getPeriodSummary',
          args: { year, month, filters: { audience: 'couple' } },
        },
        {
          name: 'getBreakdown',
          args: {
            year,
            month,
            dimension: 'category',
            filters: { audience: 'couple' },
          },
        },
      ];
    case 'woori_cycle':
      return [{ name: 'getWooriBudget', args: { mode: 'budget_cycle', year, month } }];
    case 'vpbank':
      return [{ name: 'getTrackedSourceBalance', args: { year, month } }];
    case 'food_drink':
      return [
        {
          name: 'getPeriodSummary',
          args: {
            year,
            month,
            filters: { categoryNames: ['Ăn uống', 'Trà & Cà phê'] },
          },
        },
        {
          name: 'getTransactions',
          args: {
            year,
            month,
            filters: { categoryNames: ['Ăn uống', 'Trà & Cà phê'] },
            limit: 40,
          },
        },
      ];
    case 'unusual':
      return [{ name: 'getUnusualSpendingFacts', args: { year, month } }];
    default:
      return null;
  }
}
