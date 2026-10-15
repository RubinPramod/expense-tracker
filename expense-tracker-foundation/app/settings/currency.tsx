import { router } from 'expo-router';
import { Text } from 'react-native';
import { Card, Screen, Title } from '../../src/components/ui';
import { colors } from '../../src/theme/tokens';

export default function CurrencyScreen() {
  return <Screen>
    <Text onPress={() => router.back()} style={{ color: colors.primary, fontWeight: '700' }} accessibilityRole="button">Back</Text>
    <Title subtitle="Amounts are stored as integer paise and shown with Indian grouping.">Currency</Title>
    <Card>
      <Text style={{ color: colors.text, fontWeight: '700' }}>Indian rupee (INR)</Text>
      <Text style={{ color: colors.textSecondary }}>The first version reports by calendar month. Other currencies can be stored later, but entry and reports use INR.</Text>
    </Card>
  </Screen>;
}
