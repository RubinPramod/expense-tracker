jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: async () => {
    throw new Error('Tests use the in-memory ledger.');
  },
}));

import { readFileSync } from 'fs';
import { resolve } from 'path';
import * as XLSX from 'xlsx';
import { FOOD_CATEGORY_ID } from '../src/domain/categorization';
import { transactionsToCsv } from '../src/domain/csvExport';
import {
  countDispositions, draftsFromTabular, parseCsv, parsePastedMessages, parseXlsx, planDrafts, suggestMapping,
} from '../src/domain/importing';
import { createId } from '../src/domain/ids';
import { summarize } from '../src/domain/reports';
import { buildEncryptedBackup, exportAiFile, previewAiFile, restoreBackup } from '../src/services/exchangeService';
import {
  commitImport, deleteAllData, knownTransactions, listCategories, listImportBatches, listRecurring, listRules, listTransactions,
  saveAccount, saveRecurring, saveRule, saveTransaction, undoLastClassification, updateClassification, voidTransaction,
} from '../src/repositories/ledgerRepository';
import type { RuleRow, TransactionListItem } from '../src/repositories/types';
import { closeMemoryLedger, useMemoryLedger } from './support/memoryDatabase';

const accountId = 'acct-icici';

function fixture(name: string): string {
  return readFileSync(resolve(__dirname, 'fixtures', name), 'utf8');
}

async function uploadTabular(input: { name: string; headers: string[]; records: Record<string, string>[]; sourceType: string; accountId: string | null }) {
  const rules = (await listRules()).map(asRule);
  const mapping = suggestMapping(input.headers);
  const planned = planDrafts(
    draftsFromTabular({ headers: input.headers, records: input.records }, mapping, input.accountId, rules),
    await knownTransactions(),
  );
  const chosen = planned.filter((draft) => draft.disposition === 'new' || draft.disposition === 'needs_review');
  const counts = await commitImport({
    sourceType: input.sourceType,
    sourceLabel: input.name,
    accountId: input.accountId,
    fileHash: `hash-${input.name}`,
    rowsSeen: planned.length,
    skipped: planned.length - chosen.length,
    drafts: chosen,
  });
  return { planned, counts, rows: await listTransactions() };
}

async function uploadCsv(name: string, text = fixture(name)) {
  const tabular = parseCsv(text);
  return uploadTabular({ name, headers: tabular.headers, records: tabular.records, sourceType: 'statement', accountId });
}

function asRule(rule: RuleRow) {
  return rule;
}

function spendingOf(rows: TransactionListItem[], today = '2025-03-31') {
  return summarize(rows.map((row) => ({
    id: row.id,
    flow: row.flow,
    kind: row.kind,
    amountMinor: row.amountMinor,
    occurredAt: row.occurredAt,
    categoryId: row.categoryId,
    categoryName: row.categoryName,
    purpose: row.purpose,
    status: row.status,
    merchantName: row.merchantName,
    description: row.descriptionOriginal,
  })), today);
}

beforeEach(async () => {
  await useMemoryLedger();
  await saveAccount({ id: accountId, name: 'ICICI', type: 'bank', institution: 'ICICI', currency: 'INR', openingBalanceMinor: null });
});

afterEach(() => {
  closeMemoryLedger();
});

