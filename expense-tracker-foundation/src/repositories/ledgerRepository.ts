import type { ParsedDraft } from '../domain/importing';
import type { SQLiteDatabase } from 'expo-sqlite';
import { normalizeText } from '../domain/categorization';
import { createId, nowIso } from '../domain/ids';
import type { TransactionRecord } from '../domain/transaction';
import { validateTransaction } from '../domain/ledgerRules';
import { getDatabase } from '../database/client';
import { seedIfEmpty } from '../database/seed';
import type {
  AccountRow, CategoryRow, ImportBatchRow, RecurringRow, RuleRow, TransactionDraft, TransactionListItem, TransactionQuery,
} from './types';

async function database(): Promise<SQLiteDatabase> {
  return getDatabase();
}

function nullable(value: unknown): string | null {
  return value == null ? null : String(value);
}

function mapTransaction(row: Record<string, unknown>): TransactionListItem {
  return {
    id: String(row.id),
    flow: row.flow as TransactionListItem['flow'],
    kind: row.kind as TransactionListItem['kind'],
    amountMinor: Number(row.amount_minor),
    occurredAt: String(row.occurred_at),
    postedAt: nullable(row.posted_at),
    accountId: nullable(row.account_id),
    accountName: nullable(row.account_name),
    sourceAccountId: nullable(row.source_account_id),
    destinationAccountId: nullable(row.destination_account_id),
    sourceAccountName: nullable(row.source_account_name),
    destinationAccountName: nullable(row.destination_account_name),
    categoryId: nullable(row.category_id),
    categoryName: nullable(row.category_name),
    purpose: row.purpose as TransactionListItem['purpose'],
    merchantId: nullable(row.merchant_id),
    merchantName: nullable(row.merchant_name),
    counterpartyId: nullable(row.counterparty_id),
    counterpartyName: nullable(row.counterparty_name),
    descriptionOriginal: String(row.description_original),
    descriptionNormalized: String(row.description_normalized),
    reference: nullable(row.reference),
    status: row.status as TransactionListItem['status'],
    linkedTransactionId: nullable(row.linked_transaction_id),
    userEdited: Number(row.user_edited) === 1,
    sourceType: nullable(row.source_type),
  };
}

const TRANSACTION_SELECT = `
  SELECT t.*,
    a.name AS account_name,
    sa.name AS source_account_name,
    da.name AS destination_account_name,
    c.name AS category_name,
    m.canonical_name AS merchant_name,
    cp.display_name AS counterparty_name,
    (SELECT source_type FROM transaction_sources s WHERE s.transaction_id = t.id ORDER BY s.created_at LIMIT 1) AS source_type
  FROM transactions t
  LEFT JOIN accounts a ON a.id = t.account_id
  LEFT JOIN accounts sa ON sa.id = t.source_account_id
  LEFT JOIN accounts da ON da.id = t.destination_account_id
  LEFT JOIN categories c ON c.id = t.category_id
  LEFT JOIN merchants m ON m.id = t.merchant_id
  LEFT JOIN counterparties cp ON cp.id = t.counterparty_id
`;

export async function listAccounts(): Promise<AccountRow[]> {
  const db = await database();
  const rows = await db.getAllAsync<Record<string, unknown>>('SELECT * FROM accounts ORDER BY name');
  return rows.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    type: row.type as AccountRow['type'],
    institution: nullable(row.institution),
    currency: String(row.currency),
    openingBalanceMinor: row.opening_balance_minor == null ? null : Number(row.opening_balance_minor),
    isActive: Number(row.is_active) === 1,
  }));
}

