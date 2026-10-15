import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { Card, ChoiceRow, Field, PrimaryButton, Screen, Title } from '../../src/components/ui';
import { useAppState } from '../../src/context/AppState';
import { createId } from '../../src/domain/ids';
import { listCategories, listRules, saveRule } from '../../src/repositories/ledgerRepository';
import type { CategoryRow, RuleRow } from '../../src/repositories/types';
import type { TransactionPurpose } from '../../src/domain/transaction';
import { colors } from '../../src/theme/tokens';

export default function RulesScreen() {
  const { revision, refresh } = useAppState();
  const [rules, setRules] = useState<RuleRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [name, setName] = useState('');
  const [pattern, setPattern] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [purpose, setPurpose] = useState<TransactionPurpose>('unknown');
  const [priority, setPriority] = useState('100');

  useEffect(() => {
    listRules().then(setRules);
    listCategories().then(setCategories);
  }, [revision]);

  async function add() {
    if (!name.trim() || !pattern.trim()) return;
    await saveRule({
      id: createId(), name: name.trim(), matchField: 'description', operator: 'contains', pattern: pattern.trim(),
      categoryId: categoryId || null, purpose, flow: null, kind: null, counterpartyName: null,
      priority: Number(priority) || 100, enabled: true, builtin: false,
    });
    setName(''); setPattern('');
    refresh();
  }

  return <Screen>
    <Text onPress={() => router.back()} style={{ color: colors.primary, fontWeight: '700' }} accessibilityRole="button">Back</Text>
    <Title subtitle="Your rules run before the built-in merchant aliases. A lower priority number wins.">Rules</Title>
    {rules.map((rule) => (
      <Card key={rule.id}>
        <Text style={{ color: colors.text, fontWeight: '700' }}>{rule.name}{rule.builtin ? ' · built in' : ''}</Text>
        <Text style={{ color: colors.textSecondary }}>{rule.operator} "{rule.pattern}" · priority {rule.priority} · {rule.enabled ? 'on' : 'off'}</Text>
        <Text style={{ color: colors.primary }} accessibilityRole="button" onPress={() => saveRule({ ...rule, enabled: !rule.enabled }).then(refresh)}>{rule.enabled ? 'Disable' : 'Enable'}</Text>
      </Card>
    ))}
    <Card>
      <Field label="Name" value={name} onChangeText={setName} />
      <Field label="Description contains" value={pattern} onChangeText={setPattern} />
      <Field label="Priority" value={priority} onChangeText={setPriority} keyboardType="number-pad" />
      <ChoiceRow options={[{ id: '', label: 'No category' }, ...categories.map((category) => ({ id: category.id, label: category.name }))]} value={categoryId} onChange={setCategoryId} />
      <ChoiceRow options={['office', 'personal', 'shared', 'business', 'unknown'].map((item) => ({ id: item, label: item }))} value={purpose} onChange={(id) => setPurpose(id as TransactionPurpose)} />
      <PrimaryButton label="Add rule" onPress={add} />
    </Card>
  </Screen>;
}
