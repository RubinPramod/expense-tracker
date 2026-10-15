import { z } from 'zod';
import type { TransactionPurpose } from './transaction';

export const AI_SCHEMA_VERSION = 1 as const;

const purposeSchema = z.enum(['office', 'personal', 'shared', 'business', 'unknown']);

export const aiExportSchema = z.object({
  schemaVersion: z.literal(AI_SCHEMA_VERSION),
  exportedAt: z.string(),
  prompt: z.string(),
  allowedCategories: z.array(z.object({ id: z.string(), name: z.string() })),
  transactions: z.array(z.object({
    id: z.string().uuid(),
    date: z.string(),
    amountMinor: z.number().int().positive(),
    flow: z.enum(['expense', 'income', 'transfer']),
    description: z.string(),
    categoryId: z.string().nullable(),
    purpose: purposeSchema,
  })),
});

export const aiSuggestionSchema = z.object({
  transactionId: z.string(),
  categoryId: z.string().nullable().optional(),
  purpose: purposeSchema.optional(),
  amountMinor: z.number().optional(),
  date: z.string().optional(),
  description: z.string().optional(),
  flow: z.string().optional(),
  accountId: z.string().optional(),
  direction: z.string().optional(),
});

export const aiImportSchema = z.object({
  schemaVersion: z.literal(AI_SCHEMA_VERSION),
  suggestions: z.array(aiSuggestionSchema),
});

export interface AiLedgerRow {
  id: string;
  date: string;
  amountMinor: number;
  flow: 'expense' | 'income' | 'transfer';
  description: string;
  categoryId: string | null;
  purpose: TransactionPurpose;
  userEdited: boolean;
}

export interface AiSuggestionDecision {
  transactionId: string;
  categoryId: string | null;
  purpose: TransactionPurpose;
  accepted: boolean;
  reason: string | null;
}

export function buildAiExport(rows: AiLedgerRow[], categories: { id: string; name: string }[], exportedAt: string) {
  const payload = {
    schemaVersion: AI_SCHEMA_VERSION,
    exportedAt,
    prompt: [
      'Classify these personal transactions.',
      'Return JSON with schemaVersion 1 and suggestions: [{ transactionId, categoryId, purpose }].',
      'purpose must be office, personal, shared, business, or unknown.',
      'categoryId must be one of allowedCategories.',
      'Do not change transaction ids, dates, amounts, accounts, direction, or descriptions.',
    ].join(' '),
    allowedCategories: categories.map((category) => ({ id: category.id, name: category.name })),
    transactions: rows.map((row) => ({
      id: row.id,
      date: row.date,
      amountMinor: row.amountMinor,
      flow: row.flow,
      description: row.description,
      categoryId: row.categoryId,
      purpose: row.purpose,
    })),
  };
  return aiExportSchema.parse(payload);
}

export function reviewAiSuggestions(fileText: string, current: AiLedgerRow[], allowedCategoryIds: string[]): AiSuggestionDecision[] {
  let parsed: z.infer<typeof aiImportSchema>;
  try {
    parsed = aiImportSchema.parse(JSON.parse(fileText));
  } catch {
    return [{ transactionId: '', categoryId: null, purpose: 'unknown', accepted: false, reason: 'The file is not a valid suggestion document.' }];
  }
  const seen = new Set<string>();
  const byId = new Map(current.map((row) => [row.id, row]));
  return parsed.suggestions.map((suggestion) => {
    const row = byId.get(suggestion.transactionId);
    const purpose = suggestion.purpose ?? row?.purpose ?? 'unknown';
    const categoryId = suggestion.categoryId ?? null;
    if (!row) {
      return { transactionId: suggestion.transactionId, categoryId, purpose, accepted: false, reason: 'Unknown transaction.' };
    }
    if (seen.has(suggestion.transactionId)) {
      return { transactionId: suggestion.transactionId, categoryId, purpose, accepted: false, reason: 'Duplicate suggestion for this transaction.' };
    }
    seen.add(suggestion.transactionId);
    if (suggestion.accountId || suggestion.direction) {
      return { transactionId: suggestion.transactionId, categoryId, purpose, accepted: false, reason: 'Suggestions cannot change the account or direction.' };
    }
    if (suggestion.amountMinor != null && suggestion.amountMinor !== row.amountMinor) {
      return { transactionId: suggestion.transactionId, categoryId, purpose, accepted: false, reason: 'Amount does not match the ledger.' };
    }
    if (suggestion.date != null && suggestion.date.slice(0, 10) !== row.date.slice(0, 10)) {
      return { transactionId: suggestion.transactionId, categoryId, purpose, accepted: false, reason: 'Date does not match the ledger.' };
    }
    if (suggestion.description != null && suggestion.description !== row.description) {
      return { transactionId: suggestion.transactionId, categoryId, purpose, accepted: false, reason: 'Description does not match the ledger.' };
    }
    if (suggestion.flow != null && suggestion.flow !== row.flow) {
      return { transactionId: suggestion.transactionId, categoryId, purpose, accepted: false, reason: 'Direction does not match the ledger.' };
    }
    if (row.userEdited) {
      return { transactionId: suggestion.transactionId, categoryId, purpose, accepted: false, reason: 'A user correction is already saved for this transaction.' };
    }
    if (categoryId != null && !allowedCategoryIds.includes(categoryId)) {
      return { transactionId: suggestion.transactionId, categoryId, purpose, accepted: false, reason: 'Unknown category.' };
    }
    return { transactionId: suggestion.transactionId, categoryId, purpose, accepted: true, reason: null };
  });
}