export async function saveAccount(input: Omit<AccountRow, 'isActive'> & { isActive?: boolean }): Promise<void> {
  const db = await database();
  const timestamp = nowIso();
  await db.runAsync(
    `INSERT INTO accounts (id, name, type, institution, currency, opening_balance_minor, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name, type = excluded.type, institution = excluded.institution,
       opening_balance_minor = excluded.opening_balance_minor, is_active = excluded.is_active, updated_at = excluded.updated_at`,
    input.id, input.name.trim(), input.type, input.institution, input.currency, input.openingBalanceMinor,
    input.isActive === false ? 0 : 1, timestamp, timestamp,
  );
}

export async function listCategories(): Promise<CategoryRow[]> {
  const db = await database();
  const rows = await db.getAllAsync<Record<string, unknown>>('SELECT * FROM categories ORDER BY sort_order, name');
  return rows.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    direction: row.direction as CategoryRow['direction'],
    isSystem: Number(row.is_system) === 1,
    sortOrder: Number(row.sort_order),
  }));
}

export async function saveCategory(input: { id?: string; name: string; direction: CategoryRow['direction'] }): Promise<string> {
  const db = await database();
  const id = input.id ?? createId();
  const timestamp = nowIso();
  const sort = await db.getFirstAsync<{ max: number | null }>('SELECT MAX(sort_order) AS max FROM categories');
  await db.runAsync(
    `INSERT INTO categories (id, name, parent_id, direction, is_system, sort_order, created_at, updated_at)
     VALUES (?, ?, NULL, ?, 0, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET name = excluded.name, direction = excluded.direction, updated_at = excluded.updated_at`,
    id, input.name.trim(), input.direction, (sort?.max ?? 0) + 1, timestamp, timestamp,
  );
  return id;
}

export async function listRules(): Promise<RuleRow[]> {
  const db = await database();
  const rows = await db.getAllAsync<Record<string, unknown>>('SELECT * FROM categorization_rules ORDER BY priority, name');
  return rows.map(mapRule);
}

export async function saveRule(input: RuleRow): Promise<void> {
  const db = await database();
  const timestamp = nowIso();
  await db.runAsync(
    `INSERT INTO categorization_rules (
      id, name, match_field, operator, pattern, merchant_alias_pattern, category_id, purpose, flow, kind,
      counterparty_name, priority, is_builtin, is_enabled, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name, match_field = excluded.match_field, operator = excluded.operator, pattern = excluded.pattern,
      category_id = excluded.category_id, purpose = excluded.purpose, flow = excluded.flow, kind = excluded.kind,
      counterparty_name = excluded.counterparty_name, priority = excluded.priority, is_enabled = excluded.is_enabled,
      updated_at = excluded.updated_at`,
    input.id, input.name, input.matchField, input.operator, input.pattern, input.pattern, input.categoryId, input.purpose,
    input.flow, input.kind, input.counterpartyName, input.priority, input.builtin ? 1 : 0, input.enabled ? 1 : 0, timestamp, timestamp,
  );
}

export async function deleteRule(id: string): Promise<void> {
  const db = await database();
  await db.runAsync('DELETE FROM categorization_rules WHERE id = ? AND is_builtin = 0', id);
}

function mapRule(row: Record<string, unknown>): RuleRow {
  return {
    id: String(row.id),
    name: String(row.name),
    matchField: row.match_field as RuleRow['matchField'],
    operator: row.operator as RuleRow['operator'],
    pattern: String(row.pattern ?? ''),
    categoryId: nullable(row.category_id),
    purpose: (row.purpose as RuleRow['purpose']) ?? null,
    flow: (row.flow as RuleRow['flow']) ?? null,
    kind: (row.kind as RuleRow['kind']) ?? null,
    counterpartyName: nullable(row.counterparty_name),
    priority: Number(row.priority),
    enabled: Number(row.is_enabled) === 1,
    builtin: Number(row.is_builtin) === 1,
  };
}

