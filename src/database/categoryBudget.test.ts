import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  budgetGroupForExactCategoryName,
  classifyTrustedCategoryBudgetGroups,
} from './categoryBudget.ts';

describe('category budget_group trusted classification', () => {
  it('classifies exact trusted food category names only', () => {
    assert.equal(budgetGroupForExactCategoryName('Ăn uống'), 'household_food');
    assert.equal(budgetGroupForExactCategoryName('Trà & Cà phê'), 'household_food');
    assert.equal(budgetGroupForExactCategoryName('Mua sắm'), null);
    assert.equal(budgetGroupForExactCategoryName('Ăn uống '), null);
  });

  it('classifyTrustedCategoryBudgetGroups is exact-name only', () => {
    const classified = classifyTrustedCategoryBudgetGroups([
      { id: 1, name: 'Ăn uống' },
      { id: 2, name: 'Trà & Cà phê' },
      { id: 3, name: 'Di chuyển' },
    ]);
    assert.deepEqual(classified, [
      { id: 1, budget_group: 'household_food' },
      { id: 2, budget_group: 'household_food' },
    ]);
  });
});
