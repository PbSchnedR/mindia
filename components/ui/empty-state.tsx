import React from 'react';
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, font } from '@/constants/tokens';

interface EmptyStateProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  style?: ViewStyle;
}

export function EmptyState({ icon, title, subtitle, action, style }: EmptyStateProps) {
  return (
    <View style={[styles.container, style]}>
      <Ionicons name={icon} size={48} color={colors.placeholder} />
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: spacing['4xl'],
    paddingHorizontal: spacing.xl,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: colors.textTertiary,
    textAlign: 'center',
    lineHeight: 20,
  },
  action: {
    marginTop: spacing.lg,
  },
});
