import { countsAsGrossSpending } from '../src/domain/ledgerRules';

describe('countsAsGrossSpending', () => {
  it('counts an ordinary expense purchase', () => expect(countsAsGrossSpending('expense', 'purchase')).toBe(true));
  it('does not count income as spending', () => expect(countsAsGrossSpending('income', 'income')).toBe(false));
  it('does not count internal transfers as spending', () => expect(countsAsGrossSpending('transfer', 'internal_transfer')).toBe(false));
  it('does not count card repayment as a second expense', () => expect(countsAsGrossSpending('expense', 'card_repayment')).toBe(false));
  it('does not count loans given as ordinary consumption', () => expect(countsAsGrossSpending('expense', 'loan_given')).toBe(false));
  it('does not count a refund as gross spending', () => expect(countsAsGrossSpending('expense', 'refund')).toBe(false));
  it('does not count a reimbursement as gross spending', () => expect(countsAsGrossSpending('expense', 'reimbursement_paid')).toBe(false));
});
