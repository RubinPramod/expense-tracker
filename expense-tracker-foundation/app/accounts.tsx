import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { Card, ChoiceRow, ErrorText, Field, PrimaryButton, Screen, Title } from '../src/components/ui';
import { useAppState } from '../src/context/AppState';
import { createId } from '../src/domain/ids';
import { formatInr, rupeesToMinor } from '../src/domain/money';
import { summarize } from '../src/domain/reports';
import { listAccounts, listTransactions, saveAccount } from '../src/repositories/ledgerRepository';
import type { AccountRow } from '../src/repositories/types';
import { colors } from '../src/theme/tokens';

const TYPES = [
  { id: 'bank', label: 'Bank' },
  { id: 'credit_card', label: 'Credit card' },
  { id: 'cash', label: 'Cash' },
  { id: 'wallet', label: 'Wallet' },
  { id: 'other', label: 'Other' },
] as const;

export default function AccountsScreen() {
  const { revision, refresh } = useAppState();
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [spending, setSpending] = useState(0);
  const [name, setName] = useState('');
  const [institution, setInstitution] = useState('');
  const [balance, setBalance] = useState('');
  const [type, setType] = useState<(typeof TYPES)[number]['id']>('bank');
  const [error, setError] = useState('');

  useEffect(() => {
    listAccounts().then(setAccounts);
    listTransactions().then((rows) => {
      const today = new Date();
      const key = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      setSpending(summarize(rows.map((row) => ({ ...row, merchantName: row.merchantName, description: row.descriptionOriginal, categoryName: row.categoryName })), key).spendingMinor);
    });
  }, [revision]);

  const banks = accounts.filter((account) => account.type === 'bank' && account.isActive);
  const cards = accounts.filter((account) => account.type === 'credit_card' && account.isActive);
  const others = accounts.filter((account) => account.type !== 'bank' && account.type !== 'credit_card' && account.isActive);
  const entered = accounts.reduce((sum, account) => sum + (account.openingBalanceMinor ?? 0), 0);

  async function add() {
    if (!name.trim()) { setError('Name the account.'); return; }
    const opening = balance.trim() ? rupeesToMinor(balance) : null;
    if (balance.trim() && opening == null) { setError('Balance must be a rupee amount.'); return; }
    await saveAccount({ id: createId(), name: name.trim(), type, institution: institution.trim() || null, currency: 'INR', openingBalanceMinor: opening });
    setName(''); setInstitution(''); setBalance(''); setError('');
    refresh();
  }

  return <Screen>
    <Title subtitle="These are labels for your own records. Nothing is connected to a bank.">Accounts and cards</Title>
    <Text onPress={() => router.back()} style={{ color: colors.primary, fontWeight: '700' }} accessibilityRole="button">Back</Text>
    <Card>
      <Text style={{ color: colors.textSecondary }}>Entered balances {formatInr(entered)}</Text>
      <Text style={{ color: colors.textSecondary }}>Spending this month {formatInr(spending)}</Text>
      <Text style={{ color: colors.textSecondary }}>Transfers and card repayments are excluded from spending.</Text>
    </Card>
    <Section title="Bank accounts" rows={banks} />
    <Section title="Credit cards" rows={cards} />
    <Section title="Other accounts" rows={others} />
    <Card>
      <Field label="Name" value={name} onChangeText={setName} placeholder="SBI savings" />
      <Field label="Institution" value={institution} onChangeText={setInstitution} placeholder="Optional" />
      <Field label="Opening balance" value={balance} onChangeText={setBalance} placeholder="Optional" keyboardType="decimal-pad" />
      <ChoiceRow options={TYPES.map((item) => ({ id: item.id, label: item.label }))} value={type} onChange={(id) => setType(id as typeof type)} />
      {error ? <ErrorText>{error}</ErrorText> : null}
      <PrimaryButton label="Add account" onPress={add} />
    </Card>
  </Screen>;
}

function Section({ title, rows }: { title: string; rows: AccountRow[] }) {
  return <Card>
    <Text style={{ color: colors.text, fontWeight: '700' }}>{title}</Text>
    {rows.length === 0 ? <Text style={{ color: colors.textSecondary }}>None yet.</Text> : rows.map((account) => (
      <Text key={account.id} style={{ color: colors.text }}>{account.name}{account.institution ? ` · ${account.institution}` : ''}{account.openingBalanceMinor == null ? '' : ` · ${formatInr(account.openingBalanceMinor)}`}</Text>
    ))}
  </Card>;
}
