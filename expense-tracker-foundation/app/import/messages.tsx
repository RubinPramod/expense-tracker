import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, TextInput } from 'react-native';
import { Card, ChoiceRow, ErrorText, PrimaryButton, Screen, SecondaryButton, Title } from '../../src/components/ui';
import { useAppState } from '../../src/context/AppState';
import { draftsFromTabular, parsePastedMessages, planDrafts, suggestMapping, type ParsedDraft } from '../../src/domain/importing';
import { formatInr } from '../../src/domain/money';
import { commitImport, knownTransactions, listAccounts, listCategories, listRules } from '../../src/repositories/ledgerRepository';
import type { AccountRow, CategoryRow, RuleRow } from '../../src/repositories/types';
import { takeSharedText } from '../../src/services/incomingShare';
import { colors, radii, spacing } from '../../src/theme/tokens';

const selectable = new Set<ParsedDraft['disposition']>(['new', 'needs_review', 'probable_duplicate']);

export default function MessageImportScreen() {
  const { refresh } = useAppState();
  const [text, setText] = useState('');
  const [accountId, setAccountId] = useState('');
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [rules, setRules] = useState<RuleRow[]>([]);
  const [drafts, setDrafts] = useState<ParsedDraft[]>([]);
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [step, setStep] = useState<'compose' | 'review'>('compose');
  const [error, setError] = useState('');

  useEffect(() => {
    listAccounts().then(setAccounts);
    listCategories().then(setCategories);
    listRules().then(setRules);
  }, []);

  useFocusEffect(useCallback(() => {
    const shared = takeSharedText();
    if (!shared) return;
    setText(shared);
    setDrafts([]);
    setStep('compose');
    setError('');
  }, []));

  async function review() {
    const tabular = parsePastedMessages(text);
    if (!tabular.records.length) {
      setError('Paste at least one message with a date and an amount.');
      return;
    }
    const planned = planDrafts(draftsFromTabular(tabular, suggestMapping(tabular.headers), accountId || null, rules), await knownTransactions());
    const initial: Record<number, boolean> = {};
    planned.forEach((draft) => { initial[draft.rowIndex] = draft.disposition === 'new' || draft.disposition === 'needs_review'; });
    setDrafts(planned);
    setSelected(initial);
    setError(planned.some((draft) => selectable.has(draft.disposition)) ? '' : 'Nothing new was found. Duplicates and invalid lines stay out of the ledger.');
    setStep('review');
  }

  async function save() {
    const chosen = drafts.filter((draft) => selected[draft.rowIndex] && selectable.has(draft.disposition));
    if (!chosen.length) {
      setError('Select at least one new or review row.');
      return;
    }
    const counts = await commitImport({
      sourceType: 'message_share',
      sourceLabel: 'Shared or pasted messages',
      accountId: accountId || null,
      fileHash: null,
      rowsSeen: drafts.length,
      skipped: drafts.length - chosen.length,
      drafts: chosen,
    });
    refresh();
    router.replace({ pathname: '/(tabs)/reports', params: { imported: String(counts.created + counts.review) } });
  }

  return <Screen>
    <Text onPress={() => router.back()} style={{ color: colors.primary, fontWeight: '700' }} accessibilityRole="button">Back</Text>
    <Title subtitle="Paste a message here, or share it into the app from Messages. The app does not read your inbox.">Import from messages</Title>
    {step === 'compose' ? <Card>
      <Text style={{ color: colors.textSecondary }}>A development build is required before the app appears in the phone's share sheet. Expo Go can still import pasted text.</Text>
      <TextInput accessibilityLabel="Message text" multiline value={text} onChangeText={setText} placeholder="INR 180.00 debited on 14/10/2026 at AB Coffee" placeholderTextColor={colors.textSecondary} style={{ minHeight: 140, borderWidth: 1, borderColor: colors.border, borderRadius: radii.lg, padding: spacing.md, color: colors.text, textAlignVertical: 'top' }} />
      <ChoiceRow options={[{ id: '', label: 'No account' }, ...accounts.map((account) => ({ id: account.id, label: account.name }))]} value={accountId} onChange={setAccountId} />
      {error ? <ErrorText>{error}</ErrorText> : null}
      <PrimaryButton label="Review" onPress={review} />
    </Card> : <Card>
      {drafts.map((draft) => {
        const category = categories.find((item) => item.id === draft.categoryId)?.name ?? 'Unclassified';
        const canSelect = selectable.has(draft.disposition);
        return <Pressable key={draft.rowIndex} accessibilityRole="checkbox" accessibilityState={{ checked: Boolean(selected[draft.rowIndex]), disabled: !canSelect }} onPress={() => { if (canSelect) setSelected((current) => ({ ...current, [draft.rowIndex]: !current[draft.rowIndex] })); }}>
          <Text style={{ color: colors.text, fontWeight: '700' }}>{selected[draft.rowIndex] ? 'Selected' : draft.disposition.replace(/_/g, ' ')} · {draft.amountMinor == null ? 'No amount' : formatInr(draft.amountMinor)}</Text>
          <Text style={{ color: colors.textSecondary }}>{draft.description} · {category} · {draft.date ?? 'No date'}</Text>
        </Pressable>;
      })}
      {error ? <ErrorText>{error}</ErrorText> : null}
      <PrimaryButton label="Save and show in reports" onPress={save} />
      <SecondaryButton label="Back to message" onPress={() => setStep('compose')} />
    </Card>}
  </Screen>;
}
