import { Tabs } from 'expo-router';
import { View } from 'react-native';
import { AppIcon } from '../../src/components/AppIcon';
import { colors, radii } from '../../src/theme/tokens';

export default function TabLayout() {
  return <Tabs screenOptions={{
    headerShown: false,
    tabBarActiveTintColor: colors.primary,
    tabBarInactiveTintColor: colors.textSecondary,
    tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border, height: 72, paddingTop: 8, paddingBottom: 8 },
    tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
  }}>
    <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: ({ color }) => <AppIcon name="home" color={color} /> }} />
    <Tabs.Screen name="transactions" options={{ title: 'Transactions', tabBarIcon: ({ color }) => <AppIcon name="transactions" color={color} /> }} />
    <Tabs.Screen name="add" options={{
      title: 'Add',
      tabBarLabel: () => null,
      tabBarIcon: () => <View style={{ width: 52, height: 52, borderRadius: radii.pill, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}><AppIcon name="add" color="#FFFFFF" size={28} /></View>,
    }} />
    <Tabs.Screen name="reports" options={{ title: 'Reports', tabBarIcon: ({ color }) => <AppIcon name="reports" color={color} /> }} />
    <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: ({ color }) => <AppIcon name="settings" color={color} /> }} />
  </Tabs>;
}
