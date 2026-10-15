import { router } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';
import { Card, ErrorText, PrimaryButton, Screen, SecondaryButton, Title } from '../../src/components/ui';
import { useAppState } from '../../src/context/AppState';
import type { AiSuggestionDecision } from '../../src/domain/aiExchange';
import { exportAiFile, previewAiFile } from '../../src/services/exchangeService';
import { pickDocument, readTextFile, shareTextFile } from '../../src/services/files';
import { updateClassification } from '../../src/repositories/ledgerRepository';
import { colors } from '../../src/theme/tokens';

export default function AiScreen() {
  const { refresh } = useAppState();
  const [decisions, setDecisions] = useState<AiSuggestionDecision[]>([]);
  const [accepted, setAccepted] = useState<Record<string, boolean>>({});
  const [error, setError] = useState('');
  const [note, setNote] = useState('');

  async function exportFile() {
    const payload = await exportAiFile();
    await shareTextFile('chatgpt-transactions.json', JSON.stringify(payload, null, 2), 'application/json');
    setNote(`Exported ${payload.transactions.length} unresolved transactions. Share this file yourself. The app does not call an AI service.`);
  }

  async function importFile() {
    try {
      const asset = await pickDocument('application/json');
      if (!asset) return;
      const text = await readTextFile(asset.uri);
      const reviewed = await previewAiFile(text);
      setDecisions(reviewed);
      const flags: Record<string, boolean> = {};
      reviewed.forEach((decision) => { if (decision.accepted) flags[decision.transactionId] = true; });
      setAccepted(flags);
      setError(reviewed.some((decision) => !decision.accepted) ? 'Some rows were rejected and cannot be applied.' : '');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'That file could not be read.');
    }
  }

  async function apply() {
    for (const decision of decisions) {
      if (!decision.accepted || !accepted[decision.transactionId]) continue;
      await updateClassification({
        id: decision.transactionId,
        categoryId: decision.categoryId,
        purpose: decision.purpose,
        status: decision.categoryId ? 'confirmed' : 'needs_review',
        userEdited: true,
      });
    }
    refresh();
    setNote('Approved suggestions were saved. Amounts, dates, accounts, and descriptions were not changed.');
    setDecisions([]);
  }

  return <Screen>
    <Text onPress={() => router.back()} style={{ color: colors.primary, fontWeight: '700' }} accessibilityRole="button">Back</Text>
    <Title subtitle="Export a file, classify it elsewhere, then import the suggestions. Unknown ids and changed amounts or dates are rejected.">Manual AI exchange</Title>
    <Card>
      <PrimaryButton label="Export unresolved transactions" onPress={exportFile} />
      <SecondaryButton label="Import suggestion file" onPress={importFile} />
      {note ? <Text style={{ color: colors.textSecondary }}>{note}</Text> : null}
      {error ? <ErrorText>{error}</ErrorText> : null}
    </Card>
    {decisions.map((decision, index) => (
      <Card key={`${decision.transactionId}-${index}`}>
        <Text style={{ color: colors.text, fontWeight: '700' }}>{decision.transactionId || 'File'}</Text>
        <Text style={{ color: decision.accepted ? colors.income : colors.expense }}>{decision.accepted ? `Category ${decision.categoryId ?? 'unchanged'} · ${decision.purpose}` : decision.reason}</Text>
        {decision.accepted ? <Text style={{ color: colors.primary }} onPress={() => setAccepted((current) => ({ ...current, [decision.transactionId]: !current[decision.transactionId] }))} accessibilityRole="checkbox">{accepted[decision.transactionId] ? '☑ Include' : '☐ Include'}</Text> : null}
      </Card>
    ))}
    {decisions.some((decision) => decision.accepted) ? <PrimaryButton label="Apply approved suggestions" onPress={apply} /> : null}
    <Text style={{ color: colors.textSecondary }}>Approved suggestions update category and purpose only. Create a rule from the transaction if you want that mapping reused.</Text>
  </Screen>;
}
