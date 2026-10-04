import type { SourceSpendingGroup } from '../types';

/** Web: shared-workspace friendly wording. */
const WEB_LABELS: Record<SourceSpendingGroup, string> = {
  personal_yue: 'Cá nhân',
  household: 'Quỹ chung',
};

export function getSourceGroupLabels(): Record<SourceSpendingGroup, string> {
  return WEB_LABELS;
}
