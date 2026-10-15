import { useEffect, useState } from 'react';
import { Pressable, Text } from 'react-native';
import { formatLocalDate } from '../domain/dates';
import { createId } from '../domain/ids';
import { minorToRupeeInput, rupeesToMinor } from '../domain/money';
import type { TransactionFlow, TransactionKind, TransactionPurpose } from '../domain/transaction';
import { useAppState } from '../context/AppState';
import { listAccounts, listCategories, saveRule, saveTransaction } from '../repositories/ledgerRepository';
import type { AccountRow, CategoryRow, TransactionListItem } from '../repositories/types';
import { colors, typography } from '../theme/tokens';
import { Card, ChoiceRow, ErrorText, Field, PrimaryButton, SecondaryButton } from './ui';

const PURPOSES: TransactionPurpose[] = ['unknown', 'personal', 'office', 'shared', 'business'];

export function TransactionEditor({ existing, onDone }: { existing?: TransactionListItem | null; onDone: () => void }) {
  const { refresh } = useAppState();
  const locked = existing?.sourceType === 'statement' || existing?.sourceType === 'message_share';
  const [flow, setFlow] = useState<TransactionFlow>(existing?.flow ?? 'expense');
  const [kind, setKind] = useState<TransactionKind>(existing?.kind ?? 'purchase');
  const [amount, setAmount] = useState(existing ? minorToRupeeInput(existing.amountMinor) : '');
  const [date, setDate] = useState(existing?.occurredAt.slice(0, 10) ?? formatLocalDate(new Date()));
  const [merchant, setMerchant] = useState(existing?.merchantName ?? existing?.counterpartyName ?? '');
  const [description, setDescription] = useState(existing?.descriptionOriginal ?? '');
  const [purpose, setPurpose] = useState<TransactionPurpose>(existing?.purpose ?? 'unknown');
  const [accountId, setAccountId] = useState(existing?.accountId ?? '');
  const [sourceAccountId, setSourceAccountId] = useState(existing?.sourceAccountId ?? '');
  const [destinationAccountId, setDestinationAccountId] = useState(existing?.destinationAccountId ?? '');
  const [categoryId, setCategoryId] = useState(existing?.categoryId ?? '');
  const [createRule, setCreateRule] = useState(false);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    listAccounts().then(setAccounts).catch((err: unknown) => setError(err instanceof Error ? err.message : 'Accounts could not be loaded.'));
    listCategories().then(setCategories).catch((err: unknown) => setError(err instanceof Error ? err.message : 'Categories could not be loaded.'));
  }, []);

  const kinds = kindsFor(flow);
  const visibleCategories = categories.filter((category) => flow === 'income' ? category.direction !== 'expense' : category.direction !== 'income' || flow === 'transfer');

  async function onSave() {
    const minor = locked && existing ? existing.amountMinor : rupeesToMinor(amount);
    const occurredAt = locked && existing ? existing.occurredAt.slice(0, 10) : date;
    if (!occurredAt.match(/^\d{4}-\d{2}-\d{2}$/)) { setError('Use a date like 2026-10-14.'); return; }
    if (minor == null || minor <= 0) { setError('Enter an amount in rupees, such as 1250.50.'); return; }
    if (flow === 'transfer' && (!sourceAccountId || !destinationAccountId || sourceAccountId === destinationAccountId)) {
      setError('A transfer needs two different accounts.');
      return;
    }
    const original = locked ? existing?.descriptionOriginal ?? description : (description.trim() || merchant.trim() || 'Manual transaction');
    try {
      await saveTransaction({
        id: existing?.id ?? createId(),
        flow,
        kind,
        amountMinor: minor,
        occurredAt,
        accountId: flow === 'transfer' ? null : (locked ? existing?.accountId ?? null : accountId || null),
        sourceAccountId: flow === 'transfer' ? sourceAccountId : null,
        destinationAccountId: flow === 'transfer' ? destinationAccountId : null,
        categoryId: categoryId || null,
        purpose,
        merchantName: flow === 'expense' ? merchant.trim() || null : null,
        counterpartyName: flow === 'income' ? merchant.trim() || null : null,
        descriptionOriginal: original,
        reference: existing?.reference ?? null,
        status: categoryId ? 'confirmed' : 'needs_review',
        linkedTransactionId: existing?.linkedTransactionId ?? null,
        userEdited: true,
      });
      if (createRule && (merchant.trim() || description.trim())) {
        await saveRule({
          id: createId(),
          name: merchant.trim() || description.trim(),
          matchField: 'description',
          operator: 'contains',
          pattern: merchant.trim() || description.trim(),
          categoryId: categoryId || null,
          purpose,
          flow,
          kind,
          counterpartyName: null,
          priority: 100,
          enabled: true,
          builtin: false,
        });
      }
      refresh();
      onDone();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'The transaction could not be saved.');
    }
  }

  return <>
    <ChoiceRow options={[{ id: 'expense', label: 'Expense' }, { id: 'income', label: 'Income' }, { id: 'transfer', label: 'Transfer' }]} value={flow} onChange={(id) => { const next = id as TransactionFlow; setFlow(next); setKind(kindsFor(next)[0] ?? 'purchase'); }} />
    <Card>
      <Text style={{ color: colors.textSecondary, fontSize: typography.caption }}>Transfers and credit-card repayments are not counted as expenses.</Text>
    </Card>
    <Field label="Amount (INR)" value={amount} onChangeText={locked ? () => undefined : setAmount} placeholder="0.00" keyboardType="decimal-pad" />
    <Field label="Date" value={date} onChangeText={locked ? () => undefined : setDate} placeholder="YYYY-MM-DD" />
    {flow !== 'transfer' ? <Field label={flow === 'income' ? 'Payer' : 'Merchant or person'} value={merchant} onChangeText={setMerchant} placeholder="Name" /> : null}
    <Field label="Description" value={locked ? existing?.descriptionOriginal ?? '' : description} onChangeText={locked ? () => undefined : setDescription} placeholder="What was this for?" />
    <Text style={{ color: colors.text, fontWeight: '700' }}>Type</Text>
    <ChoiceRow options={kinds.map((item) => ({ id: item, label: labelKind(item) }))} value={kind} onChange={(id) => setKind(id as TransactionKind)} />
    {flow !== 'transfer' ? <>
      <Text style={{ color: colors.text, fontWeight: '700' }}>Category</Text>
      <ChoiceRow options={[{ id: '', label: 'Uncategorised' }, ...visibleCategories.map((category) => ({ id: category.id, label: category.name }))]} value={categoryId} onChange={setCategoryId} />
      <Text style={{ color: colors.text, fontWeight: '700' }}>Account</Text>
      <ChoiceRow options={[{ id: '', label: 'None' }, ...accounts.filter((account) => account.isActive).map((account) => ({ id: account.id, label: account.name }))]} value={accountId} onChange={setAccountId} />
    </> : <>
      <Text style={{ color: colors.text, fontWeight: '700' }}>From</Text>
      <ChoiceRow options={accounts.filter((account) => account.isActive).map((account) => ({ id: account.id, label: account.name }))} value={sourceAccountId} onChange={setSourceAccountId} />
      <Text style={{ color: colors.text, fontWeight: '700' }}>To</Text>
      <ChoiceRow options={accounts.filter((account) => account.isActive).map((account) => ({ id: account.id, label: account.name }))} value={destinationAccountId} onChange={setDestinationAccountId} />
    </>}
    <Text style={{ color: colors.text, fontWeight: '700' }}>Purpose</Text>
    <ChoiceRow options={PURPOSES.map((item) => ({ id: item, label: item }))} value={purpose} onChange={(id) => setPurpose(id as TransactionPurpose)} />
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: createRule }} onPress={() => setCreateRule((current) => !current)}>
      <Text style={{ color: colors.text, fontSize: typography.secondary }}>{createRule ? '☑' : '☐'} Create a rule for future matches</Text>
    </Pressable>
    {error ? <ErrorText>{error}</ErrorText> : null}
    <PrimaryButton label={existing ? 'Save changes' : 'Save transaction'} onPress={onSave} />
    <SecondaryButton label="Cancel" onPress={onDone} />
  </>;
}

function kindsFor(flow: TransactionFlow): TransactionKind[] {
  if (flow === 'income') return ['income', 'refund', 'reimbursement_received', 'loan_repayment_received'];
  if (flow === 'transfer') return ['internal_transfer', 'card_repayment'];
  return ['purchase', 'bill_payment', 'refund', 'loan_given', 'reimbursement_paid', 'shared_expense'];
}

function labelKind(kind: TransactionKind): string {
  return kind.replace(/_/g, ' ');
}