export async function listTransactions(query: TransactionQuery = {}): Promise<TransactionListItem[]> {
  const db = await database();
  const where: string[] = ["t.status != 'voided'"];
  const params: (string | number)[] = [];
  if (query.flow) { where.push('t.flow = ?'); params.push(query.flow); }
  if (query.accountId) { where.push('(t.account_id = ? OR t.source_account_id = ? OR t.destination_account_id = ?)'); params.push(query.accountId, query.accountId, query.accountId); }
  if (query.categoryId) { where.push('t.category_id = ?'); params.push(query.categoryId); }
  if (query.purpose) { where.push('t.purpose = ?'); params.push(query.purpose); }
  if (query.status) { where.push('t.status = ?'); params.push(query.status); }
  if (query.dateFrom) { where.push('substr(t.occurred_at, 1, 10) >= ?'); params.push(query.dateFrom); }
  if (query.dateTo) { where.push('substr(t.occurred_at, 1, 10) <= ?'); params.push(query.dateTo); }
  if (query.minMinor != null) { where.push('t.amount_minor >= ?'); params.push(query.minMinor); }
  if (query.maxMinor != null) { where.push('t.amount_minor <= ?'); params.push(query.maxMinor); }
  if (query.merchant?.trim()) {
    where.push('(m.canonical_name LIKE ? OR cp.display_name LIKE ? OR t.description_normalized LIKE ?)');
    const like = `%${normalizeText(query.merchant)}%`;
    params.push(like, like, like);
  }
  if (query.search?.trim()) {
    const like = `%${normalizeText(query.search)}%`;
    const clauses = ['t.description_normalized LIKE ?', 'm.canonical_name LIKE ?', 'cp.display_name LIKE ?', 'c.name LIKE ?'];
    params.push(like, like, like, `%${query.search.trim()}%`);
    const digits = query.search.replace(/\D/g, '');
    if (digits) {
      clauses.push('CAST(t.amount_minor AS TEXT) LIKE ?');
      params.push(`%${digits}%`);
    }
    where.push(`(${clauses.join(' OR ')})`);
  }
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `${TRANSACTION_SELECT} WHERE ${where.join(' AND ')} ORDER BY t.occurred_at DESC, t.created_at DESC`,
    ...params,
  );
  return rows.map(mapTransaction);
}

export async function getTransaction(id: string): Promise<TransactionListItem | null> {
  const db = await database();
  const row = await db.getFirstAsync<Record<string, unknown>>(`${TRANSACTION_SELECT} WHERE t.id = ?`, id);
  return row ? mapTransaction(row) : null;
}

