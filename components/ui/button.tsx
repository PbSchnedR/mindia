import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  type PressableProps,
  ActivityIndicator,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, font } from '@/constants/tokens';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'soft';

export type ButtonProps = PressableProps & {
  title: string;
  variant?: Variant;
  loading?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  size?: 'sm' | 'md' | 'lg';
};

const VARIANT_STYLES: Record<Variant, { bg: string; border?: string; text: string }> = {
  primary: { bg: colors.primary, text: colors.textOnPrimary },
  secondary: { bg: 'transparent', border: colors.border, text: colors.text },
  danger: { bg: colors.error, text: colors.textOnPrimary },
  ghost: { bg: 'transparent', text: colors.textSecondary },
  soft: { bg: colors.primaryLight, text: colors.primary },
};

export function Button({
  title,
  variant = 'primary',
  loading,
  disabled,
  icon,
  size = 'md',
  style,
  ...rest
}: ButtonProps) {
  const v = VARIANT_STYLES[variant];
  const isDisabled = disabled || loading;

  const containerStyle: ViewStyle = {
    backgroundColor: v.bg,
    ...(v.border ? { borderColor: v.border, borderWidth: 1.5 } : {}),
  };

  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        size === 'sm' && styles.baseSm,
        size === 'lg' && styles.baseLg,
        containerStyle,
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
        style as ViewStyle,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={v.text} size="small" />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={size === 'sm' ? 16 : size === 'lg' ? 20 : 18} color={v.text} />}
          <Text
            style={[
              size === 'sm' ? styles.labelSm : size === 'lg' ? styles.labelLg : styles.label,
              { color: v.text },
            ]}
          >
            {title}
          </Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 48,
    paddingHorizontal: spacing['2xl'],
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  baseSm: {
    height: 38,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.sm,
  },
  baseLg: {
    height: 56,
    paddingHorizontal: spacing['3xl'],
    borderRadius: radius.lg,
  },
  label: {
    ...font.button,
  },
  labelSm: {
    ...font.buttonSm,
  },
  labelLg: {
    ...font.button,
    fontSize: 16,
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  disabled: {
    opacity: 0.45,
  },
});
