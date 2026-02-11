import React from 'react';
import { View, Text, Pressable, StyleSheet, type ViewStyle } from 'react-native';
import { colors, spacing, radius, shadows } from '@/constants/tokens';

interface ToggleGroupProps<T extends string> {
  options: { key: T; label: string }[];
  value: T;
  onChange: (key: T) => void;
  style?: ViewStyle;
}

export function ToggleGroup<T extends string>({
  options,
  value,
  onChange,
  style,
}: ToggleGroupProps<T>) {
  return (
    <View style={[styles.container, style]}>
      {options.map((option) => {
        const active = option.key === value;
        return (
          <Pressable
            key={option.key}
            style={[styles.button, active && styles.buttonActive]}
            onPress={() => onChange(option.key)}
          >
            <Text style={[styles.text, active && styles.textActive]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.borderLight,
    borderRadius: radius.md,
    padding: 4,
  },
  button: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  buttonActive: {
    backgroundColor: colors.bg,
    ...shadows.sm,
  },
  text: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  textActive: {
    color: colors.primary,
  },
});
