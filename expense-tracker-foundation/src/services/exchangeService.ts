import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import { backupCounts, createBackupDocument, decryptBackup, encryptBackup, type EncryptedBackup } from '../domain/backup';
import { buildAiExport, reviewAiSuggestions } from '../domain/aiExchange';
import { transactionsToCsv } from '../domain/csvExport';
import { nowIso } from '../domain/ids';
import {
  dumpTable, listCategories, listTransactions, replaceFromBackup,
} from '../repositories/ledgerRepository';
import type { TransactionListItem } from '../repositories/types';

export async function buildEncryptedBackup(passphrase: string): Promise<EncryptedBackup> {
  const [accounts, categories, merchants, merchantAliases, counterparties, transactions, transactionSources, rules, recurring, importBatches, metadata] = await Promise.all([
    dumpTable('accounts'), dumpTable('categories'), dumpTable('merchants'), dumpTable('merchant_aliases'),
    dumpTable('counterparties'), dumpTable('transactions'), dumpTable('transaction_sources'), dumpTable('categorization_rules'),
    dumpTable('recurring_schedules'), dumpTable('import_batches'), dumpTable('app_metadata'),
  ]);
  const document = createBackupDocument({
    exportedAt: nowIso(),
    accounts, categories, merchants, merchantAliases, counterparties, transactions, transactionSources,
    rules, recurring, importBatches, metadata,
  });
  return encryptBackup(document, passphrase);
}

export async function previewBackup(payload: EncryptedBackup, passphrase: string) {
  return backupCounts(decryptBackup(payload, passphrase));
}

export async function restoreBackup(payload: EncryptedBackup, passphrase: string): Promise<void> {
  const document = decryptBackup(payload, passphrase);
  await replaceFromBackup({
    accounts: document.accounts,
    categories: document.categories,
    merchants: document.merchants,
    merchant_aliases: document.merchantAliases,
    counterparties: document.counterparties,
    transactions: document.transactions,
    transaction_sources: document.transactionSources,
    categorization_rules: document.rules,
    recurring_schedules: document.recurring,
    import_batches: document.importBatches,
    app_metadata: document.metadata,
  });
}

export async function exportTransactionsCsv(): Promise<string> {
  const rows = await listTransactions();
  return transactionsToCsv(rows);
}

export async function exportAiFile(rows?: TransactionListItem[]) {
  const all = rows ?? await listTransactions({ status: 'needs_review' });
  const categories = await listCategories();
  return buildAiExport(all.map((row) => ({
    id: row.id,
    date: row.occurredAt.slice(0, 10),
    amountMinor: row.amountMinor,
    flow: row.flow,
    description: row.descriptionOriginal,
    categoryId: row.categoryId,
    purpose: row.purpose,
    userEdited: row.userEdited,
  })), categories, nowIso());
}

export async function previewAiFile(fileText: string) {
  const [rows, categories] = await Promise.all([listTransactions(), listCategories()]);
  return reviewAiSuggestions(fileText, rows.map((row) => ({
    id: row.id,
    date: row.occurredAt.slice(0, 10),
    amountMinor: row.amountMinor,
    flow: row.flow,
    description: row.descriptionOriginal,
    categoryId: row.categoryId,
    purpose: row.purpose,
    userEdited: row.userEdited,
  })), categories.map((category) => category.id));
}

export function hashBytes(bytes: Uint8Array): string {
  return bytesToHex(sha256(bytes));
}
