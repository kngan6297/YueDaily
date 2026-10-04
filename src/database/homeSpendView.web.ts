// ============================================================
// P2.2 — Web Home spend-view labels (neutral multi-account copy)
// ============================================================

import type { HomeSpendView } from './homeSpendViewShared';

export type { HomeSpendView };

export const HOME_SPEND_VIEW_OPTIONS: { id: HomeSpendView; label: string }[] = [
  { id: 'all', label: 'Tất cả' },
  { id: 'personal_yue', label: 'Cá nhân' },
  { id: 'household', label: 'Quỹ chung' },
];

export {
  matchesHomeSpendView,
  spendingGroupEqualsClause,
  spendingGroupForHomeSpendView,
  sumHomeSpendView,
} from './homeSpendViewShared';
