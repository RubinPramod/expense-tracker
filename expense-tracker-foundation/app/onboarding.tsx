import { router } from 'expo-router';
import { Text } from 'react-native';
import { AppIcon } from '../src/components/AppIcon';
import { Card, PrimaryButton, Screen, SecondaryButton, Title } from '../src/components/ui';
import { setMetadata } from '../src/repositories/ledgerRepository';
import { colors, typography } from '../src/theme/tokens';

async function finish(href: '/(tabs)' | '/import/statements' | '/accounts') {
  await setMetadata('setup_complete', 'true');
  router.replace(href);
}

export default function OnboardingScreen() {
  return <Screen>
    <Text style={{ color: colors.primary, fontWeight: '700', textAlign: 'right' }} onPress={() => finish('/(tabs)')} accessibilityRole="button">Skip for now</Text>
    <AppIcon name="wallet" size={56} color={colors.primary} />
    <Title subtitle="Track expenses and understand spending. Your data stays on this device. There is no account and no automatic sync, so keep a backup.">Take control of your money</Title>
    <Card><Text style={{ color: colors.text, fontWeight: '700' }}>Quick setup</Text><Text style={{ color: colors.textSecondary }}>Start with Food & Dining, Transport, and Income. Add accounts when you are ready.</Text></Card>
    <Card><Text style={{ color: colors.text, fontWeight: '700' }}>Guided setup</Text><Text style={{ color: colors.textSecondary }}>Import a CSV or Excel statement and review it before anything is saved.</Text></Card>
    <Card><Text style={{ color: colors.text, fontWeight: '700' }}>Custom setup</Text><Text style={{ color: colors.textSecondary }}>Add your own accounts first, then enter transactions yourself.</Text></Card>
    <Text style={{ color: colors.textSecondary, fontSize: typography.caption }}>Backups can be encrypted with a passphrase you choose. The app does not send transactions to an AI service.</Text>
    <PrimaryButton label="Quick setup" onPress={() => finish('/(tabs)')} />
    <SecondaryButton label="Import a statement" onPress={() => finish('/import/statements')} />
    <SecondaryButton label="Add accounts" onPress={() => finish('/accounts')} />
  </Screen>;
}
