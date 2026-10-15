export type TransactionFlow = 'expense' | 'income' | 'transfer';

export type TransactionKind =
  | 'purchase'
  | 'bill_payment'
  | 'card_repayment'
  | 'refund'
  | 'reimbursement_received'
  | 'reimbursement_paid'
  | 'loan_given'
  | 'loan_repayment_received'
  | 'loan_repayment_paid'
  | 'shared_expense'
  | 'internal_transfer'
  | 'income'
  | 'cash_withdrawal'
  | 'cash_deposit'
  | 'adjustment';

export type TransactionPurpose = 'office' | 'personal' | 'shared' | 'business' | 'unknown';
export type TransactionStatus = 'draft' | 'needs_review' | 'confirmed' | 'voided';
export type TransactionSourceType = 'manual' | 'statement' | 'message_share' | 'message_capture' | 'external_ai_import' | 'backup_restore';

export interface TransactionRecord {
  id: string;
  flow: TransactionFlow;
  kind: TransactionKind;
  amountMinor: number; // Positive integer in paise; never store floating-point rupees.
  currency: 'INR';
  occurredAt: string; // ISO-8601 timestamp with timezone when known.
  accountId: string | null;
  sourceAccountId: string | null;
  destinationAccountId: string | null;
  categoryId: string | null;
  purpose: TransactionPurpose;
  merchantId: string | null;
  counterpartyId: string | null;
  descriptionOriginal: string;
  descriptionNormalized: string;
  reference: string | null;
  status: TransactionStatus;
  linkedTransactionId: string | null; // e.g. refund -> original purchase
  userEdited: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ClassificationSuggestion {
  transactionId: string;
  categoryId: string | null;
  purpose: TransactionPurpose;
  suggestedFlow: TransactionFlow | null;
  suggestedKind: TransactionKind | null;
  merchantAlias: string | null;
  confidence: number; // 0..1; signal only, not proof
  explanation: string;
  modelId: string;
}