export async function saveTransaction(draft: TransactionDraft): Promise<void> {
  const db = await database();
  const merchantId = draft.merchantName ? await ensureMerchant(db, draft.merchantName) : null;
  const counterpartyId = draft.counterpartyName ? await ensureCounterparty(db, draft.counterpartyName) : null;
  const timestamp = nowIso();
  const record: TransactionRecord = {
    id: draft.id,
    flow: draft.flow,
    kind: draft.kind,
    amountMinor: draft.amountMinor,
    currency: 'INR',
    occurredAt: draft.occurredAt,
    accountId: draft.accountId,
    sourceAccountId: draft.sourceAccountId,
    destinationAccountId: draft.destinationAccountId,
    categoryId: draft.categoryId,
    purpose: draft.purpose,
    merchantId,
    counterpartyId,
    descriptionOriginal: draft.descriptionOriginal,
    descriptionNormalized: normalizeText(draft.descriptionOriginal),
    reference: draft.reference,
    status: draft.status,
    linkedTransactionId: draft.linkedTransactionId,
    userEdited: draft.userEdited,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const errors = validateTransaction(record);
  if (errors.length) throw new Error(errors.join(' '));
  await db.runAsync(
    `INSERT INTO transactions (
      id, flow, kind, amount_minor, currency, occurred_at, posted_at, account_id, source_account_id,
      destination_account_id, category_id, purpose, merchant_id, counterparty_id, description_original,
      description_normalized, reference, status, linked_transaction_id, user_edited, created_at, updated_at
    ) VALUES (?, ?, ?, ?, 'INR', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      flow = excluded.flow, kind = excluded.kind, amount_minor = excluded.amount_minor, occurred_at = excluded.occurred_at,
      posted_at = excluded.posted_at, account_id = excluded.account_id, source_account_id = excluded.source_account_id,
      destination_account_id = excluded.destination_account_id, category_id = excluded.category_id, purpose = excluded.purpose,
      merchant_id = excluded.merchant_id, counterparty_id = excluded.counterparty_id,
      description_original = excluded.description_original, description_normalized = excluded.description_normalized,
      reference = excluded.reference, status = excluded.status,
      linked_transaction_id = excluded.linked_transaction_id, user_edited = excluded.user_edited, updated_at = excluded.updated_at`,
    record.id, record.flow, record.kind, record.amountMinor, record.occurredAt, draft.postedAt ?? null,
    record.accountId, record.sourceAccountId, record.destinationAccountId, record.categoryId, record.purpose,
    merchantId, counterpartyId, record.descriptionOriginal, record.descriptionNormalized, record.reference,
    record.status, record.linkedTransactionId, record.userEdited ? 1 : 0, timestamp, timestamp,
  );
  if (draft.sourceKey && draft.sourceType) {
    await db.runAsync(
      `INSERT OR IGNORE INTO transaction_sources (
        id, transaction_id, import_batch_id, source_type, source_record_key, source_description, source_occurred_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      createId(), draft.id, draft.importBatchId ?? null, draft.sourceType, draft.sourceKey, draft.descriptionOriginal, draft.occurredAt, timestamp,
    );
  }
}

export async function updateClassification(input: {
  id: string;
  categoryId: string | null;
  purpose: TransactionListItem['purpose'];
  status: TransactionListItem['status'];
  userEdited: boolean;
  counterpartyName?: string | null;
  ruleId?: string | null;
}): Promise<void> {
  const db = await database();
  const current = await getTransaction(input.id);
  if (!current) throw new Error('Transaction not found.');
  const timestamp = nowIso();
  await db.runAsync(
    `INSERT INTO classification_history (
      id, transaction_id, previous_category_id, previous_purpose, previous_status, previous_user_edited, rule_id, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    createId(), input.id, current.categoryId, current.purpose, current.status, current.userEdited ? 1 : 0, input.ruleId ?? null, timestamp,
  );
  const counterpartyId = input.counterpartyName ? await ensureCounterparty(db, input.counterpartyName) : current.counterpartyId;
  await db.runAsync(
    `UPDATE transactions SET category_id = ?, purpose = ?, status = ?, user_edited = ?, counterparty_id = ?, updated_at = ? WHERE id = ?`,
    input.categoryId, input.purpose, input.status, input.userEdited ? 1 : 0, counterpartyId, timestamp, input.id,
  );
}

export async function undoLastClassification(transactionId: string): Promise<boolean> {
  const db = await database();
  const row = await db.getFirstAsync<Record<string, unknown>>(
    'SELECT * FROM classification_history WHERE transaction_id = ? ORDER BY created_at DESC LIMIT 1',
    transactionId,
  );
  if (!row) return false;
  await db.runAsync(
    `UPDATE transactions SET category_id = ?, purpose = ?, status = ?, user_edited = ?, updated_at = ? WHERE id = ?`,
    nullable(row.previous_category_id), String(row.previous_purpose), String(row.previous_status), Number(row.previous_user_edited), nowIso(), transactionId,
  );
  if (row.rule_id) await db.runAsync('DELETE FROM categorization_rules WHERE id = ? AND is_builtin = 0', String(row.rule_id));
  await db.runAsync('DELETE FROM classification_history WHERE id = ?', String(row.id));
  return true;
}

export async function voidTransaction(id: string): Promise<void> {
  const db = await database();
  await db.runAsync(`UPDATE transactions SET status = 'voided', updated_at = ? WHERE id = ?`, nowIso(), id);
}

export async function listSourceKeys(sourceType: string): Promise<{ sourceKey: string; transactionId: string }[]> {
  const db = await database();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    'SELECT source_record_key, transaction_id FROM transaction_sources WHERE source_type = ? AND source_record_key IS NOT NULL',
    sourceType,
  );
  return rows.map((row) => ({ sourceKey: String(row.source_record_key), transactionId: String(row.transaction_id) }));
}

export async function knownTransactions(): Promise<{ id: string; accountId: string | null; amountMinor: number; occurredAt: string; flow: string; descriptionNormalized: string; reference: string | null; sourceKeys: string[] }[]> {
  const db = await database();
  const rows = await db.getAllAsync<Record<string, unknown>>(`
    SELECT t.id, t.account_id, t.amount_minor, t.occurred_at, t.flow, t.description_normalized, t.reference,
      GROUP_CONCAT(s.source_record_key) AS source_keys
    FROM transactions t
    LEFT JOIN transaction_sources s ON s.transaction_id = t.id
    WHERE t.status != 'voided'
    GROUP BY t.id
  `);
  return rows.map((row) => ({
    id: String(row.id),
    accountId: nullable(row.account_id),
    amountMinor: Number(row.amount_minor),
    occurredAt: String(row.occurred_at),
    flow: String(row.flow),
    descriptionNormalized: String(row.description_normalized),
    reference: nullable(row.reference),
    sourceKeys: row.source_keys ? String(row.source_keys).split(',').filter(Boolean) : [],
  }));
}

export async function createImportBatch(input: { sourceType: string; sourceLabel: string; accountId: string | null; fileHash: string | null; rowsSeen: number }): Promise<string> {
  const db = await database();
  const id = createId();
  await db.runAsync(
    `INSERT INTO import_batches (id, source_type, source_label, account_id, file_hash, status, row_count, rows_seen, created_at)
     VALUES (?, ?, ?, ?, ?, 'reviewing', ?, ?, ?)`,
    id, input.sourceType, input.sourceLabel, input.accountId, input.fileHash, input.rowsSeen, input.rowsSeen, nowIso(),
  );
  return id;
}

export async function finishImportBatch(id: string, counts: { created: number; skipped: number; review: number }): Promise<void> {
  const db = await database();
  await db.runAsync(
    `UPDATE import_batches SET status = 'committed', rows_created = ?, rows_skipped = ?, rows_review = ?, committed_at = ? WHERE id = ?`,
    counts.created, counts.skipped, counts.review, nowIso(), id,
  );
}

export async function listImportBatches(): Promise<ImportBatchRow[]> {
  const db = await database();
  const rows = await db.getAllAsync<Record<string, unknown>>('SELECT * FROM import_batches ORDER BY created_at DESC');
  return rows.map((row) => ({
    id: String(row.id),
    sourceType: String(row.source_type),
    sourceLabel: nullable(row.source_label),
    status: String(row.status),
    rowsSeen: Number(row.rows_seen),
    rowsCreated: Number(row.rows_created),
    rowsSkipped: Number(row.rows_skipped),
    rowsReview: Number(row.rows_review),
    createdAt: String(row.created_at),
    committedAt: nullable(row.committed_at),
  }));
}

export async function listRecurring(): Promise<RecurringRow[]> {
  const db = await database();
  const rows = await db.getAllAsync<Record<string, unknown>>('SELECT * FROM recurring_schedules ORDER BY next_due_at');
  return rows.map((row) => ({
    id: String(row.id),
    label: String(row.label),
    amountMinor: row.amount_minor == null ? null : Number(row.amount_minor),
    cadence: row.cadence as RecurringRow['cadence'],
    dueDay: row.due_day == null ? null : Number(row.due_day),
    leadDays: Number(row.lead_days),
    nextDueAt: nullable(row.next_due_at),
    accountId: nullable(row.account_id),
    categoryId: nullable(row.category_id),
    purpose: (row.purpose as RecurringRow['purpose']) ?? null,
    status: row.status as RecurringRow['status'],
    requiresConfirmation: Number(row.requires_confirmation) === 1,
    notificationId: nullable(row.notification_id),
  }));
}

export async function saveRecurring(input: RecurringRow): Promise<void> {
  const db = await database();
  const timestamp = nowIso();
  await db.runAsync(
    `INSERT INTO recurring_schedules (
      id, label, amount_minor, currency, cadence, due_day, lead_days, next_due_at, account_id, category_id,
      purpose, status, requires_confirmation, notification_id, created_at, updated_at
    ) VALUES (?, ?, ?, 'INR', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      label = excluded.label, amount_minor = excluded.amount_minor, cadence = excluded.cadence, due_day = excluded.due_day,
      lead_days = excluded.lead_days, next_due_at = excluded.next_due_at, account_id = excluded.account_id,
      category_id = excluded.category_id, purpose = excluded.purpose, status = excluded.status,
      requires_confirmation = excluded.requires_confirmation, notification_id = excluded.notification_id, updated_at = excluded.updated_at`,
    input.id, input.label, input.amountMinor, input.cadence, input.dueDay, input.leadDays, input.nextDueAt, input.accountId,
    input.categoryId, input.purpose, input.status, input.requiresConfirmation ? 1 : 0, input.notificationId, timestamp, timestamp,
  );
}

export async function getMetadata(key: string): Promise<string | null> {
  const db = await database();
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM app_metadata WHERE key = ?', key);
  return row?.value ?? null;
}

export async function setMetadata(key: string, value: string): Promise<void> {
  const db = await database();
  await db.runAsync(
    `INSERT INTO app_metadata (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    key, value,
  );
}

export async function deleteAllData(): Promise<void> {
  const db = await database();
  const tables = [
    'classification_history', 'duplicate_candidates', 'transaction_sources', 'import_rows', 'import_batches',
    'transactions', 'merchant_aliases', 'merchants', 'counterparties', 'recurring_schedules', 'categorization_rules',
    'categories', 'accounts', 'app_metadata',
  ];
  await db.withTransactionAsync(async () => {
    for (const table of tables) await db.execAsync(`DELETE FROM ${table}`);
  });
  await seedIfEmpty(db);
}

async function ensureMerchant(db: SQLiteDatabase, name: string): Promise<string> {
  const alias = normalizeText(name);
  const existing = await db.getFirstAsync<{ merchant_id: string }>('SELECT merchant_id FROM merchant_aliases WHERE alias_normalized = ?', alias);
  if (existing) return existing.merchant_id;
  const id = createId();
  const timestamp = nowIso();
  await db.runAsync('INSERT INTO merchants (id, canonical_name, created_at, updated_at) VALUES (?, ?, ?, ?)', id, name.trim(), timestamp, timestamp);
  await db.runAsync(
    'INSERT INTO merchant_aliases (id, merchant_id, alias_normalized, alias_original, created_at) VALUES (?, ?, ?, ?, ?)',
    createId(), id, alias, name.trim(), timestamp,
  );
  return id;
}

async function ensureCounterparty(db: SQLiteDatabase, name: string): Promise<string> {
  const existing = await db.getFirstAsync<{ id: string }>('SELECT id FROM counterparties WHERE lower(display_name) = lower(?)', name.trim());
  if (existing) return existing.id;
  const id = createId();
  const timestamp = nowIso();
  await db.runAsync('INSERT INTO counterparties (id, display_name, created_at, updated_at) VALUES (?, ?, ?, ?)', id, name.trim(), timestamp, timestamp);
  return id;
}

export async function dumpTable(table: string): Promise<Record<string, unknown>[]> {
  assertTable(table);
  const db = await database();
  return db.getAllAsync<Record<string, unknown>>(`SELECT * FROM ${table}`);
}

export async function commitImport(input: {
  sourceType: string;
  sourceLabel: string;
  accountId: string | null;
  fileHash: string | null;
  rowsSeen: number;
  skipped: number;
  drafts: ParsedDraft[];
}): Promise<{ created: number; skipped: number; review: number }> {
  const db = await database();
  const batchId = createId();
  let created = 0;
  let review = 0;
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO import_batches (id, source_type, source_label, account_id, file_hash, status, row_count, rows_seen, created_at)
       VALUES (?, ?, ?, ?, ?, 'reviewing', ?, ?, ?)`,
      batchId, input.sourceType, input.sourceLabel, input.accountId, input.fileHash, input.rowsSeen, input.rowsSeen, nowIso(),
    );
    for (const draft of input.drafts) {
      if (!draft.date || draft.amountMinor == null || !draft.sourceKey) continue;
      const needsReview = draft.disposition === 'needs_review' || draft.disposition === 'probable_duplicate' || !draft.categoryId;
      await saveTransaction({
        id: createId(),
        flow: draft.flow,
        kind: draft.kind,
        amountMinor: draft.amountMinor,
        occurredAt: draft.date,
        postedAt: draft.postedDate,
        accountId: input.accountId,
        sourceAccountId: null,
        destinationAccountId: null,
        categoryId: draft.categoryId,
        purpose: draft.purpose,
        merchantName: draft.description,
        counterpartyName: draft.counterpartyName,
        descriptionOriginal: draft.originalText || draft.description,
        reference: draft.reference,
        status: needsReview ? 'needs_review' : 'confirmed',
        linkedTransactionId: null,
        userEdited: false,
        sourceType: input.sourceType,
        sourceKey: draft.sourceKey,
        importBatchId: batchId,
      });
      if (needsReview) review += 1;
      else created += 1;
    }
    await db.runAsync(
      `UPDATE import_batches SET status = 'committed', rows_created = ?, rows_skipped = ?, rows_review = ?, committed_at = ? WHERE id = ?`,
      created, input.skipped, review, nowIso(), batchId,
    );
  });
  return { created, skipped: input.skipped, review };
}

