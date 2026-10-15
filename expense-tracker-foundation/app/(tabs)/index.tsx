import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { AppIcon } from '../../src/components/AppIcon';
import { Card, EmptyState, Screen, Title } from '../../src/components/ui';
import { useAppState } from '../../src/context/AppState';
import { displayDate, greeting, monthWindow } from '../../src/domain/dates';
import { formatInr } from '../../src/domain/money';
import { summarize, type ReportTransaction } from '../../src/domain/reports';
import { getMetadata, listRecurring, listTransactions } from '../../src/repositories/ledgerRepository';
import type { RecurringRow, TransactionListItem } from '../../src/repositories/types';
import { colors, spacing, typography } from '../../src/theme/tokens';

export default function OverviewScreen() {
  const { revision } = useAppState();
  const [rows, setRows] = useState<TransactionListItem[]>([]);
  const [bills, setBills] = useState<RecurringRow[]>([]);
  const [name, setName] = useState('');
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  useEffect(() => {
    listTransactions().then(setRows);
    listRecurring().then(setBills);
    getMetadata('display_name').then((value) => setName(value ?? ''));
  }, [revision]);

  const reportRows: ReportTransaction[] = rows.map(toReport);
  const report = summarize(reportRows, todayKey);
  const month = monthWindow(todayKey);
  const upcoming = bills.filter((bill) => bill.status === 'active' && bill.nextDueAt).slice(0, 3);

  return <Screen>
    <Title subtitle="Here's your financial snapshot">{name ? `${greeting()}, ${name}` : greeting()}</Title>
    <Card>
      <Text style={{ color: colors.textSecondary }}>Total spending · {month.label}{report.partial ? ' · partial' : ''}</Text>
      <Text style={{ color: colors.text, fontSize: 34, fontWeight: '800' }}>{formatInr(report.spendingMinor)}</Text>
      <Text style={{ color: colors.textSecondary }}>Gross spending. Refunds of {formatInr(report.refundMinor)} are shown separately.</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        <Metric label="Income" value={formatInr(report.incomeMinor)} color={colors.income} />
        <Metric label="Transfers" value={formatInr(report.transferMinor)} color={colors.info} />
        <Metric label="Card payments" value={formatInr(report.cardRepaymentMinor)} color={colors.primary} />
      </View>
    </Card>
    <Pressable accessibilityRole="button" accessibilityLabel="Open review queue" onPress={() => router.push('/review')}>
      <Card>
        <Text style={{ color: colors.text, fontWeight: '700' }}>{report.unclassifiedCount} items need your review</Text>
        <Text style={{ color: colors.textSecondary }}>{formatInr(report.unclassifiedMinor)} is still unclassified. Totals are not fully categorised until these are resolved.</Text>
      </Card>
    </Pressable>
    <Card>
      <Text style={{ color: colors.text, fontWeight: '700' }}>Spending by category</Text>
      {report.categories.length === 0 ? <Text style={{ color: colors.textSecondary }}>Category totals appear after you add expenses.</Text> : report.categories.map((slice) => (
        <View key={slice.name} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md }}>
          <Text style={{ color: colors.text, flex: 1 }}>{slice.name}</Text>
          <Text style={{ color: colors.textSecondary }}>{Math.round(slice.share * 100)}%</Text>
          <Text style={{ color: colors.text, fontWeight: '600' }}>{formatInr(slice.amountMinor)}</Text>
        </View>
      ))}
    </Card>
    <Card>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ color: colors.text, fontWeight: '700' }}>Upcoming bills</Text>
        <Text style={{ color: colors.primary, fontWeight: '700' }} onPress={() => router.push('/bills')} accessibilityRole="button">View all</Text>
      </View>
      {upcoming.length === 0 ? <Text style={{ color: colors.textSecondary }}>Confirmed reminders show up here.</Text> : upcoming.map((bill) => (
        <View key={bill.id} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ color: colors.text }}>{bill.label}</Text>
          <Text style={{ color: colors.textSecondary }}>{bill.nextDueAt?.slice(0, 10)} · {bill.amountMinor == null ? 'Amount varies' : formatInr(bill.amountMinor)}</Text>
        </View>
      ))}
    </Card>
    <Card>
      <Text style={{ color: colors.text, fontWeight: '700' }}>Recent transactions</Text>
      {rows.length === 0 ? <EmptyState title="No transactions yet" body="Add one, or import a statement. Sample merchants are not included." /> : rows.slice(0, 5).map((row) => (
        <Pressable key={row.id} accessibilityRole="button" accessibilityLabel={row.descriptionOriginal} onPress={() => router.push(`/transaction/${row.id}`)} style={{ minHeight: 44, justifyContent: 'center' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontWeight: '600' }}>{row.merchantName ?? row.descriptionOriginal}</Text>
              <Text style={{ color: colors.textSecondary, fontSize: typography.caption }}>{displayDate(row.occurredAt)} · {row.categoryName ?? 'Uncategorised'}</Text>
            </View>
            <Text style={{ color: row.flow === 'income' ? colors.income : colors.expense, fontWeight: '700' }}>{row.flow === 'income' ? '+' : '-'}{formatInr(row.amountMinor)}</Text>
          </View>
        </Pressable>
      ))}
    </Card>
    <Pressable accessibilityRole="button" onPress={() => router.push('/import/statements')} style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center', minHeight: 44 }}>
      <AppIcon name="upload" size={18} />
      <Text style={{ color: colors.primary, fontWeight: '700' }}>Import a statement</Text>
    </Pressable>
  </Screen>;
}

function Metric({ label, value, color }: { label: string; value: string; color: string }) {
  return <View style={{ backgroundColor: colors.surfaceSubtle, borderRadius: 16, padding: spacing.md, minWidth: 140, flexGrow: 1 }}>
    <Text style={{ color }}>{label}</Text>
    <Text style={{ color: colors.text, fontWeight: '700' }}>{value}</Text>
  </View>;
}

function toReport(row: TransactionListItem): ReportTransaction {
  return {
    id: row.id, flow: row.flow, kind: row.kind, amountMinor: row.amountMinor, occurredAt: row.occurredAt,
    categoryId: row.categoryId, categoryName: row.categoryName, purpose: row.purpose, status: row.status,
    merchantName: row.merchantName, description: row.descriptionOriginal,
  };
}
