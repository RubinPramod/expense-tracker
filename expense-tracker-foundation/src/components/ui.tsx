import { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radii, spacing, touchTarget, typography } from '../theme/tokens';

export function Screen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  const content = scroll
    ? <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">{children}</ScrollView>
    : <View style={[styles.content, styles.fill]}>{children}</View>;
  return <SafeAreaView style={styles.screen} edges={['top']}>{content}</SafeAreaView>;
}

export function Title({ children, subtitle }: { children: string; subtitle?: string }) {
  return <View style={{ gap: spacing.xs }}>
    <Text style={styles.title}>{children}</Text>
    {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
  </View>;
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function PrimaryButton({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.primary, pressed && styles.pressed, disabled && styles.disabled]}>
    <Text style={styles.primaryText}>{label}</Text>
  </Pressable>;
}

export function SecondaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.secondary}>
    <Text style={styles.secondaryText}>{label}</Text>
  </Pressable>;
}

export function Field({ label, value, onChangeText, placeholder, keyboardType }: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'decimal-pad' | 'number-pad';
}) {
  return <View style={styles.field}>
    <Text style={styles.label}>{label}</Text>
    <TextInput accessibilityLabel={label} value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={colors.textSecondary} keyboardType={keyboardType} style={styles.input} />
  </View>;
}

export function ChoiceRow({ options, value, onChange }: { options: { id: string; label: string }[]; value: string; onChange: (id: string) => void }) {
  return <View style={styles.choices}>
    {options.map((option) => {
      const selected = option.id === value;
      return <Pressable key={option.id} accessibilityRole="button" accessibilityState={{ selected }} accessibilityLabel={option.label} onPress={() => onChange(option.id)} style={[styles.choice, selected && styles.choiceSelected]}>
        <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>{option.label}</Text>
      </Pressable>;
    })}
  </View>;
}

export function SettingsLink({ title, detail, onPress }: { title: string; detail?: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={styles.link}>
    <View style={{ flex: 1 }}>
      <Text style={styles.linkTitle}>{title}</Text>
      {detail ? <Text style={styles.subtitle}>{detail}</Text> : null}
    </View>
    <Text style={styles.chevron}>›</Text>
  </Pressable>;
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return <View style={styles.empty}>
    <Text style={styles.linkTitle}>{title}</Text>
    <Text style={[styles.subtitle, styles.center]}>{body}</Text>
  </View>;
}

export function ErrorText({ children }: { children: string }) {
  return <Text style={styles.error}>{children}</Text>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxxl },
  fill: { flex: 1 },
  title: { fontSize: typography.heading, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: typography.secondary, color: colors.textSecondary, lineHeight: 20 },
  card: { backgroundColor: colors.surface, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, gap: spacing.sm },
  primary: { minHeight: touchTarget.minHeight, borderRadius: radii.lg, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg },
  pressed: { backgroundColor: colors.primaryPressed },
  disabled: { opacity: 0.5 },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: typography.body },
  secondary: { minHeight: touchTarget.minHeight, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg },
  secondaryText: { color: colors.primary, fontWeight: '700', fontSize: typography.body },
  field: { gap: spacing.xs },
  label: { color: colors.textSecondary, fontSize: typography.caption, fontWeight: '600' },
  input: { minHeight: touchTarget.minHeight, borderWidth: 1, borderColor: colors.border, borderRadius: radii.lg, backgroundColor: colors.surface, paddingHorizontal: spacing.md, color: colors.text, fontSize: typography.body },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  choice: { minHeight: touchTarget.minHeight, paddingHorizontal: spacing.md, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  choiceSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  choiceText: { color: colors.textSecondary, fontWeight: '600', fontSize: 13 },
  choiceTextSelected: { color: '#fff' },
  link: { minHeight: touchTarget.minHeight, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  linkTitle: { color: colors.text, fontSize: typography.body, fontWeight: '600' },
  chevron: { color: colors.textSecondary, fontSize: 22 },
  empty: { alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.xl },
  center: { textAlign: 'center' },
  error: { color: colors.expense, fontSize: typography.secondary },
});
