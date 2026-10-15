import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Card, Field, PrimaryButton, Screen, SettingsLink, Title } from '../../src/components/ui';
import { useAppState } from '../../src/context/AppState';
import { getMetadata, setMetadata } from '../../src/repositories/ledgerRepository';

export default function SettingsScreen() {
  const { refresh } = useAppState();
  const [name, setName] = useState('');
  useEffect(() => { getMetadata('display_name').then((value) => setName(value ?? '')); }, []);

  return <Screen>
    <Title subtitle="Your data stays on this device. There is no profile account and no cloud sync.">Settings</Title>
    <Card>
      <Field label="Display name" value={name} onChangeText={setName} placeholder="Optional, for the greeting" />
      <PrimaryButton label="Save name" onPress={() => { setMetadata('display_name', name.trim()).then(refresh); }} />
    </Card>
    <Card>
      <SettingsLink title="Accounts" detail="Bank, card, cash, and wallet. Balances are what you enter." onPress={() => router.push('/accounts')} />
      <SettingsLink title="Import statement" detail="CSV or Excel, with a review step" onPress={() => router.push('/import/statements')} />
      <SettingsLink title="Paste or share a message" detail="You choose the message. The app does not read your inbox." onPress={() => router.push('/import/messages')} />
      <SettingsLink title="Import history" detail="Statement and pasted-message batches" onPress={() => router.push('/import/history')} />
      <SettingsLink title="Backup and restore" detail="Encrypted JSON backup, CSV export, or delete everything" onPress={() => router.push('/settings/data')} />
      <SettingsLink title="Categories" detail="Add or rename categories" onPress={() => router.push('/settings/categories')} />
      <SettingsLink title="Rules" detail="Deterministic merchant and description rules" onPress={() => router.push('/settings/rules')} />
      <SettingsLink title="Bills and recurring" detail="Reminders you confirm yourself" onPress={() => router.push('/bills')} />
      <SettingsLink title="AI exchange" detail="Manual file export and import. No API key and no network call." onPress={() => router.push('/settings/ai')} />
      <SettingsLink title="Currency" detail="Indian rupees, stored as paise" onPress={() => router.push('/settings/currency')} />
    </Card>
  </Screen>;
}
