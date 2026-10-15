import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { AppIcon } from '../../src/components/AppIcon';
import { ChoiceRow, EmptyState, PrimaryButton, Screen, SecondaryButton, Title } from '../../src/components/ui';
import { useAppState } from '../../src/context/AppState';
import { displayDate, monthWindow } from '../../src/domain/dates';
import { formatInr, rupeesToMinor } from '../../src/domain/money';
import { groupByDate } from '../../src/domain/reports';
import { listAccounts, listCategories, listTransactions } from '../../src/repositories/ledgerRepository';
import type { AccountRow, CategoryRow, TransactionListItem, TransactionQuery } from '../../src/repositories/types';
import type { TransactionFlow, TransactionPurpose } from '../../src/domain/transaction';
import { colors, radii, spacing, touchTarget, typography } from '../../src/theme/tokens';

export default function TransactionsScreen() {
  const { revision } = useAppState();
  const [search, setSearch] = useState('');
  const [flow, setFlow] = useState<TransactionFlow | ''>('');
  const [rows, setRows] = useState<TransactionListItem[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [query, setQuery] = useState<TransactionQuery>({});
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  useEffect(() => {
    listAccounts().then(setAccounts);
    listCategories().then(setCategories);
  }, [revision]);

  useEffect(() => {
    listTransactions({ ...query, search, flow: flow || undefined }).then(setRows);
  }, [revision, search, flow, query]);

  const groups = groupByDate(rows);
  const activeFilters = Object.values(query).filter((value) => value != null && value !== '').length;

  return <Screen scroll={false}>
    <Title subtitle="All your transactions in one place">Transactions</Title>
    <View style={{ minHeight: touchTarget.minHeight, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radii.lg, paddingHorizontal: spacing.md }}>
      <AppIcon name="search" color={colors.textSecondary} />
      <TextInput accessibilityLabel="Search transactions" placeholder="Search by merchant, amount, category" placeholderTextColor={colors.textSecondary} style={{ flex: 1, minHeight: touchTarget.minHeight, color: colors.text, fontSize: typography.secondary }} value={search} onChangeText={setSearch} />
    </View>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center' }}>
      <ChoiceRow options={[{ id: '', label: 'All' }, { id: 'expense', label: 'Expense' }, { id: 'income', label: 'Income' }, { id: 'transfer', label: 'Transfer' }]} value={flow} onChange={(id) => setFlow(id as TransactionFlow | '')} />
      <Pressable accessibilityRole="button" accessibilityLabel="Filter transactions" onPress={() => setFiltersOpen(true)} style={{ minHeight: touchTarget.minHeight, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.md, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.primary }}>
        <AppIcon name="filter" size={18} /><Text style={{ color: colors.primary, fontWeight: '700' }}>Filter{activeFilters ? ` (${activeFilters})` : ''}</Text>
      </Pressable>
    </View>
    <ScrollView contentContainerStyle={{ gap: spacing.md, paddingBottom: spacing.xxxl }}>
      {groups.length === 0 ? <EmptyState title="No transactions yet" body="Add a transaction or import a statement to get started." /> : groups.map((group) => (
        <View key={group.date} style={{ gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: colors.text, fontWeight: '700' }}>{displayDate(group.date)}</Text>
            <Text style={{ color: colors.textSecondary }}>Spending {formatInr(group.spendingMinor)}</Text>
          </View>
          {group.rows.map((row) => (
            <Pressable key={row.id} accessibilityRole="button" accessibilityLabel={`${row.descriptionOriginal}, ${formatInr(row.amountMinor)}`} onPress={() => router.push(`/transaction/${row.id}`)} style={{ minHeight: 56, backgroundColor: colors.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flex: 1, paddingRight: spacing.md }}>
                <Text style={{ color: colors.text, fontWeight: '700' }}>{row.merchantName ?? row.counterpartyName ?? row.descriptionOriginal}</Text>
                <Text style={{ color: colors.textSecondary, fontSize: typography.caption }}>{row.categoryName ?? 'Uncategorised'} · {row.accountName ?? row.sourceAccountName ?? 'No account'}{row.status === 'needs_review' ? ' · Needs review' : ''}</Text>
              </View>
              <Text style={{ color: row.flow === 'income' ? colors.income : colors.expense, fontWeight: '700' }}>{row.flow === 'income' ? '+' : '-'}{formatInr(row.amountMinor)}</Text>
            </Pressable>
          ))}
        </View>
      ))}
    </ScrollView>
    <FilterSheet visible={filtersOpen} accounts={accounts} categories={categories} today={todayKey} onClose={() => setFiltersOpen(false)} onApply={setQuery} />
  </Screen>;
}

function FilterSheet({ visible, accounts, categories, today, onClose, onApply }: {
  visible: boolean;
  accounts: AccountRow[];
  categories: CategoryRow[];
  today: string;
  onClose: () => void;
  onApply: (query: TransactionQuery) => void;
}) {
  const month = monthWindow(today);
  const [range, setRange] = useState('month');
  const [accountId, setAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [purpose, setPurpose] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [merchant, setMerchant] = useState('');

  function apply() {
    const from = range === 'month' ? month.start : range === 'last' ? monthWindow(today, -1).start : undefined;
    const to = range === 'month' ? month.end : range === 'last' ? monthWindow(today, -1).end : undefined;
    onApply({
      accountId: accountId || undefined,
      categoryId: categoryId || undefined,
      purpose: (purpose || undefined) as TransactionPurpose | undefined,
      dateFrom: from,
      dateTo: to,
      minMinor: rupeesToMinor(minAmount) ?? undefined,
      maxMinor: rupeesToMinor(maxAmount) ?? undefined,
      merchant: merchant || undefined,
    });
    onClose();
  }

  return <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
    <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, backgroundColor: colors.background }}>
      <Title subtitle="Date, account, category, amount, merchant, and purpose">Filter transactions</Title>
      <ChoiceRow options={[{ id: 'month', label: 'This month' }, { id: 'last', label: 'Last month' }, { id: 'all', label: 'All dates' }]} value={range} onChange={setRange} />
      <Text style={{ fontWeight: '700', color: colors.text }}>Account</Text>
      <ChoiceRow options={[{ id: '', label: 'All' }, ...accounts.map((account) => ({ id: account.id, label: account.name }))]} value={accountId} onChange={setAccountId} />
      <Text style={{ fontWeight: '700', color: colors.text }}>Category</Text>
      <ChoiceRow options={[{ id: '', label: 'All' }, ...categories.map((category) => ({ id: category.id, label: category.name }))]} value={categoryId} onChange={setCategoryId} />
      <Text style={{ fontWeight: '700', color: colors.text }}>Purpose</Text>
      <ChoiceRow options={[{ id: '', label: 'All' }, { id: 'office', label: 'Office' }, { id: 'personal', label: 'Personal' }, { id: 'shared', label: 'Shared' }, { id: 'business', label: 'Business' }, { id: 'unknown', label: 'Unknown' }]} value={purpose} onChange={setPurpose} />
      <TextInput accessibilityLabel="Minimum amount" placeholder="Min amount" value={minAmount} onChangeText={setMinAmount} keyboardType="decimal-pad" style={{ minHeight: 44, borderWidth: 1, borderColor: colors.border, borderRadius: radii.lg, paddingHorizontal: spacing.md, backgroundColor: colors.surface }} />
      <TextInput accessibilityLabel="Maximum amount" placeholder="Max amount" value={maxAmount} onChangeText={setMaxAmount} keyboardType="decimal-pad" style={{ minHeight: 44, borderWidth: 1, borderColor: colors.border, borderRadius: radii.lg, paddingHorizontal: spacing.md, backgroundColor: colors.surface }} />
      <TextInput accessibilityLabel="Merchant or counterparty" placeholder="Merchant or counterparty" value={merchant} onChangeText={setMerchant} style={{ minHeight: 44, borderWidth: 1, borderColor: colors.border, borderRadius: radii.lg, paddingHorizontal: spacing.md, backgroundColor: colors.surface }} />
      <PrimaryButton label="Apply filters" onPress={apply} />
      <SecondaryButton label="Reset" onPress={() => { setRange('all'); setAccountId(''); setCategoryId(''); setPurpose(''); setMinAmount(''); setMaxAmount(''); setMerchant(''); onApply({}); onClose(); }} />
    </ScrollView>
  </Modal>;
}
