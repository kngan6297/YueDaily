import type { SourceSpendingGroup } from '../types';
import { SOURCE_SPENDING_GROUP_LABELS } from '../types';

/** Native: canonical labels. */
export function getSourceGroupLabels(): Record<SourceSpendingGroup, string> {
  return SOURCE_SPENDING_GROUP_LABELS;
}
