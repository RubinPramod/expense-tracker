import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text } from 'react-native';
import { Card, ChoiceRow, ErrorText, PrimaryButton, Screen, Title } from '../../src/components/ui';
import { useAppState } from '../../src/context/AppState';
import { countDispositions, draftsFromTabular, parseCsv, parseXlsx, planDrafts, suggestMapping, type ColumnMapping, type ParsedDraft } from '../../src/domain/importing';
import { formatInr } from '../../src/domain/money';
import { commitImport, knownTransactions, listAccounts, listRules } from '../../src/repositories/ledgerRepository';
import type { AccountRow, RuleRow } from '../../src/repositories/types';
import { hashBytes } from '../../src/services/exchangeService';
import { pickDocument, readBytes, readTextFile } from '../../src/services/files';
import { colors } from '../../src/theme/tokens';

export default function StatementImportScreen() {
  const { refresh } = useAppState();
  const [step, setStep] = useState<'file' | 'map' | 'review' | 'done'>('file');
  const [name, setName] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [records, setRecords] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [accountId, setAccountId] = useState('');
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [rules, setRules] = useState<RuleRow[]>([]);
  const [drafts, setDrafts] = useState<ParsedDraft[]>([]);
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [hash, setHash] = useState<string | null>(null);
  const [result, setResult] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    listAccounts().then(setAccounts);
    listRules().then(setRules);
  }, []);

  async function chooseFile() {
    try {
      const asset = await pickDocument(['text/csv', 'text/comma-separated-values', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', '*/*']);
      if (!asset) return;
      setName(asset.name);
      const bytes = await readBytes(asset.uri);
      setHash(hashBytes(bytes));
      const tabular = asset.name.toLowerCase().endsWith('.csv') ? parseCsv(await readTextFile(asset.uri)) : parseXlsx(bytes);
      if (!tabular.headers.length) { setError('The file has no header row.'); return; }
      setHeaders(tabular.headers);
      setRecords(tabular.records);
      setMapping(suggestMapping(tabular.headers));
      setError('');
      setStep('map');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'That file could not be read.');
    }
  }

  async function review() {
    if (!mapping) return;
    const parsed = draftsFromTabular({ headers, records }, mapping, accountId || null, rules.map(toRule));
    const planned = planDrafts(parsed, await knownTransactions());
    setDrafts(planned);
    const initial: Record<number, boolean> = {};
    planned.forEach((draft) => { initial[draft.rowIndex] = draft.disposition === 'new' || draft.disposition === 'needs_review'; });
    setSelected(initial);
    setStep('review');
  }

  async function commit() {
    const chosen = drafts.filter((draft) => selected[draft.rowIndex] && draft.disposition !== 'invalid' && draft.disposition !== 'duplicate');
    const counts = await commitImport({ sourceType: 'statement', sourceLabel: name, accountId: accountId || null, fileHash: hash, rowsSeen: drafts.length, skipped: drafts.length - chosen.length, drafts: chosen });
    const skipped = drafts.length - chosen.length;
    setResult(`Created ${counts.created}, needs review ${counts.review}, skipped ${skipped}.`);
    refresh();
    setStep('done');
  }

  const counts = countDispositions(drafts);

  return <Screen>
    <Text onPress={() => router.back()} style={{ color: colors.primary, fontWeight: '700' }} accessibilityRole="button">Back</Text>
    <Title subtitle="CSV and Excel only. PDF, drag-and-drop, and bank connections are not part of this version.">Import statement</Title>
    <Text style={{ color: colors.textSecondary }}>1 Upload · 2 Map columns · 3 Review · 4 Import</Text>
    {error ? <ErrorText>{error}</ErrorText> : null}
    {step === 'file' ? <Card>
      <PrimaryButton label="Choose file" onPress={chooseFile} />
    </Card> : null}
    {step === 'map' && mapping ? <Card>
      <Text style={{ color: colors.text }}>{name} · {records.length} rows</Text>
      <Text style={{ color: colors.textSecondary }}>Date column: {mapping.date}. Description: {mapping.description}. {mapping.debit ? `Debit ${mapping.debit}. Credit ${mapping.credit}.` : `Amount ${mapping.amount}.`}</Text>
      <Text style={{ color: colors.text, fontWeight: '700' }}>Account</Text>
      <ChoiceRow options={[{ id: '', label: 'No account' }, ...accounts.map((account) => ({ id: account.id, label: account.name }))]} value={accountId} onChange={setAccountId} />
      <HeaderPicker label="Date" headers={headers} value={mapping.date} onChange={(date) => setMapping({ ...mapping, date })} />
      <HeaderPicker label="Description" headers={headers} value={mapping.description} onChange={(description) => setMapping({ ...mapping, description })} />
      <PrimaryButton label="Continue to review" onPress={review} />
    </Card> : null}
    {step === 'review' ? <>
      <Card>
        <Text style={{ color: colors.text }}>{counts.new} new · {counts.needs_review} need review · {counts.probable_duplicate} probable duplicates · {counts.duplicate} duplicates · {counts.invalid} invalid</Text>
        <Text style={{ color: colors.textSecondary }}>Duplicates and invalid rows are not imported. Probable duplicates stay out unless you select them.</Text>
      </Card>
      {drafts.slice(0, 40).map((draft) => (
        <Pressable key={draft.rowIndex} accessibilityRole="checkbox" accessibilityState={{ checked: Boolean(selected[draft.rowIndex]) }} onPress={() => setSelected((current) => ({ ...current, [draft.rowIndex]: !current[draft.rowIndex] }))} style={{ minHeight: 44 }}>
          <Text style={{ color: colors.text }}>{selected[draft.rowIndex] ? '☑' : '☐'} {draft.date ?? 'No date'} · {draft.description || 'No description'} · {draft.amountMinor == null ? '—' : formatInr(draft.amountMinor)} · {draft.disposition}</Text>
        </Pressable>
      ))}
      <PrimaryButton label="Import selected" onPress={commit} />
    </> : null}
    {step === 'done' ? <Card>
      <Text style={{ color: colors.text, fontWeight: '700' }}>{result}</Text>
      <PrimaryButton label="Done" onPress={() => router.replace('/(tabs)/transactions')} />
    </Card> : null}
  </Screen>;
}

function HeaderPicker({ label, headers, value, onChange }: { label: string; headers: string[]; value: string; onChange: (value: string) => void }) {
  return <>
    <Text style={{ color: colors.text, fontWeight: '700' }}>{label}</Text>
    <ChoiceRow options={headers.map((header) => ({ id: header, label: header }))} value={value} onChange={onChange} />
  </>;
}

function toRule(rule: RuleRow) {
  return { ...rule, matchField: rule.matchField, operator: rule.operator };
}
