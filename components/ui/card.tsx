import React from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';
import { colors, radius, spacing, shadows } from '@/constants/tokens';

export function Card({ style, ...rest }: ViewProps) {
  return <View style={[styles.card, style]} {...rest} />;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bgSecondary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
