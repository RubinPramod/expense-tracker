import type { TransactionListItem } from '../repositories/types';

export function transactionsToCsv(rows: TransactionListItem[]): string {
  const header = ['date', 'description', 'flow', 'kind', 'amount_inr', 'category', 'purpose', 'account', 'status'];
  const lines = rows.map((row) => [
    row.occurredAt.slice(0, 10),
    row.descriptionOriginal,
    row.flow,
    row.kind,
    (row.amountMinor / 100).toFixed(2),
    row.categoryName ?? '',
    row.purpose,
    row.accountName ?? row.sourceAccountName ?? '',
    row.status,
  ].map(csvCell).join(','));
  return [header.join(','), ...lines].join('\n');
}

function csvCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}
