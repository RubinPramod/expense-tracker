import type { TransactionFlow, TransactionKind, TransactionPurpose, TransactionStatus } from '../domain/transaction';

export interface AccountRow {
  id: string;
  name: string;
  type: 'bank' | 'credit_card' | 'cash' | 'wallet' | 'other';
  institution: string | null;
  currency: string;
  openingBalanceMinor: number | null;
  isActive: boolean;
}

export interface CategoryRow {
  id: string;
  name: string;
  direction: 'expense' | 'income' | 'both';
  isSystem: boolean;
  sortOrder: number;
}

export interface TransactionListItem {
  id: string;
  flow: TransactionFlow;
  kind: TransactionKind;
  amountMinor: number;
  occurredAt: string;
  postedAt: string | null;
  accountId: string | null;
  accountName: string | null;
  sourceAccountId: string | null;
  destinationAccountId: string | null;
  sourceAccountName: string | null;
  destinationAccountName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  purpose: TransactionPurpose;
  merchantId: string | null;
  merchantName: string | null;
  counterpartyId: string | null;
  counterpartyName: string | null;
  descriptionOriginal: string;
  descriptionNormalized: string;
  reference: string | null;
  status: TransactionStatus;
  linkedTransactionId: string | null;
  userEdited: boolean;
  sourceType: string | null;
}

export interface TransactionDraft {
  id: string;
  flow: TransactionFlow;
  kind: TransactionKind;
  amountMinor: number;
  occurredAt: string;
  postedAt?: string | null;
  accountId: string | null;
  sourceAccountId: string | null;
  destinationAccountId: string | null;
  categoryId: string | null;
  purpose: TransactionPurpose;
  merchantName: string | null;
  counterpartyName: string | null;
  descriptionOriginal: string;
  reference: string | null;
  status: TransactionStatus;
  linkedTransactionId: string | null;
  userEdited: boolean;
  sourceType?: string;
  sourceKey?: string | null;
  importBatchId?: string | null;
}

export interface RuleRow {
  id: string;
  name: string;
  matchField: 'description' | 'merchant' | 'reference' | 'counterparty';
  operator: 'contains' | 'equals' | 'starts_with';
  pattern: string;
  categoryId: string | null;
  purpose: TransactionPurpose | null;
  flow: TransactionFlow | null;
  kind: TransactionKind | null;
  counterpartyName: string | null;
  priority: number;
  enabled: boolean;
  builtin: boolean;
}

export interface RecurringRow {
  id: string;
  label: string;
  amountMinor: number | null;
  cadence: 'weekly' | 'monthly' | 'yearly';
  dueDay: number | null;
  leadDays: number;
  nextDueAt: string | null;
  accountId: string | null;
  categoryId: string | null;
  purpose: TransactionPurpose | null;
  status: 'suggested' | 'active' | 'paused' | 'ended';
  requiresConfirmation: boolean;
  notificationId: string | null;
}

export interface ImportBatchRow {
  id: string;
  sourceType: string;
  sourceLabel: string | null;
  status: string;
  rowsSeen: number;
  rowsCreated: number;
  rowsSkipped: number;
  rowsReview: number;
  createdAt: string;
  committedAt: string | null;
}

export interface TransactionQuery {
  search?: string;
  flow?: TransactionFlow;
  accountId?: string;
  categoryId?: string;
  purpose?: TransactionPurpose;
  dateFrom?: string;
  dateTo?: string;
  minMinor?: number;
  maxMinor?: number;
  merchant?: string;
  status?: TransactionStatus;
}
