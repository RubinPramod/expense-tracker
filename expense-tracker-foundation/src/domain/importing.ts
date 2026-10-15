import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { classifyText, normalizeText, type CategorizationRule } from './categorization';
import { parseFlexibleDate } from './dates';
import { isExactDuplicate, type DuplicateCandidateInput } from './duplicateCandidates';
import { rupeesToMinor } from './money';
import type { TransactionFlow, TransactionKind, TransactionPurpose } from './transaction';
import { assertNever } from './ids';

export interface TabularFile {
  headers: string[];
  records: Record<string, string>[];
}

export interface ColumnMapping {
  date: string;
  postedDate?: string;
  description: string;
  amount?: string;
  debit?: string;
  credit?: string;
  reference?: string;
  direction?: string;
}

export type ImportDisposition = 'new' | 'duplicate' | 'invalid' | 'needs_review' | 'probable_duplicate';

export interface ParsedDraft {
  rowIndex: number;
  accountId: string | null;
  date: string | null;
  postedDate: string | null;
  description: string;
  amountMinor: number | null;
  flow: TransactionFlow;
  kind: TransactionKind;
  reference: string | null;
  categoryId: string | null;
  purpose: TransactionPurpose;
  counterpartyName: string | null;
  ruleId: string | null;
  status: 'needs_review' | 'confirmed';
  sourceKey: string | null;
  originalText: string;
  errors: string[];
  disposition: ImportDisposition;
  matchedTransactionId: string | null;
}

export interface KnownTransaction extends DuplicateCandidateInput {
  id: string;
  sourceKeys: string[];
}

export function parseCsv(text: string): TabularFile {
  const parsed = Papa.parse<string[]>(text.replace(/^\uFEFF/, ''), { header: false, skipEmptyLines: 'greedy' });
  return rowsToTabular(parsed.data);
}

export function parseXlsx(data: Uint8Array): TabularFile {
  const book = XLSX.read(data, { type: 'array' });
  const sheetName = book.SheetNames[0];
  if (!sheetName) return { headers: [], records: [] };
  const sheet = book.Sheets[sheetName];
  if (!sheet) return { headers: [], records: [] };
  const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, { header: 1, raw: false, defval: '' });
  return rowsToTabular(rows.map((row) => row.map((cell) => String(cell ?? ''))));
}

export function suggestMapping(headers: string[]): ColumnMapping {
  const find = (...needles: string[]) => headers.find((header) => {
    const normalized = normalizeText(header);
    const tokens = normalized.split(' ');
    return needles.some((needle) => normalized === needle || tokens.includes(needle) || (needle.includes(' ') && normalized.includes(needle)));
  });
  const date = find('txn date', 'transaction date', 'date') ?? headers[0] ?? 'Date';
  const posted = find('value date', 'posted date');
  const description = find('description', 'narration', 'transaction details', 'details', 'particulars') ?? headers[1] ?? 'Description';
  const debit = find('debit', 'withdrawal');
  const credit = find('credit', 'deposit');
  const amount = find('amount');
  const reference = find('ref no', 'reference', 'cheque', 'utr');
  const direction = find('type', 'dr cr', 'direction');
  return {
    date,
    postedDate: posted,
    description,
    amount: debit || credit ? undefined : amount,
    debit,
    credit,
    reference,
    direction,
  };
}

export function draftsFromTabular(file: TabularFile, mapping: ColumnMapping, accountId: string | null, rules: CategorizationRule[]): ParsedDraft[] {
  return file.records.map((record, rowIndex) => parseRecord(record, rowIndex, mapping, accountId, rules));
}

