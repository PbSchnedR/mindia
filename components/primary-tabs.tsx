import React from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';

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
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
  },
  tab: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: '#F1F5F9',
  },
  tabActive: {
    backgroundColor: '#2563EB',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
});

