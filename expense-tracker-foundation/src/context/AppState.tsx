import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { getDatabase } from '../database/client';
import { syncAllReminders } from '../services/reminderService';
import { colors, spacing, typography } from '../theme/tokens';

interface AppStateValue {
  revision: number;
  refresh: () => void;
}

const AppStateContext = createContext<AppStateValue | null>(null);

export function AppState({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true;
    getDatabase()
      .then(() => syncAllReminders().catch(() => undefined))
      .then(() => { if (active) setReady(true); })
      .catch((err: unknown) => { if (active) setError(err instanceof Error ? err.message : 'The ledger could not be opened.'); });
    return () => { active = false; };
  }, []);

  const value = useMemo(() => ({ revision, refresh: () => setRevision((current) => current + 1) }), [revision]);
  if (error) {
    return <View style={{ flex: 1, backgroundColor: colors.background, padding: spacing.xl, justifyContent: 'center' }}><Text style={{ color: colors.text, fontSize: typography.title, fontWeight: '700' }}>Ledger unavailable</Text><Text style={{ color: colors.textSecondary, marginTop: spacing.sm }}>{error}</Text></View>;
  }
  if (!ready) {
    return <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={colors.primary} /><Text style={{ color: colors.textSecondary, marginTop: spacing.md }}>Opening your ledger</Text></View>;
  }
  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppStateValue {
  const value = useContext(AppStateContext);
  if (!value) throw new Error('AppState is missing.');
  return value;
}
