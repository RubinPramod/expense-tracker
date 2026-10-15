import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Card, Screen, Title } from '../../src/components/ui';
import { useAppState } from '../../src/context/AppState';
import { monthWindow } from '../../src/domain/dates';
import { formatInr } from '../../src/domain/money';
import { summarize, type ReportTransaction } from '../../src/domain/reports';
import { listTransactions } from '../../src/repositories/ledgerRepository';
import type { TransactionListItem } from '../../src/repositories/types';
import { colors, spacing } from '../../src/theme/tokens';

export default function ReportsScreen() {
  const { revision } = useAppState();
  const [rows, setRows] = useState<TransactionListItem[]>([]);
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  useEffect(() => { listTransactions().then(setRows); }, [revision]);
  const report = summarize(rows.map(toReport), todayKey);
  const max = Math.max(...report.months.map((month) => month.spendingMinor), 1);

  return <Screen>
    <Title subtitle={report.partial ? `${monthWindow(todayKey).label} is still in progress` : monthWindow(todayKey).label}>Reports</Title>
    <View style={{ flexDirection: 'row', gap: spacing.sm }}>
      <Summary label="Income" value={formatInr(report.incomeMinor)} color={colors.income} />
      <Summary label="Gross spending" value={formatInr(report.spendingMinor)} color={colors.expense} />
      <Summary label="Net spending" value={formatInr(report.netSpendingMinor)} color={colors.primary} />
    </View>
    <Card>
      <Text style={{ color: colors.text, fontWeight: '700' }}>Also excluded or shown apart</Text>
      <Text style={{ color: colors.textSecondary }}>Refunds {formatInr(report.refundMinor)} · Transfers {formatInr(report.transferMinor)} · Card repayments {formatInr(report.cardRepaymentMinor)}</Text>
      <Text style={{ color: colors.textSecondary }}>Office spending {formatInr(report.officeSpendingMinor)} · Office meals {formatInr(report.officeMealsMinor)}</Text>
      <Text style={{ color: colors.text, fontWeight: '700' }}>{report.unclassifiedCount} unclassified · {formatInr(report.unclassifiedMinor)}</Text>
    </Card>
    <Card>
      <Text style={{ color: colors.text, fontWeight: '700' }}>Last 6 months</Text>
      {report.months.map((month) => (
        <View key={month.key} style={{ gap: 4 }}>
          <Text style={{ color: colors.textSecondary }}>{month.label}{month.partial ? ' · partial' : ''}</Text>
          <View style={{ height: 10, backgroundColor: colors.surfaceSubtle, borderRadius: 99 }}>
            <View style={{ width: `${Math.round((month.spendingMinor / max) * 100)}%`, height: 10, backgroundColor: colors.primary, borderRadius: 99 }} />
          </View>
        </View>
      ))}
    </Card>
    <Card>
      <Text style={{ color: colors.text, fontWeight: '700' }}>Spending by category</Text>
      {report.categories.length === 0 ? <Text style={{ color: colors.textSecondary }}>No expenses in this month.</Text> : report.categories.map((slice) => (
        <Text key={slice.name} style={{ color: colors.text }}>{slice.name} · {formatInr(slice.amountMinor)} · {Math.round(slice.share * 100)}%</Text>
      ))}
    </Card>
    <Card>
      <Text style={{ color: colors.text, fontWeight: '700' }}>Top merchants</Text>
      {report.merchants.length === 0 ? <Text style={{ color: colors.textSecondary }}>Merchant totals appear from the descriptions you import or enter.</Text> : report.merchants.slice(0, 5).map((merchant, index) => (
        <Text key={merchant.name} style={{ color: colors.text }}>{index + 1}. {merchant.name} · {formatInr(merchant.amountMinor)}</Text>
      ))}
    </Card>
  </Screen>;
}

function Summary({ label, value, color }: { label: string; value: string; color: string }) {
  return <View style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: 4 }}>
    <Text style={{ color, fontSize: 12, fontWeight: '700' }}>{label}</Text>
    <Text style={{ color: colors.text, fontWeight: '800' }}>{value}</Text>
  </View>;
}

function toReport(row: TransactionListItem): ReportTransaction {
  return {
    id: row.id, flow: row.flow, kind: row.kind, amountMinor: row.amountMinor, occurredAt: row.occurredAt,
    categoryId: row.categoryId, categoryName: row.categoryName, purpose: row.purpose, status: row.status,
    merchantName: row.merchantName, description: row.descriptionOriginal,
  };
}
