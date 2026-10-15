import type { TransactionFlow, TransactionKind, TransactionRecord } from './transaction';

/**
 * Gross spending is consumption. Refunds and reimbursements stay visible in their own totals.
 * Transfers, card repayments, loans, and cash movement never count as a second expense.
 */
const NON_SPENDING_KINDS = new Set<TransactionKind>([
  'card_repayment', 'internal_transfer', 'cash_withdrawal', 'cash_deposit',
  'loan_given', 'loan_repayment_received', 'loan_repayment_paid', 'adjustment',
  'refund', 'reimbursement_received', 'reimbursement_paid',
]);

export function countsAsGrossSpending(flow: TransactionFlow, kind: TransactionKind): boolean {
  if (flow !== 'expense') return false;
  return !NON_SPENDING_KINDS.has(kind);
}

export function validateTransaction(tx: TransactionRecord): string[] {
  const errors: string[] = [];
  if (!tx.id.trim()) errors.push('Transaction id is required.');
  if (!Number.isSafeInteger(tx.amountMinor) || tx.amountMinor <= 0) errors.push('Amount must be a positive integer number of minor currency units.');
  if (!tx.descriptionOriginal.trim()) errors.push('Original description is required.');
  if (tx.flow === 'transfer' || tx.kind === 'internal_transfer' || tx.kind === 'card_repayment') {
    if (!tx.sourceAccountId) errors.push('A source account is required for transfers and card repayments.');
    if (!tx.destinationAccountId) errors.push('A destination account is required for transfers and card repayments.');
    if (tx.sourceAccountId && tx.destinationAccountId && tx.sourceAccountId === tx.destinationAccountId) errors.push('Source and destination accounts must differ.');
  }
  if (tx.kind === 'refund' && !tx.linkedTransactionId) {
    // Permitted, but the UI should flag this for optional linkage rather than blocking a legitimate refund.
  }
  if (tx.status === 'confirmed' && tx.userEdited === false) {
    // No invariant here: imported confirmed records may be valid; preserve this field for AI precedence.
  }
  return errors;
}

export function isCardRepayment(tx: Pick<TransactionRecord, 'kind'>): boolean {
  return tx.kind === 'card_repayment';
}
