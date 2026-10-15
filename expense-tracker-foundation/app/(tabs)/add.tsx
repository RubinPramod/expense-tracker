import { router } from 'expo-router';
import { TransactionEditor } from '../../src/components/TransactionEditor';
import { Screen, Title } from '../../src/components/ui';

export default function AddScreen() {
  return <Screen>
    <Title subtitle="Expense, income, and transfer are saved to the ledger. Nothing here is a sample transaction.">Add transaction</Title>
    <TransactionEditor onDone={() => router.replace('/(tabs)/transactions')} />
  </Screen>;
}
