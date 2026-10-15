import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState as ApplicationState } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppState } from '../src/context/AppState';
import { consumeIncomingShare } from '../src/services/incomingShare';
import { colors } from '../src/theme/tokens';

function IncomingShareListener() {
  const router = useRouter();
  useEffect(() => {
    const openSharedText = () => {
      if (consumeIncomingShare()) router.push('/import/messages');
    };
    openSharedText();
    const subscription = ApplicationState.addEventListener('change', (state) => {
      if (state === 'active') openSharedText();
    });
    return () => subscription.remove();
  }, [router]);
  return null;
}

export default function RootLayout() {
  return <SafeAreaProvider>
    <StatusBar style="dark" />
    <AppState>
      <IncomingShareListener />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />
    </AppState>
  </SafeAreaProvider>;
}
