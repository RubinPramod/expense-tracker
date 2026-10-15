import type { SQLiteDatabase } from 'expo-sqlite';
import { BUILTIN_RULES, FOOD_CATEGORY_ID, INCOME_CATEGORY_ID, TRANSPORT_CATEGORY_ID } from '../domain/categorization';
import { nowIso } from '../domain/ids';

export const SEED_CATEGORIES = [
  { id: FOOD_CATEGORY_ID, name: 'Food & Dining', direction: 'expense', sortOrder: 1 },
  { id: TRANSPORT_CATEGORY_ID, name: 'Transport', direction: 'expense', sortOrder: 2 },
  { id: INCOME_CATEGORY_ID, name: 'Income', direction: 'income', sortOrder: 3 },
] as const;

export async function seedIfEmpty(db: SQLiteDatabase): Promise<void> {
  const existing = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM categories');
  if ((existing?.count ?? 0) > 0) return;
  const timestamp = nowIso();
  for (const category of SEED_CATEGORIES) {
    await db.runAsync(
      `INSERT INTO categories (id, name, parent_id, direction, is_system, sort_order, created_at, updated_at)
       VALUES (?, ?, NULL, ?, 1, ?, ?, ?)`,
      category.id, category.name, category.direction, category.sortOrder, timestamp, timestamp,
    );
  }
  for (const rule of BUILTIN_RULES) {
    await db.runAsync(
      `INSERT INTO categorization_rules (
        id, name, match_field, operator, pattern, merchant_alias_pattern, category_id, purpose,
        flow, kind, counterparty_name, priority, is_builtin, is_enabled, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?, ?)`,
      rule.id, rule.name, rule.matchField, rule.operator, rule.pattern, rule.pattern, rule.categoryId,
      rule.purpose, rule.flow, rule.kind, rule.counterpartyName, rule.priority, timestamp, timestamp,
    );
  }
}