export async function replaceFromBackup(tables: Record<string, Record<string, unknown>[]>): Promise<void> {
  const db = await database();
  const order = [
    'accounts', 'categories', 'merchants', 'merchant_aliases', 'counterparties', 'transactions',
    'import_batches', 'transaction_sources', 'categorization_rules', 'recurring_schedules', 'app_metadata',
  ];
  await db.withTransactionAsync(async () => {
    for (const table of [...order].reverse()) {
      assertTable(table);
      await db.execAsync(`DELETE FROM ${table}`);
    }
    await db.execAsync('DELETE FROM classification_history');
    await db.execAsync('DELETE FROM duplicate_candidates');
    await db.execAsync('DELETE FROM import_rows');
    for (const table of order) {
      for (const row of tables[table] ?? []) await insertRow(db, table, row);
    }
  });
}

function assertTable(table: string): void {
  const allowed = new Set([
    'accounts', 'categories', 'merchants', 'merchant_aliases', 'counterparties', 'transactions', 'import_batches',
    'import_rows', 'transaction_sources', 'duplicate_candidates', 'categorization_rules', 'recurring_schedules',
    'classification_history', 'app_metadata',
  ]);
  if (!allowed.has(table)) throw new Error('Unknown backup table.');
}

async function insertRow(db: SQLiteDatabase, table: string, row: Record<string, unknown>): Promise<void> {
  const keys = Object.keys(row).filter((key) => /^[a-z_]+$/.test(key));
  if (!keys.length) return;
  const placeholders = keys.map(() => '?').join(', ');
  await db.runAsync(
    `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`,
    ...keys.map((key) => row[key] as string | number | null),
  );
}
