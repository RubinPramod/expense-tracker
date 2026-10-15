import { router } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';
import { Card, ErrorText, Field, PrimaryButton, Screen, SecondaryButton, Title } from '../../src/components/ui';
import { useAppState } from '../../src/context/AppState';
import type { EncryptedBackup } from '../../src/domain/backup';
import { exportTransactionsCsv, buildEncryptedBackup, previewBackup, restoreBackup } from '../../src/services/exchangeService';
import { pickDocument, readTextFile, shareTextFile } from '../../src/services/files';
import { deleteAllData } from '../../src/repositories/ledgerRepository';
import { syncAllReminders } from '../../src/services/reminderService';
import { colors } from '../../src/theme/tokens';

export default function DataScreen() {
  const { refresh } = useAppState();
  const [passphrase, setPassphrase] = useState('');
  const [confirm, setConfirm] = useState('');
  const [preview, setPreview] = useState('');
  const [pending, setPending] = useState<EncryptedBackup | null>(null);
  const [deleteText, setDeleteText] = useState('');
  const [error, setError] = useState('');

  async function exportBackup() {
    try {
      if (passphrase !== confirm) { setError('Passphrases do not match.'); return; }
      const payload = await buildEncryptedBackup(passphrase);
      await shareTextFile(`expense-tracker-backup-${Date.now()}.json`, JSON.stringify(payload), 'application/json');
      setError('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Backup failed.');
    }
  }

  async function pickRestore() {
    try {
      const asset = await pickDocument('application/json');
      if (!asset) return;
      const payload = JSON.parse(await readTextFile(asset.uri)) as EncryptedBackup;
      const counts = await previewBackup(payload, passphrase);
      setPending(payload);
      setPreview(`${counts.transactions} transactions, ${counts.accounts} accounts, ${counts.categories} categories, ${counts.rules} rules, ${counts.recurring} reminders.`);
      setError('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'That backup could not be read.');
    }
  }

  async function restore() {
    if (!pending) return;
    await restoreBackup(pending, passphrase);
    await syncAllReminders();
    setPending(null);
    setPreview('Restore finished. The previous ledger was replaced.');
    refresh();
  }

  return <Screen>
    <Text onPress={() => router.back()} style={{ color: colors.primary, fontWeight: '700' }} accessibilityRole="button">Back</Text>
    <Title subtitle="Local-only means there is no automatic sync. Without a backup, deleting the app can lose the ledger.">Backup and restore</Title>
    <Card>
      <Field label="Passphrase" value={passphrase} onChangeText={setPassphrase} placeholder="At least 8 characters" />
      <Field label="Confirm passphrase" value={confirm} onChangeText={setConfirm} />
      <PrimaryButton label="Export encrypted backup" onPress={exportBackup} />
      <SecondaryButton label="Export CSV report" onPress={() => exportTransactionsCsv().then((csv) => shareTextFile('transactions.csv', csv, 'text/csv'))} />
    </Card>
    <Card>
      <Text style={{ color: colors.text, fontWeight: '700' }}>Restore</Text>
      <Text style={{ color: colors.textSecondary }}>Preview the file before it replaces this device's ledger.</Text>
      <SecondaryButton label="Choose backup file" onPress={pickRestore} />
      {preview ? <Text style={{ color: colors.text }}>{preview}</Text> : null}
      {pending ? <PrimaryButton label="Replace ledger with this backup" onPress={restore} /> : null}
    </Card>
    <Card>
      <Text style={{ color: colors.text, fontWeight: '700' }}>Delete everything</Text>
      <Field label='Type DELETE to confirm' value={deleteText} onChangeText={setDeleteText} />
      <PrimaryButton label="Delete all data" disabled={deleteText !== 'DELETE'} onPress={() => deleteAllData().then(() => { refresh(); setPreview('The ledger was cleared and default categories were restored.'); })} />
    </Card>
    {error ? <ErrorText>{error}</ErrorText> : null}
  </Screen>;
}