describe('statement upload', () => {
  it('saves a CSV statement, classifies known merchants, and leaves bad rows out', async () => {
    const { planned, counts, rows } = await uploadCsv('icici.csv');
    expect(countDispositions(planned)).toMatchObject({ new: 1, needs_review: 2, invalid: 1, duplicate: 0 });
    expect(counts).toMatchObject({ created: 1, review: 2, skipped: 1 });
    expect(rows).toHaveLength(3);
    const coffee = rows.find((row) => row.descriptionOriginal.includes('AB COFFEE'));
    expect(coffee?.categoryId).toBe(FOOD_CATEGORY_ID);
    expect(coffee?.purpose).toBe('office');
    expect(coffee?.status).toBe('confirmed');
    expect(coffee?.amountMinor).toBe(18000);
    expect(rows.some((row) => row.descriptionOriginal.includes('BROKEN'))).toBe(false);
    const report = spendingOf(rows);
    expect(report.spendingMinor).toBe(86000);
    expect(report.incomeMinor).toBe(6500000);
    expect(report.officeMealsMinor).toBe(18000);
    expect(report.unclassifiedCount).toBe(1);
    const [batch] = await listImportBatches();
    expect(batch?.rowsSeen).toBe(4);
    expect(batch?.rowsCreated).toBe(1);
    expect(batch?.rowsSkipped).toBe(1);
  });

  it('does not add rows or change totals when the same file is uploaded again', async () => {
    const first = await uploadCsv('icici.csv');
    const second = await uploadCsv('icici.csv');
    expect(second.counts.created).toBe(0);
    expect(second.counts.review).toBe(0);
    expect(second.planned.filter((row) => row.disposition === 'duplicate')).toHaveLength(3);
    expect(second.rows).toHaveLength(first.rows.length);
    expect(spendingOf(second.rows).spendingMinor).toBe(spendingOf(first.rows).spendingMinor);
    expect(spendingOf(second.rows).incomeMinor).toBe(spendingOf(first.rows).incomeMinor);
  });

  it('uploads an Excel sheet through the same review rules', async () => {
    const sheet = XLSX.utils.aoa_to_sheet([
      ['Date', 'Description', 'Type', 'Amount'],
      ['02/03/2025', 'UBER INDIA', 'DEBIT', '350.00'],
      ['02/03/2025', 'UBER INDIA', 'DEBIT', '350.00'],
    ]);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, 'Statement');
    const bytes = new Uint8Array(XLSX.write(book, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer);
    const tabular = parseXlsx(bytes);
    const result = await uploadTabular({ name: 'uber.xlsx', headers: tabular.headers, records: tabular.records, sourceType: 'statement', accountId });
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.categoryName).toBe('Transport');
    expect(result.rows[0]?.purpose).toBe('unknown');
    expect(result.rows[0]?.amountMinor).toBe(35000);
    expect(result.planned.filter((row) => row.disposition === 'duplicate')).toHaveLength(1);
  });

  it('imports a pasted message and skips a second paste of the same line', async () => {
    const line = '02/03/2025 AB COFFEE 180';
    const first = parsePastedMessages(line);
    const uploaded = await uploadTabular({ name: 'paste.txt', headers: first.headers, records: first.records, sourceType: 'message_share', accountId });
    expect(uploaded.rows).toHaveLength(1);
    expect(uploaded.rows[0]?.categoryId).toBe(FOOD_CATEGORY_ID);
    expect(uploaded.rows[0]?.amountMinor).toBe(18000);
    const again = parsePastedMessages(line);
    const repeat = await uploadTabular({ name: 'paste-again.txt', headers: again.headers, records: again.records, sourceType: 'message_share', accountId });
    expect(repeat.rows).toHaveLength(1);
    expect(repeat.counts.created + repeat.counts.review).toBe(0);
  });

  it('does not save a row that has both a debit and a credit', async () => {
    const text = 'Date,Description,Debit,Credit\n02/03/2025,AMBIGUOUS,10.00,10.00\n';
    const result = await uploadCsv('ambiguous.csv', text);
    expect(result.planned[0]?.disposition).toBe('invalid');
    expect(result.rows).toHaveLength(0);
  });

  it('holds a similar amount and date for review instead of merging it', async () => {
    await uploadCsv('icici.csv');
    const text = 'Txn Date,Description,Ref No,Debit,Credit\n02/03/2025,ZOMATO REFUND ADJUSTMENT,OTHER,680.00,\n';
    const result = await uploadCsv('similar.csv', text);
    expect(result.planned[0]?.disposition).toBe('probable_duplicate');
    expect(result.rows.filter((row) => row.amountMinor === 68000)).toHaveLength(1);
  });

  it('applies a user rule on the next upload', async () => {
    await saveRule({
      id: 'rule-zomato', name: 'Zomato', matchField: 'description', operator: 'contains', pattern: 'zomato',
      categoryId: FOOD_CATEGORY_ID, purpose: 'personal', flow: 'expense', kind: 'purchase', counterpartyName: null,
      priority: 10, enabled: true, builtin: false,
    });
    const { rows } = await uploadCsv('icici.csv');
    const zomato = rows.find((row) => row.descriptionOriginal.includes('ZOMATO'));
    expect(zomato?.categoryId).toBe(FOOD_CATEGORY_ID);
    expect(zomato?.purpose).toBe('personal');
    expect(zomato?.status).toBe('confirmed');
  });
});

