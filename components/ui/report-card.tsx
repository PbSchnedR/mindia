import React from 'react';
import { View, Text, StyleSheet, Pressable, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, shadows, font } from '@/constants/tokens';

interface ReportCardProps {
  content: string;
  date: string;
  from: 'therapist' | 'ai';
  onPress?: () => void;
  style?: ViewStyle;
}

export function ReportCard({ content, date, from, onPress, style }: ReportCardProps) {
  const Wrapper = onPress ? Pressable : View;
  const isAI = from === 'ai';
  return (
    <Wrapper
      style={[styles.card, style]}
      {...(onPress ? { onPress } : {})}
    >
      <View style={styles.header}>
        <View style={[styles.badge, isAI && styles.badgeAi]}>
          <Ionicons
            name={isAI ? 'sparkles' : 'person'}
            size={12}
            color={isAI ? colors.ai : colors.primary}
          />
          <Text style={[styles.badgeText, isAI && styles.badgeTextAi]}>
            {isAI ? 'IA' : 'Thérapeute'}
          </Text>
        </View>
        <Text style={styles.date}>{date}</Text>
      </View>
      <Text style={styles.content} numberOfLines={5}>
        {content}
      </Text>
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bg,
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 1,
    borderRadius: radius.full,
  },
  badgeAi: {
    backgroundColor: colors.aiLight,
  },
  badgeText: {
    ...font.caption,
    color: colors.primary,
    fontWeight: '600',
  },
  badgeTextAi: {
    color: colors.ai,
  },
  date: {
    ...font.caption,
  },
  content: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 21,
  },
});