export function planDrafts(drafts: ParsedDraft[], existing: KnownTransaction[]): ParsedDraft[] {
  const known = existing.map((row) => ({ ...row, sourceKeys: [...row.sourceKeys] }));
  const sourceKeys = new Set(known.flatMap((row) => row.sourceKeys));
  return drafts.map((draft) => {
    if (draft.errors.length || !draft.sourceKey || draft.amountMinor == null || !draft.date) {
      return { ...draft, disposition: 'invalid' as const };
    }
    if (sourceKeys.has(draft.sourceKey)) {
      const match = known.find((row) => row.sourceKeys.includes(draft.sourceKey ?? ''));
      return { ...draft, disposition: 'duplicate' as const, matchedTransactionId: match?.id ?? draft.matchedTransactionId };
    }
    const probe: DuplicateCandidateInput = {
      accountId: draft.accountId,
      amountMinor: draft.amountMinor,
      occurredAt: draft.date,
      flow: draft.flow,
      descriptionNormalized: normalizeText(draft.description),
      reference: draft.reference,
    };
    const exact = known.find((row) => isExactDuplicate(probe, row));
    if (exact) return { ...draft, disposition: 'duplicate' as const, matchedTransactionId: exact.id };
    const fuzzy = known.find((row) => (
      row.accountId != null
      && row.accountId === draft.accountId
      && row.amountMinor === draft.amountMinor
      && row.occurredAt.slice(0, 10) === draft.date
      && row.flow === draft.flow
      && row.descriptionNormalized !== probe.descriptionNormalized
    ));
    if (fuzzy) return { ...draft, disposition: 'probable_duplicate' as const, matchedTransactionId: fuzzy.id };
    sourceKeys.add(draft.sourceKey);
    known.push({ ...probe, id: `pending-${draft.rowIndex}`, sourceKeys: [draft.sourceKey] });
    return { ...draft, disposition: draft.status === 'needs_review' ? 'needs_review' as const : 'new' as const };
  });
}

function parseRecord(record: Record<string, string>, rowIndex: number, mapping: ColumnMapping, accountId: string | null, rules: CategorizationRule[]): ParsedDraft {
  const errors: string[] = [];
  const description = (record[mapping.description] ?? '').trim();
  const originalText = (record.Original ?? description).trim() || description;
  if (!description) errors.push('Description is required.');
  const date = parseFlexibleDate(record[mapping.date] ?? '');
  if (!date) errors.push('Date is missing or not a valid calendar date.');
  const postedDate = mapping.postedDate ? parseFlexibleDate(record[mapping.postedDate] ?? '') : null;
  const reference = mapping.reference ? (record[mapping.reference] ?? '').trim() || null : null;
  const signed = readAmount(record, mapping);
  if (!signed) errors.push('Amount is missing or not a positive rupee value.');
  const flow = signed?.flow ?? 'expense';
  const kind: TransactionKind = flow === 'income' ? 'income' : flow === 'transfer' ? 'internal_transfer' : 'purchase';
  const classified = classifyText({
    description,
    merchant: null,
    reference,
    counterparty: null,
    flow,
    kind,
    purpose: 'unknown',
  }, rules);
  const amountMinor = signed ? Math.abs(signed.minor) : null;
  const sourceKey = date && amountMinor && description
    ? sourceRecordKey({ accountId, date, amountMinor, flow: classified.flow, description, reference })
    : null;
  return {
    rowIndex,
    accountId,
    date,
    postedDate,
    description,
    amountMinor,
    flow: classified.flow,
    kind: classified.kind,
    reference,
    categoryId: classified.categoryId,
    purpose: classified.purpose,
    counterpartyName: classified.counterpartyName,
    ruleId: classified.ruleId,
    status: classified.status === 'confirmed' ? 'confirmed' : 'needs_review',
    sourceKey,
    originalText,
    errors,
    disposition: errors.length ? 'invalid' : 'new',
    matchedTransactionId: null,
  };
}

function readAmount(record: Record<string, string>, mapping: ColumnMapping): { minor: number; flow: TransactionFlow } | null {
  const debit = mapping.debit ? rupeesToMinor(record[mapping.debit] ?? '') : null;
  const credit = mapping.credit ? rupeesToMinor(record[mapping.credit] ?? '') : null;
  if (debit && credit) return null;
  if (debit) return { minor: Math.abs(debit), flow: 'expense' };
  if (credit) return { minor: Math.abs(credit), flow: 'income' };
  if (!mapping.amount) return null;
  const amount = rupeesToMinor(record[mapping.amount] ?? '');
  if (amount == null) return null;
  const direction = normalizeText(mapping.direction ? record[mapping.direction] ?? '' : '');
  if (direction === 'credit' || direction === 'cr' || direction === 'income') return { minor: Math.abs(amount), flow: 'income' };
  if (direction === 'debit' || direction === 'dr' || direction === 'expense') return { minor: Math.abs(amount), flow: 'expense' };
  if (amount < 0) return { minor: Math.abs(amount), flow: 'income' };
  return { minor: amount, flow: 'expense' };
}

