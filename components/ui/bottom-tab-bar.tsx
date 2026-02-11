import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, shadows } from '@/constants/tokens';

export interface TabItem {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconActive: keyof typeof Ionicons.glyphMap;
}

interface BottomTabBarProps {
  tabs: TabItem[];
  activeKey: string;
  onChange: (key: string) => void;
}

export function BottomTabBar({ tabs, activeKey, onChange }: BottomTabBarProps) {
  return (
    <View style={styles.outer}>
      <View style={styles.container}>
        {tabs.map((tab) => {
          const active = tab.key === activeKey;
          return (
            <Pressable
              key={tab.key}
              style={styles.tab}
              onPress={() => onChange(tab.key)}
            >
              <View style={[styles.iconWrap, active && styles.iconWrapActive]}>
                <Ionicons
                  name={active ? tab.iconActive : tab.icon}
                  size={20}
                  color={active ? colors.primary : colors.textTertiary}
                />
              </View>
              <Text style={[styles.label, active && styles.labelActive]}>
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
  outer: {
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingBottom: spacing.xs,
    ...shadows.top,
  },
  container: {
    flexDirection: 'row',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  iconWrap: {
    width: 40,
    height: 28,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: {
    backgroundColor: colors.primaryLight,
  },
  label: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.textTertiary,
  },
  labelActive: {
    color: colors.primary,
    fontWeight: '600',
  },
});
