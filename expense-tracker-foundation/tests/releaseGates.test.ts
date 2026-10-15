import { randomUUID } from 'crypto';
import { buildAiExport, reviewAiSuggestions } from '../src/domain/aiExchange';
import { backupCounts, createBackupDocument, decryptBackup, encryptBackup } from '../src/domain/backup';
import { transactionsToCsv } from '../src/domain/csvExport';
import { nextDueDate, notificationDate, remindersToSchedule, shouldSchedule } from '../src/domain/recurring';
import { applyMigrations } from '../src/database/migrate';
import { SCHEMA_SQL } from '../src/database/schemaSql';
import { SEED_CATEGORIES } from '../src/database/seed';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import type { TransactionListItem } from '../src/repositories/types';

describe('ai exchange', () => {
  const ids = [randomUUID(), randomUUID(), randomUUID(), randomUUID(), randomUUID(), randomUUID()];
  const current = ids.map((id) => ({
    id, date: '2026-10-14', amountMinor: 18000, flow: 'expense' as const, description: 'AB Coffee',
    categoryId: null, purpose: 'unknown' as const, userEdited: false,
  }));
  const categories = [{ id: 'cat_food', name: 'Food & Dining' }];

  it('rejects unknown ids, changed amounts, bad categories, duplicates, and account edits', () => {
    const file = JSON.stringify({
      schemaVersion: 1,
      suggestions: [
        { transactionId: ids[0], categoryId: 'cat_food', purpose: 'office' },
        { transactionId: ids[0], categoryId: 'cat_food', purpose: 'office' },
        { transactionId: randomUUID(), categoryId: 'cat_food', purpose: 'personal' },
        { transactionId: ids[1], categoryId: 'cat_food', purpose: 'office', amountMinor: 1 },
        { transactionId: ids[2], categoryId: 'missing', purpose: 'office' },
        { transactionId: ids[3], categoryId: 'cat_food', purpose: 'office', accountId: 'secret' },
        { transactionId: ids[4], categoryId: 'cat_food', purpose: 'office', date: '2020-01-01' },
        { transactionId: ids[5], categoryId: 'cat_food', purpose: 'office', description: 'changed' },
      ],
    });
    const decisions = reviewAiSuggestions(file, current, categories.map((category) => category.id));
    expect(decisions.map((decision) => decision.accepted)).toEqual([true, false, false, false, false, false, false, false]);
    expect(decisions.map((decision) => decision.reason)).toEqual([
      null,
      'Duplicate suggestion for this transaction.',
      'Unknown transaction.',
      'Amount does not match the ledger.',
      'Unknown category.',
      'Suggestions cannot change the account or direction.',
      'Date does not match the ledger.',
      'Description does not match the ledger.',
    ]);
  });

  it('keeps a user correction ahead of a later suggestion', () => {
    const file = JSON.stringify({ schemaVersion: 1, suggestions: [{ transactionId: ids[0], categoryId: 'cat_food', purpose: 'office' }] });
    const [decision] = reviewAiSuggestions(file, [{ ...current[0], userEdited: true }], ['cat_food']);
    expect(decision?.accepted).toBe(false);
  });

  it('builds an export that carries the transaction id and allowed categories', () => {
    const payload = buildAiExport(current, categories, '2026-10-14T00:00:00.000Z');
    expect(payload.transactions[0]?.id).toBe(ids[0]);
    expect(payload.transactions[0]).not.toHaveProperty('accountId');
    expect(payload.allowedCategories[0]?.id).toBe('cat_food');
  });
});

describe('backup', () => {
  it('round-trips an encrypted backup and rejects the wrong passphrase', () => {
    const document = createBackupDocument({
      exportedAt: '2026-10-14T00:00:00.000Z',
      accounts: [{ id: 'a' }], categories: [{ id: 'c' }], merchants: [], merchantAliases: [], counterparties: [],
      transactions: [{ id: 't', amount_minor: 100 }], transactionSources: [], rules: [{ id: 'r' }], recurring: [{ id: 'rec' }],
      importBatches: [], metadata: [],
    });
    const encrypted = encryptBackup(document, 'correct horse');
    expect(decryptBackup(encrypted, 'correct horse').transactions).toEqual(document.transactions);
    expect(backupCounts(document).rules).toBe(1);
    expect(() => decryptBackup(encrypted, 'wrong passphrase')).toThrow(/passphrase/i);
  });
});

describe('reminders', () => {
  it('schedules only confirmed items and keeps the calendar date stable', () => {
    expect(notificationDate('2026-10-14', 1)).toBe('2026-10-13T09:00:00');
    expect(nextDueDate('monthly', 31, '2026-02-01')).toBe('2026-02-28');
    expect(shouldSchedule({ id: '1', label: 'Rent', amountMinor: 1, cadence: 'monthly', dueDay: 1, leadDays: 1, nextDueAt: '2026-11-01', status: 'suggested', requiresConfirmation: true })).toBe(false);
    expect(shouldSchedule({ id: '1', label: 'Rent', amountMinor: 1, cadence: 'monthly', dueDay: 1, leadDays: 1, nextDueAt: '2026-11-01', status: 'paused', requiresConfirmation: false })).toBe(false);
    const active = { id: '1', label: 'Rent', amountMinor: 1, cadence: 'monthly' as const, dueDay: 1, leadDays: 2, nextDueAt: '2026-11-01', status: 'active' as const, requiresConfirmation: false };
    expect(remindersToSchedule([active])).toEqual([{ id: '1', fireAt: '2026-10-30T09:00:00' }]);
    expect(remindersToSchedule([{ ...active, nextDueAt: '2026-12-01' }])[0]?.fireAt).toBe('2026-11-29T09:00:00');
  });
});

describe('migration', () => {
  it('applies version 1 once and does not include investment accounts', async () => {
    const sqlFile = readFileSync(resolve(__dirname, '../src/database/schema.sql'), 'utf8');
    expect(sqlFile.trim()).toBe(SCHEMA_SQL.trim());
    expect(SCHEMA_SQL).not.toContain('investment');
    expect(SEED_CATEGORIES.map((category) => category.name)).toEqual(['Food & Dining', 'Transport', 'Income']);
    const db = new FakeDb();
    await applyMigrations(db);
    await applyMigrations(db);
    expect(db.version).toBe(1);
    expect(db.statements.filter((statement) => statement.includes('CREATE TABLE'))).toHaveLength(1);
  });
});

describe('csv', () => {
  it('quotes descriptions that contain commas', () => {
    const row = { descriptionOriginal: 'Lunch, office', occurredAt: '2026-10-14', flow: 'expense', kind: 'purchase', amountMinor: 100, categoryName: null, purpose: 'office', accountName: null, sourceAccountName: null, status: 'confirmed' } as TransactionListItem;
    expect(transactionsToCsv([row])).toContain('"Lunch, office"');
  });
});

class FakeDb {
  version = 0;
  statements: string[] = [];
  async execAsync(source: string): Promise<void> {
    this.statements.push(source);
    const match = /PRAGMA user_version = (\d+)/.exec(source);
    if (match?.[1]) this.version = Number(match[1]);
  }
  async getFirstAsync<T>(): Promise<T | null> {
    return { user_version: this.version } as T;
  }
}
