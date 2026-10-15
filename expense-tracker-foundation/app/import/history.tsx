import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { Card, Screen, Title } from '../../src/components/ui';
import { displayDate } from '../../src/domain/dates';
import { listImportBatches } from '../../src/repositories/ledgerRepository';
import type { ImportBatchRow } from '../../src/repositories/types';
import { colors } from '../../src/theme/tokens';

export default function ImportHistoryScreen() {
  const [rows, setRows] = useState<ImportBatchRow[]>([]);
  useEffect(() => { listImportBatches().then(setRows); }, []);
  return <Screen>
    <Text onPress={() => router.back()} style={{ color: colors.primary, fontWeight: '700' }} accessibilityRole="button">Back</Text>
    <Title subtitle="Each batch records how many rows were created, skipped, or left for review.">Import history</Title>
    {rows.length === 0 ? <Card><Text style={{ color: colors.textSecondary }}>No imports yet.</Text></Card> : rows.map((row) => (
      <Card key={row.id}>
        <Text style={{ color: colors.text, fontWeight: '700' }}>{row.sourceLabel ?? row.sourceType}</Text>
        <Text style={{ color: colors.textSecondary }}>{displayDate(row.createdAt)} · {row.status}</Text>
        <Text style={{ color: colors.textSecondary }}>Seen {row.rowsSeen} · created {row.rowsCreated} · review {row.rowsReview} · skipped {row.rowsSkipped}</Text>
      </Card>
    ))}
  </Screen>;
}
