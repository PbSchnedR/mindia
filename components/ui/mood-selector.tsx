import React from 'react';
import { View, Text, Pressable, StyleSheet, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, shadows, font } from '@/constants/tokens';
import type { Severity } from '@/lib/types';

const MOODS: { value: Severity; icon: keyof typeof Ionicons.glyphMap; iconActive: keyof typeof Ionicons.glyphMap; label: string; color: string; bg: string }[] = [
  { value: 1, icon: 'happy-outline', iconActive: 'happy', label: 'Bien', color: colors.success, bg: colors.successLight },
  { value: 2, icon: 'sad-outline', iconActive: 'sad', label: 'Difficile', color: colors.warning, bg: colors.warningLight },
  { value: 3, icon: 'warning-outline', iconActive: 'warning', label: 'Urgence', color: colors.error, bg: colors.errorLight },
];

interface MoodSelectorProps {
  value?: Severity;
  onChange: (value: Severity) => void;
  style?: ViewStyle;
}

export function MoodSelector({ value, onChange, style }: MoodSelectorProps) {
  return (
    <View style={[styles.container, style]}>
      <Text style={styles.title}>Comment te sens-tu ?</Text>
      <View style={styles.buttons}>
        {MOODS.map((mood) => {
          const active = value === mood.value;
          return (
            <Pressable
              key={mood.value}
              style={[
                styles.button,
                active && { backgroundColor: mood.bg, borderColor: mood.color },
              ]}
              onPress={() => onChange(mood.value)}
            >
              <View style={[styles.iconCircle, { backgroundColor: active ? mood.color + '20' : colors.bgTertiary }]}>
                <Ionicons name={active ? mood.iconActive : mood.icon} size={28} color={active ? mood.color : colors.textTertiary} />
              </View>
              <Text style={[styles.label, active && { color: mood.color }]}>
                {mood.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.lg },
  title: { ...font.sectionTitle },
  buttons: { flexDirection: 'row', gap: spacing.md },
  button: {
    flex: 1,
    backgroundColor: colors.bg,
    borderRadius: radius.xl,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.borderLight,
    ...shadows.sm,
    gap: spacing.sm,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
});