describe('ledger, reports, backup, and reminders', () => {
  it('counts a purchase and ignores a card repayment', async () => {
    const cardId = 'acct-card';
    await saveAccount({ id: cardId, name: 'Card', type: 'credit_card', institution: null, currency: 'INR', openingBalanceMinor: null });
    await saveTransaction({
      id: createId(), flow: 'expense', kind: 'purchase', amountMinor: 25000, occurredAt: '2026-10-14',
      accountId, sourceAccountId: null, destinationAccountId: null, categoryId: FOOD_CATEGORY_ID, purpose: 'personal',
      merchantName: 'Lunch', counterpartyName: null, descriptionOriginal: 'Lunch', reference: null,
      status: 'confirmed', linkedTransactionId: null, userEdited: true,
    });
    await saveTransaction({
      id: createId(), flow: 'transfer', kind: 'card_repayment', amountMinor: 25000, occurredAt: '2026-10-14',
      accountId: null, sourceAccountId: accountId, destinationAccountId: cardId, categoryId: null, purpose: 'personal',
      merchantName: null, counterpartyName: null, descriptionOriginal: 'Card payment', reference: null,
      status: 'confirmed', linkedTransactionId: null, userEdited: true,
    });
    const rows = await listTransactions();
    expect(spendingOf(rows, '2026-10-14').spendingMinor).toBe(25000);
    expect(spendingOf(rows, '2026-10-14').cardRepaymentMinor).toBe(25000);
    await expect(saveTransaction({
      id: createId(), flow: 'transfer', kind: 'internal_transfer', amountMinor: 100, occurredAt: '2026-10-14',
      accountId: null, sourceAccountId: accountId, destinationAccountId: accountId, categoryId: null, purpose: 'unknown',
      merchantName: null, counterpartyName: null, descriptionOriginal: 'Same account', reference: null,
      status: 'confirmed', linkedTransactionId: null, userEdited: true,
    })).rejects.toThrow(/differ/);
  });

  it('searches, confirms, undoes, and voids a transaction', async () => {
    const { rows } = await uploadCsv('icici.csv');
    const zomato = rows.find((row) => row.descriptionOriginal.includes('ZOMATO'));
    expect(zomato).toBeTruthy();
    const found = await listTransactions({ search: 'zomato' });
    expect(found.map((row) => row.id)).toEqual([zomato?.id]);
    const byAmount = await listTransactions({ search: '680' });
    expect(byAmount.some((row) => row.id === zomato?.id)).toBe(true);
    await updateClassification({ id: zomato!.id, categoryId: FOOD_CATEGORY_ID, purpose: 'office', status: 'confirmed', userEdited: true });
    expect((await listTransactions({ status: 'needs_review' })).some((row) => row.id === zomato?.id)).toBe(false);
    expect(await undoLastClassification(zomato!.id)).toBe(true);
    expect((await listTransactions()).find((row) => row.id === zomato?.id)?.status).toBe('needs_review');
    await voidTransaction(zomato!.id);
    const remaining = await listTransactions();
    expect(remaining.some((row) => row.id === zomato?.id)).toBe(false);
    expect(spendingOf(remaining).spendingMinor).toBe(18000);
  });

  it('rejects an AI file that changes the amount and keeps the ledger amount', async () => {
    const { rows } = await uploadCsv('icici.csv');
    const unresolved = rows.filter((row) => row.status === 'needs_review');
    const exported = await exportAiFile(unresolved);
    const bad = {
      schemaVersion: 1,
      suggestions: unresolved.map((row) => ({ transactionId: row.id, categoryId: FOOD_CATEGORY_ID, purpose: 'personal', amountMinor: 1 })),
    };
    const decisions = await previewAiFile(JSON.stringify(bad));
    expect(decisions.every((decision) => decision.accepted === false)).toBe(true);
    expect((await listTransactions()).find((row) => row.descriptionOriginal.includes('ZOMATO'))?.amountMinor).toBe(68000);
    const good = {
      schemaVersion: 1,
      suggestions: [{ transactionId: unresolved[0]?.id, categoryId: FOOD_CATEGORY_ID, purpose: 'personal' }],
    };
    const [accepted] = await previewAiFile(JSON.stringify(good));
    expect(accepted?.accepted).toBe(true);
    await updateClassification({
      id: accepted!.transactionId, categoryId: accepted!.categoryId, purpose: accepted!.purpose,
      status: 'confirmed', userEdited: true,
    });
    const saved = (await listTransactions()).find((row) => row.id === accepted?.transactionId);
    expect(saved?.categoryId).toBe(FOOD_CATEGORY_ID);
    expect(saved?.amountMinor).not.toBe(1);
    expect(exported.transactions.length).toBe(unresolved.length);
  });

  it('restores a backup without dropping transactions, rules, or reminders', async () => {
    await uploadCsv('sbi.csv');
    await saveRecurring({
      id: 'rent', label: 'Rent', amountMinor: 2500000, cadence: 'monthly', dueDay: 1, leadDays: 1,
      nextDueAt: '2026-11-01', accountId, categoryId: null, purpose: 'personal', status: 'active',
      requiresConfirmation: false, notificationId: null,
    });
    const before = await listTransactions();
    const encrypted = await buildEncryptedBackup('backup-pass');
    await deleteAllData();
    expect(await listTransactions()).toHaveLength(0);
    expect((await listCategories()).map((category) => category.name)).toEqual(['Food & Dining', 'Transport', 'Income']);
    await restoreBackup(encrypted, 'backup-pass');
    const after = await listTransactions();
    expect(after.map((row) => row.amountMinor).sort()).toEqual(before.map((row) => row.amountMinor).sort());
    expect((await listRecurring()).map((item) => item.label)).toEqual(['Rent']);
    expect((await listRules()).some((rule) => rule.name === 'Uber')).toBe(true);
    expect(transactionsToCsv(after)).toContain('UBER INDIA');
  });

  it('stores a reminder without creating a spending transaction', async () => {
    await saveRecurring({
      id: 'electricity', label: 'Electricity', amountMinor: 190000, cadence: 'monthly', dueDay: 31, leadDays: 2,
      nextDueAt: '2026-02-28', accountId: null, categoryId: null, purpose: 'personal', status: 'suggested',
      requiresConfirmation: true, notificationId: null,
    });
    expect(await listTransactions()).toHaveLength(0);
    expect((await listRecurring())[0]?.status).toBe('suggested');
  });
});
