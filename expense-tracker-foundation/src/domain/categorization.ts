import type { TransactionFlow, TransactionKind, TransactionPurpose, TransactionStatus } from './transaction';
import { assertNever } from './ids';

export type MatchField = 'description' | 'merchant' | 'reference' | 'counterparty';
export type MatchOperator = 'contains' | 'equals' | 'starts_with';

export interface CategorizationRule {
  id: string;
  name: string;
  matchField: MatchField;
  operator: MatchOperator;
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

export interface ClassifiableText {
  description: string;
  merchant: string | null;
  reference: string | null;
  counterparty: string | null;
  flow: TransactionFlow;
  kind: TransactionKind;
  purpose: TransactionPurpose;
}

export interface Classification {
  flow: TransactionFlow;
  kind: TransactionKind;
  categoryId: string | null;
  purpose: TransactionPurpose;
  counterpartyName: string | null;
  ruleId: string | null;
  status: TransactionStatus;
}

export function normalizeText(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export function matchRule(input: ClassifiableText, rules: CategorizationRule[]): CategorizationRule | null {
  const ordered = rules
    .filter((rule) => rule.enabled && rule.pattern.trim().length > 0)
    .slice()
    .sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name));
  for (const rule of ordered) {
    if (matches(haystack(input, rule.matchField), rule.operator, rule.pattern)) return rule;
  }
  return null;
}

export function classifyText(input: ClassifiableText, rules: CategorizationRule[]): Classification {
  const rule = matchRule(input, rules);
  if (!rule) {
    return {
      flow: input.flow,
      kind: input.kind,
      categoryId: null,
      purpose: input.purpose,
      counterpartyName: null,
      ruleId: null,
      status: 'needs_review',
    };
  }
  const categoryId = rule.categoryId;
  return {
    flow: rule.flow ?? input.flow,
    kind: rule.kind ?? input.kind,
    categoryId,
    purpose: rule.purpose ?? input.purpose,
    counterpartyName: rule.counterpartyName,
    ruleId: rule.id,
    status: categoryId ? 'confirmed' : 'needs_review',
  };
}

function haystack(input: ClassifiableText, field: MatchField): string {
  switch (field) {
    case 'description':
      return input.description;
    case 'merchant':
      return input.merchant ?? input.description;
    case 'reference':
      return input.reference ?? '';
    case 'counterparty':
      return input.counterparty ?? input.description;
    default:
      return assertNever(field);
  }
}

function matches(value: string, operator: MatchOperator, pattern: string): boolean {
  const left = normalizeText(value);
  const right = normalizeText(pattern);
  if (!left || !right) return false;
  switch (operator) {
    case 'contains':
      return left.includes(right);
    case 'equals':
      return left === right;
    case 'starts_with':
      return left.startsWith(right);
    default:
      return assertNever(operator);
  }
}

export const FOOD_CATEGORY_ID = 'cat_food';
export const TRANSPORT_CATEGORY_ID = 'cat_transport';
export const INCOME_CATEGORY_ID = 'cat_income';

export const BUILTIN_RULES: CategorizationRule[] = [
  rule('rule_alveera', 'Alveera Foods', 'alveera foods', FOOD_CATEGORY_ID, 'office'),
  rule('rule_alvera', 'Alvera Foods', 'alvera foods', FOOD_CATEGORY_ID, 'office'),
  rule('rule_dalchini', 'Dalchini', 'dalchini', FOOD_CATEGORY_ID, 'office'),
  rule('rule_ab_coffee', 'AB Coffee', 'ab coffee', FOOD_CATEGORY_ID, 'office'),
  rule('rule_mmrda', 'MMRDA', 'mmrda', TRANSPORT_CATEGORY_ID, 'unknown'),
  rule('rule_uber', 'Uber', 'uber', TRANSPORT_CATEGORY_ID, null),
  rule('rule_rickshaw', 'Rickshaw', 'rickshaw', TRANSPORT_CATEGORY_ID, null),
];

function rule(
  id: string,
  name: string,
  pattern: string,
  categoryId: string,
  purpose: TransactionPurpose | null,
): CategorizationRule {
  return {
    id,
    name,
    matchField: 'description',
    operator: 'contains',
    pattern,
    categoryId,
    purpose,
    flow: null,
    kind: null,
    counterpartyName: null,
    priority: 500,
    enabled: true,
    builtin: true,
  };
}
