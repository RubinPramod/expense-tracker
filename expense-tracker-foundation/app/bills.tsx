import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { Card, ChoiceRow, ErrorText, Field, PrimaryButton, Screen, Title } from '../src/components/ui';
import { useAppState } from '../src/context/AppState';
import { formatLocalDate } from '../src/domain/dates';
import { createId } from '../src/domain/ids';
import { formatInr, rupeesToMinor } from '../src/domain/money';
import { nextDueDate, type RecurringCadence } from '../src/domain/recurring';
import { listCategories, listRecurring, saveRecurring } from '../src/repositories/ledgerRepository';
import type { CategoryRow, RecurringRow } from '../src/repositories/types';
import { syncRecurringNotification } from '../src/services/reminderService';
import { colors } from '../src/theme/tokens';

export default function BillsScreen() {
  const { revision, refresh } = useAppState();
  const [rows, setRows] = useState<RecurringRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [cadence, setCadence] = useState<RecurringCadence>('monthly');
  const [dueDay, setDueDay] = useState('1');
  const [leadDays, setLeadDays] = useState('1');
  const [categoryId, setCategoryId] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    listRecurring().then(setRows);
    listCategories().then(setCategories);
  }, [revision]);

  async function add(confirmed: boolean) {
    if (!label.trim()) { setError('Name the bill.'); return; }
    const minor = amount.trim() ? rupeesToMinor(amount) : null;
    if (amount.trim() && minor == null) { setError('Amount must be in rupees.'); return; }
    const day = Number(dueDay);
    if (!Number.isInteger(day) || day < 1 || day > 31) { setError('Due day must be from 1 to 31.'); return; }
    const lead = Number(leadDays);
    const today = formatLocalDate(new Date());
    const item: RecurringRow = {
      id: createId(),
      label: label.trim(),
      amountMinor: minor,
      cadence,
      dueDay: day,
      leadDays: Number.isInteger(lead) ? lead : 1,
      nextDueAt: nextDueDate(cadence, day, today),
      accountId: null,
      categoryId: categoryId || null,
      purpose: 'personal',
      status: confirmed ? 'active' : 'suggested',
      requiresConfirmation: !confirmed,
      notificationId: null,
    };
    await saveRecurring(item);
    const scheduled = confirmed ? await syncRecurringNotification(item) : { scheduled: false, reason: 'Suggested items do not notify until you confirm them.' };
    setMessage(scheduled.scheduled ? 'Reminder scheduled.' : scheduled.reason ?? 'Saved without a notification.');
    setLabel(''); setAmount(''); setError('');
    refresh();
  }

  async function confirm(item: RecurringRow) {
    const next = { ...item, status: 'active' as const, requiresConfirmation: false };
    await saveRecurring(next);
    const scheduled = await syncRecurringNotification(next);
    setMessage(scheduled.reason ?? 'Reminder confirmed.');
    refresh();
  }

  const active = rows.filter((row) => row.status === 'active');
  const suggested = rows.filter((row) => row.status === 'suggested');

  return <Screen>
    <Text onPress={() => router.back()} style={{ color: colors.primary, fontWeight: '700' }} accessibilityRole="button">Back</Text>
    <Title subtitle="Only items you confirm can send a local reminder. Pattern detection does not notify.">Bills and recurring</Title>
    <Card>
      <Text style={{ color: colors.text, fontWeight: '700' }}>Upcoming</Text>
      {active.length === 0 ? <Text style={{ color: colors.textSecondary }}>No confirmed bills yet.</Text> : active.map((row) => (
        <Text key={row.id} style={{ color: colors.text }}>{row.label} · {row.nextDueAt?.slice(0, 10)} · {row.amountMinor == null ? 'Varies' : formatInr(row.amountMinor)} · {row.cadence}</Text>
      ))}
    </Card>
    {suggested.length ? <Card>
      <Text style={{ color: colors.text, fontWeight: '700' }}>Suggested</Text>
      {suggested.map((row) => <Text key={row.id} style={{ color: colors.primary, fontWeight: '700' }} onPress={() => confirm(row)} accessibilityRole="button">{row.label} · Confirm</Text>)}
    </Card> : null}
    <Card>
      <Field label="Name" value={label} onChangeText={setLabel} placeholder="Rent" />
      <Field label="Amount" value={amount} onChangeText={setAmount} placeholder="Optional" keyboardType="decimal-pad" />
      <Field label="Due day" value={dueDay} onChangeText={setDueDay} keyboardType="number-pad" />
      <Field label="Remind me this many days before" value={leadDays} onChangeText={setLeadDays} keyboardType="number-pad" />
      <ChoiceRow options={[{ id: 'weekly', label: 'Weekly' }, { id: 'monthly', label: 'Monthly' }, { id: 'yearly', label: 'Yearly' }]} value={cadence} onChange={(id) => setCadence(id as RecurringCadence)} />
      <ChoiceRow options={[{ id: '', label: 'No category' }, ...categories.map((category) => ({ id: category.id, label: category.name }))]} value={categoryId} onChange={setCategoryId} />
      {error ? <ErrorText>{error}</ErrorText> : null}
      {message ? <Text style={{ color: colors.textSecondary }}>{message}</Text> : null}
      <PrimaryButton label="Add and remind" onPress={() => add(true)} />
      <PrimaryButton label="Save as suggestion" onPress={() => add(false)} />
    </Card>
  </Screen>;
}
