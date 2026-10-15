import type { SQLiteDatabase } from 'expo-sqlite';
import type { TransactionRecord } from '../domain/transaction';
import { validateTransaction } from '../domain/ledgerRules';

export class TransactionRepository {
  constructor(private readonly db: SQLiteDatabase) {}

  async getById(id: string): Promise<TransactionRecord | null> {
    const row = await this.db.getFirstAsync<Record<string, unknown>>('SELECT * FROM transactions WHERE id = ?', id);
    return row ? mapRow(row) : null;
  }

  async insert(record: TransactionRecord): Promise<void> {
    const errors = validateTransaction(record);
    if (errors.length) throw new Error(`Invalid transaction: ${errors.join(' ')}`);
    await this.db.runAsync(
      `INSERT INTO transactions (
        id, flow, kind, amount_minor, currency, occurred_at, account_id,
        source_account_id, destination_account_id, category_id, purpose,
        merchant_id, counterparty_id, description_original, description_normalized,
        reference, status, linked_transaction_id, user_edited, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      record.id, record.flow, record.kind, record.amountMinor, record.currency, record.occurredAt,
      record.accountId, record.sourceAccountId, record.destinationAccountId, record.categoryId,
      record.purpose, record.merchantId, record.counterpartyId, record.descriptionOriginal,
      record.descriptionNormalized, record.reference, record.status, record.linkedTransactionId,
      record.userEdited ? 1 : 0, record.createdAt, record.updatedAt,
    );
  }
}

function mapRow(row: Record<string, unknown>): TransactionRecord {
  return {
    id: String(row.id), flow: row.flow as TransactionRecord['flow'], kind: row.kind as TransactionRecord['kind'],
    amountMinor: Number(row.amount_minor), currency: 'INR', occurredAt: String(row.occurred_at),
    accountId: nullableString(row.account_id), sourceAccountId: nullableString(row.source_account_id),
    destinationAccountId: nullableString(row.destination_account_id), categoryId: nullableString(row.category_id),
    purpose: row.purpose as TransactionRecord['purpose'], merchantId: nullableString(row.merchant_id),
    counterpartyId: nullableString(row.counterparty_id), descriptionOriginal: String(row.description_original),
    descriptionNormalized: String(row.description_normalized), reference: nullableString(row.reference),
    status: row.status as TransactionRecord['status'], linkedTransactionId: nullableString(row.linked_transaction_id),
    userEdited: Number(row.user_edited) === 1, createdAt: String(row.created_at), updatedAt: String(row.updated_at),
  };
}
function nullableString(value: unknown): string | null { return value == null ? null : String(value); }
