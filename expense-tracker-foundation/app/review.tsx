import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Card, ChoiceRow, PrimaryButton, Screen, SecondaryButton, Title } from '../src/components/ui';
import { useAppState } from '../src/context/AppState';
import { formatInr } from '../src/domain/money';
import { createId } from '../src/domain/ids';
import { listCategories, listTransactions, saveRule, updateClassification } from '../src/repositories/ledgerRepository';
import type { CategoryRow, TransactionListItem } from '../src/repositories/types';
import type { TransactionPurpose } from '../src/domain/transaction';
import { colors, spacing } from '../src/theme/tokens';

export default function ReviewScreen() {
  const { revision, refresh } = useAppState();
  const [rows, setRows] = useState<TransactionListItem[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [edits, setEdits] = useState<Record<string, { categoryId: string; purpose: TransactionPurpose; rule: boolean }>>({});

  useEffect(() => {
    listTransactions({ status: 'needs_review' }).then(setRows);
    listCategories().then(setCategories);
  }, [revision]);

  function edit(row: TransactionListItem, patch: Partial<{ categoryId: string; purpose: TransactionPurpose; rule: boolean }>) {
    setEdits((current) => ({
      ...current,
      [row.id]: {
        categoryId: patch.categoryId ?? current[row.id]?.categoryId ?? row.categoryId ?? '',
        purpose: patch.purpose ?? current[row.id]?.purpose ?? row.purpose,
        rule: patch.rule ?? current[row.id]?.rule ?? false,
      },
    }));
  }

  async function save() {
    for (const row of rows) {
      const change = edits[row.id];
      if (!change) continue;
      const ruleId = change.rule ? createId() : null;
      if (ruleId) {
        await saveRule({
          id: ruleId, name: row.merchantName ?? row.descriptionOriginal, matchField: 'description', operator: 'contains',
          pattern: row.merchantName ?? row.descriptionOriginal, categoryId: change.categoryId || null, purpose: change.purpose,
          flow: row.flow, kind: row.kind, counterpartyName: null, priority: 100, enabled: true, builtin: false,
        });
      }
      await updateClassification({
        id: row.id,
        categoryId: change.categoryId || null,
        purpose: change.purpose,
        status: change.categoryId ? 'confirmed' : 'needs_review',
        userEdited: true,
        ruleId,
      });
    }
    refresh();
    router.back();
  }

  return <Screen>
    <Title subtitle="Rules can suggest a category. Nothing is applied until you save.">Review queue</Title>
    <Text style={{ color: colors.textSecondary }}>This is not an automatic classifier. Confirm only the rows you change.</Text>
    {rows.length === 0 ? <Card><Text style={{ color: colors.text }}>Nothing is waiting for review.</Text></Card> : rows.map((row) => {
      const change = edits[row.id];
      return <Card key={row.id}>
        <Text style={{ color: colors.text, fontWeight: '700' }}>{row.descriptionOriginal}</Text>
        <Text style={{ color: colors.textSecondary }}>{row.occurredAt.slice(0, 10)} · {formatInr(row.amountMinor)} · {row.flow}</Text>
        <ChoiceRow options={[{ id: '', label: 'No category' }, ...categories.map((category) => ({ id: category.id, label: category.name }))]} value={change?.categoryId ?? row.categoryId ?? ''} onChange={(id) => edit(row, { categoryId: id })} />
        <ChoiceRow options={['office', 'personal', 'shared', 'business', 'unknown'].map((purpose) => ({ id: purpose, label: purpose }))} value={change?.purpose ?? row.purpose} onChange={(id) => edit(row, { purpose: id as TransactionPurpose })} />
        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: change?.rule ?? false }} onPress={() => edit(row, { rule: !(change?.rule ?? false) })}>
          <Text style={{ color: colors.text }}>{change?.rule ? '☑' : '☐'} Create a rule for future matches</Text>
        </Pressable>
      </Card>;
    })}
    <View style={{ flexDirection: 'row', gap: spacing.sm }}>
      <View style={{ flex: 1 }}><SecondaryButton label="Skip for now" onPress={() => router.back()} /></View>
      <View style={{ flex: 1 }}><PrimaryButton label={`Save changes (${Object.keys(edits).length})`} onPress={save} /></View>
    </View>
  </Screen>;
}
