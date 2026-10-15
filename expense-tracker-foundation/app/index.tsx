import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { getMetadata } from '../src/repositories/ledgerRepository';
import { colors } from '../src/theme/tokens';

export default function EntryRoute() {
  const [target, setTarget] = useState<string | null>(null);
  useEffect(() => {
    getMetadata('setup_complete').then((value) => setTarget(value === 'true' ? '/(tabs)' : '/onboarding')).catch(() => setTarget('/(tabs)'));
  }, []);
  if (!target) return <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={colors.primary} /></View>;
  return <Redirect href={target} />;
}
