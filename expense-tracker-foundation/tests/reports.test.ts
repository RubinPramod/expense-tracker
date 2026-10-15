import { formatInr, rupeesToMinor } from '../src/domain/money';
import { monthWindow } from '../src/domain/dates';
import { FOOD_CATEGORY_ID } from '../src/domain/categorization';
import { groupByDate, summarize, type ReportTransaction } from '../src/domain/reports';

function row(partial: Partial<ReportTransaction> & Pick<ReportTransaction, 'flow' | 'kind' | 'amountMinor' | 'occurredAt'>): ReportTransaction {
  return {
    id: partial.id ?? partial.description ?? partial.occurredAt,
    flow: partial.flow,
    kind: partial.kind,
    amountMinor: partial.amountMinor,
    occurredAt: partial.occurredAt,
    categoryId: partial.categoryId ?? null,
    categoryName: partial.categoryName ?? null,
    purpose: partial.purpose ?? 'unknown',
    status: partial.status ?? 'confirmed',
    merchantName: partial.merchantName ?? null,
    description: partial.description ?? 'Item',
  };
}

describe('money', () => {
  it('converts rupees to paise and formats them', () => {
    expect(rupeesToMinor('1,250.50')).toBe(125050);
    expect(rupeesToMinor('₹ 680')).toBe(68000);
    expect(rupeesToMinor('0')).toBeNull();
    expect(formatInr(2432000)).toBe('₹ 24,320');
    expect(formatInr(50)).toBe('₹ 0.50');
  });
});

describe('months', () => {
  it('marks the current calendar month partial until the last day', () => {
    expect(monthWindow('2026-10-14').partial).toBe(true);
    expect(monthWindow('2026-10-31').partial).toBe(false);
    expect(monthWindow('2026-10-14', -1).partial).toBe(false);
    expect(monthWindow('2026-10-14').start).toBe('2026-10-01');
    expect(monthWindow('2026-10-14').end).toBe('2026-10-31');
  });
});

describe('reports', () => {
  const rows = [
    row({ flow: 'expense', kind: 'purchase', amountMinor: 18000, occurredAt: '2026-10-06', categoryId: FOOD_CATEGORY_ID, categoryName: 'Food & Dining', purpose: 'office', merchantName: 'AB Coffee', description: 'AB Coffee' }),
    row({ flow: 'expense', kind: 'purchase', amountMinor: 50000, occurredAt: '2026-10-05', categoryId: null, categoryName: null, status: 'needs_review', description: 'Unknown shop' }),
    row({ flow: 'expense', kind: 'refund', amountMinor: 2000, occurredAt: '2026-10-07', description: 'Refund' }),
    row({ flow: 'income', kind: 'income', amountMinor: 6500000, occurredAt: '2026-10-01', description: 'Salary' }),
    row({ flow: 'transfer', kind: 'internal_transfer', amountMinor: 100000, occurredAt: '2026-10-02', description: 'Move' }),
    row({ flow: 'transfer', kind: 'card_repayment', amountMinor: 400000, occurredAt: '2026-10-03', description: 'Card' }),
    row({ flow: 'expense', kind: 'loan_given', amountMinor: 90000, occurredAt: '2026-10-04', description: 'Friend' }),
    row({ flow: 'expense', kind: 'purchase', amountMinor: 1000, occurredAt: '2026-09-01', description: 'Old' }),
    row({ flow: 'expense', kind: 'purchase', amountMinor: 999, occurredAt: '2026-10-08', status: 'voided', description: 'Void' }),
  ];

  it('keeps transfers, repayments, loans, and refunds out of gross spending', () => {
    const report = summarize(rows, '2026-10-14');
    expect(report.spendingMinor).toBe(68000);
    expect(report.refundMinor).toBe(2000);
    expect(report.netSpendingMinor).toBe(66000);
    expect(report.incomeMinor).toBe(6500000);
    expect(report.transferMinor).toBe(100000);
    expect(report.cardRepaymentMinor).toBe(400000);
    expect(report.officeSpendingMinor).toBe(18000);
    expect(report.officeMealsMinor).toBe(18000);
    expect(report.unclassifiedCount).toBe(1);
    expect(report.unclassifiedMinor).toBe(50000);
    expect(report.partial).toBe(true);
    expect(report.months).toHaveLength(6);
    expect(report.months[5]?.spendingMinor).toBe(68000);
  });

  it('groups a day by spending only', () => {
    const groups = groupByDate(rows.filter((item) => item.occurredAt.startsWith('2026-10-06') || item.flow === 'income'));
    expect(groups.find((group) => group.date === '2026-10-01')?.spendingMinor).toBe(0);
  });
});
