import React from 'react';
import { View, Text, Pressable, StyleSheet, type ViewStyle } from 'react-native';
import { colors, spacing, radius, shadows, font } from '@/constants/tokens';
import type { Severity } from '@/lib/types';

const MOODS: { value: Severity; emoji: string; label: string; color: string; bg: string }[] = [
  { value: 1, emoji: '😊', label: 'Bien', color: colors.success, bg: colors.successLight },
  { value: 2, emoji: '😟', label: 'Difficile', color: colors.warning, bg: colors.warningLight },
  { value: 3, emoji: '😰', label: 'Urgence', color: colors.error, bg: colors.errorLight },
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
              <Text style={styles.emoji}>{mood.emoji}</Text>
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
  container: {
    gap: spacing.lg,
  },
  title: {
    ...font.sectionTitle,
  },
  buttons: {
    flexDirection: 'row',
    gap: spacing.md,
  },
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
  emoji: {
    fontSize: 32,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
});
