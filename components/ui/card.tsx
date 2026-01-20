import React from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';

import { useThemeColor } from '@/hooks/use-theme-color';

export function Card({ style, ...rest }: ViewProps) {
  const bg = useThemeColor({}, 'background');
  return <View style={[styles.card, { backgroundColor: bg }, style]} {...rest} />;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(120,120,120,0.25)',
  },
});

