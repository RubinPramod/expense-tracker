import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { TransactionEditor } from '../../src/components/TransactionEditor';
import { Screen, SecondaryButton, Title } from '../../src/components/ui';
import { useAppState } from '../../src/context/AppState';
import { getTransaction, undoLastClassification, voidTransaction } from '../../src/repositories/ledgerRepository';
import type { TransactionListItem } from '../../src/repositories/types';
import { colors } from '../../src/theme/tokens';

export default function TransactionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { refresh } = useAppState();
  const [row, setRow] = useState<TransactionListItem | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (id) getTransaction(id).then(setRow);
  }, [id]);

  if (!row) return <Screen><Title>Transaction</Title><Text style={{ color: colors.textSecondary }}>Loading the ledger row.</Text></Screen>;

  return <Screen>
    <Title subtitle={row.sourceType ? `Imported from ${row.sourceType}. Amount, date, and original description stay as imported.` : 'Manual entry'}>{row.merchantName ?? 'Edit transaction'}</Title>
    <TransactionEditor existing={row} onDone={() => router.back()} />
    <SecondaryButton label="Undo last classification" onPress={() => {
      undoLastClassification(row.id).then((done) => {
        setMessage(done ? 'The previous category and purpose were restored.' : 'There is no classification change to undo.');
        refresh();
        getTransaction(row.id).then(setRow);
      });
    }} />
    <SecondaryButton label="Void transaction" onPress={() => {
      voidTransaction(row.id).then(() => { refresh(); router.back(); });
    }} />
    {message ? <Text style={{ color: colors.textSecondary }}>{message}</Text> : null}
  </Screen>;
}
