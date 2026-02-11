import React from 'react';
import { View, Text, StyleSheet, Pressable, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, shadows, font } from '@/constants/tokens';

interface SectionCardProps {
  children: React.ReactNode;
  title?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  action?: { label: string; onPress: () => void };
  style?: ViewStyle;
  variant?: 'default' | 'elevated' | 'highlight' | 'dark' | 'glass';
}

export function SectionCard({
  children,
  title,
  icon,
  iconColor = colors.primary,
  action,
  style,
  variant = 'default',
}: SectionCardProps) {
  const vs = variantStyles[variant];

  return (
    <View style={[styles.card, vs, style]}>
      {(title || action) && (
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {icon && (
              <View style={[styles.iconContainer, { backgroundColor: `${iconColor}14` }]}>
                <Ionicons name={icon} size={18} color={iconColor} />
              </View>
            )}
            {title && (
              <Text style={[styles.title, variant === 'dark' && styles.titleDark]}>
                {title}
              </Text>
            )}
          </View>
          {action && (
            <Pressable onPress={action.onPress} hitSlop={8}>
              <Text style={styles.actionText}>{action.label}</Text>
            </Pressable>
          )}
        </View>
      )}
      {children}
    </View>
  );
}

const variantStyles: Record<string, ViewStyle> = {
  default: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  elevated: {
    backgroundColor: colors.bg,
    ...shadows.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  highlight: {
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.primaryMedium,
  },
  dark: {
    backgroundColor: colors.bgDark,
  },
  glass: {
    backgroundColor: colors.bgGlass,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
};

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xl,
    padding: spacing.xl,
    gap: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  iconContainer: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    ...font.sectionTitle,
    flex: 1,
  },
  titleDark: {
    color: colors.textOnDark,
  },
  actionText: {
    ...font.label,
    color: colors.primary,
  },
});
