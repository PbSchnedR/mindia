import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useThemeColor } from '@/hooks/use-theme-color';
import type { Severity } from '@/lib/types';

export function SeverityBadge({ severity }: { severity?: Severity }) {
  const text = useThemeColor({}, 'text');

  const s = severity ?? 0;
  const { label, bg } =
    s === 3
      ? { label: 'Élevé', bg: '#FEE2E2' }
      : s === 2
        ? { label: 'Moyen', bg: '#FEF3C7' }
        : s === 1
          ? { label: 'Faible', bg: '#DCFCE7' }
          : { label: '—', bg: 'rgba(120,120,120,0.12)' };

  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.text, { color: text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 12,
    fontWeight: '700',
  },
});

