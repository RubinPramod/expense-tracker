import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { Card, ChoiceRow, Field, PrimaryButton, Screen, Title } from '../../src/components/ui';
import { useAppState } from '../../src/context/AppState';
import { listCategories, saveCategory } from '../../src/repositories/ledgerRepository';
import type { CategoryRow } from '../../src/repositories/types';
import { colors } from '../../src/theme/tokens';

export default function CategoriesScreen() {
  const { revision, refresh } = useAppState();
  const [rows, setRows] = useState<CategoryRow[]>([]);
  const [name, setName] = useState('');
  const [direction, setDirection] = useState<CategoryRow['direction']>('expense');
  useEffect(() => { listCategories().then(setRows); }, [revision]);

  return <Screen>
    <Text onPress={() => router.back()} style={{ color: colors.primary, fontWeight: '700' }} accessibilityRole="button">Back</Text>
    <Title subtitle="Food & Dining, Transport, and Income are created with the ledger.">Categories</Title>
    <Card>
      {rows.map((row) => <Text key={row.id} style={{ color: colors.text }}>{row.name} · {row.direction}{row.isSystem ? ' · built in' : ''}</Text>)}
    </Card>
    <Card>
      <Field label="Name" value={name} onChangeText={setName} placeholder="Groceries" />
      <ChoiceRow options={[{ id: 'expense', label: 'Expense' }, { id: 'income', label: 'Income' }, { id: 'both', label: 'Both' }]} value={direction} onChange={(id) => setDirection(id as CategoryRow['direction'])} />
      <PrimaryButton label="Add category" onPress={() => { if (!name.trim()) return; saveCategory({ name, direction }).then(() => { setName(''); refresh(); }); }} />
    </Card>
  </Screen>;
}
