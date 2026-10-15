import { dateKey, monthWindow } from './dates';
import { countsAsGrossSpending } from './ledgerRules';
import type { TransactionFlow, TransactionKind, TransactionPurpose, TransactionStatus } from './transaction';
import { FOOD_CATEGORY_ID } from './categorization';

export interface ReportTransaction {
  id: string;
  flow: TransactionFlow;
  kind: TransactionKind;
  amountMinor: number;
  occurredAt: string;
  categoryId: string | null;
  categoryName: string | null;
  purpose: TransactionPurpose;
  status: TransactionStatus;
  merchantName: string | null;
  description: string;
}

export interface CategorySlice {
  categoryId: string | null;
  name: string;
  amountMinor: number;
  count: number;
  share: number;
}

export interface MerchantRank {
  name: string;
  amountMinor: number;
  count: number;
  share: number;
}

export interface MonthPoint {
  key: string;
  label: string;
  spendingMinor: number;
  incomeMinor: number;
  partial: boolean;
}

export interface SpendingReport {
  monthKey: string;
  partial: boolean;
  spendingMinor: number;
  incomeMinor: number;
  refundMinor: number;
  reimbursementMinor: number;
  transferMinor: number;
  cardRepaymentMinor: number;
  officeSpendingMinor: number;
  officeMealsMinor: number;
  netSpendingMinor: number;
  unclassifiedCount: number;
  unclassifiedMinor: number;
  categories: CategorySlice[];
  officeMealMerchants: MerchantRank[];
  merchants: MerchantRank[];
  months: MonthPoint[];
}

export function summarize(rows: ReportTransaction[], today: string, monthOffset = 0): SpendingReport {
  const month = monthWindow(today, monthOffset);
  const inMonth = rows.filter((row) => included(row) && inRange(row.occurredAt, month.start, month.end));
  let spendingMinor = 0;
  let incomeMinor = 0;
  let refundMinor = 0;
  let reimbursementMinor = 0;
  let transferMinor = 0;
  let cardRepaymentMinor = 0;
  let officeSpendingMinor = 0;
  let unclassifiedCount = 0;
  let unclassifiedMinor = 0;
  const categoryTotals = new Map<string, CategorySlice>();
  const merchantTotals = new Map<string, MerchantRank>();
  const officeMealTotals = new Map<string, MerchantRank>();

  for (const row of inMonth) {
    if (row.kind === 'refund') {
      refundMinor += row.amountMinor;
      continue;
    }
    if (row.kind === 'reimbursement_received' || row.kind === 'reimbursement_paid') {
      reimbursementMinor += row.amountMinor;
      continue;
    }
    if (row.kind === 'card_repayment') {
      cardRepaymentMinor += row.amountMinor;
      continue;
    }
    if (row.flow === 'transfer' || row.kind === 'internal_transfer') {
      transferMinor += row.amountMinor;
      continue;
    }
    if (row.flow === 'income') {
      incomeMinor += row.amountMinor;
      continue;
    }
    if (!countsAsGrossSpending(row.flow, row.kind)) continue;
    spendingMinor += row.amountMinor;
    if (row.purpose === 'office') officeSpendingMinor += row.amountMinor;
    const unresolved = row.status === 'needs_review' || row.categoryId == null;
    if (unresolved) {
      unclassifiedCount += 1;
      unclassifiedMinor += row.amountMinor;
    }
    const categoryKey = row.categoryId ?? 'uncategorized';
    const slice = categoryTotals.get(categoryKey) ?? {
      categoryId: row.categoryId,
      name: row.categoryName ?? 'Uncategorised',
      amountMinor: 0,
      count: 0,
      share: 0,
    };
    slice.amountMinor += row.amountMinor;
    slice.count += 1;
    categoryTotals.set(categoryKey, slice);
    addRank(merchantTotals, row.merchantName ?? row.description, row.amountMinor);
    if ((row.categoryId === FOOD_CATEGORY_ID || row.categoryName === 'Food & Dining') && row.purpose === 'office') {
      addRank(officeMealTotals, row.merchantName ?? row.description, row.amountMinor);
    }
  }

  const categories = [...categoryTotals.values()]
    .map((slice) => ({ ...slice, share: spendingMinor === 0 ? 0 : slice.amountMinor / spendingMinor }))
    .sort((a, b) => b.amountMinor - a.amountMinor);
  const officeMealsMinor = [...officeMealTotals.values()].reduce((sum, rank) => sum + rank.amountMinor, 0);

  return {
    monthKey: month.key,
    partial: month.partial,
    spendingMinor,
    incomeMinor,
    refundMinor,
    reimbursementMinor,
    transferMinor,
    cardRepaymentMinor,
    officeSpendingMinor,
    officeMealsMinor,
    netSpendingMinor: spendingMinor - refundMinor,
    unclassifiedCount,
    unclassifiedMinor,
    categories,
    officeMealMerchants: rankShares(officeMealTotals, officeMealsMinor),
    merchants: rankShares(merchantTotals, spendingMinor),
    months: Array.from({ length: 6 }, (_, index) => {
      const point = monthWindow(today, monthOffset - 5 + index);
      const spending = rows.filter((row) => included(row) && inRange(row.occurredAt, point.start, point.end) && countsAsGrossSpending(row.flow, row.kind))
        .reduce((sum, row) => sum + row.amountMinor, 0);
      const income = rows.filter((row) => included(row) && inRange(row.occurredAt, point.start, point.end) && row.flow === 'income' && row.kind === 'income')
        .reduce((sum, row) => sum + row.amountMinor, 0);
      return { key: point.key, label: point.label, spendingMinor: spending, incomeMinor: income, partial: point.partial };
    }),
  };
}

function included(row: ReportTransaction): boolean {
  return row.status !== 'voided' && row.status !== 'draft';
}

function inRange(occurredAt: string, start: string, end: string): boolean {
  const key = dateKey(occurredAt);
  return key >= start && key <= end;
}

function addRank(map: Map<string, MerchantRank>, name: string, amountMinor: number): void {
  const current = map.get(name) ?? { name, amountMinor: 0, count: 0, share: 0 };
  current.amountMinor += amountMinor;
  current.count += 1;
  map.set(name, current);
}

function rankShares(map: Map<string, MerchantRank>, total: number): MerchantRank[] {
  return [...map.values()]
    .map((rank) => ({ ...rank, share: total === 0 ? 0 : rank.amountMinor / total }))
    .sort((a, b) => b.amountMinor - a.amountMinor);
}

export function groupByDate<T extends { occurredAt: string; flow: TransactionFlow; kind: TransactionKind; amountMinor: number; status: TransactionStatus }>(rows: T[]): { date: string; spendingMinor: number; rows: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const key = dateKey(row.occurredAt);
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }
  return [...groups.entries()].map(([date, grouped]) => ({
    date,
    spendingMinor: grouped.reduce((sum, row) => sum + (row.status !== 'voided' && countsAsGrossSpending(row.flow, row.kind) ? row.amountMinor : 0), 0),
    rows: grouped,
  }));
}
