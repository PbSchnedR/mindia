import React from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { colors, spacing, radius } from '@/constants/tokens';

type TabKey = string;

export interface PrimaryTabsProps {
  tabs: { key: TabKey; label: string }[];
  activeKey: TabKey;
  onChange: (key: TabKey) => void;
  style?: ViewStyle;
}

export function PrimaryTabs({ tabs, activeKey, onChange, style }: PrimaryTabsProps) {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.inner}>
        {tabs.map((tab) => {
          const active = tab.key === activeKey;
          return (
            <Pressable
              key={tab.key}
              onPress={() => onChange(tab.key)}
              style={[styles.tab, active && styles.tabActive]}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>
                {tab.label}
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
    paddingHorizontal: spacing['2xl'],
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  inner: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.bgTertiary,
    borderRadius: radius.full,
    padding: 4,
  },
  tab: {
    paddingVertical: 10,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.full,
  },
  tabActive: {
    backgroundColor: colors.bg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textTertiary,
  },
  tabTextActive: {
    color: colors.text,
  },
});