export function sourceRecordKey(input: { accountId: string | null; date: string; amountMinor: number; flow: TransactionFlow; description: string; reference: string | null }): string {
  if (input.reference) return `ref:${input.accountId ?? ''}:${input.reference.trim()}`;
  return `fp:${input.accountId ?? ''}:${input.date}:${input.amountMinor}:${input.flow}:${normalizeText(input.description)}`;
}

export function countDispositions(drafts: ParsedDraft[]): Record<ImportDisposition, number> {
  return drafts.reduce<Record<ImportDisposition, number>>((counts, draft) => {
    counts[draft.disposition] += 1;
    return counts;
  }, { new: 0, duplicate: 0, invalid: 0, needs_review: 0, probable_duplicate: 0 });
}

export function parsePastedMessages(text: string): TabularFile {
  const blocks = looksLikeBankAlert(text) ? [text.replace(/\s+/g, ' ').trim()] : text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  return {
    headers: ['Date', 'Description', 'Amount', 'Direction', 'Reference', 'Original'],
    records: blocks.filter(Boolean).map(parseMessageBlock),
  };
}

function looksLikeBankAlert(text: string): boolean {
  return /\b(debited|credited|withdrawn|avl\.?\s*bal)\b/i.test(text);
}

function parseMessageBlock(block: string): Record<string, string> {
  const original = block.replace(/\s+/g, ' ').trim();
  const withoutBalance = original.replace(/\b(?:avl\.?|available)\s*bal(?:ance)?\b[^0-9]*[\d,]+(?:\.\d{1,2})?/gi, ' ');
  const dateToken = /(\d{4}-\d{2}-\d{2}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/.exec(withoutBalance)?.[1] ?? '';
  const reference = /(?:\bUTR\b|\bRef(?:erence)?\b|\bUPI\b)\s*(?:No\.?|ID)?[:\s#-]*([A-Z0-9]{6,})/i.exec(withoutBalance)?.[1] ?? '';
  const merchant = /(?:\bat\b|\bto\b|\btowards\b|\binfo\b:?)\s+([A-Za-z][A-Za-z0-9 &']{0,48})/i.exec(withoutBalance)?.[1]?.trim() ?? '';
  const amountMatch = /(?:₹|inr|rs\.?)\s*([\d,]+(?:\.\d{1,2})?)/i.exec(withoutBalance);
  const plainAmount = amountMatch ? null : [...withoutBalance.replace(dateToken, ' ').matchAll(/(?<![A-Za-z*])(\d[\d,]*(?:\.\d{1,2})?)/g)].at(-1);
  const amount = (amountMatch?.[1] ?? plainAmount?.[1] ?? '').replace(/,/g, '');
  const debit = /\b(debited|debit|spent|paid|purchase|purchased|withdrawn|sent)\b/i.test(withoutBalance);
  const credit = /\b(credited|credit|received|deposited|refund)\b/i.test(withoutBalance);
  const fallbackDescription = withoutBalance
    .replace(dateToken, ' ')
    .replace(amountMatch?.[0] ?? plainAmount?.[0] ?? '', ' ')
    .replace(/\b(?:A\/c|Acct|account)\s*[xX*\d]{2,}\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return {
    Date: expandShortYear(dateToken),
    Description: merchant || fallbackDescription || original,
    Amount: amount,
    Direction: debit ? 'debit' : credit ? 'credit' : '',
    Reference: reference,
    Original: original,
  };
}

function expandShortYear(token: string): string {
  const short = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2})$/.exec(token);
  if (!short) return token;
  const year = Number(short[3]);
  return `${short[1]}/${short[2]}/${year >= 70 ? 1900 + year : 2000 + year}`;
}

function rowsToTabular(rows: string[][]): TabularFile {
  const [headerRow, ...body] = rows.filter((row) => row.some((cell) => String(cell).trim()));
  if (!headerRow) return { headers: [], records: [] };
  const headers = headerRow.map((cell, index) => cell.trim() || `Column ${index + 1}`);
  const records = body.map((row) => {
    const record: Record<string, string> = {};
    headers.forEach((header, index) => { record[header] = (row[index] ?? '').trim(); });
    return record;
  });
  return { headers, records };
}

export function assertDisposition(value: ImportDisposition): ImportDisposition {
  switch (value) {
    case 'new':
    case 'duplicate':
    case 'invalid':
    case 'needs_review':
    case 'probable_duplicate':
      return value;
    default:
      return assertNever(value);
  }
}
