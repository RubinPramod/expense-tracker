import { readFileSync } from 'fs';
import { resolve } from 'path';
import * as XLSX from 'xlsx';
import { BUILTIN_RULES, classifyText, FOOD_CATEGORY_ID, TRANSPORT_CATEGORY_ID } from '../src/domain/categorization';
import { countDispositions, draftsFromTabular, parseCsv, parsePastedMessages, parseXlsx, planDrafts, suggestMapping } from '../src/domain/importing';
import { countsAsGrossSpending } from '../src/domain/ledgerRules';
import { isExactDuplicate, scoreDuplicateCandidate } from '../src/domain/duplicateCandidates';
import type { KnownTransaction } from '../src/domain/importing';

const accountId = 'acct-1';

function load(name: string): string {
  return readFileSync(resolve(__dirname, 'fixtures', name), 'utf8');
}

function planFile(text: string, existing: KnownTransaction[] = []) {
  const tabular = parseCsv(text);
  const mapping = suggestMapping(tabular.headers);
  return planDrafts(draftsFromTabular(tabular, mapping, accountId, BUILTIN_RULES), existing);
}

describe('statement fixtures', () => {
  it('classifies ICICI rows and rejects a malformed date', () => {
    const planned = planFile(load('icici.csv'));
    const counts = countDispositions(planned);
    expect(counts.invalid).toBe(1);
    expect(counts.needs_review).toBe(2);
    const coffee = planned.find((row) => row.description.includes('AB COFFEE'));
    expect(coffee?.categoryId).toBe(FOOD_CATEGORY_ID);
    expect(coffee?.purpose).toBe('office');
    expect(coffee?.disposition).toBe('new');
    expect(coffee?.amountMinor).toBe(18000);
    const salary = planned.find((row) => row.description.includes('SALARY'));
    expect(salary?.flow).toBe('income');
    expect(salary?.amountMinor).toBe(6500000);
  });

  it('maps SBI uber and rickshaw to transport without an office purpose', () => {
    const planned = planFile(load('sbi.csv'));
    for (const row of planned) {
      expect(row.categoryId).toBe(TRANSPORT_CATEGORY_ID);
      expect(row.purpose).toBe('unknown');
      expect(row.disposition).toBe('new');
    }
  });

  it('maps Slice debit and credit rows', () => {
    const planned = planFile(load('slice.csv'));
    const lunch = planned.find((row) => row.description.includes('DALCHINI'));
    expect(lunch?.purpose).toBe('office');
    expect(lunch?.categoryId).toBe(FOOD_CATEGORY_ID);
    const credit = planned.find((row) => row.description.includes('PAYMENT'));
    expect(credit?.flow).toBe('income');
    const alveera = planned.find((row) => row.description.includes('ALVEERA'));
    expect(alveera?.purpose).toBe('office');
  });

  it('does not increase totals when the same statement is planned again', () => {
    const first = planFile(load('icici.csv'));
    const accepted = first.filter((row) => row.disposition === 'new' || row.disposition === 'needs_review');
    const existing: KnownTransaction[] = accepted.map((row) => ({
      id: `tx-${row.rowIndex}`,
      accountId,
      amountMinor: row.amountMinor ?? 0,
      occurredAt: row.date ?? '',
      flow: row.flow,
      descriptionNormalized: row.description.toLowerCase(),
      reference: row.reference,
      sourceKeys: row.sourceKey ? [row.sourceKey] : [],
    }));
    const second = planFile(load('icici.csv'), existing);
    const importable = second.filter((row) => row.disposition === 'new' || row.disposition === 'needs_review');
    expect(importable).toHaveLength(0);
    const spending = accepted
      .filter((row) => row.amountMinor != null && countsAsGrossSpending(row.flow, row.kind))
      .reduce((sum, row) => sum + (row.amountMinor ?? 0), 0);
    expect(spending).toBe(86000);
  });

  it('reads an xlsx sheet with the same mapper', () => {
    const sheet = XLSX.utils.aoa_to_sheet([
      ['Date', 'Description', 'Amount'],
      ['02/03/2025', 'AB COFFEE', '180.00'],
    ]);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, 'Statement');
    const bytes = new Uint8Array(XLSX.write(book, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer);
    const tabular = parseXlsx(bytes);
    const planned = planDrafts(draftsFromTabular(tabular, suggestMapping(tabular.headers), accountId, BUILTIN_RULES), []);
    expect(planned[0]?.categoryId).toBe(FOOD_CATEGORY_ID);
    expect(planned[0]?.amountMinor).toBe(18000);
  });
});

describe('duplicates', () => {
  const base = { accountId, amountMinor: 50000, occurredAt: '2026-10-14', flow: 'expense', descriptionNormalized: 'zomato', reference: null };
  it('does not treat amount and date alone as an exact duplicate', () => {
    expect(isExactDuplicate(base, { ...base, descriptionNormalized: 'swiggy' })).toBe(false);
    expect(scoreDuplicateCandidate(base, { ...base, descriptionNormalized: 'swiggy' }).requiresHumanReview).toBe(true);
  });
  it('matches a stable reference before the description', () => {
    expect(isExactDuplicate({ ...base, reference: 'REF1' }, { ...base, reference: 'REF1', descriptionNormalized: 'other' })).toBe(true);
  });
});

describe('friend rules', () => {
  it('matches a person without assigning an expense category', () => {
    const result = classifyText({
      description: 'Paid Akshat', merchant: null, reference: null, counterparty: null,
      flow: 'expense', kind: 'purchase', purpose: 'unknown',
    }, [...BUILTIN_RULES, {
      id: 'friend', name: 'Akshat', matchField: 'description', operator: 'contains', pattern: 'akshat',
      categoryId: null, purpose: null, flow: null, kind: null, counterpartyName: 'Akshat', priority: 100, enabled: true, builtin: false,
    }]);
    expect(result.categoryId).toBeNull();
    expect(result.counterpartyName).toBe('Akshat');
    expect(result.status).toBe('needs_review');
  });
});

describe('bank message parsing', () => {
  function planMessage(text: string) {
    const tabular = parsePastedMessages(text);
    return planDrafts(draftsFromTabular(tabular, suggestMapping(tabular.headers), accountId, BUILTIN_RULES), []);
  }

  it('keeps a simple pasted line and ignores the balance in a bank alert', () => {
    const simple = planMessage('02/03/2025 AB COFFEE 180');
    expect(simple[0]?.amountMinor).toBe(18000);
    expect(simple[0]?.categoryId).toBe(FOOD_CATEGORY_ID);
    expect(simple[0]?.originalText).toContain('AB COFFEE');

    const alert = planMessage('INR 180.00 debited from A/c XX1234 on 14-10-26 at AB COFFEE. Avl Bal INR 12,400.00. UTR ABC123456');
    expect(alert).toHaveLength(1);
    expect(alert[0]?.amountMinor).toBe(18000);
    expect(alert[0]?.date).toBe('2026-10-14');
    expect(alert[0]?.flow).toBe('expense');
    expect(alert[0]?.reference).toBe('ABC123456');
    expect(alert[0]?.categoryId).toBe(FOOD_CATEGORY_ID);
    expect(alert[0]?.originalText).toContain('12,400.00');
  });

  it('treats a credited alert as income and does not import the available balance', () => {
    const planned = planMessage('INR 65,000.00 credited on 01/04/2026. Info SALARY. Avl Bal INR 90,000.00');
    expect(planned[0]?.flow).toBe('income');
    expect(planned[0]?.amountMinor).toBe(6500000);
    expect(planned[0]?.description).toBe('SALARY');
  });
});
